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
  // ---------- 보유 캐릭터와 코인 (뽑기) ----------
  const G = RD.GACHA;
  let owned = save.get("owned", null); // 캐릭터 id → 별(각성) 단계
  if (!owned) { owned = {}; RD.CHARACTERS.forEach((c) => { if (c.starter) owned[c.id] = 1; }); save.set("owned", owned); }
  let coins = save.get("coins", null);
  if (coins == null) { coins = G.startCoins; save.set("coins", coins); }
  let pity = save.get("pity", 0);
  const isOwned = (i) => !!owned[RD.CHARACTERS[i].id];
  let selected = save.get("char", 0);
  if (!RD.CHARACTERS[selected] || !isOwned(selected)) selected = 0;
  let gachaResult = null; // 뽑기 결과 연출
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
  let maxStage = save.get("maxStage", 0); // 스토리에서 도달한 지역 (스테이지 선택에서 고를 수 있다)
  let pickStage = Math.min(save.get("pickStage", 0), maxStage);
  const bestKey = () => `best_${mode}_${diff}` + (mode === "stageselect" ? "_" + pickStage : "");
  const loadBest = () => { best = save.get(bestKey(), 0); RD.best = best; };
  loadBest();


  function startRun() {
    const id = RD.CHARACTERS[selected].id;
    run = new RD.Run(id, mode, diff, { stars: owned[id] || 1, stage: mode === "stageselect" ? pickStage : 0 });
    scene = "play";
  }

  function endRun() {
    scene = "result";
    if (["story", "hardcore"].includes(run.mode) && run.reached > maxStage) {
      maxStage = Math.min(RD.STAGES.length - 1, run.reached);
      save.set("maxStage", maxStage);
    }
    coins += run.coins;
    save.set("coins", coins);
    run.newBest = run.score > best;
    if (run.newBest) { best = run.score; RD.best = best; save.set(bestKey(), best); }
  }

  // ---------- 뽑기 ----------
  function rollOne(forceMin) {
    let grade;
    if (pity >= G.pity - 1) grade = "SSR";
    else {
      const r = Math.random();
      grade = r < G.rates.SSR ? "SSR" : r < G.rates.SSR + G.rates.SR ? "SR" : r < G.rates.SSR + G.rates.SR + G.rates.R ? "R" : "C";
    }
    if (forceMin && grade === "C") grade = "R";
    pity = grade === "SSR" ? 0 : pity + 1;
    const pool = RD.CHARACTERS.filter((c) => c.grade === grade);
    const ch = pool[Math.floor(Math.random() * pool.length)];
    let kind;
    if (!owned[ch.id]) { owned[ch.id] = 1; kind = "new"; }
    else if (owned[ch.id] < G.maxStars) { owned[ch.id]++; kind = "star"; }
    else { coins += 50; kind = "refund"; }
    return { ch, grade, kind, stars: owned[ch.id] };
  }

  function gacha(n) {
    const cost = n === 10 ? G.cost10 : G.cost1;
    if (coins < cost) return;
    coins -= cost;
    const list = [];
    for (let i = 0; i < n; i++) list.push(rollOne(false));
    // 10회 뽑기는 희귀 이상 1개 보장
    if (n === 10 && !list.some((r) => r.grade !== "C")) {
      const last = list.pop();
      if (last.kind === "new") delete owned[last.ch.id];
      if (last.kind === "star") owned[last.ch.id]--;
      if (last.kind === "refund") coins -= 50;
      pity = Math.max(0, pity - 1);
      list.push(rollOne(true));
    }
    save.set("owned", owned);
    save.set("coins", coins);
    save.set("pity", pity);
    gachaResult = { list, t: 0 };
    RD.audio && RD.audio.sfx(list.some((r) => r.grade === "SSR" || r.grade === "SR") ? "gacha_rare" : "gacha");
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
  // 브라우저는 사용자가 한 번 누른 뒤에만 소리를 낼 수 있다
  const unlock = () => RD.audio && RD.audio.init();
  addEventListener("pointerdown", unlock, true);
  addEventListener("keydown", unlock, true);
  const soundHit = (pt) => Math.hypot(pt.x - RD.SOUND_BTN.x, pt.y - RD.SOUND_BTN.y) < RD.SOUND_BTN.r + 8;

  addEventListener("keydown", (e) => {
    if (MOVE[e.code] || e.code === "Space") e.preventDefault();
    if (e.code === "KeyM" && !e.repeat) RD.audio && RD.audio.toggle();
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
      if (e.code === "KeyG") scene = "gacha";
      if (e.code === "Enter" || e.code === "Space") { if (isOwned(selected)) startRun(); }
    } else if (scene === "result") {
      if (e.code === "Enter" || e.code === "Space") startRun();
      if (e.code === "Escape") scene = "select";
    } else if (scene === "gacha") {
      if (gachaResult) { if (e.code === "Enter" || e.code === "Space" || e.code === "Escape") gachaResult = null; }
      else if (e.code === "Escape") scene = "select";
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
    if (soundHit(pt)) { RD.audio && RD.audio.toggle(); return; }
    for (const b of buttons) {
      if (pt.x >= b.x && pt.x <= b.x + b.w && pt.y >= b.y && pt.y <= b.y + b.h) { RD.audio && RD.audio.sfx("click"); b.onClick(); break; }
    }
  });
  addEventListener("pointerdown", (e) => {
    if (scene !== "play" || !run) return;
    if (e.target.closest && e.target.closest("button")) return; // 화면 밖 폭탄 버튼
    const pt = toGame(e);
    if (e.target === canvas && soundHit(pt)) { RD.audio && RD.audio.toggle(); return; }
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
    MODE_IDS.forEach((id, i) => tab(234 + i * 96, 20, 90, 30, RD.MODES[id].name, id === mode, "#7fe6ff", () => { mode = id; save.set("mode", id); loadBest(); }));
    // 난이도
    RD.text(g, "난이도", 186, 76, 14, "#9fd0ff");
    DIFF_IDS.forEach((id, i) => {
      const D = RD.DIFFICULTY[id];
      tab(234 + i * 96, 62, 90, 30, D.name, id === diff, D.color, () => { diff = id; save.set("diff", id); loadBest(); });
    });
    const D = RD.DIFFICULTY[diff];
    if (mode === "stageselect") {
      // 지역 고르기 (스토리에서 도달한 곳까지)
      RD.STAGES.forEach((st, i) => {
        const open = i <= maxStage;
        tab(120 + i * 146, 104, 138, 26, open ? `${i + 1}. ${st.name}` : `${i + 1}. 🔒`, i === pickStage, "#ffd34d", () => { if (open) { pickStage = i; save.set("pickStage", i); loadBest(); } });
      });
    } else {
      RD.text(g, `${RD.MODES[mode].desc}  ·  잔기 ${RD.MODES[mode].lives || D.lives}  ·  적 체력 x${D.enemyHp}  ·  받는 피해 x${D.damage}  ·  점수 x${D.score * (RD.MODES[mode].scoreMul || 1)}`, C.width / 2, 116, 13, "#e8e0f5", "center");
    }

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
      RD.text(g, "궁극기: " + ch.bomb.name, x + cw / 2, y + 221, 12, "#9fd0ff", "center");
      // 등급
      const GR = RD.GRADES[ch.grade];
      g.fillStyle = "#1d1622"; g.fillRect(x + 4, y + 4, 44, 20);
      g.fillStyle = GR.color; g.fillRect(x + 6, y + 6, 40, 16);
      RD.text(g, GR.name, x + 26, y + 15, 11, "#1d1622", "center", GR.color);
      if (isOwned(i)) {
        // 각성 별
        const st = owned[ch.id];
        RD.text(g, "★".repeat(st) + "☆".repeat(G.maxStars - st), x + cw - 6, y + 14, 11, "#ffd34d", "right");
      } else {
        // 잠김: 뽑기로 얻는다
        g.fillStyle = "rgba(10,6,20,0.72)";
        g.fillRect(x, y, cw, chh);
        RD.text(g, "🔒", x + cw / 2, y + 80, 34, "#fff", "center");
        RD.text(g, "뽑기로 얻기", x + cw / 2, y + 120, 15, GR.color, "center");
        RD.text(g, ch.name, x + cw / 2, y + 166, 16, "#aaa", "center");
      }
      buttons.push({ x, y, w: cw, h: chh, onClick: () => {
        if (!isOwned(i)) { scene = "gacha"; return; }
        if (selected === i) startRun();
        selected = i; save.set("char", i);
      } });
    });

    const ch = RD.CHARACTERS[selected];
    const spr = RD.getCharacterFrame(ch.id, ch.id === "owl" ? "run" : "jump", Math.floor(menuT * 10) % 4);
    g.drawImage(spr, 24, 392, 110, 110);
    RD.text(g, ch.desc.split(". ")[0], 145, 420, 15, "#fff");
    RD.text(g, `전용 · ${ch.sig.name}: ${ch.sig.desc}`, 145, 446, 12, "#ffd34d");
    RD.text(g, `궁극기 · ${ch.bomb.name}: ${ch.bomb.desc}`, 145, 470, 12, "#9fd0ff");
    let ly = 494;
    if (ch.passive) { RD.text(g, `패시브 · ${ch.passive}`, 145, ly, 12, "#9fffb0"); ly += 22; }
    const starTxt = owned[ch.id] > 1 ? `   각성 ★${owned[ch.id]}: 위력 +${Math.round(G.starDmg * 100 * (owned[ch.id] - 1))}%, 체력 +${G.starHp * (owned[ch.id] - 1)}` : "";
    RD.text(g, `최고 점수 (${RD.MODES[mode].name} · ${D.name}) ${best.toLocaleString()}${starTxt}`, 145, ly, 12, "#cfc6e0");
    RD.text(g, `코인 ${coins.toLocaleString()}`, C.width - 318, 400, 14, "#ffd34d", "center");
    button(C.width - 384, 414, 132, 66, "뽑기", () => { scene = "gacha"; }, "#c58aff");
    button(C.width - 230, 414, 200, 66, "출격!", startRun);
  }

  // ---------- 뽑기 화면 ----------
  function drawGacha() {
    menuT += 1 / 60;
    RD.drawBackground(g, menuT * 60);
    g.fillStyle = "rgba(10,8,20,0.75)";
    g.fillRect(0, 0, C.width, C.height);
    RD.text(g, "캐릭터 뽑기", C.width / 2, 44, 36, "#ffd34d", "center");
    RD.text(g, `코인 ${coins.toLocaleString()}`, C.width / 2, 86, 20, "#ffd34d", "center");
    RD.text(g, `전설 확정까지 ${G.pity - pity}회`, C.width / 2, 112, 14, "#cfd8ff", "center");

    if (gachaResult) { drawGachaResult(); return; }

    // 확률표
    const order = ["SSR", "SR", "R", "C"];
    const rate = { SSR: G.rates.SSR, SR: G.rates.SR, R: G.rates.R, C: 1 - G.rates.SSR - G.rates.SR - G.rates.R };
    order.forEach((gr, i) => {
      const GR = RD.GRADES[gr];
      const chars = RD.CHARACTERS.filter((c) => c.grade === gr);
      const y = 158 + i * 44;
      g.fillStyle = "rgba(255,255,255,0.06)";
      g.fillRect(210, y - 18, 540, 36);
      g.fillStyle = GR.color; g.fillRect(210, y - 18, 6, 36);
      RD.text(g, GR.name, 232, y, 16, GR.color);
      RD.text(g, chars.map((c) => c.name + (owned[c.id] ? ` ★${owned[c.id]}` : "")).join(", "), 300, y, 15, "#fff");
      RD.text(g, `${(rate[gr] * 100).toFixed(1)}%`, 735, y, 15, GR.color, "right");
      chars.forEach((c, k) => g.drawImage(RD.getCharacterFrame(c.id, "jump", 0), 760 + k * 36, y - 22, 44, 44));
    });
    RD.text(g, "이미 가진 캐릭터가 나오면 각성(★ +1): 위력 +6%, 최대 체력 +6. 최대 ★6을 넘으면 코인 50 돌려받기", C.width / 2, 340, 13, "#cfd8ff", "center");
    RD.text(g, "10회 뽑기는 희귀 이상 1개 보장", C.width / 2, 362, 13, "#cfd8ff", "center");

    const can1 = coins >= G.cost1, can10 = coins >= G.cost10;
    button(C.width / 2 - 330, 400, 200, 76, `1회 · ${G.cost1}`, () => gacha(1), can1 ? "#c58aff" : "#4a3d5c");
    button(C.width / 2 - 100, 400, 200, 76, `10회 · ${G.cost10}`, () => gacha(10), can10 ? "#ffb347" : "#4a3d5c");
    button(C.width / 2 + 130, 400, 200, 76, "돌아가기", () => { scene = "select"; }, "#5b8ff0");
    if (!can1) RD.text(g, "코인이 부족해요. 게임을 해서 코인을 모으세요", C.width / 2, 500, 14, "#ff8a8a", "center");
  }

  function drawGachaResult() {
    const R = gachaResult;
    R.t += 1 / 60;
    const n = R.list.length;
    const cw = n === 1 ? 200 : 150, ch = n === 1 ? 250 : 156, gap = 12;
    const cols = n === 1 ? 1 : 5;
    const x0 = (C.width - (cw * cols + gap * (cols - 1))) / 2;
    R.list.forEach((r, i) => {
      const x = x0 + (i % cols) * (cw + gap);
      const y = 132 + Math.floor(i / cols) * (ch + gap);
      const show = R.t > 0.3 + i * 0.18;
      const GR = RD.GRADES[r.grade];
      if (!show) {
        g.fillStyle = "#1d1622"; g.fillRect(x - 3, y - 3, cw + 6, ch + 6);
        g.fillStyle = "#3a2d48"; g.fillRect(x, y, cw, ch);
        RD.text(g, "?", x + cw / 2, y + ch / 2, 40, "#6a5a80", "center");
        return;
      }
      // 등급 빛
      if (r.grade === "SSR" || r.grade === "SR") {
        g.fillStyle = r.grade === "SSR" ? `hsla(${(R.t * 200) % 360},90%,65%,0.6)` : "rgba(197,138,255,0.5)";
        g.fillRect(x - 10, y - 10, cw + 20, ch + 20);
      }
      g.fillStyle = GR.color; g.fillRect(x - 3, y - 3, cw + 6, ch + 6);
      g.fillStyle = "#2b2140"; g.fillRect(x, y, cw, ch);
      const im = RD.img(r.ch.illust);
      if (im && im.width) {
        const ih = ch * 0.62, sw = im.height * (cw / ih), sx = (im.width - sw) / 2;
        g.imageSmoothingEnabled = true;
        g.drawImage(im, sx, 0, sw, im.height, x, y, cw, ih);
        g.imageSmoothingEnabled = false;
      }
      RD.text(g, GR.name, x + 8, y + 12, 12, GR.color);
      RD.text(g, r.ch.name, x + cw / 2, y + ch * 0.72, n === 1 ? 18 : 14, "#fff", "center");
      const tag = r.kind === "new" ? "NEW!" : r.kind === "star" ? `각성 ★${r.stars}` : "코인 +50";
      RD.text(g, tag, x + cw / 2, y + ch * 0.87, n === 1 ? 18 : 14, r.kind === "new" ? "#ff8a3d" : "#ffd34d", "center");
    });
    if (R.t > 0.4 + n * 0.18) button(C.width / 2 - 100, C.height - 58, 200, 46, "확인", () => { gachaResult = null; });
  }

  function drawResult() {
    RD.drawRun(g, run);
    g.fillStyle = "rgba(10,8,20,0.72)";
    g.fillRect(0, 0, C.width, C.height);
    const title = run.win ? (run.mode === "timeattack" ? "TIME UP" : run.mode === "stageselect" ? "STAGE CLEAR!" : "ALL CLEAR!") : "GAME OVER";
    RD.text(g, title, C.width / 2, 96, 48, run.win ? "#ffd34d" : "#ff4d5e", "center");
    RD.text(g, `${RD.MODES[run.mode].name} · ${run.D.name}`, C.width / 2, 140, 18, run.D.color, "center");
    RD.text(g, run.score.toLocaleString() + " 점", C.width / 2, 200, 52, "#fff", "center");
    if (run.newBest) RD.text(g, "최고 기록!", C.width / 2, 248, 22, "#ff8a3d", "center");
    const reach = ["story", "hardcore", "stageselect"].includes(run.mode) ? `${run.stage.name}` : run.mode === "bossrush" ? `${run.loop}라운드` : `${Math.floor(run.t)}초 생존`;
    RD.text(g, `격추 ${run.kills}   Lv.${run.level}   ${reach}`, C.width / 2, 290, 20, "#ffd34d", "center");
    // 고른 강화 목록
    const ups = RD.UPGRADES.filter((u) => run.lv(u.id)).map((u) => `${u.id === "sig" ? run.char.sig.name : u.name} ${run.lv(u.id)}`);
    RD.text(g, ups.join(" · ") || "강화 없음", C.width / 2, 328, 13, "#cfd8ff", "center");
    RD.text(g, `코인 +${run.coins}  (보유 ${coins.toLocaleString()})`, C.width / 2, 356, 16, "#ffd34d", "center");
    button(C.width / 2 - 230, 390, 210, 66, "다시 출격", startRun);
    button(C.width / 2 + 20, 390, 210, 66, "메뉴로", () => { scene = "select"; }, "#5b8ff0");
  }

  function drawTouchHints() {
    if (run.choosing) return;
    if (!isTouch()) {
      if (run.t < 6) RD.text(g, "이동: 방향키 / WASD    정밀 이동: Shift    궁극기: X    사격은 자동", C.width / 2, C.height - 50, 14, "rgba(255,255,255,0.8)", "center");
      return;
    }
    if (run.t < 5) RD.text(g, "화면을 대고 끌어서 이동 · 사격은 자동", C.width / 2, C.height / 2 + 90, 18, "#fff", "center");
    g.globalAlpha = 0.45;
    g.fillStyle = "#1d1622";
    g.beginPath(); g.arc(BOMB_BTN.x, BOMB_BTN.y, BOMB_BTN.r, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1;
    g.strokeStyle = "#4aa8ff"; g.lineWidth = 3;
    g.beginPath(); g.arc(BOMB_BTN.x, BOMB_BTN.y, BOMB_BTN.r, 0, Math.PI * 2); g.stroke();
    RD.text(g, "궁극기", BOMB_BTN.x, BOMB_BTN.y - 8, 16, "#fff", "center");
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
    if (RD.audio) {
      let track = "menu";
      if (scene === "play") track = run.over ? null : (run.boss ? "boss" : "stage") + ":" + run.stage.transpose;
      if (scene === "result") track = null;
      RD.audio.music(track);
    }

    if (scene === "loading") {
      g.fillStyle = "#120c1c";
      g.fillRect(0, 0, C.width, C.height);
      RD.text(g, "불러오는 중...", C.width / 2, C.height / 2, 28, "#fff", "center");
    } else if (scene === "select") {
      drawSelect();
      RD.drawSoundButton(g);
    } else if (scene === "play") {
      run.update(dt);
      RD.drawRun(g, run);
      drawTouchHints();
      if (run.over && run.overTimer > (run.win ? 3 : 1.5)) endRun();
    } else if (scene === "result") {
      drawResult();
    } else if (scene === "gacha") {
      drawGacha();
      RD.drawSoundButton(g);
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
  RD.debugState = () => ({ scene, run, coins, owned, pity });
  RD.debugGacha = (c) => { coins = c; scene = "gacha"; };
  RD.startRun = (i) => { selected = i; startRun(); };
})();
