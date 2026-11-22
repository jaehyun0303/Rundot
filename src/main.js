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

  function startRun() {
    run = new RD.Run(RD.CHARACTERS[selected].id);
    scene = "play";
  }

  function endRun() {
    scene = "result";
    run.newBest = run.score > best;
    if (run.newBest) { best = run.score; RD.best = best; save.set("best", best); }
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

  function drawSelect() {
    menuT += 1 / 60;
    RD.drawBackground(g, menuT * 120);
    g.fillStyle = "rgba(10,8,20,0.45)";
    g.fillRect(0, 0, C.width, C.height);
    RD.text(g, "RUNDOT", C.width / 2, 52, 52, "#ffd34d", "center");
    RD.text(g, "출격할 캐릭터를 고르세요", C.width / 2, 98, 20, "#fff", "center");

    const cw = 164, chh = 240, gap = 14;
    const x0 = (C.width - (cw * 5 + gap * 4)) / 2;
    RD.CHARACTERS.forEach((ch, i) => {
      const x = x0 + i * (cw + gap), y = 126;
      const sel = i === selected;
      g.fillStyle = sel ? "#ffd34d" : "#1d1622";
      g.fillRect(x - 4, y - 4 - (sel ? 6 : 0), cw + 8, chh + 8);
      g.fillStyle = "#2b2140";
      g.fillRect(x, y - (sel ? 6 : 0), cw, chh);
      const im = RD.img(ch.illust);
      if (im && im.width) {
        // 일러스트 가운데(캐릭터) 부분만 잘라서 보여 준다
        const sw = im.height * (cw / 170), sx = (im.width - sw) / 2;
        g.imageSmoothingEnabled = true;
        g.drawImage(im, sx, 0, sw, im.height, x, y - (sel ? 6 : 0), cw, 170);
        g.imageSmoothingEnabled = false;
      }
      RD.text(g, ch.name, x + cw / 2, y + 190 - (sel ? 6 : 0), 17, sel ? "#ffd34d" : "#fff", "center");
      RD.text(g, `${ch.type} · ${ch.shot.name}`, x + cw / 2, y + 212 - (sel ? 6 : 0), 13, "#ffc49a", "center");
      RD.text(g, "폭탄: " + ch.bomb.name, x + cw / 2, y + 230 - (sel ? 6 : 0), 13, "#9fd0ff", "center");
      buttons.push({ x, y, w: cw, h: chh, onClick: () => { if (selected === i) startRun(); selected = i; save.set("char", i); } });
    });

    const ch = RD.CHARACTERS[selected];
    // 선택한 캐릭터의 인게임 도트 모습 미리보기
    const spr = RD.getCharacterFrame(ch.id, ch.id === "owl" ? "run" : "jump", Math.floor(menuT * 10) % 4);
    g.drawImage(spr, 40, 380, 120, 120);
    RD.text(g, ch.desc, 175, 432, 18, "#fff");
    RD.text(g, `최고 점수 ${best.toLocaleString()}`, 175, 466, 16, "#ffd34d");
    button(C.width - 250, 410, 210, 72, "출격!", startRun);
  }

  function drawResult() {
    RD.drawRun(g, run);
    g.fillStyle = "rgba(10,8,20,0.7)";
    g.fillRect(0, 0, C.width, C.height);
    RD.text(g, "GAME OVER", C.width / 2, 110, 48, "#ff4d5e", "center");
    RD.text(g, run.score.toLocaleString() + " 점", C.width / 2, 200, 56, "#fff", "center");
    if (run.newBest) RD.text(g, "최고 기록!", C.width / 2, 254, 24, "#ff8a3d", "center");
    RD.text(g, `격추 ${run.kills}   도달 ${run.loop}주차`, C.width / 2, 300, 22, "#ffd34d", "center");
    button(C.width / 2 - 230, 380, 210, 70, "다시 출격", startRun);
    button(C.width / 2 + 20, 380, 210, 70, "캐릭터 선택", () => { scene = "select"; }, "#5b8ff0");
  }

  function drawTouchHints() {
    if (!isTouch()) {
      if (run.t < 6) RD.text(g, "이동: 방향키 / WASD    정밀 이동: Shift    폭탄: X    사격은 자동", C.width / 2, C.height - 18, 14, "rgba(255,255,255,0.8)", "center");
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
      if (run.over && run.overTimer > 1.5) endRun();
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
