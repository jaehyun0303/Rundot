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
  let totalCoins = save.get("coins", 0);
  let menuT = 0;
  let buttons = []; // 이번 프레임에 그린 클릭 영역

  function startRun() {
    run = new RD.Run(RD.CHARACTERS[selected].id);
    scene = "play";
  }

  function endRun() {
    scene = "result";
    totalCoins += run.coins;
    save.set("coins", totalCoins);
    run.newBest = run.score > best;
    if (run.newBest) { best = run.score; save.set("best", best); }
  }

  // ---------- 입력 ----------
  const keys = { jump: ["Space", "ArrowUp", "KeyW"], slide: ["ArrowDown", "KeyS"], attack: ["KeyX", "KeyJ", "ArrowRight", "KeyD"] };
  addEventListener("keydown", (e) => {
    if ([...keys.jump, ...keys.slide, ...keys.attack].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    if (scene === "play") {
      if (keys.jump.includes(e.code)) { run.input.jumpHeld = true; run.jump(); }
      if (keys.slide.includes(e.code)) run.input.slideHeld = true;
      if (keys.attack.includes(e.code)) { run.input.attackHeld = true; run.attack(); }
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
  addEventListener("keyup", (e) => {
    if (scene !== "play") return;
    if (keys.jump.includes(e.code)) run.input.jumpHeld = false;
    if (keys.slide.includes(e.code)) run.input.slideHeld = false;
    if (keys.attack.includes(e.code)) run.input.attackHeld = false;
  });

  function toGame(e) {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * C.width, y: ((e.clientY - r.top) / r.height) * C.height };
  }
  const pointers = new Map(); // 터치마다 점프/슬라이드 중 무엇을 누르고 있는지
  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    const pt = toGame(e);
    if (scene === "play") {
      // 왼쪽 절반 = 슬라이드, 오른쪽 위 = 공격, 오른쪽 아래 = 점프
      const action = pt.x < C.width / 2 ? "slide" : pt.y < C.height * 0.5 ? "attack" : "jump";
      pointers.set(e.pointerId, action);
      RD.press(action, true);
      return;
    }
    for (const b of buttons) {
      if (pt.x >= b.x && pt.x <= b.x + b.w && pt.y >= b.y && pt.y <= b.y + b.h) { b.onClick(); break; }
    }
  });
  const release = (e) => {
    const action = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    if (!run || !action) return;
    if (![...pointers.values()].includes(action)) RD.press(action, false);
  };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);

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
    RD.text(g, "달릴 캐릭터를 고르세요", C.width / 2, 98, 20, "#fff", "center");

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
      RD.text(g, "공격: " + ch.attack.name, x + cw / 2, y + 212 - (sel ? 6 : 0), 13, "#ffc49a", "center");
      RD.text(g, "스킬: " + ch.skill, x + cw / 2, y + 230 - (sel ? 6 : 0), 13, "#9fd0ff", "center");
      buttons.push({ x, y, w: cw, h: chh, onClick: () => { if (selected === i) startRun(); selected = i; save.set("char", i); } });
    });

    const ch = RD.CHARACTERS[selected];
    // 선택한 캐릭터의 인게임 도트 모습 미리보기
    const spr = RD.getCharacterFrame(ch.id, "run", Math.floor(menuT * 10) % 4);
    g.drawImage(spr, 40, 380, 120, 120);
    RD.text(g, ch.desc, 175, 432, 18, "#fff");
    RD.text(g, `최고 점수 ${best.toLocaleString()}   코인 ${totalCoins.toLocaleString()}`, 175, 466, 16, "#ffd34d");
    button(C.width - 250, 410, 210, 72, "달리기!", startRun);
  }

  function drawResult() {
    RD.drawRun(g, run);
    g.fillStyle = "rgba(10,8,20,0.7)";
    g.fillRect(0, 0, C.width, C.height);
    RD.text(g, "결과", C.width / 2, 110, 44, "#ffd34d", "center");
    RD.text(g, run.score.toLocaleString() + " 점", C.width / 2, 200, 56, "#fff", "center");
    if (run.newBest) RD.text(g, "최고 기록!", C.width / 2, 254, 24, "#ff8a3d", "center");
    RD.text(g, `코인 +${run.coins}   처치 ${run.kills}마리   거리 ${Math.floor(run.player.x / 100)}m`, C.width / 2, 300, 22, "#ffd34d", "center");
    button(C.width / 2 - 230, 380, 210, 70, "다시 달리기", startRun);
    button(C.width / 2 + 20, 380, 210, 70, "캐릭터 선택", () => { scene = "select"; }, "#5b8ff0");
  }

  function drawTouchHints() {
    if (!matchMedia("(pointer: coarse)").matches) {
      RD.text(g, "점프: Space / ↑    슬라이드: ↓    공격: X / →", C.width / 2, C.height - 18, 14, "rgba(255,255,255,0.7)", "center");
      return;
    }
    g.globalAlpha = 0.35;
    g.fillStyle = "#1d1622";
    g.beginPath(); g.arc(80, C.height - 70, 44, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(C.width - 80, C.height - 70, 44, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(C.width - 80, C.height * 0.5 - 70, 44, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1;
    RD.text(g, "공격", C.width - 80, C.height * 0.5 - 70, 18, "#fff", "center");
    RD.text(g, "슬라이드", 80, C.height - 70, 16, "#fff", "center");
    RD.text(g, "점프", C.width - 80, C.height - 70, 18, "#fff", "center");
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
      if (run.over && run.overTimer > 1.2) endRun();
    } else if (scene === "result") {
      drawResult();
    }
    requestAnimationFrame(frame);
  }

  load().then(() => { scene = "select"; });
  requestAnimationFrame(frame);
  // 화면 밖 버튼(세로 화면용 점프/슬라이드 버튼)에서 쓰는 입력
  RD.press = (action, down) => {
    if (scene !== "play" || !run) return;
    if (action === "jump") { run.input.jumpHeld = down; if (down) run.jump(); }
    else if (action === "attack") { run.input.attackHeld = down; if (down) run.attack(); }
    else run.input.slideHeld = down;
  };
  RD.debugState = () => ({ scene, run });
  RD.startRun = (i) => { selected = i; startRun(); };
})();
