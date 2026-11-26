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
  let owned = save.get("owned", null); // 캐릭터 id → 성급 (별) 단계
  if (!owned) { owned = {}; RD.CHARACTERS.forEach((c) => { if (c.starter) owned[c.id] = 1; }); save.set("owned", owned); }
  let coins = save.get("coins", null);
  if (coins == null) { coins = G.startCoins; save.set("coins", coins); }
  let pity = save.get("pity", 0);
  // 테스트 모드: 켜 두면 모든 캐릭터와 지역이 열리고 뽑기가 무료 (진짜 진행 상황은 건드리지 않는다)
  let testMode = !!save.get("testMode", false);
  // 각성: 왕별(6성)에서 각성하면 성급이 0성부터 다시 (owned 값 1 = 0성)
  let awak = save.get("awak", {}), stones = save.get("stones", 0);
  // 각성 버전 / 일반 버전 전환: 각성한 캐릭터(테스트 모드에서는 모든 캐릭터)는 어느 쪽으로든 출격할 수 있다
  let form = save.get("form", {}); // 캐릭터 id → "awake" | "normal"
  const awakOf = (id) => !!awak[id]; // 진짜로 각성했는지 (성급 계산용)
  const awakAvail = (id) => testMode || !!awak[id];
  const useAwake = (id) => awakAvail(id) && (form[id] || (awak[id] ? "awake" : "normal")) === "awake";
  const setForm = (id, f) => { form[id] = f; save.set("form", form); RD.audio && RD.audio.sfx("click"); };
  const rawOf = (id) => (testMode ? Math.max(1, owned[id] || 0) : owned[id] || 0);
  const starsOf = (id) => Math.max(0, rawOf(id) - (awakOf(id) ? 1 : 0)); // 0성~5성, 6 = 왕별
  const isOwned = (i) => rawOf(RD.CHARACTERS[i].id) > 0;
  const dispChar = (i) => (useAwake(RD.CHARACTERS[i].id) ? RD.awakenedChar(RD.CHARACTERS[i].id) : RD.CHARACTERS[i]);
  const starName = (n) => (n >= 6 ? "왕별" : `${n}성`);
  let selected = save.get("char", 0);
  if (!RD.CHARACTERS[selected] || !isOwned(selected)) selected = 0;
  let gachaResult = null; // 뽑기 결과 연출
  let gachaInfo = false; // 확률 상세 창
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
  let raidPick = Math.min(save.get("raidPick", 0), RD.RAID_BOSSES.length - 1);
  let raidLv = save.get("raidLv", {}); // 보스별 레이드 레벨
  let maxStage = save.get("maxStage", 0); // 스토리에서 도달한 지역 (스테이지 선택에서 고를 수 있다)
  let pickStage = Math.min(save.get("pickStage", 0), maxStage);
  const bestKey = () => `best_${mode}_${diff}` + (mode === "stageselect" ? "_" + pickStage : mode === "raid" ? "_" + raidPick : "");
  const loadBest = () => { best = save.get(bestKey(), 0); RD.best = best; };

  // ---------- 캐릭터 숙련도 ----------
  let mastery = save.get("mastery", {}); // 캐릭터 id → 누적 경험치
  const mxp = (id) => mastery[id] || 0;
  const mlv = (id) => RD.masteryLevel(mxp(id));
  const shortName = (ch) => ch.name.split(" ")[0];
  function titleOf(ch) {
    let t = null;
    RD.MASTERY.rewards.forEach((r, lv) => { if (r && r.title && mlv(ch.id) >= lv) t = r.title(shortName(ch)); });
    return t;
  }
  function addMastery(id, xp) {
    const before = mlv(id);
    mastery[id] = mxp(id) + xp;
    const after = mlv(id);
    const got = [];
    for (let lv = before + 1; lv <= after; lv++) {
      const r = RD.MASTERY.rewards[lv];
      if (r && r.coins) coins += r.coins;
      got.push(lv);
    }
    save.set("mastery", mastery); save.set("coins", coins);
    return { before, after, got };
  }

  // ---------- 일일 미션 ----------
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
  function seeded(seed) { let h = 2166136261; for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296; }
  let missions = save.get("missions", null);
  function ensureMissions() {
    if (missions && missions.date === today()) return;
    const rnd = seeded(today());
    const pool = RD.MISSIONS.slice();
    const list = [];
    while (list.length < 3 && pool.length) {
      const m = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
      const n = m.n[Math.floor(rnd() * m.n.length)];
      const ownedIds = RD.CHARACTERS.filter((c, i) => isOwned(i)).map((c) => c.id);
      list.push({ id: m.id, n, prog: 0, claimed: false, ch: m.id === "char" ? ownedIds[Math.floor(rnd() * ownedIds.length)] : null });
    }
    missions = { date: today(), list, bonus: false };
    save.set("missions", missions);
  }
  ensureMissions();
  const missionDef = (m) => RD.MISSIONS.find((d) => d.id === m.id);
  const missionText = (m) => missionDef(m).text(m.n, RD.CHARACTERS.find((c) => c.id === m.ch));
  function missionAdd(fn) {
    ensureMissions();
    let done = 0;
    for (const m of missions.list) {
      if (m.prog >= m.n) continue;
      const v = fn(m, missionDef(m));
      if (!v) continue;
      m.prog = missionDef(m).best ? Math.max(m.prog, v) : m.prog + v;
      if (m.prog >= m.n) { m.prog = m.n; done++; }
    }
    save.set("missions", missions);
    return done;
  }
  const missionsReady = () => { ensureMissions(); return missions.list.filter((m) => m.prog >= m.n && !m.claimed).length + (missions.list.every((m) => m.claimed) && !missions.bonus ? 1 : 0); };

  // ---------- 도감 ----------
  let dex = save.get("dex", {}); // 몬스터 종류 → 쓰러뜨린 수
  let dexTab = "mon", dexSel = null;

  // ---------- 결투 ----------
  let trophy = save.get("trophy", 0), duelRec = save.get("duelRec", { w: 0, l: 0 });
  let match = null; // 매칭 화면 상태
  loadBest();


  function startRun() {
    if (!isOwned(selected)) { scene = "chars"; return; }
    const id = RD.CHARACTERS[selected].id;
    if (mode === "adventure") {
      // 어드벤처 런: 오븐브레이크 방식 러너
      run = new RD.AdvRun(id);
      Object.assign(run, { isAdv: true, mode, D: RD.DIFFICULTY[diff], M: RD.MODES.adventure, stage: RD.STAGES[0] });
      scene = "play";
      return;
    }
    if (mode === "duel" && !(match && match.go)) {
      // 대전 상대 찾기 → 없으면 AI 라이벌
      const rivals = RD.CHARACTERS.map((c) => c.id);
      const aiLv = Math.max(1, Math.min(5, 1 + Math.floor(trophy / 100)));
      match = { t: 0, rival: rivals[Math.floor(Math.random() * rivals.length)], aiLv, name: `${RD.DUEL.names[Math.floor(Math.random() * RD.DUEL.names.length)]} 라이벌`, arena: RD.RAID_BOSSES[Math.floor(Math.random() * RD.RAID_BOSSES.length)][0] };
      scene = "match";
      return;
    }
    run = new RD.Run(id, mode, diff, { stars: Math.max(1, starsOf(id)), awakened: useAwake(id), mastery: mlv(id), stage: mode === "stageselect" ? pickStage : 0, raidBoss: RD.RAID_BOSSES[raidPick][0], raidLv: raidLv[RD.RAID_BOSSES[raidPick][0]] || 1,
      duel: match && match.go ? { rival: match.rival, aiLv: match.aiLv, name: match.name, arena: match.arena } : null });
    if (mode === "duel") match = null;
    RD.playerTitle = titleOf(RD.CHARACTERS[selected]);
    scene = "play";
  }

  function endRun() {
    scene = "result";
    if (run.raid && run.win) { const k = run.raid.type; raidLv[k] = (raidLv[k] || 1) + 1; save.set("raidLv", raidLv); }
    if (["story", "hardcore"].includes(run.mode) && run.reached > maxStage) {
      maxStage = Math.min(RD.STAGES.length - 1, run.reached);
      save.set("maxStage", maxStage);
    }
    // 결투: 트로피
    if (run.duel) {
      run.trophyGain = run.win ? RD.DUEL.trophyWin : RD.DUEL.trophyLose;
      trophy = Math.max(0, trophy + run.trophyGain); save.set("trophy", trophy);
      duelRec[run.win ? "w" : "l"]++; save.set("duelRec", duelRec);
    }
    // 도감: 처음 쓰러뜨린 몬스터는 코인 보상
    if (run.killsByType) {
      run.dexNew = 0;
      for (const [k, n] of Object.entries(run.killsByType)) { if (k === "rival" || !RD.DEX[k]) continue; if (!dex[k]) { run.dexNew++; coins += RD.DEX_REWARD; } dex[k] = (dex[k] || 0) + n; }
      save.set("dex", dex);
    }
    // 일일 미션
    if (!run.isAdv) run.missionDone = missionAdd((m, d) => d.stat(run, m));
    else run.missionDone = missionAdd((m, d) => (m.id === "runs" ? 1 : m.id === "char" && run.charId === m.ch ? 1 : 0));
    // 각성석: 보스 처치, 레이드 성공, 결투 승리
    const AS = RD.AWAKEN.sources;
    run.stones = (run.bossKills || 0) * AS.boss + (run.raid && !run.duel && run.win ? AS.raidWin : 0) + (run.duel && run.win ? AS.duelWin : 0);
    if (run.stones) { stones += run.stones; save.set("stones", stones); }
    // 숙련도: 처치 + 점수 + 버틴 시간 + 승리
    const xp = Math.round((run.kills || 0) + (run.score || 0) / 500 + (run.t || 0) / 10 + (run.win ? 100 : 0));
    run.mastery = { xp, ...addMastery(run.charId || RD.CHARACTERS[selected].id, xp) };
    coins += run.coins;
    save.set("coins", coins);
    run.newBest = run.score > best;
    if (run.newBest) { best = run.score; RD.best = best; save.set(bestKey(), best); }
  }

  // ---------- 뽑기 ----------
  function rollOne(forceMin) {
    missionAdd((m) => (m.id === "gacha" ? 1 : 0));
    let grade;
    if (pity >= G.pity - 1) grade = "SSR";
    else {
      let r = Math.random();
      grade = r < G.rates.MY ? "MY" : (r -= G.rates.MY) < G.rates.SSR ? "SSR" : r < G.rates.SSR + G.rates.SR ? "SR" : r < G.rates.SSR + G.rates.SR + G.rates.R ? "R" : "C";
    }
    if (forceMin && grade === "C") grade = "R";
    pity = grade === "SSR" ? 0 : pity + 1;
    const pool = RD.CHARACTERS.filter((c) => c.grade === grade);
    const ch = pool[Math.floor(Math.random() * pool.length)];
    let kind;
    const maxRaw = G.maxStars + (awak[ch.id] ? 1 : 0);
    if (!owned[ch.id]) { owned[ch.id] = 1; kind = "new"; }
    else if (owned[ch.id] < maxRaw) { owned[ch.id]++; kind = "star"; }
    else { coins += 50; stones += RD.AWAKEN.sources.kingDup; kind = "refund"; } // 왕별 이후 중복: 코인 + 각성석
    return { ch, grade, kind, stars: owned[ch.id] - (awak[ch.id] ? 1 : 0) };
  }

  function gacha(n) {
    const cost = testMode ? 0 : n === 10 ? G.cost10 : G.cost1;
    if (coins < cost) return;
    const backup = testMode ? { owned: { ...owned }, coins, pity, stones } : null;
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
    if (backup) { owned = backup.owned; coins = backup.coins; pity = backup.pity; stones = backup.stones; } // 테스트 모드: 결과만 보여 준다
    save.set("owned", owned);
    save.set("coins", coins);
    save.set("pity", pity);
    // 뽑기 컷씬: 소환 → 번쩍 → (전설/영웅 새 캐릭터 등장 장면) → 카드 공개
    const rank = { C: 0, R: 1, SR: 2, SSR: 3, MY: 4 };
    const best = list.reduce((a, r) => (rank[r.grade] > rank[a] ? r.grade : a), "C");
    const cutins = list.filter((r) => ["MY", "SSR", "SR"].includes(r.grade) && r.kind === "new");
    gachaResult = { list, t: 0, state: "summon", best, cutins, ci: 0, st: 0 };
    RD.audio && RD.audio.sfx("gacha_charge");
  }

  // 뽑기 컷씬 넘기기 (터치 / Space)
  function skipGacha() {
    const R = gachaResult;
    if (!R) return;
    if (R.state === "summon" || R.state === "flash") nextGachaState(R, true);
    else if (R.state === "cutin") nextGachaState(R);
  }
  function nextGachaState(R, fromSummon) {
    if (fromSummon && R.state !== "flash") RD.audio && RD.audio.sfx(R.best === "SSR" || R.best === "SR" ? "gacha_rare" : "gacha");
    if (fromSummon && R.cutins.length) { R.state = "cutin"; R.ci = 0; }
    else if (R.state === "cutin" && R.ci + 1 < R.cutins.length) R.ci++;
    else { R.state = "cards"; R.t = 0; }
    R.st = 0;
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
  const pauseHit = (pt) => Math.abs(pt.x - RD.PAUSE_BTN.x) < 26 && Math.abs(pt.y - RD.PAUSE_BTN.y) < 26;
  const soundHit = (pt) => Math.hypot(pt.x - RD.SOUND_BTN.x, pt.y - RD.SOUND_BTN.y) < RD.SOUND_BTN.r + 8;

  addEventListener("keydown", (e) => {
    if (MOVE[e.code] || e.code === "Space") e.preventDefault();
    if (e.code === "KeyM" && !e.repeat) RD.audio && RD.audio.toggle();
    held.add(e.code);
    syncKeys();
    if (e.repeat) return;
    if (scene === "play" && run.isAdv) {
      if (e.repeat) return;
      if (["Space", "ArrowUp", "KeyW"].includes(e.code)) { run.input.jumpHeld = true; run.jump(); }
      if (["ArrowDown", "KeyS"].includes(e.code)) run.input.slideHeld = true;
      return;
    }
    if (scene === "play" && run.techOpen) {
      if (e.code === "Escape" || e.code === "KeyT") run.techOpen = false;
      if (e.code === "Enter" && run.techSel) run.unlockTech(run.techSel);
      return;
    }
    if (scene === "play" && run.mech && e.code === "KeyT" && !run.over && !run.cutscene && !run.choosing && !run.paused) { run.techOpen = true; return; }
    if (scene === "play" && !run.over && (e.code === "Escape" || e.code === "KeyP") && !run.cutscene && !run.choosing) { run.paused = !run.paused; return; }
    if (scene === "play" && run.paused) return;
    if (scene === "play" && run.cutscene) {
      // 컷씬: Space/Enter/X 넘기기, Esc 건너뛰기
      if (["Space", "Enter", "KeyX", "KeyZ"].includes(e.code)) run.advanceCutscene();
      if (e.code === "Escape") run.endCutscene();
      return;
    }
    if (scene === "play" && run.choosing) {
      const n = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 }[e.code];
      const N = run.choosing.options.length;
      if (n != null && n < N) run.choosing.sel = n;
      if (e.code === "ArrowLeft" || e.code === "KeyA") run.choosing.sel = ((run.choosing.sel ?? 1) + N - 1) % N;
      if (e.code === "ArrowRight" || e.code === "KeyD") run.choosing.sel = ((run.choosing.sel ?? -1) + 1) % N;
      if ((e.code === "Enter" || e.code === "Space") && run.choosing.sel != null) run.choose(run.choosing.sel);
      if (e.code === "KeyR") run.reroll();
      return;
    }
    if (scene === "play") {
      if (run.raid) {
        // 레이드: Space/J 공격 (마우스 방향, 없으면 자동 조준), X/K/E 궁극기
        const U = RD.brawlUI, p = run.player;
        if (e.code === "Space" || e.code === "KeyJ") run.brawlAttack(U.mouse ? Math.atan2(U.mouse.y - p.y, U.mouse.x - p.x) : null);
        if (e.code === "KeyX" || e.code === "KeyK" || e.code === "KeyE") run.brawlSuper();
      } else if (e.code === "KeyX" || e.code === "Space" || e.code === "KeyK") run.bomb();
      if (e.code === "KeyB") RD.debug = !RD.debug;
    } else if (scene === "select") {
      const NC = RD.CHARACTERS.length;
      if (e.code === "ArrowLeft") selected = (selected + NC - 1) % NC;
      if (e.code === "ArrowRight") selected = (selected + 1) % NC;
      if (e.code === "KeyG") scene = "gacha";
      if (e.code === "KeyT") { testMode = !testMode; save.set("testMode", testMode); }
      if (e.code === "Enter" || e.code === "Space") { if (isOwned(selected)) startRun(); }
    } else if (scene === "missions" || scene === "dex") {
      if (e.code === "Escape") scene = "select";
    } else if (scene === "match") {
      if (e.code === "Escape") { match = null; scene = "select"; }
    } else if (scene === "result") {
      if (e.code === "Enter" || e.code === "Space") startRun();
      if (e.code === "Escape") scene = "select";
    } else if (scene === "chars") {
      const NC = RD.CHARACTERS.length;
      if (e.code === "ArrowLeft") selected = (selected + NC - 1) % NC;
      if (e.code === "ArrowRight") selected = (selected + 1) % NC;
      if (e.code === "Escape") { if (starPopup) starPopup = false; else scene = "select"; }
      if ((e.code === "Enter" || e.code === "Space") && isOwned(selected) && !starPopup) startRun();
    } else if (scene === "gacha") {
      if (gachaResult) {
        if (gachaResult.state !== "cards") { if (["Enter", "Space", "Escape"].includes(e.code)) skipGacha(); }
        else if (e.code === "Enter" || e.code === "Space" || e.code === "Escape") gachaResult = null;
      }
      else if (e.code === "Escape") scene = "select";
    }
  });
  addEventListener("keyup", (e) => {
    held.delete(e.code); syncKeys();
    if (scene === "play" && run && run.isAdv) {
      if (["Space", "ArrowUp", "KeyW"].includes(e.code)) run.input.jumpHeld = false;
      if (["ArrowDown", "KeyS"].includes(e.code)) run.input.slideHeld = false;
    }
  });
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
    if (scene !== "select" && scene !== "chars" && soundHit(pt)) { RD.audio && RD.audio.toggle(); return; }
    if (scene === "gacha" && gachaResult && gachaResult.state !== "cards") { skipGacha(); return; }
    for (const b of buttons) {
      if (pt.x >= b.x && pt.x <= b.x + b.w && pt.y >= b.y && pt.y <= b.y + b.h) { RD.audio && RD.audio.sfx("click"); b.onClick(); break; }
    }
  });
  addEventListener("pointerdown", (e) => {
    if (scene !== "play" || !run) return;
    if (e.target.closest && e.target.closest("button")) return; // 화면 밖 폭탄 버튼
    const pt = toGame(e);
    if (e.target === canvas && soundHit(pt)) { RD.audio && RD.audio.toggle(); return; }
    if (run.paused) {
      for (const b of buttons) if (pt.x >= b.x && pt.x <= b.x + b.w && pt.y >= b.y && pt.y <= b.y + b.h) { RD.audio && RD.audio.sfx("click"); b.onClick(); break; }
      return;
    }
    if (e.target === canvas && !run.over && !run.cutscene && !run.choosing && !run.techOpen && pauseHit(pt)) { run.paused = true; return; }
    const inR = (r) => r && pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h;
    if (run.techOpen) {
      // 메카 테크트리
      const tb = RD.techBtns;
      if (inR(tb.close)) { run.techOpen = false; return; }
      if (inR(tb.unlock)) { if (run.techSel) run.unlockTech(run.techSel); return; }
      for (const r of RD.techRects) if (inR(r)) { RD.audio && RD.audio.sfx("click"); if (run.techSel === r.id) run.unlockTech(r.id); else run.techSel = r.id; }
      return;
    }
    if (run.mech && e.target === canvas && !run.over && !run.cutscene && !run.choosing && inR(RD.TECH_BTN)) { run.techOpen = true; RD.audio && RD.audio.sfx("click"); return; }
    if (run.isAdv) {
      const pad = e.target.closest && e.target.closest(".touchpad");
      const action = pad || (e.target === canvas && pt.x < C.width / 2) ? "slide" : "jump";
      advPointers.set(e.pointerId, action);
      if (action === "jump") { run.input.jumpHeld = true; run.jump(); } else run.input.slideHeld = true;
      return;
    }
    if (run.cutscene) {
      const sk = RD.cutSkip;
      if (e.target === canvas && pt.x >= sk.x && pt.x <= sk.x + sk.w && pt.y >= sk.y && pt.y <= sk.y + sk.h) run.endCutscene();
      else run.advanceCutscene();
      return;
    }
    if (run.choosing) {
      // 강화 카드 고르기 (선택 직후 실수로 눌리지 않게 0.35초 기다림)
      if (run.choosing.t < 0.35) return;
      const inR = (r) => r && pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h;
      const cb = RD.choiceBtns;
      if (inR(cb.confirm)) { if (run.choosing.sel != null) run.choose(run.choosing.sel); return; }
      if (inR(cb.reroll)) { run.reroll(); return; }
      RD.cardRects.forEach((r, i) => {
        if (!inR(r)) return;
        // 같은 카드를 한 번 더 누르면 바로 고른다
        if (run.choosing.sel === i) run.choose(i); else { run.choosing.sel = i; RD.audio && RD.audio.sfx("click"); }
      });
      return;
    }
    if (run.raid) { brawlDown(e, pt); return; }
    if (isTouch() && Math.hypot(pt.x - BOMB_BTN.x, pt.y - BOMB_BTN.y) < BOMB_BTN.r && e.target === canvas) { run.bomb(); return; }
    if (drag) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
  });
  // ---------- 레이드: 브롤스타즈식 조작 ----------
  // 마우스: 조준은 마우스, 왼쪽 클릭 공격, 오른쪽 클릭 궁극기 / 터치: 왼쪽 이동 스틱, 오른쪽 공격·궁극기 스틱
  // (스틱을 끌어서 조준하고 떼면 발사, 짧게 톡 치면 자동 조준)
  const U = RD.brawlUI;
  canvas.addEventListener("contextmenu", (e) => { if (scene === "play" && run && run.raid) e.preventDefault(); });
  function brawlDown(e, pt) {
    const onCanvas = e.target === canvas;
    if (e.pointerType === "mouse" && onCanvas) {
      const p = run.player, ang = Math.atan2(pt.y - p.y, pt.x - p.x);
      if (e.button === 2) run.brawlSuper(); else run.brawlAttack(ang);
      return;
    }
    if (onCanvas && Math.hypot(pt.x - RD.SUP_BTN.x, pt.y - RD.SUP_BTN.y) < RD.SUP_BTN.r * 1.3) { U.sup = { id: e.pointerId, ang: 0, drag: 0 }; return; }
    if (onCanvas && Math.hypot(pt.x - RD.ATK_BTN.x, pt.y - RD.ATK_BTN.y) < RD.ATK_BTN.r * 1.4) { U.atk = { id: e.pointerId, ang: 0, drag: 0 }; return; }
    if (!U.move) U.move = { id: e.pointerId, ox: pt.x, oy: pt.y, cx: e.clientX, cy: e.clientY, dx: 0, dy: 0 };
  }
  function brawlMove(e) {
    const pt = toGame(e);
    if (e.pointerType === "mouse") U.mouse = pt;
    for (const [s, btn] of [[U.atk, RD.ATK_BTN], [U.sup, RD.SUP_BTN]]) {
      if (s && s.id === e.pointerId) { s.ang = Math.atan2(pt.y - btn.y, pt.x - btn.x); s.drag = Math.hypot(pt.x - btn.x, pt.y - btn.y); }
    }
    if (U.move && U.move.id === e.pointerId) {
      let dx = (e.clientX - U.move.cx) / 60, dy = (e.clientY - U.move.cy) / 60;
      const l = Math.hypot(dx, dy);
      if (l < 0.18) { dx = dy = 0; } // 가운데 근처는 멈춤 (데드존)
      else if (l > 1) { dx /= l; dy /= l; }
      U.move.dx = dx; U.move.dy = dy;
      run.input.dx = dx; run.input.dy = dy;
    }
  }
  function brawlUp(e) {
    if (U.atk && U.atk.id === e.pointerId) { run.brawlAttack(U.atk.drag > 22 ? U.atk.ang : null); U.atk = null; }
    if (U.sup && U.sup.id === e.pointerId) { run.brawlSuper(); U.sup = null; }
    if (U.move && U.move.id === e.pointerId) { U.move = null; run.input.dx = run.input.dy = 0; }
  }
  addEventListener("pointermove", (e) => { if (scene === "play" && run && run.raid) brawlMove(e); });

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
  const advPointers = new Map();
  const endDrag = (e) => {
    if (scene === "play" && run && run.raid) brawlUp(e);
    if (drag && e.pointerId === drag.id) drag = null;
    const a = advPointers.get(e.pointerId);
    if (a && run && run.isAdv) {
      advPointers.delete(e.pointerId);
      if (![...advPointers.values()].includes(a)) { if (a === "jump") run.input.jumpHeld = false; else run.input.slideHeld = false; }
    }
  };
  addEventListener("pointerup", endDrag);
  addEventListener("pointercancel", endDrag);

  // ---------- 화면들 (UI 목업 스타일) ----------
  const UI = RD.UI;
  function button(x, y, w, h, label, onClick, color = "#ff8a3d", sub) {
    UI.btn(g, x, y, w, h, color);
    const dark = ["#7fe6ff", "#9fffb0", "#ffd34d"].includes(color);
    const tc = dark ? "#1d1622" : "#fff";
    if (sub) {
      UI.fitText(g, label, x + w / 2, y + h / 2 - 9, w - 12, Math.min(30, h * 0.42), tc, "center", dark ? color : "#1d1622");
      UI.fitText(g, sub, x + w / 2, y + h / 2 + 16, w - 12, 12, tc, "center", dark ? color : "#1d1622");
    } else UI.fitText(g, label, x + w / 2, y + h / 2 - 1, w - 12, Math.min(26, h * 0.45), tc, "center", dark ? color : "#1d1622");
    buttons.push({ x, y, w, h, onClick });
  }

  function tab(x, y, w, h, label, active, color, onClick, iconName) {
    g.fillStyle = active ? color : "#1d1622"; g.fillRect(x - 3, y - 3, w + 6, h + 6);
    g.fillStyle = active ? "#3d2f5a" : "#2b2140"; g.fillRect(x, y, w, h);
    g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(x, y + h - 3, w, 3);
    let tx = x + w / 2, al = "center";
    if (iconName) { UI.iconBox(g, x + 5, y + (h - 22) / 2, 22, iconName, color); tx = x + 34; al = "left"; }
    UI.fitText(g, label, tx, y + h / 2, iconName ? w - 40 : w - 8, 14, active ? "#fff" : "#cfc6e0", al);
    buttons.push({ x, y, w, h, onClick });
  }

  const MODE_ICON = { story: "book", stageselect: "flag", endless: "target", bossrush: "skull", timeattack: "clock", hardcore: "heart", chaos: "chaos",
    dream: "candy", adventure: "run", raid: "sword", trumpets: "trumpet", duel: "target" };
  const MODE_COL = { story: "#ff8a3d", stageselect: "#ffd34d", endless: "#7fe6ff", bossrush: "#ff4d5e", timeattack: "#9fd0ff", hardcore: "#ff6a6a", chaos: "#c58aff",
    dream: "#ff9ad8", adventure: "#7fe08a", raid: "#c58aff", trumpets: "#ffd34d", duel: "#ff5ad8" };
  const ownedCount = () => RD.CHARACTERS.filter((c, i) => isOwned(i)).length;

  function menuBackdrop() {
    menuT += 1 / 60;
    g.fillStyle = UI.COL.bg; g.fillRect(0, 0, C.width, C.height);
    // 반짝이는 도트 별
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,255,255,${0.15 + 0.25 * Math.abs(Math.sin(menuT * 1.3 + i))})`; g.fillRect((i * 173) % C.width, (i * 97) % C.height, 2, 2); }
  }

  function coinBox(x, y, w) {
    UI.panel(g, x, y, w, 34);
    UI.icon(g, "coin", x + 10, y + 7, 20, "#ffd34d");
    RD.text(g, testMode ? "무료" : coins.toLocaleString(), x + w - 10, y + 18, 17, "#fff", "right");
  }

  function subtitle() {
    const D = RD.DIFFICULTY[diff];
    let s = `${RD.MODES[mode].name} · ${D.name}`;
    if (mode === "stageselect") s += ` · ${RD.STAGES[pickStage].name}`;
    if (mode === "raid") s += ` · ${RD.RAID_BOSSES[raidPick][2]} Lv.${raidLv[RD.RAID_BOSSES[raidPick][0]] || 1}`;
    return s;
  }

  // 메인 로비
  function drawSelect() {
    menuBackdrop();
    const D = RD.DIFFICULTY[diff], ch = dispChar(selected);
    // 왼쪽 위: 로고, 보유, 코인
    UI.panel(g, 16, 14, 312, 132);
    RD.text(g, "RUNDOT", 30, 48, 42, "#ffd34d");
    UI.iconBox(g, 30, 74, 30, "star", "#ffd34d", "#3a2d58");
    RD.text(g, "모험가", 70, 82, 16, "#fff");
    UI.chip(g, 132, 72, 92, 20, "#7fe6ff", `보유 ${ownedCount()}/${RD.CHARACTERS.length}`, 12);
    coinBox(30, 102, 284);
    // 모드 설명과 최고 기록
    UI.panel(g, 16, 158, 312, 86, "#231a36");
    UI.iconBox(g, 28, 170, 28, MODE_ICON[mode], MODE_COL[mode]);
    RD.text(g, RD.MODES[mode].name, 66, 184, 17, MODE_COL[mode]);
    const desc = RD.MODES[mode].desc;
    g.font = `bold 11px ${RD.FONT}`;
    const lines = [""];
    for (const w of desc.split(" ")) { const t = (lines[lines.length - 1] + " " + w).trim(); if (g.measureText(t).width > 286) lines.push(w); else lines[lines.length - 1] = t; }
    lines.slice(0, 2).forEach((l, i) => RD.text(g, l, 28, 208 + i * 15, 11, "#cfc6e0"));
    RD.text(g, `최고 기록 ${best.toLocaleString()}`, 316, 184, 12, "#ffd34d", "right");
    // 난이도 + 지역/보스 고르기
    UI.panel(g, 16, 256, 312, 164);
    RD.text(g, "난이도", 28, 272, 13, "#ffd34d");
    DIFF_IDS.forEach((id, i) => { const d = RD.DIFFICULTY[id]; tab(28 + i * 74, 284, 68, 28, d.name, id === diff, d.color, () => { diff = id; save.set("diff", id); loadBest(); }); });
    if (mode === "duel") {
      RD.text(g, "결투 기록", 28, 330, 13, "#ffd34d");
      UI.icon(g, "star", 28, 344, 18, "#ffd34d");
      RD.text(g, `트로피 ${trophy}`, 52, 353, 15, "#fff");
      RD.text(g, `${duelRec.w}승 ${duelRec.l}패`, 316, 353, 13, "#cfc6e0", "right");
      RD.text(g, `AI 라이벌 실력 Lv.${Math.max(1, Math.min(5, 1 + Math.floor(trophy / 100)))} (트로피가 오르면 강해진다)`, 28, 380, 11, "#b9add0");
      RD.text(g, "온라인 대전 상대가 없으면 AI 라이벌과 매칭", 28, 400, 11, "#b9add0");
    } else if (mode === "raid") {
      RD.text(g, "레이드 보스", 28, 330, 13, "#ffd34d");
      RD.RAID_BOSSES.forEach(([type, , name], i) => {
        tab(28 + (i % 2) * 146, 342 + Math.floor(i / 2) * 19, 140, 15, `${name} Lv${raidLv[type] || 1}`, i === raidPick, "#ff8a8a", () => { raidPick = i; save.set("raidPick", i); loadBest(); });
      });
    } else if (mode === "stageselect") {
      RD.text(g, "지역", 28, 330, 13, "#ffd34d");
      RD.STAGES.filter((st) => !st.special).forEach((st, i) => {
        const open = testMode || i <= maxStage;
        tab(28 + (i % 2) * 146, 342 + Math.floor(i / 2) * 26, 140, 20, open ? `${i + 1}. ${st.name}` : `${i + 1}. 잠김`, i === pickStage, "#ffd34d", () => { if (open) { pickStage = i; save.set("pickStage", i); loadBest(); } });
      });
    } else {
      const lv = RD.MODES[mode].lives || D.lives;
      RD.text(g, `잔기 ${lv}  ·  적 체력 x${D.enemyHp}`, 28, 336, 12, "#cfc6e0");
      RD.text(g, `받는 피해 x${D.damage}  ·  점수 x${(D.score * (RD.MODES[mode].scoreMul || 1)).toFixed(1)}`, 28, 356, 12, "#cfc6e0");
      RD.text(g, D.terrain ? `지형 효과 ${D.terrain < 1 ? "약하게" : D.terrain > 1 ? "강하게" : "보통"}` : "지형 효과 없음", 28, 376, 12, "#9fffb0");
    }
    // 가운데: 고른 캐릭터
    UI.panel(g, 344, 14, 300, 320, "#1d1428");
    UI.portrait(g, ch, 350, 20, 288, 308, Math.floor(menuT * 8) % 4);
    UI.panel(g, 344, 344, 300, 76);
    UI.fitText(g, ch.name, 494 - 30, 368, 200, 22, "#fff", "center");
    UI.chip(g, 574, 357, 54, 22, UI.gradeCol(ch.grade), RD.GRADES[ch.grade].name, 12);
    RD.text(g, "성급", 360, 401, 11, "#cfc6e0");
    UI.stars(g, 390, 394, starsOf(ch.id), G.maxStars, 1.6);
    const ml = mlv(ch.id), tt = titleOf(ch);
    UI.chip(g, 524, 394, 50, 16, ml >= 10 ? "#ffd34d" : "#7fe6ff", `숙련 ${ml}`, 10);
    const tline = [ch.awakened ? `[${ch.epithet}]` : null, tt].filter(Boolean).join(" · ");
    if (tline) UI.fitText(g, tline, 494 - 30, 340 - 0, 280, 12, ch.awakened ? "#ff9ad8" : ml >= 10 ? "#ffd34d" : "#9fffb0", "center");
    buttons.push({ x: 344, y: 14, w: 300, h: 406, onClick: () => { scene = "chars"; } });
    // 오른쪽 위: 소리, 테스트 모드
    const tbx = C.width - 106;
    UI.panel(g, tbx, 14, 38, 34, testMode ? "#2f5a3a" : "#2b2140");
    UI.icon(g, "gear", tbx + 9, 21, 20, testMode ? "#7fe08a" : "#cfc6e0");
    buttons.push({ x: tbx, y: 14, w: 38, h: 34, onClick: () => { testMode = !testMode; save.set("testMode", testMode); } });
    if (testMode) RD.text(g, "테스트 모드", tbx - 8, 31, 11, "#7fe08a", "right");
    // 모드 선택 (2열)
    UI.panel(g, 660, 60, 284, 360);
    RD.text(g, "모드 선택", 672, 78, 15, "#ffd34d");
    RD.text(g, `${MODE_IDS.length}개 모드`, 932, 78, 11, "#9a8ab8", "right");
    MODE_IDS.forEach((id, i) => {
      const x = 670 + (i % 2) * 136, y = 94 + Math.floor(i / 2) * 54;
      tab(x, y, 128, 44, RD.MODES[id].name, id === mode, MODE_COL[id], () => { mode = id; save.set("mode", id); loadBest(); }, MODE_ICON[id]);
      if (RD.MODES[id].special) UI.chip(g, x + 86, y - 6, 40, 13, "#ffd34d", "특별", 9);
    });
    // 아래: 메뉴 바
    UI.panel(g, 16, 436, 628, 90, "#231a36");
    const mr = missionsReady();
    [["캐릭터", "up", "#ff8a3d", () => { scene = "chars"; }], ["뽑기", "chest", "#c58aff", () => { scene = "gacha"; }], ["미션", "flag", "#ffd34d", () => { scene = "missions"; }],
      ["도감", "book", "#9fffb0", () => { scene = "dex"; }], ["소리", "sound", "#7fe6ff", () => RD.audio && RD.audio.toggle()], ["테스트", "gear", "#7fe08a", () => { testMode = !testMode; save.set("testMode", testMode); }]]
      .forEach(([label, ic, col, fn], i) => {
        const x = 26 + i * 103, y = 448, w = 94;
        UI.btn(g, x, y, w, 66, "#2b2140");
        UI.icon(g, ic, x + w / 2 - 12, y + 8, 24, col);
        RD.text(g, label, x + w / 2, y + 48, 14, "#fff", "center");
        if (label === "테스트" && testMode) UI.chip(g, x + 56, y - 8, 36, 14, "#7fe08a", "ON", 10);
        if (label === "미션" && mr) UI.chip(g, x + 66, y - 8, 26, 16, "#ff4d5e", String(mr), 11, "#fff");
        buttons.push({ x, y, w, h: 66, onClick: fn });
      });
    // 출격
    button(660, 436, 284, 90, "출격!", startRun, "#ff8a3d", subtitle());
  }

  // ---------- 일일 미션 ----------
  function backHeader(title, sub) {
    menuBackdrop();
    UI.panel(g, 16, 12, 40, 40); UI.icon(g, "back", 24, 20, 24, "#fff");
    buttons.push({ x: 16, y: 12, w: 40, h: 40, onClick: () => { scene = "select"; } });
    RD.text(g, title, 72, 33, 24, "#fff");
    if (sub) RD.text(g, sub, 72 + g.measureText(title).width + 16, 35, 13, "#9fffb0");
    coinBox(C.width - 196, 14, 180);
  }
  function drawMissions() {
    ensureMissions();
    const now = new Date(), mid = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const left = Math.max(0, mid - now), hh = Math.floor(left / 3600000), mm = Math.floor((left % 3600000) / 60000);
    backHeader("일일 미션", `새 미션까지 ${hh}시간 ${mm}분`);
    missions.list.forEach((m, i) => {
      const y = 78 + i * 112, done = m.prog >= m.n, rw = RD.MISSION_REWARD[i];
      UI.panel(g, 30, y, 900, 96, m.claimed ? "#1d1428" : "#2b2140");
      UI.iconBox(g, 46, y + 20, 56, { kills: "skull", boss: "skull", runs: "flag", score: "star", ult: "bolt", duel: "target", raid: "sword", char: "up", survive: "clock", gacha: "chest" }[m.id] || "flag", done ? "#ffd34d" : "#7fe6ff");
      UI.fitText(g, missionText(m), 124, y + 30, 520, 18, m.claimed ? "#7a6a90" : "#fff");
      UI.segBar(g, 124, y + 54, 520, 14, m.prog / m.n, done ? "#ffd34d" : "#7fe6ff");
      RD.text(g, `${Math.floor(Math.min(m.prog, m.n)).toLocaleString()} / ${m.n.toLocaleString()}`, 644, y + 82, 11, "#cfc6e0", "right");
      UI.icon(g, "coin", 672, y + 30, 20, "#ffd34d");
      RD.text(g, `+${rw}`, 700, y + 40, 16, "#ffd34d");
      if (m.claimed) UI.chip(g, 770, y + 26, 140, 44, "#3d2f5a", "받음", 15, "#9a8ab8");
      else button(770, y + 24, 140, 48, done ? "받기" : "진행 중", () => {
        if (!done || m.claimed) return;
        m.claimed = true; coins += rw; save.set("coins", coins); save.set("missions", missions); RD.audio && RD.audio.sfx("coin");
      }, done ? "#ffd34d" : "#4a3d60");
    });
    // 모두 완료 보너스
    const all = missions.list.every((m) => m.claimed);
    const y = 420;
    UI.panel(g, 30, y, 900, 96, "#231a36");
    UI.iconBox(g, 46, y + 20, 56, "chest", all ? "#ff8a3d" : "#5a4a70");
    RD.text(g, "미션 3개 모두 받기 보너스", 124, y + 34, 18, "#fff");
    RD.text(g, "매일 밤 12시에 새 미션 3개가 나온다", 124, y + 62, 12, "#b9add0");
    RD.text(g, `+${RD.MISSION_BONUS}`, 700, y + 38, 16, "#ffd34d");
    RD.text(g, `각성석 +${RD.AWAKEN.sources.missionBonus}`, 700, y + 60, 11, "#ff9ad8");
    if (missions.bonus) UI.chip(g, 770, y + 26, 140, 44, "#3d2f5a", "받음", 15, "#9a8ab8");
    else button(770, y + 24, 140, 48, all ? "보너스 받기" : "잠김", () => {
      if (!all || missions.bonus) return;
      missions.bonus = true; coins += RD.MISSION_BONUS; stones += RD.AWAKEN.sources.missionBonus; save.set("stones", stones); save.set("coins", coins); save.set("missions", missions); RD.audio && RD.audio.sfx("clear");
    }, all ? "#ff8a3d" : "#4a3d60");
  }

  // ---------- 도감 ----------
  function monThumb(type) {
    const def = RD.ENEMIES[type];
    if (def.img) { const im = RD.img(def.img[0]); if (im && im.naturalWidth) return im; }
    return RD.getMonsterFrame(def.sprite, 0, false, def.variant);
  }
  function drawDex() {
    const monKeys = Object.keys(RD.DEX).filter((k) => !RD.ENEMIES[k].boss), bossKeys = Object.keys(RD.DEX).filter((k) => RD.ENEMIES[k].boss);
    const seen = Object.keys(RD.DEX).filter((k) => dex[k]).length;
    backHeader("도감", `${seen}/${Object.keys(RD.DEX).length} 등록 · 새로 등록하면 코인 +${RD.DEX_REWARD}`);
    [["mon", "몬스터", "#9fffb0"], ["boss", "보스", "#ff4d5e"], ["char", "캐릭터", "#ffd34d"]].forEach(([id, label, col], i) => tab(30 + i * 130, 66, 120, 32, label, dexTab === id, col, () => { dexTab = id; dexSel = null; }));
    UI.panel(g, 30, 112, 640, 410, "#231a36");
    const list = dexTab === "mon" ? monKeys : dexTab === "boss" ? bossKeys : RD.CHARACTERS.map((c) => c.id);
    const cols = 5, cw = 118, chh = dexTab === "char" ? 186 : 92;
    list.forEach((k, i) => {
      const x = 42 + (i % cols) * (cw + 8), y = 124 + Math.floor(i / cols) * (chh + 8);
      const isChar = dexTab === "char", ch = isChar ? RD.CHARACTERS.find((c) => c.id === k) : null;
      const got = isChar ? isOwned(RD.CHARACTERS.indexOf(ch)) : !!dex[k];
      g.fillStyle = dexSel === k ? "#ffd34d" : "#1d1622"; g.fillRect(x - 3, y - 3, cw + 6, chh + 6);
      g.fillStyle = got ? "#2b2140" : "#18111f"; g.fillRect(x, y, cw, chh);
      if (isChar) {
        UI.portrait(g, ch, x + 4, y + 4, cw - 8, chh - 54);
        if (!got) { g.fillStyle = "rgba(10,6,20,0.75)"; g.fillRect(x + 4, y + 4, cw - 8, chh - 54); }
        UI.fitText(g, got ? ch.name : "???", x + cw / 2, y + chh - 38, cw - 8, 12, got ? "#fff" : "#7a6a90", "center");
        UI.chip(g, x + 10, y + chh - 24, cw - 20, 16, mlv(k) >= 10 ? "#ffd34d" : "#7fe6ff", `숙련 Lv.${mlv(k)}`, 10);
      } else {
        const im = monThumb(k), s = Math.min((cw - 16) / im.width, (chh - 30) / im.height);
        g.imageSmoothingEnabled = !!RD.ENEMIES[k].img;
        if (!got) g.globalAlpha = 0.18;
        g.drawImage(im, x + (cw - im.width * s) / 2, y + 4 + (chh - 30 - im.height * s) / 2, im.width * s, im.height * s);
        g.globalAlpha = 1; g.imageSmoothingEnabled = false;
        UI.fitText(g, got ? RD.DEX[k][0] : "???", x + cw / 2, y + chh - 13, cw - 8, 12, got ? "#fff" : "#7a6a90", "center");
      }
      buttons.push({ x, y, w: cw, h: chh, onClick: () => { dexSel = k; } });
    });
    // 오른쪽 설명
    UI.panel(g, 686, 66, 258, 456, "#1d1428");
    if (!dexSel) { RD.text(g, "칸을 눌러 자세히 보기", 815, 290, 13, "#9a8ab8", "center"); return; }
    if (dexTab === "char") {
      const ch = RD.CHARACTERS.find((c) => c.id === dexSel), lv = mlv(ch.id), xp = mxp(ch.id), N = RD.MASTERY.need;
      UI.portrait(g, ch, 698, 78, 234, 150);
      UI.fitText(g, ch.name, 815, 246, 230, 18, "#fff", "center");
      RD.text(g, titleOf(ch) || "칭호 없음", 815, 268, 12, lv >= 10 ? "#ffd34d" : "#9fffb0", "center");
      RD.text(g, `숙련 Lv.${lv}`, 698, 292, 14, "#7fe6ff");
      RD.text(g, lv >= 10 ? "최고 레벨" : `${xp} / ${N[lv]}`, 932, 292, 11, "#cfc6e0", "right");
      UI.segBar(g, 698, 302, 234, 10, lv >= 10 ? 1 : (xp - N[lv - 1]) / (N[lv] - N[lv - 1]), "#7fe6ff");
      RD.MASTERY.rewards.forEach((r, l) => {
        if (!r) return;
        const y = 326 + (l - 2) * 21, on = lv >= l;
        RD.text(g, `Lv.${l}`, 698, y, 11, on ? "#ffd34d" : "#6a5a80");
        UI.fitText(g, r.passive ? `패시브: ${RD.MASTERY.passive[ch.id]}` : r.text + (r.title ? ` "${r.title(shortName(ch))}"` : ""), 736, y, 196, 11, on ? "#fff" : "#7a6a90");
      });
      return;
    }
    const got = !!dex[dexSel], def = RD.ENEMIES[dexSel];
    const im = monThumb(dexSel), s = Math.min(220 / im.width, 170 / im.height);
    g.imageSmoothingEnabled = !!def.img;
    if (!got) g.globalAlpha = 0.18;
    g.drawImage(im, 815 - im.width * s / 2, 80 + (170 - im.height * s) / 2, im.width * s, im.height * s);
    g.globalAlpha = 1; g.imageSmoothingEnabled = false;
    UI.fitText(g, got ? RD.DEX[dexSel][0] : "???", 815, 272, 230, 20, "#fff", "center");
    UI.chip(g, 760, 290, 110, 18, def.boss ? "#ff4d5e" : def.midboss || def.elite ? "#ff8a3d" : "#9fffb0", def.boss ? "보스" : def.midboss ? "중간 보스" : def.elite ? "정예" : "몬스터", 11);
    const desc = got ? RD.DEX[dexSel][1] : "아직 만나지 못했다. 쓰러뜨리면 등록된다";
    g.font = `bold 12px ${RD.FONT}`;
    const lines = [""];
    for (const w of desc.split(" ")) { const t = (lines[lines.length - 1] + " " + w).trim(); if (g.measureText(t).width > 226) lines.push(w); else lines[lines.length - 1] = t; }
    lines.slice(0, 4).forEach((l, i) => RD.text(g, l, 815, 330 + i * 18, 12, "#cfc6e0", "center"));
    if (got) { RD.text(g, "쓰러뜨린 수", 702, 430, 12, "#b9add0"); RD.text(g, dex[dexSel].toLocaleString(), 930, 430, 16, "#ffd34d", "right"); }
  }

  // ---------- 결투 매칭 ----------
  function drawMatch(dt) {
    menuBackdrop();
    match.t += dt;
    const S = RD.DUEL.searchTime, me = RD.CHARACTERS[selected], rv = RD.CHARACTERS.find((c) => c.id === match.rival);
    if (match.t < S + 1.6) {
      // 상대 찾는 중 → 없으면 AI
      UI.panel(g, 230, 120, 500, 300, "#231a36");
      const ai = match.t >= S;
      RD.text(g, ai ? "대전 상대를 찾지 못했어요" : "대전 상대를 찾는 중", 480, 170, 22, ai ? "#ff8a8a" : "#fff", "center");
      if (!ai) {
        for (let i = 0; i < 8; i++) {
          const a = match.t * 4 + (i / 8) * Math.PI * 2, on = i === Math.floor(match.t * 8) % 8;
          g.fillStyle = on ? "#ff5ad8" : "#3d2f5a"; g.fillRect(480 + Math.cos(a) * 46 - 6, 270 + Math.sin(a) * 46 - 6, 12, 12);
        }
        RD.text(g, `${Math.floor(match.t)}초 · 트로피 ${trophy} 근처 상대`, 480, 350, 13, "#b9add0", "center");
      } else {
        UI.iconBox(g, 448, 222, 64, "gear", "#ff5ad8");
        RD.text(g, "AI 라이벌과 매칭합니다", 480, 330, 18, "#ffd34d", "center");
        RD.text(g, `실력 Lv.${match.aiLv}`, 480, 356, 13, "#b9add0", "center");
      }
      button(390, 440, 180, 56, "매칭 취소", () => { match = null; scene = "select"; }, "#5a4a78");
      return;
    }
    // VS 화면
    const k = Math.min(1, (match.t - S - 1.6) * 3);
    UI.panel(g, 40 - (1 - k) * 400, 80, 380, 360, "#231a36");
    UI.portrait(g, me, 50 - (1 - k) * 400, 90, 360, 260);
    UI.fitText(g, "나", 230 - (1 - k) * 400, 372, 340, 22, "#7fe6ff", "center");
    UI.fitText(g, me.name + (titleOf(me) ? ` · ${titleOf(me)}` : ""), 230 - (1 - k) * 400, 404, 340, 14, "#fff", "center");
    UI.panel(g, 540 + (1 - k) * 400, 80, 380, 360, "#231a36");
    UI.portrait(g, rv, 550 + (1 - k) * 400, 90, 360, 260);
    UI.fitText(g, match.name, 730 + (1 - k) * 400, 372, 340, 22, "#ff8a8a", "center");
    UI.fitText(g, `${rv.name} · AI 실력 Lv.${match.aiLv}`, 730 + (1 - k) * 400, 404, 340, 14, "#fff", "center");
    RD.text(g, "VS", 480, 260, 64 * (0.6 + 0.4 * k), "#ff5ad8", "center");
    if (match.t > S + 3.8) { match.go = true; startRun(); }
  }

  // 성급 보상 창 (캐릭터 화면에서 별을 누르면)
  let starPopup = false, awakenFx = null;
  function awakenNow(c) {
    const need = RD.AWAKEN.stones[c.grade];
    if (testMode) { form[c.id] = "awake"; save.set("form", form); }
    else {
      if (starsOf(c.id) < 6 || awak[c.id] || stones < need || coins < RD.AWAKEN.coins) return;
      stones -= need; coins -= RD.AWAKEN.coins;
      awak[c.id] = true; owned[c.id] = 1; form[c.id] = "awake"; save.set("form", form); // 성급은 0성부터 다시
      save.set("awak", awak); save.set("owned", owned); save.set("stones", stones); save.set("coins", coins);
    }
    starPopup = false;
    awakenFx = { t: 0, id: c.id };
    RD.audio && RD.audio.sfx("levelup");
  }
  function drawStarPopup(ch0) {
    const base = RD.CHARACTERS.find((c) => c.id === ch0.id), st = starsOf(base.id), T = RD.STAR_TRAITS[base.id] || {}, aw = awakOf(base.id) || (testMode && useAwake(base.id));
    buttons = [];
    g.fillStyle = "rgba(10,6,20,0.82)"; g.fillRect(0, 0, C.width, C.height);
    UI.panel(g, 120, 24, 720, 492, "#231a36");
    RD.text(g, `${ch0.name} 성급`, 142, 52, 22, "#ffd34d");
    RD.text(g, aw ? "각성한 캐릭터 · 성급을 0성부터 다시 올린다" : "같은 캐릭터를 또 뽑으면 성급이 오른다 · 왕별(6성)이면 각성 가능", 142, 76, 12, "#b9add0");
    UI.chip(g, 712, 40, 112, 22, "#ff9ad8", `각성석 ${stones}`, 12);
    for (let n = 1; n <= G.maxStars; n++) {
      const y = 92 + (n - 1) * 44, on = st >= n;
      g.fillStyle = on ? "#2f2550" : "#1d1428"; g.fillRect(142, y, 676, 38);
      UI.stars(g, 152, y + 12, n, n, 1.3);
      RD.text(g, starName(n), 262, y + 19, 12, n >= 6 ? "#ff5ad8" : "#ffd34d");
      RD.text(g, `공격력 +${Math.round(G.starDmg * (n - 1) * 100)}% · 체력 +${Math.round(G.starHpPct * (n - 1) * 100)}%`, 318, y + 11, 11, on ? "#fff" : "#7a6a90");
      if (T[n]) { UI.chip(g, 318, y + 21, 30, 13, on ? "#ffd34d" : "#4a3d60", "특성", 8, on ? "#1d1622" : "#9a8ab8"); UI.fitText(g, T[n], 354, y + 28, 440, 11, on ? "#9fffb0" : "#7a6a90"); }
      if (on && n === st) UI.chip(g, 756, y + 9, 54, 18, "#7fe6ff", "지금", 10);
    }
    // 각성
    const ay = 362, F = RD.AWAKEN.forms[base.id], need = RD.AWAKEN.stones[base.grade];
    UI.panel(g, 142, ay, 676, 94, aw ? "#3a2050" : "#2b1d3a", "#ff5ad8");
    RD.text(g, aw ? "각성 완료" : "캐릭터 각성", 156, ay + 18, 15, "#ff5ad8");
    UI.fitText(g, `${F.name} [${F.epithet}] · ${F.shot}: ${F.desc}`, 156, ay + 42, 640, 12, "#fff");
    if (aw) RD.text(g, "공격 방식이 바뀌고 체력·공격력 +20%. 성급은 0성부터 다시 올린다", 156, ay + 70, 12, "#b9add0");
    else {
      const ok1 = st >= 6, ok2 = stones >= need, ok3 = coins >= RD.AWAKEN.coins, can = testMode || (ok1 && ok2 && ok3);
      RD.text(g, `왕별 ${ok1 ? "✓" : `(지금 ${starName(st)})`}`, 156, ay + 70, 12, ok1 ? "#9fffb0" : "#ff8a8a");
      RD.text(g, `각성석 ${stones}/${need}`, 290, ay + 70, 12, ok2 ? "#9fffb0" : "#ff8a8a");
      RD.text(g, `코인 ${RD.AWAKEN.coins}`, 420, ay + 70, 12, ok3 ? "#9fffb0" : "#ff8a8a");
      button(640, ay + 46, 164, 40, testMode ? "각성 (테스트)" : "각성하기", () => { if (can) awakenNow(base); }, can ? "#ff5ad8" : "#4a3d60");
    }
    button(380, 466, 200, 40, "닫기", () => { starPopup = false; }, "#5a4a78");
  }
  // 각성 연출
  function drawAwakenFx(dt) {
    awakenFx.t += dt;
    const t = awakenFx.t, c = RD.awakenedChar(awakenFx.id), F = RD.AWAKEN.forms[awakenFx.id];
    buttons = [{ x: 0, y: 0, w: C.width, h: C.height, onClick: () => { if (t > 1) awakenFx = null; } }];
    g.fillStyle = `rgba(10,6,20,${Math.min(0.92, t * 2)})`; g.fillRect(0, 0, C.width, C.height);
    g.save(); g.translate(C.width / 2, 250);
    for (let i = 0; i < 16; i++) { g.rotate(Math.PI / 8 + t * 0.01); g.fillStyle = `rgba(255,90,216,${0.08 * Math.min(1, t)})`; g.beginPath(); g.moveTo(0, 0); g.lineTo(600, -50); g.lineTo(600, 50); g.fill(); }
    g.restore();
    const k = Math.min(1, t * 1.5);
    if (t < 0.4) { g.fillStyle = `rgba(255,255,255,${1 - t / 0.4})`; g.fillRect(0, 0, C.width, C.height); }
    UI.panel(g, C.width / 2 - 170, 70 + (1 - k) * 40, 340, 260, "#1d1428", F.color);
    UI.portrait(g, c, C.width / 2 - 164, 76 + (1 - k) * 40, 328, 248);
    RD.text(g, "각성!", C.width / 2, 372, 40, "#ff5ad8", "center");
    RD.text(g, `${c.name}`, C.width / 2, 414, 26, "#fff", "center");
    RD.text(g, `[${c.epithet}]`, C.width / 2, 446, 16, F.color, "center");
    RD.text(g, `새 공격: ${F.shot}`, C.width / 2, 476, 13, "#cfc6e0", "center");
    if (t > 1) RD.text(g, "화면을 누르면 닫힘", C.width / 2, 508, 11, "#9a8ab8", "center");
    if (t > 6) awakenFx = null;
  }

  // 캐릭터 선택과 상세
  function drawChars() {
    menuBackdrop();
    UI.panel(g, 16, 12, 40, 40); UI.icon(g, "back", 24, 20, 24, "#fff");
    buttons.push({ x: 16, y: 12, w: 40, h: 40, onClick: () => { scene = "select"; } });
    RD.text(g, "캐릭터 선택", 72, 33, 24, "#fff");
    RD.text(g, `보유 ${ownedCount()}/${RD.CHARACTERS.length}`, 216, 35, 13, "#9fffb0");
    coinBox(C.width - 196, 14, 180);
    // 카드 줄
    const NC = RD.CHARACTERS.length, gap = 10;
    const cw = Math.floor((C.width - 32 - gap * (NC - 1)) / NC), chh = 168;
    RD.CHARACTERS.forEach((c, i) => {
      const x = 16 + i * (cw + gap), y = 66, sel = i === selected, own = isOwned(i), gc = UI.gradeCol(c.grade);
      g.fillStyle = sel ? "#ffd34d" : gc; g.fillRect(x - 4, y - 4, cw + 8, chh + 8);
      g.fillStyle = "#2b2140"; g.fillRect(x, y, cw, chh);
      UI.portrait(g, c, x + 6, y + 6, cw - 12, 100);
      if (!own) { g.fillStyle = "rgba(10,6,20,0.7)"; g.fillRect(x + 6, y + 6, cw - 12, 100); UI.icon(g, "lock", x + cw / 2 - 12, y + 30, 24, "#fff"); UI.chip(g, x + 10, y + 70, cw - 20, 18, "#c58aff", "뽑기로 얻기", 10, "#fff"); }
      UI.chip(g, x + cw - 40, y + 2, 36, 16, gc, RD.GRADES[c.grade].name, 10);
      if (sel) UI.chip(g, x - 2, y - 2, 34, 16, "#ffd34d", "선택", 10);
      const dc = dispChar(i);
      UI.fitText(g, dc.name, x + cw / 2, y + 124, cw - 8, 14, own ? (dc.awakened ? "#ff9ad8" : "#fff") : "#9a8ab8", "center");
      if (dc.awakened) UI.chip(g, x + 4, y + 86, 40, 16, "#ff5ad8", "각성", 10, "#fff");
      else if (own && starsOf(c.id) >= 6) UI.chip(g, x + 4, y + 86, 60, 16, "#ffd34d", "각성 가능", 9);
      const st = starsOf(c.id);
      UI.stars(g, x + (cw - G.maxStars * 13) / 2, y + 140, st, G.maxStars, 1.4);
      if (own) RD.text(g, starName(st), x + cw / 2, y + 158, 10, st >= 6 ? "#ff5ad8" : "#b9add0", "center");
      buttons.push({ x, y, w: cw, h: chh, onClick: () => { selected = i; if (own) save.set("char", i); } });
    });
    // 상세
    const ch = dispChar(selected), own = isOwned(selected);
    UI.panel(g, 16, 250, 928, 278, "#231a36");
    UI.panel(g, 28, 262, 180, 254, "#1d1428");
    UI.portrait(g, ch, 31, 265, 174, 248, Math.floor(menuT * 8) % 4);
    // 일반 / 각성 전환 (각성했거나 테스트 모드)
    const bid = RD.CHARACTERS[selected].id;
    if (own && awakAvail(bid)) {
      const aw = useAwake(bid);
      g.fillStyle = "rgba(10,6,20,0.75)"; g.fillRect(31, 477, 174, 36);
      tab(36, 482, 80, 26, "일반", !aw, "#7fe6ff", () => setForm(bid, "normal"));
      tab(120, 482, 80, 26, "각성", aw, "#ff5ad8", () => setForm(bid, "awake"));
      if (testMode && !awak[bid]) UI.chip(g, 36, 462, 100, 14, "#7fe08a", "테스트 모드", 9);
    }
    UI.fitText(g, ch.name, 224, 282, 200, 24, "#fff");
    UI.chip(g, 432, 270, 50, 22, UI.gradeCol(ch.grade), RD.GRADES[ch.grade].name, 12);
    if (ch.awakened) RD.text(g, `[${ch.epithet}]`, 224, 261, 11, "#ff9ad8");
    UI.chip(g, 490, 270, 60, 22, "#3d2f5a", ch.type, 12, "#fff");
    UI.stars(g, 560, 273, starsOf(ch.id), G.maxStars, 1.6);
    buttons.push({ x: 556, y: 266, w: 80, h: 26, onClick: () => { starPopup = true; } });
    // 숙련도 (누르면 도감의 숙련 보상 목록)
    const ml = mlv(ch.id);
    UI.chip(g, 640, 270, 58, 22, ml >= 10 ? "#ffd34d" : "#7fe6ff", `숙련 ${ml}`, 11);
    buttons.push({ x: 640, y: 270, w: 58, h: 22, onClick: () => { dexTab = "char"; dexSel = ch.id; scene = "dex"; } });
    const rows = [["일반 공격", "sword", "#ff8a3d", ch.shot.name, ch.desc],
      ["전용 강화", "up", "#c58aff", ch.sig.name, ch.sig.desc],
      ["궁극기", "bolt", "#ffd34d", ch.bomb.name, ch.bomb.desc],
      ["패시브", "shield", "#9fffb0", ch.passive ? ch.passive.split(":")[0] : "없음", ch.passive ? ch.passive.split(":").slice(1).join(":").trim() : "-"]];
    rows.forEach(([k, ic, col, name, desc], i) => {
      const y = 304 + i * 54;
      UI.panel(g, 222, y, 470, 46, "#2b2140");
      UI.iconBox(g, 230, y + 6, 34, ic, col);
      RD.text(g, k, 274, y + 23, 11, "#9a8ab8");
      UI.fitText(g, name, 340, y + 15, 340, 15, "#fff");
      UI.fitText(g, desc, 340, y + 34, 340, 11, "#cfc6e0");
    });
    // 능력치
    UI.panel(g, 706, 262, 226, 140, "#1d1428");
    RD.text(g, "능력치", 718, 280, 13, "#ffd34d");
    UI.icon(g, "heart", 846, 272, 14, "#ff4d6a");
    RD.text(g, `체력 ${RD.CHAR_HP[ch.id] || 100}` + (ch.id === "mech" ? "+메카" : ""), 922, 280, 12, "#fff", "right");
    const S = RD.STATS[ch.id] || [5, 5, 5, 5];
    [["공격", "#ff8a3d"], ["사거리", "#7fe6ff"], ["생존", "#9fffb0"], ["난이도", "#ff4d5e"]].forEach(([k, col], i) => {
      const y = 302 + i * 25;
      RD.text(g, k, 718, y + 6, 12, "#fff");
      UI.segBar(g, 770, y, 120, 12, S[i] / 10, col, 10);
      RD.text(g, String(S[i]), 922, y + 6, 12, "#cfc6e0", "right");
    });
    if (own) button(706, 414, 226, 102, "이 캐릭터로 출격", () => { save.set("char", selected); startRun(); }, "#ff8a3d", subtitle());
    else button(706, 414, 226, 102, "뽑기로 얻기", () => { scene = "gacha"; }, "#c58aff", `${RD.GRADES[ch.grade].name} 등급`);
  }

  // ---------- 뽑기 화면 ----------
  function drawGacha() {
    menuBackdrop();
    if (gachaResult && gachaResult.state !== "cards") { drawGachaResult(); return; }
    // 위: 뒤로, 제목, 코인
    UI.panel(g, 16, 12, 40, 40); UI.icon(g, "back", 24, 20, 24, "#fff");
    buttons.push({ x: 16, y: 12, w: 40, h: 40, onClick: () => { gachaResult = null; scene = "select"; } });
    RD.text(g, gachaResult ? "뽑기 결과" : "캐릭터 뽑기", 72, 33, 24, gachaResult ? "#ffd34d" : "#fff");
    coinBox(C.width - 196, 14, 180);
    if (gachaResult) { drawGachaResult(); return; }
    // 확률표와 전설 확정까지 남은 횟수
    UI.panel(g, 260, 64, 440, 66, "#231a36");
    const rate = { MY: G.rates.MY, SSR: G.rates.SSR, SR: G.rates.SR, R: G.rates.R, C: 1 - G.rates.MY - G.rates.SSR - G.rates.SR - G.rates.R };
    ["MY", "SSR", "SR", "R", "C"].forEach((gr, i) => {
      const x = 272 + i * 86;
      g.fillStyle = UI.gradeCol(gr); g.fillRect(x, 74, 10, 10);
      RD.text(g, `${RD.GRADES[gr].name} ${(rate[gr] * 100).toFixed(rate[gr] < 0.01 ? 1 : 1)}%`, x + 15, 80, 11, UI.gradeCol(gr));
    });
    RD.text(g, `전설 확정까지 ${G.pity - pity}회`, 272, 110, 13, "#fff");
    UI.segBar(g, 420, 104, 230, 12, pity / G.pity, "#ffd34d", 10);
    RD.text(g, `${pity}/${G.pity}`, 690, 110, 11, "#9a8ab8", "right");
    // 왼쪽: 픽업 (가장 높은 등급 캐릭터)
    const pick = RD.CHARACTERS.find((c) => c.grade === "MY") || RD.CHARACTERS.find((c) => c.grade === "SSR");
    UI.panel(g, 16, 148, 220, 270, "#231a36");
    UI.chip(g, 24, 140, 86, 20, "#ffd34d", "이번 주 픽업", 11);
    UI.panel(g, 28, 170, 196, 200, "#1d1428");
    UI.portrait(g, pick, 30, 172, 192, 196, Math.floor(menuT * 8) % 4);
    UI.fitText(g, pick.name, 30, 394, 130, 15, "#fff");
    UI.chip(g, 168, 384, 52, 20, UI.gradeCol(pick.grade), RD.GRADES[pick.grade].name, 11);
    // 가운데: 소환 마법진과 보물 상자
    const cx = 480, cy = 290;
    g.fillStyle = "rgba(197,138,255,0.18)"; g.beginPath(); g.moveTo(cx - 40, 130); g.lineTo(cx + 40, 130); g.lineTo(cx + 90, cy); g.lineTo(cx - 90, cy); g.fill();
    g.save(); g.translate(cx, cy); g.scale(1, 0.38);
    for (let r = 0; r < 3; r++) {
      g.rotate(menuT * (r % 2 ? -0.6 : 0.5));
      g.strokeStyle = r === 1 ? "#ffd34d" : "#c58aff"; g.lineWidth = 6; g.setLineDash(r === 0 ? [18, 10] : []);
      g.beginPath(); g.arc(0, 0, 150 - r * 30, 0, Math.PI * 2); g.stroke();
    }
    g.setLineDash([]); g.restore();
    const bob = Math.sin(menuT * 2) * 6;
    UI.btn(g, cx - 60, cy - 120 + bob, 120, 96, "#a07a3a");
    g.fillStyle = "#6b4a22"; g.fillRect(cx - 60, cy - 84 + bob, 120, 8);
    g.fillStyle = "#ffd34d"; g.fillRect(cx - 12, cy - 92 + bob, 24, 24);
    g.fillStyle = "#1d1622"; g.fillRect(cx - 4, cy - 84 + bob, 8, 8);
    for (let i = 0; i < 12; i++) { g.fillStyle = `rgba(255,211,77,${0.4 + 0.4 * Math.sin(menuT * 3 + i)})`; g.fillRect(cx + Math.cos(i + menuT) * 140, cy - 60 + Math.sin(i * 2.1 + menuT) * 90, 4, 4); }
    // 오른쪽: 나올 수 있는 캐릭터
    UI.panel(g, 724, 148, 220, 270, "#231a36");
    RD.text(g, "나올 수 있는 캐릭터", 736, 166, 13, "#ffd34d");
    [...RD.CHARACTERS].sort((a, b) => ["MY", "SSR", "SR", "R", "C"].indexOf(a.grade) - ["MY", "SSR", "SR", "R", "C"].indexOf(b.grade)).forEach((c, i) => {
      const y = 186 + i * 28;
      UI.fitText(g, c.name + (starsOf(c.id) ? ` ★${starsOf(c.id)}` : ""), 736, y + 10, 140, 13, starsOf(c.id) ? "#fff" : "#9a8ab8");
      UI.chip(g, 888, y + 1, 46, 18, UI.gradeCol(c.grade), RD.GRADES[c.grade].name, 10);
    });
    // 아래: 뽑기 버튼
    const can1 = testMode || coins >= G.cost1, can10 = testMode || coins >= G.cost10;
    UI.btn(g, 16, 438, 104, 40, "#2b2140"); RD.text(g, "확률 상세", 68, 456, 13, "#fff", "center");
    buttons.push({ x: 16, y: 438, w: 104, h: 40, onClick: () => { gachaInfo = !gachaInfo; } });
    RD.text(g, "중복 = 성급 ★+1", 16, 500, 11, "#9a8ab8");
    button(300, 430, 280, 96, "1회 뽑기", () => gacha(1), can1 ? "#7fe6ff" : "#4a3d5c", testMode ? "무료" : `코인 ${G.cost1}`);
    button(600, 430, 344, 96, "10회 뽑기", () => gacha(10), can10 ? "#ff8a3d" : "#4a3d5c", testMode ? "무료" : `코인 ${G.cost10.toLocaleString()}`);
    UI.chip(g, 612, 420, 140, 20, "#ffd34d", "희귀 이상 1개 보장", 11);
    if (!can1) RD.text(g, "코인이 부족해요. 게임을 해서 모으세요", 440, 515, 12, "#ff8a8a", "center");
    if (gachaInfo) {
      // 확률 상세 창
      g.fillStyle = "rgba(6,2,12,0.8)"; g.fillRect(0, 0, C.width, C.height);
      UI.panel(g, 230, 90, 500, 340);
      RD.text(g, "확률 상세", 480, 116, 20, "#ffd34d", "center");
      ["MY", "SSR", "SR", "R", "C"].forEach((gr, i) => {
        const y = 150 + i * 44, chars = RD.CHARACTERS.filter((c) => c.grade === gr);
        UI.chip(g, 248, y, 56, 22, UI.gradeCol(gr), RD.GRADES[gr].name, 12);
        RD.text(g, `${(rate[gr] * 100).toFixed(1)}%`, 330, y + 11, 14, "#fff");
        UI.fitText(g, chars.map((c) => c.name).join(", ") || "-", 400, y + 11, 310, 13, "#cfc6e0");
      });
      RD.text(g, `50회 안에 전설이 안 나오면 다음은 전설 확정 · 10회 뽑기는 희귀 이상 1개 보장`, 480, 386, 12, "#cfc6e0", "center");
      RD.text(g, `중복은 성급 ★+1 (공격력 +6%, 체력 +8%, ★2·4·6 특성), ★6 이후 코인 50 환급`, 480, 408, 12, "#cfc6e0", "center");
      buttons.length = 0;
      buttons.push({ x: 0, y: 0, w: C.width, h: C.height, onClick: () => { gachaInfo = false; } });
    }
  }

  // 소환 마법진: 등급에 따라 빛이 바뀐다 (전설은 무지개)
  const GRADE_GLOW = { C: [207, 216, 230], R: [95, 184, 255], SR: [197, 138, 255], SSR: [255, 211, 77], MY: [255, 90, 216] };
  function drawSummon(R) {
    const k = Math.min(1, R.st / 2);
    const cx = C.width / 2, cy = 270;
    // 처음엔 파란빛, 점점 최고 등급 색으로 (영웅/전설은 막판에 바뀐다)
    let col = R.st < 1.2 || R.best === "C" ? GRADE_GLOW.R : GRADE_GLOW[R.best];
    if ((R.best === "SSR" || R.best === "MY") && R.st > 1.5) { const h = (R.st * 400) % 360; col = null; g.strokeStyle = `hsl(${h},90%,65%)`; }
    const c = col ? `rgb(${col.join(",")})` : null;
    g.fillStyle = "rgba(4,2,12,0.85)"; g.fillRect(0, 0, C.width, C.height);
    const glow = g.createRadialGradient(cx, cy, 10, cx, cy, 260 * k + 40);
    glow.addColorStop(0, col ? `rgba(${col.join(",")},0.55)` : "rgba(255,255,255,0.6)"); glow.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = glow; g.fillRect(0, 0, C.width, C.height);
    g.save(); g.translate(cx, cy);
    for (let ring = 0; ring < 3; ring++) {
      g.rotate((ring % 2 ? -1 : 1) * R.st * (1 + ring) * 0.8);
      if (c) g.strokeStyle = c;
      g.lineWidth = 3;
      const r = (80 + ring * 45) * (0.4 + 0.6 * k);
      g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke();
      for (let q = 0; q < 8; q++) { const a = (q / 8) * Math.PI * 2; g.fillStyle = c || g.strokeStyle; g.fillRect(Math.cos(a) * r - 4, Math.sin(a) * r - 4, 8, 8); }
    }
    g.restore();
    // 빨려 드는 빛 알갱이
    for (let q = 0; q < 40; q++) {
      const a = q * 2.4 + R.st, d = ((1 - ((R.st * 0.8 + q * 0.13) % 1)) * 320);
      g.fillStyle = c || `hsl(${(q * 40 + R.st * 300) % 360},90%,65%)`;
      g.fillRect(cx + Math.cos(a) * d - 2, cy + Math.sin(a) * d - 2, 4, 4);
    }
    RD.text(g, R.st < 1.2 ? "소환 중…" : R.best === "MY" ? "!!!! 신화의 기운 !!!!" : R.best === "SSR" ? "!!! 전설의 기운 !!!" : R.best === "SR" ? "영웅의 기운!" : "소환 중…", cx, 470, 22, c || "#ffd34d", "center");
    RD.text(g, "터치해서 건너뛰기", cx, 505, 12, "#9a8aa8", "center");
  }

  // 전설/영웅 새 캐릭터 등장 장면
  function drawCutin(R) {
    const r = R.cutins[R.ci], GR = RD.GRADES[r.grade];
    const k = Math.min(1, R.st / 0.5);
    g.fillStyle = "rgba(6,2,12,0.92)"; g.fillRect(0, 0, C.width, C.height);
    // 빛살
    g.save(); g.translate(C.width * 0.62, 260); g.rotate(R.st * 0.4);
    for (let q = 0; q < 12; q++) {
      g.rotate(Math.PI / 6);
      g.fillStyle = r.grade !== "SR" ? `hsla(${(q * 30 + R.st * 120) % 360},90%,65%,0.18)` : "rgba(197,138,255,0.16)";
      g.beginPath(); g.moveTo(0, 0); g.lineTo(600, -60); g.lineTo(600, 60); g.fill();
    }
    g.restore();
    // 일러스트가 오른쪽에서 미끄러져 들어온다
    const im = RD.img(r.ch.illust);
    if (!(im && im.width)) g.drawImage(RD.getCharacterFrame(r.ch.id, "jump", 0), C.width * 0.45 + (1 - k) * 500, 60, 400, 400);
    if (im && im.width) {
      const h = 470, w = (im.width / im.height) * h;
      const x = C.width * 0.62 - w / 2 + (1 - k) * 500;
      g.save(); g.beginPath(); g.rect(C.width * 0.3, 30, C.width * 0.7, 470); g.clip();
      g.imageSmoothingEnabled = true; g.globalAlpha = k;
      g.drawImage(im, x, 30, w, h);
      g.restore(); g.imageSmoothingEnabled = false; g.globalAlpha = 1;
    }
    const tx = 40 + (1 - k) * -300;
    RD.text(g, `${GR.name} 등급!`, tx, 140, 44, GR.color);
    RD.text(g, r.ch.name, tx, 200, 34, "#ffffff");
    RD.text(g, `${r.ch.type} · ${r.ch.shot.name}`, tx, 244, 17, "#ffc49a");
    RD.text(g, `궁극기 · ${r.ch.bomb.name}`, tx, 272, 17, "#9fd0ff");
    if (r.ch.passive) RD.text(g, `패시브 · ${r.ch.passive.split(":")[0]}`, tx, 300, 17, "#9fffb0");
    RD.text(g, "NEW!", tx, 350, 30, "#ff8a3d");
    if (R.st > 0.8 && Math.floor(R.st * 2) % 2) RD.text(g, "▶ 터치", 40, 500, 14, "#ffd34d");
  }

  function drawGachaResult() {
    const R = gachaResult;
    R.st += 1 / 60;
    if (R.state === "summon") {
      drawSummon(R);
      if (R.st > 2.1) { RD.audio && RD.audio.sfx(R.best === "SSR" || R.best === "SR" ? "gacha_rare" : "gacha"); R.state = "flash"; R.st = 0; }
      return;
    }
    if (R.state === "flash") {
      const k = R.st / 0.35;
      const col = GRADE_GLOW[R.best];
      g.fillStyle = `rgba(${col.join(",")},${1 - k})`; g.fillRect(0, 0, C.width, C.height);
      g.fillStyle = `rgba(255,255,255,${Math.max(0, 1 - k * 1.5)})`; g.fillRect(0, 0, C.width, C.height);
      if (R.st > 0.35) nextGachaState(R, true);
      return;
    }
    if (R.state === "cutin") {
      drawCutin(R);
      if (R.st > 3.2) nextGachaState(R);
      return;
    }
    R.t += 1 / 60;
    const n = R.list.length;
    const cols = n === 1 ? 1 : 5, cw = n === 1 ? 200 : 164, ch = n === 1 ? 250 : 170, gap = 14;
    const x0 = (C.width - (cw * cols + gap * (cols - 1))) / 2, y0 = n === 1 ? 90 : 66;
    R.list.forEach((r, i) => {
      const x = x0 + (i % cols) * (cw + gap), y = y0 + Math.floor(i / cols) * (ch + gap + 4);
      const show = R.t > 0.2 + i * 0.12, gc = UI.gradeCol(r.grade);
      if (!show) { UI.panel(g, x, y, cw, ch, "#3a2d48"); RD.text(g, "?", x + cw / 2, y + ch / 2, 40, "#6a5a80", "center"); return; }
      const rare = ["MY", "SSR"].includes(r.grade);
      g.fillStyle = rare ? `hsl(${(R.t * 200 + i * 40) % 360},90%,65%)` : gc; g.fillRect(x - 5, y - 5, cw + 10, ch + 10);
      g.fillStyle = "#2b2140"; g.fillRect(x, y, cw, ch);
      UI.portrait(g, r.ch, x + 8, y + 8, cw - 16, ch * 0.62);
      UI.fitText(g, r.ch.name, x + cw / 2, y + ch * 0.74, cw - 10, n === 1 ? 18 : 14, "#fff", "center");
      if (r.kind === "new") UI.chip(g, x + cw / 2 - 24, y + ch * 0.82, 48, 20, gc, RD.GRADES[r.grade].name, 11);
      else {
        UI.chip(g, x + cw / 2 - 52, y + ch * 0.82, 40, 20, gc, RD.GRADES[r.grade].name, 10);
        UI.chip(g, x + cw / 2 - 6, y + ch * 0.82, 58, 20, "#3d2f5a", r.kind === "star" ? (r.stars >= 6 ? "왕별!" : `${r.stars}성`) : "코인+각성석", 10, "#ffd34d");
      }
      if (r.kind === "new") UI.chip(g, x + cw - 56, y - 10, 52, 18, "#ff4d5e", "NEW!", 11, "#fff");
    });
    if (R.t > 0.3 + n * 0.12) {
      // 등급별 개수
      UI.panel(g, 16, 450, 260, 64, "#231a36");
      ["MY", "SSR", "SR", "R", "C"].forEach((gr, k) => {
        const c = R.list.filter((r) => r.grade === gr).length;
        RD.text(g, `${RD.GRADES[gr].name} ${c}`, 28 + k * 50, 482, 12, UI.gradeCol(gr));
      });
      button(380, 446, 220, 74, "확인", () => { gachaResult = null; }, "#3d2f5a");
      const again = n === 10 ? G.cost10 : G.cost1;
      button(616, 446, 328, 74, `${n}회 더 뽑기`, () => { gachaResult = null; gacha(n); }, testMode || coins >= again ? "#ff8a3d" : "#4a3d5c", testMode ? "무료" : `코인 ${again.toLocaleString()}`);
    }
  }

  // 결과 화면
  function drawResult() {
    if (run.isAdv) RD.drawAdv(g, run); else RD.drawRun(g, run);
    run.rt = (run.rt || 0) + 1 / 60;
    const win = run.win || (run.isAdv && run.newBest);
    g.fillStyle = "rgba(10,6,20,0.86)"; g.fillRect(0, 0, C.width, C.height);
    // 승리면 빛살
    if (run.win) {
      g.save(); g.translate(C.width / 2, 60);
      for (let i = 0; i < 14; i++) { g.rotate(Math.PI / 7 + run.rt * 0.02); g.fillStyle = "rgba(255,211,77,0.06)"; g.beginPath(); g.moveTo(0, 0); g.lineTo(700, -60); g.lineTo(700, 60); g.fill(); }
      g.restore();
    } else { const gr = g.createRadialGradient(C.width / 2, 60, 20, C.width / 2, 60, 400); gr.addColorStop(0, "rgba(255,40,60,0.25)"); gr.addColorStop(1, "rgba(255,40,60,0)"); g.fillStyle = gr; g.fillRect(0, 0, C.width, C.height); }
    const title = run.isAdv ? "어드벤처 런 결과" : run.duel ? (run.win ? "결투 승리!" : "결투 패배") : run.raid ? (run.win ? "레이드 성공!" : "레이드 종료") : run.win
      ? (run.mode === "timeattack" ? "TIME UP" : run.mode === "stageselect" ? "STAGE CLEAR!" : run.mode === "dream" ? "좋은 꿈 꿨어!" : run.mode === "trumpets" ? "심판 완료" : "ALL CLEAR!")
      : run.mode === "dream" ? "잠에서 깼다…" : "GAME OVER";
    RD.text(g, title, C.width / 2, 48, 48, run.win || run.isAdv ? "#ffd34d" : "#ff4d5e", "center");
    UI.chip(g, C.width / 2 - 92, 80, 88, 22, "#ff8a3d", RD.MODES[run.mode].name, 12, "#fff");
    UI.chip(g, C.width / 2 + 4, 80, 88, 22, "#3d2f5a", run.D.name, 12, "#fff");
    // 왼쪽: 캐릭터
    const ch = RD.CHARACTERS.find((c) => c.id === run.charId);
    UI.panel(g, 16, 120, 196, 270, "#1d1428");
    UI.portrait(g, ch, 19, 123, 190, 264);
    if (!run.win && !run.isAdv) { g.fillStyle = "rgba(40,0,10,0.35)"; g.fillRect(19, 123, 190, 264); }
    // 점수
    UI.panel(g, 228, 120, 360, 130, "#231a36");
    RD.text(g, "SCORE", 244, 140, 12, "#9a8ab8");
    RD.text(g, String(run.score).padStart(7, "0"), 244, 190, 46, run.win || run.isAdv ? "#ffd34d" : "#fff");
    if (run.newBest) { g.save(); g.translate(500, 150); g.rotate(-0.08); UI.chip(g, -50, -14, 100, 28, "#ffe066", "최고 기록!", 14); g.restore(); }
    else RD.text(g, `최고 기록까지 -${Math.max(0, best - run.score).toLocaleString()}`, 244, 230, 12, "#ff8a8a");
    // 기록 칸 4개
    const reach = run.isAdv ? `${Math.floor(run.player.x / 100)}m` : run.raid ? `${Math.round((100 * run.raid.dmg) / Math.max(1, (run.boss || { maxHp: run.raid.dmg }).maxHp))}% 피해` : run.mode === "trumpets" ? (run.tr >= 0 ? RD.TRUMPETS[run.tr].name : "시작") : ["story", "hardcore", "stageselect"].includes(run.mode) ? run.stage.name : run.mode === "bossrush" ? `${run.loop}라운드` : `${Math.floor(run.t)}초`;
    const mm = Math.floor(run.t / 60), ss = Math.floor(run.t % 60);
    const tiles = run.isAdv
      ? [["달린 거리", reach, "#9fffb0", "run"], ["코인", `+${run.coins}`, "#ffd34d", "coin"], ["플레이 시간", `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`, "#fff", "clock"], ["캐릭터", ch.name, "#7fe6ff", "star"]]
      : [["격추 수", String(run.kills), "#fff", "sword"], ["레벨", `Lv.${run.level}`, "#7fe6ff", "up"], [run.raid ? "준 피해" : "도달", reach, "#9fffb0", "flag"], ["플레이 시간", `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`, "#fff", "clock"]];
    tiles.forEach(([k, v, col, ic], i) => {
      const x = 604 + (i % 2) * 172, y = 120 + Math.floor(i / 2) * 68;
      UI.panel(g, x, y, 164, 60, "#2b2140");
      UI.icon(g, ic, x + 10, y + 10, 14, "#cfc6e0");
      RD.text(g, k, x + 30, y + 17, 11, "#9a8ab8");
      UI.fitText(g, v, x + 12, y + 42, 144, 18, col);
    });
    // 이번 판 강화
    UI.panel(g, 228, 266, 440, 124, "#231a36");
    RD.text(g, "이번 판 강화", 242, 284, 13, "#ffd34d");
    const list = run.isAdv ? [] : (run.raid ? RD.BRAWL_UPS[run.charId] : RD.UPGRADES).filter((u) => run.lv(u.id));
    let cx = 242, cy = 300;
    for (const u of list) {
      const name = u.id === "sig" ? run.char.sig.name : u.id === "multi" ? run.upgradeInfo(u).name : u.name;
      const label = `${name} ${UI.roman(run.lv(u.id))}`;
      g.font = `bold 12px ${RD.FONT}`;
      const w = g.measureText(label).width + 22;
      if (cx + w > 656) { cx = 242; cy += 28; }
      if (cy > 362) break;
      g.fillStyle = "#1d1622"; g.fillRect(cx - 2, cy - 2, w + 4, 24); g.fillStyle = "#2b2140"; g.fillRect(cx, cy, w, 20); g.fillStyle = u.color; g.fillRect(cx, cy, 4, 20);
      RD.text(g, label, cx + 10, cy + 10, 12, "#fff");
      cx += w + 8;
    }
    if (!list.length) RD.text(g, run.isAdv ? "어드벤처 런은 강화가 없어요" : "강화 없음", 242, 312, 12, "#9a8ab8");
    // 획득 보상
    UI.panel(g, 684, 266, 260, 140, "#231a36");
    RD.text(g, "획득 보상", 698, 284, 13, "#ffd34d");
    const rewards = [["coin", "코인", `+${run.coins}`, "#ffd34d"], ["star", "보유 코인", coins.toLocaleString(), "#fff"]];
    if (run.duel) rewards.push(["star", "트로피", `${run.trophyGain > 0 ? "+" : ""}${run.trophyGain} → ${trophy}`, run.trophyGain > 0 ? "#ffd34d" : "#ff8a8a"]);
    else if (run.raid) rewards.push(["sword", "레이드 레벨업", run.win ? `Lv.${run.raid.lv} → Lv.${run.raid.lv + 1}` : "클리어 시 획득", run.win ? "#ffd34d" : "#6a5a80"]);
    if (run.mastery) rewards.push(["up", run.mastery.after > run.mastery.before ? `숙련 Lv.${run.mastery.after} 달성!` : `숙련도 Lv.${run.mastery.after}`, `+${run.mastery.xp}`, run.mastery.after > run.mastery.before ? "#9fffb0" : "#fff"]);
    if (run.stones) rewards.push(["star", "각성석", `+${run.stones} (보유 ${stones})`, "#ff9ad8"]);
    if (run.missionDone || run.dexNew) rewards.push(["flag", run.missionDone ? `미션 완료 ${run.missionDone}개` : "도감 새 등록", run.dexNew ? `도감 +${run.dexNew}` : "로비에서 받기", "#ffd34d"]);
    if (rewards.length > 4) rewards.splice(1, 1); // 칸이 모자라면 보유 코인 줄을 뺀다
    rewards.slice(0, 4).forEach(([ic, k, v, col], i) => {
      const y = 296 + i * 26;
      g.fillStyle = "#2b2140"; g.fillRect(696, y, 236, 24);
      UI.icon(g, ic, 702, y + 4, 16, col === "#6a5a80" ? "#6a5a80" : "#ffd34d");
      RD.text(g, k, 724, y + 12, 12, col === "#6a5a80" ? "#6a5a80" : "#fff");
      RD.text(g, v, 926, y + 12, 13, col, "right");
    });
    // 버튼
    button(400, 420, 256, 90, "로비로", () => { scene = "select"; }, "#3d2f5a");
    button(672, 420, 272, 90, run.isAdv ? "다시 달리기" : "다시 출격", startRun, "#ff8a3d");
  }

  function drawTouchHints() {
    if (run.isAdv) {
      if (run.t > 6) return;
      RD.text(g, isTouch() ? "왼쪽 누르기: 슬라이드   오른쪽 누르기: 점프 (두 번 = 2단 점프)" : "점프: Space / ↑ (두 번 = 2단 점프)    슬라이드: ↓ (누르고 있기)", C.width / 2, C.height - 50, 15, "#ffffff", "center");
      return;
    }
    if (run.choosing || run.cutscene || run.techOpen || run.paused) return;
    if (run.raid) {
      if (run.t < 7) RD.text(g, isTouch() ? "왼쪽: 이동 스틱 · 오른쪽 공격 스틱: 끌어서 조준, 떼면 발사 (톡 치면 자동 조준) · 맞히면 궁극기 충전" : "이동: WASD · 조준: 마우스 · 공격: 왼쪽 클릭/Space · 궁극기: 오른쪽 클릭/E · 맞히면 궁극기 충전", C.width / 2, C.height - 50, 13, "#ffffff", "center");
      return;
    }
    if (!isTouch()) {
      if (run.t < 6) RD.text(g, "이동: 방향키 / WASD    정밀 이동: Shift    궁극기: X    사격은 자동", C.width / 2, C.height - 50, 14, "rgba(255,255,255,0.8)", "center");
      return;
    }
    if (run.t < 5) RD.text(g, "화면을 대고 끌어서 이동 · 사격은 자동", C.width / 2, C.height / 2 + 90, 18, "#fff", "center");
    // 노란 도트 원 궁극기 버튼
    const has = run.bombs > 0, B = BOMB_BTN;
    const col = has ? "#ffe34d" : "#6a5a40";
    if (has) { g.globalAlpha = 0.25 + 0.15 * Math.sin(performance.now() / 200); g.fillStyle = col; g.beginPath(); g.arc(B.x, B.y, B.r + 8, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; }
    g.fillStyle = "#1d1622"; g.beginPath(); g.arc(B.x, B.y, B.r + 3, 0, Math.PI * 2); g.fill();
    g.fillStyle = col; g.beginPath(); g.arc(B.x, B.y, B.r, 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(0,0,0,0.18)"; g.beginPath(); g.arc(B.x, B.y + 4, B.r - 4, 0.15 * Math.PI, 0.85 * Math.PI); g.fill();
    UI.icon(g, "bolt", B.x - 12, B.y - 26, 24, has ? "#fff" : "#9a8a70");
    RD.text(g, `궁극기 ×${run.bombs}`, B.x, B.y + 14, 13, "#1d1622", "center", col);
  }

  // 일시정지 화면
  function drawPause() {
    g.fillStyle = "rgba(10,6,20,0.75)";
    g.fillRect(0, 0, C.width, C.height);
    const w = 340, h = 250, x = (C.width - w) / 2, y = (C.height - h) / 2;
    UI.panel(g, x, y, w, h);
    RD.text(g, "일시정지", C.width / 2, y + 38, 28, UI.COL.gold, "center");
    RD.text(g, `${RD.MODES[run.mode].name} · ${RD.DIFFICULTY[run.diff] ? RD.DIFFICULTY[run.diff].name : ""} · 점수 ${run.score.toLocaleString()}`, C.width / 2, y + 72, 13, "#b9add0", "center");
    button(x + 30, y + 98, w - 60, 52, "계속하기", () => { run.paused = false; }, UI.COL.orange);
    button(x + 30, y + 170, w - 60, 46, "그만두고 로비로", () => { run.paused = false; scene = "select"; }, "#5a4a78");
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
      if (scene === "play") track = run.over ? null : run.stage.music && !(run.boss && RD.ENEMIES[run.boss.type].boss) ? run.stage.music : (run.boss ? "boss" : "stage") + ":" + run.stage.transpose;
      if (scene === "result") track = null;
      RD.audio.music(track);
    }

    if (scene === "loading") {
      g.fillStyle = "#120c1c";
      g.fillRect(0, 0, C.width, C.height);
      RD.text(g, "불러오는 중...", C.width / 2, C.height / 2, 28, "#fff", "center");
    } else if (scene === "select") {
      drawSelect();
    } else if (scene === "play") {
      if (!run.paused) run.update(dt);
      if (run.isAdv) { RD.drawAdv(g, run); RD.drawSoundButton(g); RD.drawPauseButton(g); } else RD.drawRun(g, run);
      drawTouchHints();
      if (run.paused) drawPause();
      if (run.over && run.overTimer > (run.win ? 3 : 1.5)) endRun();
    } else if (scene === "result") {
      drawResult();
    } else if (scene === "chars") {
      drawChars();
      if (starPopup) drawStarPopup(dispChar(selected));
      if (awakenFx) drawAwakenFx(dt);
    } else if (scene === "missions") {
      drawMissions();
    } else if (scene === "dex") {
      drawDex();
    } else if (scene === "match") {
      drawMatch(dt);
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
    if (scene === "play" && run && run.isAdv) {
      // 세로 화면의 궁극기 버튼 = 점프
      run.input.jumpHeld = down;
      if (down) run.jump();
      return;
    }
    if (scene !== "play" || !run || !down) return;
    if (run.cutscene) { run.advanceCutscene(); return; }
    if (run.raid) { run.brawlAttack(null); return; } // 세로 화면의 버튼 = 자동 조준 공격
    if (action === "bomb") run.bomb();
  };
  RD.debugState = () => ({ scene, run, coins, owned, pity });
  RD.debugGacha = (c) => { coins = c; scene = "gacha"; };
  RD.startRun = (i) => { selected = i; startRun(); };
})();
