// 시작점: 이미지 로딩, 화면 전환(캐릭터 선택 → 게임 → 결과), 입력, 게임 루프
(function () {
  const C = RD.CONFIG;
  const canvas = document.getElementById("game");
  const g = canvas.getContext("2d");
  canvas.width = C.width;
  canvas.height = C.height;

  // ---------- 저장 (최고 점수, 코인) ----------
  const save = {
    get(k, d) { try { const v = localStorage.getItem("rundot_" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem("rundot_" + k, JSON.stringify(v)); } catch { /* 저장 불가 환경 */ } },
  };

  // ---------- 이미지 ----------
  const images = {};
  RD.img = (name) => images[name];
  function load() {
    const names = [...RD.IMAGES, ...RD.ILLUSTS];
    let done = 0;
    return Promise.all(names.map((n) => new Promise((res) => {
      const im = new Image();
      const dir = n.startsWith("illust_") ? "assets/raw/" : "assets/game/";
      im.onload = () => { done++; res(); };
      im.onerror = () => { console.warn("이미지 없음:", n); done++; res(); };
      im.src = dir + n + ".png";
      images[n] = im;
    })));
  }

  // ---------- 상태 ----------
  let scene = "loading";
  let selected = save.get("char", 0);
  let run = null;
  let best = save.get("best", 0);
  RD.best = best;
  let menuT = 0;
  let buttons = []; // 이번 프레임에 그린 클릭 영역

  const MODE_IDS = Object.keys(RD.MODES);
  const DIFF_IDS = Object.keys(RD.DIFFICULTY);
  let mode = MODE_IDS.includes(save.get("mode")) ? save.get("mode") : "story";
  let diff = DIFF_IDS.includes(save.get("diff")) ? save.get("diff") : "normal";
  // 최고 점수는 모드와 난이도마다 따로
  const bestKey = () => `best_${mode}_${diff}`;
  const loadBest = () => { best = save.get(bestKey(), 0); RD.best = best; };
  loadBest();

  function startRun() {
    run = new RD.Run(RD.CHARACTERS[selected].id, mode, diff);
    scene = "play";
  }

  function endRun() {
    scene = "result";
    run.newBest = run.score > best;
    if (run.newBest) { best = run.score; RD.best = best; save.set(bestKey(), best); }
  }

  // ---------- 입력 ----------
  // 키보드: 방향키/WASD 이동, Shift 정밀 이동, X/Space 폭탄. 사격은 자동.
  const held = new Set();
  const MOVE = { ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0], ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1] };
  function syncKeys() {
    if (!run) return;
    let dx = 0, dy = 0;
    for (const k of held) if (MOVE[k]) { dx += MOVE[k][0]; dy += MOVE[k][1]; }
    const len = Math.hypot(dx, dy) || 1;
    run.input.dx = dx / len;
    run.input.dy = dy / len;
    run.input.focus = held.has("ShiftLeft") || held.has("ShiftRight");
  }
  addEventListener("keydown", (e) => {
    if (MOVE[e.code] || e.code === "Space") e.preventDefault();
    held.add(e.code);
    syncKeys();
    if (e.repeat) return;
    if (scene === "play" && run.choosing) {
      const n = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 }[e.code];
      if (n != null) run.choose(n);
      if (e.code === "ArrowLeft" || e.code === "KeyA") run.choosing.sel = ((run.choosing.sel ?? 1) + 2) % 3;
      if (e.code === "ArrowRight" || e.code === "KeyD") run.choosing.sel = ((run.choosing.sel ?? 1) + 1) % 3;
      if (e.code === "Enter" || e.code === "Space") run.choose(run.choosing.sel ?? 1);
      return;
    }
    if (scene === "play") {
      if (e.code === "KeyX" || e.code === "Space" || e.code === "KeyK") run.bomb();
      if (e.code === "KeyB") RD.debug = !RD.debug;
    } else if (scene === "select") {
      if (e.code === "ArrowLeft") selected = (selected + 4) % 5;
      if (e.code === "ArrowRight") selected = (selected + 1) % 5;
      if (e.code === "Enter" || e.code === "Space") startRun();
    } else if (scene === "result") {
      if (e.code === "Enter" || e.code === "Space") startRun();
      if (e.code === "Escape") scene = "select";
    }
  });
  addEventListener("keyup", (e) => { held.delete(e.code); syncKeys(); });
  addEventListener("blur", () => { held.clear(); syncKeys(); });

  function toGame(e) {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * C.width, y: ((e.clientY - r.top) / r.height) * C.height };
  }
  const BOMB_BTN = { x: C.width - 70, y: C.height - 70, r: 46 }; // 가로 화면 터치용 폭탄 버튼
  const isTouch = () => matchMedia("(pointer: coarse)").matches;

  // 터치/마우스: 화면 아무 데나 대고 끌면, 끈 만큼 캐릭터가 움직인다 (상대 이동)
  let drag = null;
  canvas.addEventListener("pointerdown", (e) => {
    if (scene === "play") return; // 플레이 중에는 아래 window 핸들러가 처리
    e.preventDefault();
    const pt = toGame(e);
    for (const b of buttons) {
      if (pt.x >= b.x && pt.x <= b.x + b.w && pt.y >= b.y && pt.y <= b.y + b.h) { b.onClick(); break; }
    }
  });
  addEventListener("pointerdown", (e) => {
    if (scene !== "play" || !run) return;
    if (e.target.closest && e.target.closest("button")) return; // 화면 밖 폭탄 버튼
    const pt = toGame(e);
    if (run.choosing) {
      // 강화 카드 고르기 (선택 직후 실수로 눌리지 않게 0.35초 기다림)
      if (run.choosing.t < 0.35) return;
      RD.cardRects.forEach((r, i) => { if (pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h) run.choose(i); });
      return;
    }
    if (isTouch() && Math.hypot(pt.x - BOMB_BTN.x, pt.y - BOMB_BTN.y) < BOMB_BTN.r && e.target === canvas) { run.bomb(); return; }
    if (drag) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
  });
  addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id || !run) return;
    const r = canvas.getBoundingClientRect();
    // 세로 화면은 캔버스가 작아서 덜 민감하게
    const k = (C.width / r.width) * (innerHeight > innerWidth ? 0.75 : C.touchSensitivity);
    run.input.moveX += (e.clientX - drag.x) * k;
    run.input.moveY += (e.clientY - drag.y) * k;
    drag.x = e.clientX;
    drag.y = e.clientY;
  });
  const endDrag = (e) => { if (drag && e.pointerId === drag.id) drag = null; };
  addEventListener("pointerup", endDrag);
  addEventListener("pointercancel", endDrag);

  // ---------- 화면들 ----------
  function button(x, y, w, h, label, onClick, color = "#ff8a3d") {
    g.fillStyle = "#1d1622";
    g.fillRect(x - 3, y - 3, w + 6, h + 6);
    g.fillStyle = color;
    g.fillRect(x, y, w, h);
    g.fillStyle = "rgba(255,255,255,0.25)";
    g.fillRect(x, y, w, h / 3);
    RD.text(g, label, x + w / 2, y + h / 2 + 1, Math.min(28, h * 0.5), "#fff", "center");
    buttons.push({ x, y, w, h, onClick });
  }

  function tab(x, y, w, h, label, active, color, onClick) {
    g.fillStyle = "#1d1622";
    g.fillRect(x - 2, y - 2, w + 4, h + 4);
    g.fillStyle = active ? color : "#2b2140";
    g.fillRect(x, y, w, h);
    RD.text(g, label, x + w / 2, y + h / 2 + 1, 15, active ? "#1d1622" : "#cfc6e0", "center", active ? color : "#1d1622");
    buttons.push({ x, y, w, h, onClick });
  }

  function drawSelect() {
    menuT += 1 / 60;
    RD.drawBackground(g, menuT * 120);
    g.fillStyle = "rgba(10,8,20,0.5)";
    g.fillRect(0, 0, C.width, C.height);
    RD.text(g, "RUNDOT", 24, 34, 36, "#ffd34d");

    // 모드
    RD.text(g, "모드", 200, 34, 14, "#9fd0ff");
    MODE_IDS.forEach((id, i) => tab(240 + i * 118, 20, 110, 30, RD.MODES[id].name, id === mode, "#7fe6ff", () => { mode = id; save.set("mode", id); loadBest(); }));
    // 난이도
    RD.text(g, "난이도", 186, 76, 14, "#9fd0ff");
    DIFF_IDS.forEach((id, i) => {
      const D = RD.DIFFICULTY[id];
      tab(240 + i * 118, 62, 110, 30, D.name, id === diff, D.color, () => { diff = id; save.set("diff", id); loadBest(); });
    });
    const D = RD.DIFFICULTY[diff];
    RD.text(g, `${RD.MODES[mode].desc}  ·  잔기 ${D.lives}  ·  적 체력 x${D.enemyHp}  ·  받는 피해 x${D.damage}  ·  점수 x${D.score}`, C.width / 2, 116, 13, "#e8e0f5", "center");

    // 캐릭터
    const cw = 172, chh = 232, gap = 12;
    const x0 = (C.width - (cw * 5 + gap * 4)) / 2;
    RD.CHARACTERS.forEach((ch, i) => {
      const sel = i === selected;
      const x = x0 + i * (cw + gap), y = 140 - (sel ? 5 : 0);
      g.fillStyle = sel ? "#ffd34d" : "#1d1622";
      g.fillRect(x - 4, y - 4, cw + 8, chh + 8);
      g.fillStyle = "#2b2140";
      g.fillRect(x, y, cw, chh);
      const im = RD.img(ch.illust);
      if (im && im.width) {
        const sw = im.height * (cw / 150), sx = (im.width - sw) / 2;
        g.imageSmoothingEnabled = true;
        g.drawImage(im, sx, 0, sw, im.height, x, y, cw, 150);
        g.imageSmoothingEnabled = false;
      }
      RD.text(g, ch.name, x + cw / 2, y + 166, 16, sel ? "#ffd34d" : "#fff", "center");
      RD.text(g, `${ch.type} · ${ch.shot.name}`, x + cw / 2, y + 187, 12, "#ffc49a", "center");
      RD.text(g, "전용: " + ch.sig.name, x + cw / 2, y + 204, 12, "#ffd34d", "center");
      RD.text(g, "폭탄: " + ch.bomb.name, x + cw / 2, y + 221, 12, "#9fd0ff", "center");
      buttons.push({ x, y, w: cw, h: chh, onClick: () => { if (selected === i) startRun(); selected = i; save.set("char", i); } });
    });

    const ch = RD.CHARACTERS[selected];
    const spr = RD.getCharacterFrame(ch.id, ch.id === "owl" ? "run" : "jump", Math.floor(menuT * 10) % 4);
    g.drawImage(spr, 24, 392, 110, 110);
    RD.text(g, ch.desc, 145, 420, 16, "#fff");
    RD.text(g, `전용 강화 · ${ch.sig.name}: ${ch.sig.desc}`, 145, 446, 13, "#ffd34d");
    RD.text(g, `최고 점수 (${RD.MODES[mode].name} · ${D.name}) ${best.toLocaleString()}`, 145, 472, 13, "#9fd0ff");
    button(C.width - 230, 412, 200, 70, "출격!", startRun);
  }

  function drawResult() {
    RD.drawRun(g, run);
    g.fillStyle = "rgba(10,8,20,0.72)";
    g.fillRect(0, 0, C.width, C.height);
    const title = run.win ? (run.mode === "timeattack" ? "TIME UP" : "ALL CLEAR!") : "GAME OVER";
    RD.text(g, title, C.width / 2, 96, 48, run.win ? "#ffd34d" : "#ff4d5e", "center");
    RD.text(g, `${RD.MODES[run.mode].name} · ${run.D.name}`, C.width / 2, 140, 18, run.D.color, "center");
    RD.text(g, run.score.toLocaleString() + " 점", C.width / 2, 200, 52, "#fff", "center");
    if (run.newBest) RD.text(g, "최고 기록!", C.width / 2, 248, 22, "#ff8a3d", "center");
    const reach = run.mode === "story" ? `스테이지 ${run.loop}` : run.mode === "bossrush" ? `${run.loop}라운드` : `${Math.floor(run.t)}초 생존`;
    RD.text(g, `격추 ${run.kills}   Lv.${run.level}   ${reach}`, C.width / 2, 290, 20, "#ffd34d", "center");
    // 고른 강화 목록
    const ups = RD.UPGRADES.filter((u) => run.lv(u.id)).map((u) => `${u.id === "sig" ? run.char.sig.name : u.name} ${run.lv(u.id)}`);
    RD.text(g, ups.join(" · ") || "강화 없음", C.width / 2, 328, 13, "#cfd8ff", "center");
    button(C.width / 2 - 230, 390, 210, 66, "다시 출격", startRun);
    button(C.width / 2 + 20, 390, 210, 66, "메뉴로", () => { scene = "select"; }, "#5b8ff0");
  }

  function drawTouchHints() {
    if (run.choosing) return;
    if (!isTouch()) {
      if (run.t < 6) RD.text(g, "이동: 방향키 / WASD    정밀 이동: Shift    폭탄: X    사격은 자동", C.width / 2, C.height - 50, 14, "rgba(255,255,255,0.8)", "center");
      return;
    }
    if (run.t < 5) RD.text(g, "화면을 대고 끌어서 이동 · 사격은 자동", C.width / 2, C.height / 2 + 90, 18, "#fff", "center");
    g.globalAlpha = 0.45;
    g.fillStyle = "#1d1622";
    g.beginPath(); g.arc(BOMB_BTN.x, BOMB_BTN.y, BOMB_BTN.r, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1;
    g.strokeStyle = "#4aa8ff"; g.lineWidth = 3;
    g.beginPath(); g.arc(BOMB_BTN.x, BOMB_BTN.y, BOMB_BTN.r, 0, Math.PI * 2); g.stroke();
    RD.text(g, "폭탄", BOMB_BTN.x, BOMB_BTN.y - 8, 17, "#fff", "center");
    RD.text(g, "x" + run.bombs, BOMB_BTN.x, BOMB_BTN.y + 14, 15, "#9fd0ff", "center");
  }

  // ---------- 루프 ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    buttons = [];
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, C.width, C.height);

    if (scene === "loading") {
      g.fillStyle = "#120c1c";
      g.fillRect(0, 0, C.width, C.height);
      RD.text(g, "불러오는 중...", C.width / 2, C.height / 2, 28, "#fff", "center");
    } else if (scene === "select") {
      drawSelect();
    } else if (scene === "play") {
      run.update(dt);
      RD.drawRun(g, run);
      drawTouchHints();
      if (run.over && run.overTimer > (run.win ? 3 : 1.5)) endRun();
    } else if (scene === "result") {
      drawResult();
    }
    requestAnimationFrame(frame);
  }

  load().then(() => { scene = "select"; });
  requestAnimationFrame(frame);
  // 화면 밖 버튼(세로 화면용 폭탄 버튼)에서 쓰는 입력
  RD.press = (action, down) => {
    if (scene !== "play" || !run || !down) return;
    if (action === "bomb") run.bomb();
  };
  RD.debugState = () => ({ scene, run });
  RD.startRun = (i) => { selected = i; startRun(); };
})();
