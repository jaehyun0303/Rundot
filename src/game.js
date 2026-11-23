// 슈팅 게임 진행: 이동과 자동 사격, 체력, 레벨업 강화 선택, 보조무기, 적과 탄막, 모드, 난이도
(function () {
  const C = RD.CONFIG;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // ---------- 스테이지 모드 진행표 ----------
  // t = 스테이지 시작 후 초. 중간 보스나 보스가 살아 있는 동안은 시간이 멈춘다.
  const STAGE = [
    [2, (r) => r.batLine(120, 5, "sine")],
    [5, (r) => r.batLine(380, 5, "sine")],
    [8.5, (r) => r.ground("slime", 3)],
    [9.5, (r) => r.special(1)],
    [11, (r) => r.batLine(240, 6, "dive")],
    [14, (r) => r.wisp(150)],
    [17, (r) => { r.batLine(110, 5, "sine"); r.batLine(390, 5, "sine"); }],
    [19, (r) => r.special(2)],
    [21, (r) => r.ground("mushroom", 2)],
    [23, (r) => r.batV(250)],
    [27, (r) => { r.wisp(130); r.wisp(360); }],
    [29, (r) => r.special(2)],
    [31, (r) => r.ground("slime", 4)],
    [33, (r) => r.batLine(200, 7, "dive")],
    [37, (r) => r.midboss()],
    [39, (r) => r.batV(170)],
    [42, (r) => { r.ground("mushroom", 3); r.batLine(140, 5, "sine"); }],
    [44, (r) => r.special(2)],
    [46, (r) => { r.wisp(120); r.wisp(250); r.wisp(380); }],
    [53, (r) => r.special(3)],
    [51, (r) => { r.batV(140); r.batV(360); }],
    [55, (r) => { r.ground("slime", 5); r.batLine(300, 6, "dive"); }],
    [59, (r) => { r.batLine(100, 6, "sine"); r.batLine(250, 6, "sine"); r.batLine(400, 6, "sine"); }],
    [62, (r) => r.special(3)],
    [64, (r) => { r.wisp(180); r.wisp(330); r.ground("mushroom", 3); }],
    [70, (r) => r.warning()],
    [73, (r) => r.spawnBoss()],
  ];
  const STORY_STAGES = RD.STORY_COUNT; // 특별 지역은 빼고
  const STORYLIKE = ["story", "hardcore", "stageselect"]; // 진행표대로 가는 모드

  // 무한 / 타임 어택 모드에서 무작위로 고르는 적 등장 패턴 (k = 강도 1~4)
  const PATTERNS = [
    (r, k) => r.batLine(rand(80, 420), 4 + k, pick(["sine", "dive"])),
    (r, k) => r.batV(rand(150, 350)),
    (r, k) => { for (let i = 0; i < Math.ceil(k / 2); i++) r.wisp(rand(90, 400)); },
    (r, k) => r.ground(pick(["slime", "mushroom"]), 1 + Math.ceil(k)),
    (r, k) => { r.batLine(rand(80, 200), 3 + k, "sine"); r.batLine(rand(300, 420), 3 + k, "sine"); },
    (r, k) => r.special(1 + Math.ceil(k / 2)),
    (r, k) => r.special(1 + Math.ceil(k / 2)),
  ];

  class Run {
    constructor(charId, mode = "story", diff = "normal", opts = {}) {
      this.stars = opts.stars || 1; // 각성 단계 (뽑기에서 중복으로 얻으면 오른다)
      this.coins = 0; // 이번 판에 모은 코인
      this.slashes = []; // 여우 베기
      this.parry = RD.FOX_PARRY.max; // 여우 베기 게이지 (탄을 벨 수 있는 횟수)
      this.shield = 0; // 고양이 마력 보호막 충전 시간
      this.charId = charId;
      this.char = RD.CHARACTERS.find((c) => c.id === charId);
      this.mode = mode;
      this.diff = diff;
      this.D = RD.DIFFICULTY[diff];
      this.t = 0;
      this.stageT = 0;
      this.stageIdx = 0;
      this.loop = 1; // 난이도 단계 (스토리는 지역 번호, 무한/보스 러시는 라운드)
      this.M = RD.MODES[mode];
      this.hazards = []; // 지형 위험 (용암 기둥, 낙뢰)
      this.wind = null; // 설원 강풍
      this.terrainT = 0;
      this.reached = 0; // 스토리에서 도달한 지역 번호 (저장용)
      this.score = 0;
      this.nextExtend = C.extendEvery;
      this.lives = this.M.lives || this.D.lives;
      this.bombs = C.bombs;
      this.kills = 0;
      this.over = false;
      this.win = false;
      this.overTimer = 0;
      this.scroll = 0;

      // 성장
      this.up = {}; // 강화 id → 단계
      this.level = 1;
      this.exp = 0;
      this.expNeed = this.needFor(1);
      this.pendingLevels = 0;
      this.choosing = null; // 레벨업 카드 선택 중이면 { options }

      this.player = { vx: 0, vy: 0, x: 160, y: 260, hp: C.maxHp + RD.GACHA.starHp * (this.stars - 1), invuln: C.respawnInvuln, hurt: 0, dead: 0, animT: 0, shotCd: 0, tilt: 0 };
      this.pet = { x: 100, y: 260, t: 0, cd: 0 };
      this.sub = { missile: 1, laser: 2, rear: 0.5, lightning: 1.5, laserOn: 0 };
      this.shots = [];
      this.enemies = [];
      this.bullets = [];
      this.items = [];
      this.effects = [];
      this.groups = {};
      this.groupId = 0;
      this.bombT = 0; // 궁극기 남은 시간
      this.ult = null; // 궁극기 상태
      this.banner = null;
      this.shake = 0;
      this.spawnT = 3;
      this.bossClock = 0;
      this.bossCount = 0;
      this.input = { dx: 0, dy: 0, focus: false, moveX: 0, moveY: 0 };

      if (mode === "bossrush") {
        // 보스 러시: 처음에 강화 3개를 고르고 시작
        this.pendingLevels = 3;
        this.rushState = { wait: 2.5, next: "golem" };
      }
      // 특별 모드는 전용 지역에서 한다
      const sp = this.M.special ? RD.STAGES.findIndex((st) => st.id === this.M.special) : -1;
      this.setStage(sp >= 0 ? sp : opts.stage || 0, true);
      this.sugar = 0; // 달콤한 꿈: 모은 사탕
      this.rush = 0; // 슈가 러시 남은 시간
      this.tr = -1; // 일곱 나팔: 몇 번째 나팔인지
      this.trT = 0;
      this.ev = {}; // 한 번만 일어나는 일 기록
      if (mode === "stageselect") {
        // 뒤쪽 지역을 고르면 따라잡을 수 있도록 강화를 미리 고른다 (지역마다 2개)
        this.loop = 1 + 0.5 * (opts.stage || 0);
        this.pendingLevels += 2 * (opts.stage || 0);
      }
      this.openChoice();
    }

    // ---------- 지역 ----------
    setStage(idx, first) {
      this.stageNo = idx;
      this.stage = RD.STAGES[idx];
      this.terrain = this.stage.effect;
      this.hazards = [];
      this.wind = null;
      this.terrainT = 0;
      this.reached = Math.max(this.reached, idx);
      this.intro = { name: this.stage.name, effect: `${this.stage.effectName}: ${this.stage.effectDesc}`, t: 0, life: first ? 3.5 : 4.5, delay: first ? 0 : 1.5 };
    }

    // ---------- 능력치 (강화 단계에서 계산) ----------
    lv(id) { return this.up[id] || 0; }
    get power() { return 1 + this.lv("multi"); }
    get dmgMul() { return (1 + 0.2 * this.lv("dmg")) * (1 + RD.GACHA.starDmg * (this.stars - 1)); }
    get maxHp() { return C.maxHp + 25 * this.lv("hp") + RD.GACHA.starHp * (this.stars - 1); }
    get armor() { return 1 - 0.15 * this.lv("armor"); }
    get magnetR() { return 100 * (1 + 0.6 * this.lv("magnet")); }
    get scoreMul() { return this.D.score * (this.M.scoreMul || 1) * (1 + 0.15 * this.lv("luck")); }
    get bossAlive() { return this.enemies.some((e) => !e.dead && (RD.ENEMIES[e.type].boss || RD.ENEMIES[e.type].midboss)); }
    get boss() { return this.enemies.find((e) => !e.dead && (RD.ENEMIES[e.type].boss || RD.ENEMIES[e.type].midboss)); }
    get bulletSpeed() { return RD.BULLET.speed * (1 + 0.12 * (this.loop - 1)) * this.D.bulletSpeed; }
    get timeLeft() { return this.mode === "timeattack" ? Math.max(0, RD.MODES.timeattack.time - this.t) : null; }

    needFor(level) { return Math.round(5 + level * 3.5 + Math.pow(level, 1.5)); }

    // ---------- 레벨업 강화 선택 ----------
    gainExp(n) {
      this.exp += n * this.D.exp;
      while (this.exp >= this.expNeed) {
        this.exp -= this.expNeed;
        this.level++;
        this.expNeed = this.needFor(this.level);
        this.pendingLevels++;
        RD.audio && RD.audio.sfx("levelup");
      }
      this.openChoice();
    }

    upgradeInfo(u) {
      if (u.id === "sig") return { name: this.char.sig.name, desc: this.char.sig.desc };
      if (u.id === "multi") {
        const names = { fox: "베기 강화", rabbit: "단검 추가", bear: "망치 추가", owl: "회오리 추가", cat: "구슬 추가" };
        return { name: names[this.charId], desc: this.char.shot.multiDesc(this.lv("multi")) };
      }
      return { name: u.name, desc: u.desc(this.lv(u.id)) };
    }

    openChoice() {
      if (this.choosing || this.pendingLevels <= 0 || this.over) return;
      const pool = RD.UPGRADES.filter((u) => this.lv(u.id) < u.max && (!u.only || u.only(this.char)));
      const options = [];
      while (options.length < 3 && pool.length) {
        // 이미 가진 강화가 조금 더 잘 나온다
        const w = pool.map((u) => (this.lv(u.id) > 0 ? 1.6 : 1));
        let r = Math.random() * w.reduce((a, b) => a + b, 0);
        let i = 0;
        while ((r -= w[i]) > 0) i++;
        options.push(pool.splice(i, 1)[0]);
      }
      // 화력이 너무 안 오르지 않도록, 주무기나 전용 강화가 하나는 끼게 한다
      const isMain = (u) => u.cat === "주무기" || u.cat === "전용";
      if (options.length === 3 && !options.some(isMain)) {
        const mains = pool.filter(isMain);
        if (mains.length) options[2] = pick(mains);
      }
      if (!options.length) { this.pendingLevels = 0; this.player.hp = this.maxHp; return; }
      this.choosing = { options, t: 0 };
    }

    choose(i) {
      if (!this.choosing) return;
      const u = this.choosing.options[i];
      if (!u) return;
      this.up[u.id] = this.lv(u.id) + 1;
      if (u.id === "hp") this.player.hp = this.maxHp;
      if (u.id === "bomb") this.bombs = Math.min(C.maxBombs + 3, this.bombs + 2);
      const info = this.upgradeInfo(u);
      this.text(`${info.name} Lv.${this.lv(u.id)}`, u.color);
      RD.audio && RD.audio.sfx("choose");
      this.choosing = null;
      this.pendingLevels--;
      this.player.invuln = Math.max(this.player.invuln, 0.8); // 고른 직후 잠깐 보호
      this.openChoice();
    }

    // ---------- 적 등장 ----------
    addEnemy(type, x, y, extra = {}) {
      const def = RD.ENEMIES[type];
      const timeScale = this.mode === "endless" || this.mode === "timeattack" ? 1 + this.t / 120 : 1;
      const hp = def.hp * (1 + 0.6 * (this.loop - 1)) * this.D.enemyHp * timeScale;
      const e = { type, x, y, hp, maxHp: hp, t: 0, flash: 0, dead: false, fireT: rand(0.6, 1.6) / this.D.fireRate, variant: def.variant || this.stage.variant, ...extra };
      this.enemies.push(e);
      return e;
    }

    newGroup(n) {
      const id = ++this.groupId;
      this.groups[id] = { killed: 0, total: n };
      return id;
    }

    batLine(y, n, path) {
      const g = this.newGroup(n);
      for (let i = 0; i < n; i++) this.addEnemy("bat", C.width + 40, y, { path, baseY: y, group: g, delay: i * 0.25 });
    }

    batV(y) {
      const g = this.newGroup(7);
      for (let i = 0; i < 7; i++) {
        const k = i - 3;
        this.addEnemy("bat", C.width + 40 + Math.abs(k) * 46, y + k * 34, { path: "straight", baseY: y + k * 34, group: g });
      }
    }

    wisp(y) { this.addEnemy("wisp", C.width + 50, y, { path: "hover", stopX: rand(640, 800) }); }

    // 지역마다 나오는 특수 몬스터
    special(n) {
      for (let i = 0; i < n; i++) {
        const type = pick(this.stage.mobs);
        const y = rand(80, C.groundY - 60);
        const x = C.width + 40 + i * 70;
        if (type === "eye") this.addEnemy("eye", x, y, { path: "snipe", stopX: rand(780, 900), fireT: 1.2 });
        if (type === "beetle") this.addEnemy("beetle", x, y, { path: "charge" });
        if (type === "fairy") this.addEnemy("fairy", x, y, { path: "hover", stopX: rand(760, 880), fireT: 2.5 });
        if (type === "bomber") this.addEnemy("bomber", x, y, { path: "homing", vx: -160, vy: 0 });
      }
    }

    ground(type, n) {
      const def = RD.ENEMIES[type];
      for (let i = 0; i < n; i++) this.addEnemy(type, C.width + 40 + i * 110, C.groundY - def.h / 2, { path: "ground" });
    }

    midboss() {
      const def = RD.ENEMIES.golem;
      this.addEnemy("golem", C.width + 80, C.groundY - def.h / 2, { path: "midboss", stopX: 780, life: 30, name: this.stage.midName });
    }

    warning() { RD.audio && RD.audio.sfx("warning"); this.banner = { text: "WARNING", sub: `${this.stage.bossName} 등장`, sub2: "특성 · " + this.stage.bossTrait, color: "#ff4d5e", t: 0, life: 3.5 }; }
    spawnBoss() {
      const type = this.stage.boss, def = RD.ENEMIES[type];
      const y = def.ground ? C.groundY - def.h / 2 : 240;
      const b = this.addEnemy(type, C.width + 160, y, { path: "boss", phase: 1, name: this.stage.bossName, baseY: y });
      if (def.style === "crystal") this.spawnShards(b);
    }

    spawnShards(b) {
      for (let i = 0; i < 4; i++) this.addEnemy("shard", b.x, b.y, { path: "orbit", parent: b, ang: (i / 4) * Math.PI * 2, variant: null });
    }

    // ---------- 모드별 진행 ----------
    direct(dt) {
      const M = this.mode;
      if (this.M.special === "dream") return this.directDream(dt);
      if (this.M.special === "judgment") return this.directJudgment(dt);
      // 혼돈 모드: 일정 시간마다 지역이 무작위로 바뀐다
      if (M === "chaos" && !this.bossAlive && (this.shiftT = (this.shiftT || 0) + dt) >= this.M.shiftEvery) {
        this.shiftT = 0;
        let n = this.stageNo;
        while (n === this.stageNo) n = Math.floor(Math.random() * STORY_STAGES);
        this.setStage(n);
      }
      if (STORYLIKE.includes(M)) {
        if (!this.bossAlive) this.stageT += dt;
        while (this.stageIdx < STAGE.length && this.stageT >= STAGE[this.stageIdx][0]) STAGE[this.stageIdx++][1](this);
        return;
      }
      if (M === "bossrush") {
        const rs = this.rushState;
        if (this.bossAlive) return;
        rs.wait -= dt;
        if (rs.wait > 0) return;
        if (rs.next === "golem") { this.midboss(); rs.next = "boss"; }
        // (보스를 잡으면 다음 지역으로 넘어간다)
        else { this.warning(); this.spawnBoss(); rs.next = "golem"; }
        rs.wait = 3;
        return;
      }
      // 무한 / 타임 어택: 무작위 패턴 + 주기적인 보스
      if (this.bossAlive) return;
      this.bossClock += dt;
      const bossEvery = M === "timeattack" ? 70 : M === "chaos" ? 75 : 80;
      if (this.bossClock >= bossEvery) {
        this.bossClock = 0;
        this.bossCount++;
        if (M !== "timeattack" && this.bossCount % 2 === 0) { this.warning(); this.spawnBoss(); }
        else this.midboss();
        return;
      }
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        const k = Math.min(4, 1 + this.t / 50);
        const base = M === "timeattack" ? 1.6 : 2.4;
        this.spawnT = Math.max(0.7, base - this.t / 90) * rand(0.8, 1.2);
        pick(PATTERNS)(this, k);
      }
    }

    // ---------- 달콤한 꿈 ----------
    directDream(dt) {
      const E = this.ev;
      // 사탕 비
      if ((this.candyT = (this.candyT || 0) - dt) <= 0) {
        this.candyT = this.rush > 0 ? 0.12 : 0.35;
        this.items.push({ type: "candy", x: rand(240, C.width + 20), y: -10, vx: rand(-90, -40), vy: rand(20, 60) });
      }
      if (this.t > 55 && !E.mid) { E.mid = true; this.midboss(); }
      if (this.t > 130 && !E.warn && !this.bossAlive) { E.warn = true; E.bossAt = this.t + 3; this.warning(); }
      if (E.bossAt && this.t >= E.bossAt && !E.boss) { E.boss = true; this.spawnBoss(); }
      if (this.bossAlive || E.boss) return;
      if ((this.spawnT -= dt) <= 0) {
        this.spawnT = rand(1.6, 2.4);
        pick(PATTERNS)(this, Math.min(3, 1 + this.t / 60));
      }
    }

    // ---------- 일곱 나팔 소리의 심판 ----------
    blowTrumpet(i) {
      const T = RD.TRUMPETS[i];
      this.tr = i;
      this.trT = 0;
      this.terrain = "t" + (i + 1);
      this.hazards = [];
      this.loop = 1 + i * 0.35;
      this.banner = { text: T.name, sub: T.line, color: "#ffd34d", t: 0, life: 4 };
      RD.audio && RD.audio.sfx("trumpet");
    }

    directJudgment(dt) {
      const angels = this.enemies.some((e) => !e.dead && e.type === "angel");
      const busy = this.bossAlive || angels;
      if (this.tr < 0) { if ((this.trT += dt) > 4.5) this.blowTrumpet(0); return; }
      if (!busy) this.trT += dt;
      const i = this.tr, E = this.ev;
      // 나팔마다 정해진 큰 사건
      if (i === 4 && this.trT > 8 && !E.abaddon) {
        E.abaddon = true;
        this.banner = { text: "WARNING", sub: "무저갱의 사자 아바돈", sub2: "특성 · 황충 떼를 부리고 무저갱의 연기를 뿜는다", color: "#ff4d5e", t: 0, life: 3.5 };
        RD.audio && RD.audio.sfx("warning");
        const def = RD.ENEMIES.boss_abaddon;
        this.addEnemy("boss_abaddon", C.width + 160, 240, { path: "boss", phase: 1, name: "무저갱의 사자 아바돈", baseY: 240 });
      }
      if (i === 5 && this.trT > 3 && !E.angels) {
        E.angels = true;
        this.banner = { text: "네 천사", sub: "큰 강 유브라데에 결박된 네 천사가 풀려났다", color: "#ffe9a0", t: 0, life: 3 };
        [100, 200, 300, 400].forEach((y, k) => this.addEnemy("angel", C.width + 40 + k * 30, y, { path: "hover", stopX: 700 + (k % 2) * 140, fireT: 1 + k * 0.3, stay: true }));
      }
      if (i === 6 && this.trT > 10 && !E.dragon) {
        E.dragon = true;
        this.warning();
        this.spawnBoss();
      }
      // 나팔이 끝나면 다음 나팔 (일곱째는 용을 쓰러뜨려야 끝)
      if (i < 6 && this.trT > 38 && !busy) { this.blowTrumpet(i + 1); return; }
      if (busy && this.bossAlive) return;
      if ((this.spawnT -= dt) <= 0) {
        this.spawnT = Math.max(0.9, 2.2 - i * 0.18) * rand(0.8, 1.2);
        pick(PATTERNS)(this, Math.min(4, 1.5 + i * 0.4));
      }
    }

    // 나팔마다 내리는 재앙 (updateTerrain 에서 부른다)
    trumpetPlague(dt) {
      const p = this.player, i = this.tr;
      const every = (key, sec) => { this[key] = (this[key] || 0) - dt; if (this[key] <= 0) { this[key] = sec; return true; } return false; };
      this._firing = null;
      if (i === 0 && every("pT", 0.28)) {
        // 피 섞인 우박과 불
        if (Math.random() < 0.5) this.shot(rand(100, C.width + 60), -10, Math.PI / 2 + 0.25, rand(220, 300), "shard", { color: "#ffffff", r: 6 });
        else this.shot(rand(100, C.width + 60), -10, Math.PI / 2 + 0.25, rand(180, 240), "fireball", { color: "#ff5a1a", r: 7 });
      }
      if (i === 1 && every("pT", 6.5)) {
        // 불붙은 큰 산이 던져진다
        this.hazards.push({ type: "meteor", sx: C.width + 120, sy: -120, ex: p.x + rand(-60, 60), ey: C.groundY - 40, t: 0, warn: 1.4, active: 0.8, w: 150, r: 75, dmg: 34 });
      }
      if (i === 2 && every("pT", 3.4)) {
        // 쓴 쑥 별: 떨어진 자리에 독 연기
        this.hazards.push({ type: "star", x: Math.random() < 0.6 ? p.x + rand(-40, 40) : rand(80, C.width - 80), t: 0, warn: 1.1, active: 0.2, w: 40, dmg: 20 });
      }
      if (i === 3 && every("pT", 6)) this.blackout = 1.4; // 해와 달과 별이 어두워진다
      if (i === 4 && every("pT", 1.5) && !this.bossAlive) {
        // 황충 떼
        const y = rand(80, C.groundY - 80);
        for (let k = 0; k < 8; k++) this.addEnemy("locust", C.width + 30 + k * 26, y + (k % 2) * 24, { path: "swarm", delay: k * 0.06 });
      }
      if (i === 5 && every("pT", 3.2)) {
        // 마병대
        for (let k = 0; k < 3; k++) this.addEnemy("horseman", C.width + 40 + k * 40, rand(80, C.groundY - 60), { path: "charge" });
      }
      if (i === 6) {
        // 번개, 음성, 우레, 지진, 큰 우박
        if (every("pT", 2)) this.strike(p.x + rand(-80, 80), 0.9);
        if (every("qT", 6)) { this.shake = 0.7; for (let k = -1; k <= 1; k++) this.hazards.push({ type: "lava", quake: true, x: p.x + k * 140 + rand(-30, 30), t: 0, warn: 1.0, active: 0.6, w: 70 }); }
        if (every("hT", 0.55)) this.shot(rand(100, C.width + 60), -14, Math.PI / 2 + 0.15, rand(150, 210), "shard", { color: "#ffffff", r: 11 });
      }
      if (this.blackout) this.blackout = Math.max(0, this.blackout - dt);
    }

    // ---------- 적 탄 ----------
    fire(x, y, ang, speed = this.bulletSpeed, r = RD.BULLET.radius, color = "#ff5aa8") {
      const src = this._firing ? RD.ENEMIES[this._firing.type] : null;
      // boss: 보스/중간 보스가 쏜 탄 (부엉이 회오리로 막을 수 없다)
      this.bullets.push({ x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, r, color, boss: !!(src && (src.boss || src.midboss)) });
    }

    aimAt(e) { const p = this.player; return Math.atan2(p.y - e.y, p.x - e.x); }

    fan(e, n, spread, speed, color) {
      const a = this.aimAt(e);
      for (let i = 0; i < n; i++) this.fire(e.x - 10, e.y, a + (i - (n - 1) / 2) * spread, speed, undefined, color);
    }

    ring(e, n, speed, offset = 0, color) {
      for (let i = 0; i < n; i++) this.fire(e.x, e.y, offset + (i / n) * Math.PI * 2, speed, undefined, color);
    }

    // ---------- 플레이어 사격 ----------
    addShot(o) {
      this.shots.push({ hit: [], t: 0, pierce: 0, ...o });
    }

    // 주무기: 캐릭터마다 완전히 다른 방식
    shoot(dt) {
      const p = this.player;
      p.shotCd -= dt;
      if (p.shotCd > 0 || p.dead > 0) return;
      const s = this.char.shot;
      p.shotCd = s.cd * Math.pow(0.88, this.lv("rate")) * (this.rush > 0 ? 0.5 : 1);
      const sig = this.lv("sig");
      const pw = this.power;
      const dmg = s.dmg * this.dmgMul;
      RD.audio && RD.audio.sfx("shot_" + this.charId);

      switch (s.kind) {
        case "slash": {
          // 여우: 앞쪽을 벤다. 파워 3부터 위아래 두 번
          const r = s.range * s.multi[pw - 1];
          const dirs = pw >= 3 ? [-1, 1] : [p.slashDir = -(p.slashDir || 1)];
          for (const dir of dirs) this.slashes.push({ t: 0, life: 0.14, r, dir, dmg: dmg * (pw >= 3 ? 0.7 : 1), hit: [] });
          if (sig > 0) {
            this.addShot({ kind: "wave", x: p.x + 30, y: p.y, vx: 820, vy: 0, w: 26, h: 44, dmg: 2.5 * (1 + 0.5 * (sig - 1)) * this.dmgMul, pierce: 99, color: s.color });
          }
          break;
        }
        case "boomerang": {
          // 토끼: 부메랑 단검
          // 가장 가까운 앞쪽 적 쪽으로 던진다 (위아래 최대 약 35도)
          const n = s.multi[pw - 1];
          let aim = 0, bd = 1e9;
          for (const e of this.enemies) {
            if (e.dead || e.delay > 0 || e.x < p.x + 30 || e.x > C.width) continue;
            const d = Math.hypot(e.x - p.x, e.y - p.y);
            if (d < bd) { bd = d; aim = Math.max(-0.6, Math.min(0.6, Math.atan2(e.y - p.y, e.x - p.x))); }
          }
          for (let i = 0; i < n; i++) {
            const a = aim + (i - (n - 1) / 2) * 0.22;
            this.addShot({ kind: "boomerang", main: true, x: p.x + 20, y: p.y, vx: Math.cos(a) * s.speed, vy: Math.sin(a) * s.speed, w: 26, h: 26, dmg, pierce: 99, color: s.color, back: false });
          }
          break;
        }
        case "lob": {
          // 곰: 포물선으로 망치를 던진다
          // 가장 가까운 앞쪽 적에게 떨어지도록 포물선을 계산한다
          const n = s.multi[pw - 1];
          const G = 1500;
          let tgt = null, bd = 1e9;
          for (const e of this.enemies) {
            if (e.dead || e.delay > 0 || e.x < p.x + 40 || e.x > C.width) continue;
            const d = e.x - p.x;
            if (d < bd) { bd = d; tgt = e; }
          }
          for (let i = 0; i < n; i++) {
            const tx = tgt ? tgt.x + (i - (n - 1) / 2) * 50 : p.x + 360 + i * 80;
            const ty = tgt ? tgt.y : C.groundY - 10;
            const T = 0.75 + 0.08 * i; // 날아가는 시간
            const vx = (tx - (p.x + 20)) / T, vy = (ty - (p.y - 10) - 0.5 * G * T * T) / T;
            this.addShot({ kind: "lob", main: true, x: p.x + 20, y: p.y - 10, vx, vy, w: 28, h: 28, dmg, pierce: 0, color: s.color,
              radius: s.radius * (1 + 0.3 * sig), boom: 1 + 0.2 * sig });
          }
          break;
        }
        case "tornado": {
          // 부엉이: 회오리
          const n = s.multi[pw - 1];
          const size = 1 + 0.25 * sig;
          const offs = [[0], [-50, 50], [-85, 0, 85], [-110, -38, 38, 110]][n - 1];
          for (const oy of offs) {
            this.addShot({ kind: "tornado", main: true, x: p.x + 40, y: Math.max(70, Math.min(C.groundY - 40, p.y + oy)), vx: s.speed, vy: 0,
              w: s.w * size, h: s.h * size, dmg, pierce: 99, color: s.color, life: s.life * (1 + 0.3 * sig), tick: new Map() });
          }
          break;
        }
        default: {
          // 고양이: 유도 구슬
          const pierce = this.lv("pierce");
          for (const [oy, deg] of s.lanes[pw - 1]) {
            const a = (deg * Math.PI) / 180;
            this.addShot({ kind: s.kind, main: true, x: p.x + 30, y: p.y + oy, vx: Math.cos(a) * s.speed, vy: Math.sin(a) * s.speed, w: s.w, h: s.h, dmg, pierce, homing: !!s.homing, color: s.color });
          }
        }
      }
    }

    // 여우 베기: 캐릭터 앞의 부채꼴. 적을 베고 적 탄을 없앤다
    updateSlashes(dt) {
      const p = this.player;
      for (const sl of this.slashes) {
        sl.t += dt;
        const inArc = (x, y, pad) => {
          const dx = x - p.x, dy = y - p.y;
          return dx > -24 - pad && Math.hypot(dx, dy) < sl.r + pad && Math.abs(dy) < sl.r * 0.9 + pad;
        };
        for (const e of this.enemies) {
          if (e.dead || e.delay > 0 || sl.hit.includes(e)) continue;
          const def = RD.ENEMIES[e.type];
          if (inArc(e.x, e.y, Math.max(def.w, def.h) / 2)) {
            sl.hit.push(e);
            this.damage(e, sl.dmg);
            this.effects.push({ type: "spark", x: e.x - def.w / 4, y: e.y, t: 0, life: 0.12 });
          }
        }
        // 탄 베기는 베기 게이지를 하나씩 쓴다. 게이지가 없으면 탄을 벨 수 없다
        const before = this.bullets.length;
        this.bullets = this.bullets.filter((b) => {
          if (this.parry < 1 || !inArc(b.x, b.y, b.r)) return true;
          this.parry -= 1;
          this.effects.push({ type: "pop", x: b.x, y: b.y, t: 0, life: 0.25 });
          return false;
        });
        if (this.bullets.length < before) { this.addScore((before - this.bullets.length) * 10); RD.audio && RD.audio.sfx("parry"); }
      }
      this.slashes = this.slashes.filter((sl) => sl.t < sl.life);
    }

    // 곰 망치 폭발
    explode(x, y, r, dmg) {
      this.effects.push({ type: "boom", x, y, t: 0, life: 0.35, r });
      this.shake = Math.max(this.shake, 0.08);
      for (const e of this.enemies) {
        if (e.dead || e.delay > 0) continue;
        const def = RD.ENEMIES[e.type];
        if (Math.hypot(e.x - x, e.y - y) < r + Math.max(def.w, def.h) / 2) this.damage(e, dmg);
      }
    }

    // 주무기가 적에게 맞았을 때 (토끼 급소, 고양이 분열)
    mainHit(s, e, spawned) {
      let dmg = s.dmg;
      const sig = this.lv("sig");
      if (s.main && sig > 0) {
        if (this.charId === "rabbit" && Math.random() < 0.15 * sig) {
          dmg *= 3;
          this.effects.push({ type: "text", x: e.x, y: e.y - 30, text: "급소!", color: "#ffd34d", t: 0, life: 0.4, size: 14 });
        }
        if (this.charId === "cat" && !s.split) {
          for (let k = 0; k <= sig; k++) {
            const a = (k / (sig + 1)) * Math.PI * 2 + Math.random();
            spawned.push({ kind: "orb", x: s.x, y: s.y, vx: Math.cos(a) * 500, vy: Math.sin(a) * 500, w: 12, h: 12, dmg: s.dmg * 0.4, homing: true, split: true, small: true, color: s.color });
          }
        }
      }
      this.damage(e, dmg);
    }

    // 보조무기
    updateSubWeapons(dt) {
      const p = this.player, S = this.sub;
      if (p.dead > 0) return;
      const onScreen = this.enemies.filter((e) => !e.dead && !(e.delay > 0) && e.x < C.width && e.x > 0);

      // 펫
      const petLv = this.lv("pet");
      const pet = this.pet;
      if (petLv > 0 && (pet.cd -= dt) <= 0) {
        pet.cd = 0.2;
        for (let i = 0; i < petLv; i++) {
          this.addShot({ kind: "pet", x: pet.x + 16, y: pet.y + (i - (petLv - 1) / 2) * 10, vx: 900, vy: 0, w: 16, h: 10, dmg: 1 + 0.4 * petLv, color: "#7fe6ff" });
        }
      }
      // 유도 미사일
      const mi = this.lv("missile");
      if (mi > 0 && (S.missile -= dt) <= 0) {
        S.missile = 1.7 - 0.15 * mi;
        for (let i = 0; i < mi; i++) {
          const a = -1.2 + (i / Math.max(1, mi - 1)) * 2.4 * (mi > 1 ? 1 : 0);
          this.addShot({ kind: "missile", x: p.x, y: p.y, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, w: 18, h: 12, dmg: 6 + 2 * mi, homing: true, color: "#ffd34d" });
        }
      }
      // 레이저
      const la = this.lv("laser");
      if (la > 0) {
        if (S.laserOn > 0) {
          S.laserOn -= dt;
          const half = 8 + 4 * la;
          for (const e of onScreen) {
            const b = this.enemyBox(e);
            if (b.x + b.w > p.x + 20 && b.y < p.y + half && b.y + b.h > p.y - half) this.damage(e, (28 + 16 * la) * dt, true);
          }
        } else if ((S.laser -= dt) <= 0) {
          S.laser = 3.4 - 0.3 * la;
          S.laserOn = 0.7;
        }
      }
      // 후방 사격
      const re = this.lv("rear");
      if (re > 0 && (S.rear -= dt) <= 0) {
        S.rear = 0.4;
        const angs = [Math.PI, -1.1, 1.1];
        if (re >= 2) angs.push(Math.PI - 0.35, Math.PI + 0.35);
        if (re >= 3) angs.push(-0.6, 0.6);
        if (re >= 4) angs.push(-Math.PI / 2, Math.PI / 2);
        for (const a of angs) this.addShot({ kind: "pet", x: p.x, y: p.y, vx: Math.cos(a) * 760, vy: Math.sin(a) * 760, w: 14, h: 10, dmg: 2, color: "#ffc49a" });
      }
      // 번개
      const li = this.lv("lightning");
      if (li > 0 && (S.lightning -= dt) <= 0) {
        S.lightning = 2.1 - 0.2 * li;
        const targets = onScreen.slice().sort(() => Math.random() - 0.5).slice(0, li);
        for (const e of targets) {
          this.effects.push({ type: "bolt", x: e.x, y: e.y, t: 0, life: 0.25 });
          this.damage(e, 12 + 6 * li, true);
        }
      }
      // 수호 구슬: 적에게 피해, 적 탄을 막는다
      const ob = this.lv("orbit");
      if (ob > 0) {
        for (let i = 0; i < ob; i++) {
          const a = this.t * 3 + (i / ob) * Math.PI * 2;
          const ox = p.x + Math.cos(a) * 70, oy = p.y + Math.sin(a) * 70;
          for (const e of onScreen) if (Math.hypot(e.x - ox, e.y - oy) < 30 + RD.ENEMIES[e.type].w / 2) this.damage(e, 30 * dt, true);
          this.bullets = this.bullets.filter((b) => Math.hypot(b.x - ox, b.y - oy) > 16);
        }
      }
    }

    // ---------- 궁극기 (캐릭터마다 다름) ----------
    bomb() {
      if (this.over || this.choosing || this.bombs <= 0 || this.bombT > 0 || this.player.dead > 0) return;
      const p = this.player;
      this.bombs--;
      const life = { fox: 1.0, rabbit: 3.0, bear: 1.5, owl: 2.8, cat: 3.0 }[this.charId];
      this.bombT = life;
      this.ult = { kind: this.charId, t: 0, life, x0: p.x, y0: p.y, done: {}, spawnT: 0, mul: 1 + 0.3 * this.lv("bomb") };
      p.invuln = Math.max(p.invuln, life + 0.6);
      this.banner = { text: this.char.bomb.name + "!", color: this.char.bomb.color, t: 0, life: 1.2, small: true };
      RD.audio && RD.audio.sfx("ult_" + this.charId);

      const popAll = () => {
        for (const b of this.bullets) this.effects.push({ type: "pop", x: b.x, y: b.y, t: 0, life: 0.3 });
        this.addScore(this.bullets.length * 10);
        this.bullets = [];
      };
      if (this.charId === "rabbit") popAll();
      if (this.charId === "bear") { popAll(); this.shake = 0.8; }
      if (this.charId === "cat") {
        // 적 탄이 코인으로 바뀐다 (최대 30개, 나머지는 사라짐)
        this.bullets.forEach((b, i) => {
          if (i < 30) this.items.push({ type: "coin", x: b.x, y: b.y, vx: rand(-30, 30), vy: rand(-120, -40) });
          else this.effects.push({ type: "pop", x: b.x, y: b.y, t: 0, life: 0.3 });
        });
        this.bullets = [];
      }
    }

    updateUlt(dt) {
      const u = this.ult;
      if (!u) return;
      const p = this.player;
      u.t += dt;
      const live = this.enemies.filter((e) => !e.dead && !(e.delay > 0) && e.x < C.width + 20);
      const big = (e) => RD.ENEMIES[e.type].boss || RD.ENEMIES[e.type].midboss;

      switch (u.kind) {
        case "fox": {
          // 일섬: 화면 끝까지 돌진 → 지나간 가로줄을 벤다 → 제자리로
          const dashEnd = 0.3, cutAt = 0.42;
          if (u.t < dashEnd) p.x = u.x0 + (C.width - 70 - u.x0) * (u.t / dashEnd);
          else if (u.t > cutAt + 0.15) p.x += (u.x0 - p.x) * Math.min(1, dt * 8);
          if (u.t >= cutAt && !u.done.cut) {
            u.done.cut = true;
            this.shake = 0.6;
            for (const b of this.bullets) this.effects.push({ type: "pop", x: b.x, y: b.y, t: 0, life: 0.3 });
            this.addScore(this.bullets.length * 10);
            this.bullets = [];
            for (const e of live) {
              const inBand = Math.abs(e.y - u.y0) < 80 + RD.ENEMIES[e.type].h / 2;
              this.damage(e, (inBand ? 130 : 25) * u.mul);
            }
          }
          break;
        }
        case "rabbit": {
          // 그림자 단검 폭풍: 분신 4명이 적에게 단검을 쏟아붓는다
          u.clones = [[p.x - 60, p.y - 110], [p.x - 60, p.y + 110], [p.x + 90, p.y - 170], [p.x + 90, p.y + 170]]
            .map(([x, y]) => [x, Math.max(50, Math.min(C.groundY - 20, y))]);
          u.spawnT -= dt;
          while (u.spawnT <= 0 && u.t < u.life - 0.3) {
            u.spawnT += 0.05;
            const [cx, cy] = pick(u.clones);
            const tg = live.length ? pick(live) : null;
            const a = tg ? Math.atan2(tg.y - cy, tg.x - cx) : rand(-0.4, 0.4);
            this.addShot({ kind: "dagger", x: cx, y: cy, vx: Math.cos(a) * 1000, vy: Math.sin(a) * 1000, w: 22, h: 12, dmg: 2.4 * u.mul, pierce: 0, homing: true, color: "#9fffb0" });
          }
          // 분신 주변의 적 탄도 막는다
          this.bullets = this.bullets.filter((b) => !u.clones.some(([x, y]) => Math.hypot(b.x - x, b.y - y) < 40));
          break;
        }
        case "bear": {
          // 대지 강타: 바위 기둥이 앞쪽으로 차례차례 솟는다
          const cols = 8;
          for (let i = 0; i < cols; i++) {
            const at = 0.1 + i * 0.1;
            if (u.t < at || u.done[i]) continue;
            u.done[i] = true;
            const cx = u.x0 + 40 + i * ((C.width - u.x0) / cols);
            this.effects.push({ type: "pillar", x: cx, t: 0, life: 0.7 });
            this.shake = Math.max(this.shake, 0.25);
            for (const e of live) {
              const def = RD.ENEMIES[e.type];
              if (Math.abs(e.x - cx) > 55 + def.w / 2) continue;
              if (def.ground) this.damage(e, 60 * u.mul); // 땅의 적에게 강하다
              else if (e.y > C.groundY - 300) this.damage(e, 35 * u.mul);
            }
          }
          break;
        }
        case "owl": {
          // 회오리 바람: 화면 가운데의 거대한 회오리가 적과 탄을 빨아들인다
          const cx = C.width * 0.64, cy = 260;
          u.cx = cx; u.cy = cy;
          const fade = Math.min(1, (u.life - u.t) * 2);
          for (const b of this.bullets) {
            const a = Math.atan2(cy - b.y, cx - b.x);
            b.vx += Math.cos(a) * 1600 * dt * fade;
            b.vy += Math.sin(a) * 1600 * dt * fade;
          }
          const before = this.bullets.length;
          this.bullets = this.bullets.filter((b) => Math.hypot(b.x - cx, b.y - cy) > 40);
          this.addScore((before - this.bullets.length) * 10);
          for (const e of live) {
            const d = Math.hypot(e.x - cx, e.y - cy);
            if (!big(e)) {
              const a = Math.atan2(cy - e.y, cx - e.x);
              const pull = Math.min(260, d * 2) * dt * fade;
              e.x += Math.cos(a) * pull;
              e.y += Math.sin(a) * pull;
              if (e.baseY != null) e.baseY = e.y;
            }
            if (d < 220 + RD.ENEMIES[e.type].w / 2) this.damage(e, (big(e) ? 22 : 40) * u.mul * dt, true);
          }
          // 회오리 근처의 탄은 플레이어 쪽으로 오지 못한다
          this.bullets = this.bullets.filter((b) => Math.hypot(b.x - p.x, b.y - p.y) > 60);
          break;
        }
        case "cat": {
          // 별빛 마법진: 별똥별이 적에게 떨어진다
          u.spawnT -= dt;
          while (u.spawnT <= 0 && u.t < u.life - 0.4) {
            u.spawnT += 0.11;
            const tg = live.length ? pick(live) : null;
            const tx = tg ? tg.x : rand(400, C.width);
            this.addShot({ kind: "meteor", x: tx + rand(-160, 60), y: -30, vx: 260, vy: 900, w: 30, h: 30, dmg: 5.5 * u.mul, pierce: 2, homing: true, color: "#ffd34d" });
          }
          this.bullets = this.bullets.filter((b) => Math.hypot(b.x - p.x, b.y - p.y) > 110); // 마법진이 탄을 막는다
          break;
        }
      }
      if (u.t >= u.life) this.ult = null;
    }

    // ---------- 피격과 체력 ----------
    hurt(amount) {
      const p = this.player;
      if (p.shielded) {
        // 고양이 마력 보호막
        p.shielded = false;
        p.invuln = C.hitInvuln;
        this.effects.push({ type: "ring", x: p.x, y: p.y, t: 0, life: 0.4 });
        RD.audio && RD.audio.sfx("shieldbreak");
        return;
      }
      RD.audio && RD.audio.sfx("hurt");
      p.hp -= amount * this.D.damage * this.armor;
      p.invuln = C.hitInvuln;
      p.hurt = 0.3;
      this.shake = Math.max(this.shake, 0.15);
      this.effects.push({ type: "flash", t: 0, life: 0.2 });
      if (p.hp <= 0) this.die();
    }

    die() {
      const p = this.player;
      RD.audio && RD.audio.sfx("die");
      this.effects.push({ type: "boom", x: p.x, y: p.y, t: 0, life: 0.8, big: true });
      this.shake = 0.4;
      this.lives--;
      this.bombs = Math.max(this.bombs, C.bombs);
      this.bullets = [];
      if (this.lives <= 0) { this.over = true; p.dead = 99; p.hp = 0; RD.audio && RD.audio.sfx("gameover"); return; }
      p.dead = 1; // 1초 뒤 체력을 모두 채워 다시 등장
    }

    addScore(n) {
      this.score += Math.round(n * this.scoreMul);
      while (!this.M.noHeal && this.score >= this.nextExtend) {
        this.nextExtend += C.extendEvery;
        this.lives++;
        this.banner = { text: "1UP!", color: "#9fffb0", t: 0, life: 1.2, small: true };
      }
    }

    // ---------- 갱신 ----------
    update(dt) {
      if (this.banner && (this.banner.t += dt) > this.banner.life) this.banner = null;
      if (this.choosing) { this.choosing.t += dt; return; } // 강화를 고르는 동안 멈춘다
      this.t += dt;
      this.scroll += C.scrollSpeed * dt;
      this.shake = Math.max(0, this.shake - dt);
      const p = this.player;

      if (this.over) {
        this.overTimer += dt;
        this.updateEffects(dt);
        this.updateBullets(dt);
        return;
      }
      if (this.mode === "timeattack" && this.timeLeft <= 0) {
        this.over = true;
        this.win = true;
        this.banner = { text: "TIME UP", color: "#ffd34d", t: 0, life: 3 };
        return;
      }

      this.direct(dt);
      this.updateTerrain(dt);
      if (this.intro) { this.intro.t += dt; if (this.intro.t > this.intro.delay + this.intro.life) this.intro = null; }

      // 이동 (키보드: dx/dy, 터치: moveX/moveY 만큼 바로 이동)
      const inp = this.input;
      if (p.dead > 0) {
        p.dead -= dt;
        if (p.dead <= 0) { p.x = 120; p.y = 260; p.hp = this.maxHp; p.invuln = C.respawnInvuln; }
        inp.moveX = inp.moveY = 0;
      } else {
        p.slow = Math.max(0, (p.slow || 0) - dt);
        const sp = (inp.focus ? C.focusSpeed : C.moveSpeed) * (1 + 0.12 * this.lv("speed")) * (p.slow > 0 ? 0.5 : 1);
        let mx = inp.dx * sp * dt + inp.moveX;
        let my = inp.dy * sp * dt + inp.moveY;
        p.inverted = Math.max(0, (p.inverted || 0) - dt);
        if (p.inverted > 0) { mx = -mx; my = -my; } // 악몽: 조작 반전
        if (this.terrain === "ice") {
          // 빙판: 바로 멈추거나 꺾지 못하고 미끄러진다
          const k = Math.min(1, dt * 3.5);
          p.vx += (mx / Math.max(dt, 0.001) - p.vx) * k;
          p.vy += (my / Math.max(dt, 0.001) - p.vy) * k;
          mx = p.vx * dt; my = p.vy * dt;
        } else { p.vx = p.vy = 0; }
        p.x += mx;
        p.y += my;
        p.tilt += (Math.max(-1, Math.min(1, my / Math.max(1, sp * dt))) - p.tilt) * Math.min(1, dt * 10);
        inp.moveX = inp.moveY = 0;
        p.x = Math.max(30, Math.min(C.width - 40, p.x));
        p.y = Math.max(50, Math.min(C.groundY - 20, p.y));
        p.hp = Math.min(this.maxHp, p.hp + this.lv("regen") * dt);
      }
      p.invuln = Math.max(0, p.invuln - dt);
      p.hurt = Math.max(0, p.hurt - dt);
      // 패시브
      if (this.charId === "fox") this.parry = Math.min(RD.FOX_PARRY.max, this.parry + dt / RD.FOX_PARRY.regen);
      if (this.charId === "cat" && !p.shielded) {
        this.shield += dt;
        if (this.shield >= RD.CAT_SHIELD.every) { this.shield = 0; p.shielded = true; RD.audio && RD.audio.sfx("shield"); }
      }
      p.animT += dt;
      this.bombT = Math.max(0, this.bombT - dt);

      const pet = this.pet;
      pet.t += dt;
      pet.x += (p.x - 56 - pet.x) * Math.min(1, dt * 8);
      pet.y += (p.y - 34 + Math.sin(pet.t * 4) * 6 - pet.y) * Math.min(1, dt * 8);

      this.shoot(dt);
      this.updateSubWeapons(dt);
      this.updateSlashes(dt);
      this.updateShots(dt);
      this.updateEnemies(dt);
      this.updateBullets(dt);
      this.updateItems(dt);
      this.updateEffects(dt);

      this.updateUlt(dt);

      // 피격 판정 (판정은 캐릭터 가운데의 작은 점)
      if (p.dead <= 0 && p.invuln <= 0) {
        const bi = this.bullets.findIndex((b) => Math.hypot(b.x - p.x, b.y - p.y) < b.r + C.hitRadius);
        if (bi >= 0) {
          const b = this.bullets.splice(bi, 1)[0];
          const shielded = p.shielded;
          this.hurt(C.bulletDamage);
          if (!shielded) {
            const bo = this.enemies.find((e) => !e.dead && RD.ENEMIES[e.type].style === "bat");
            if (b.boss && bo) { bo.hp = Math.min(bo.maxHp, bo.hp + bo.maxHp * 0.02); this.effects.push({ type: "text", x: bo.x, y: bo.y - 90, text: "흡혈", color: "#ff4d5e", t: 0, life: 0.8, size: 16 }); }
            if (b.freeze) { p.slow = 1.6; this.text("빙결!", "#bfe8ff"); }
          }
        } else {
          const hitE = this.enemies.find((e) => !e.dead && e.t > 0 && this.inBox(p, e, -6));
          if (hitE) {
            this.hurt(C.contactDamage);
            if (hitE.type === "bomber") this.damage(hitE, 999); // 자폭
          }
        }
      }
    }

    enemyBox(e) {
      const def = RD.ENEMIES[e.type];
      return { x: e.x - def.w / 2, y: e.y - def.h / 2, w: def.w, h: def.h };
    }

    inBox(pt, e, pad = 0) {
      const b = this.enemyBox(e);
      return pt.x > b.x - pad && pt.x < b.x + b.w + pad && pt.y > b.y - pad && pt.y < b.y + b.h + pad;
    }

    updateShots(dt) {
      const p = this.player;
      const spawned = [];
      const boxHit = (s, e) => {
        const b = this.enemyBox(e);
        return s.x + s.w / 2 > b.x && s.x - s.w / 2 < b.x + b.w && s.y + s.h / 2 > b.y && s.y - s.h / 2 < b.y + b.h;
      };
      const live = (e) => !e.dead && !(e.delay > 0) && e.x < C.width + 20;
      for (const s of this.shots) {
        s.t += dt;

        if (s.kind === "boomerang") {
          // 날아가며 느려지다가 캐릭터에게 돌아온다 (돌아올 때 다시 맞힐 수 있다)
          if (!s.back) {
            const sp = Math.hypot(s.vx, s.vy);
            const nsp = sp - 1500 * dt;
            if (nsp <= 60) { s.back = true; s.hit = []; }
            else { s.vx *= nsp / sp; s.vy *= nsp / sp; }
          } else {
            const a = Math.atan2(p.y - s.y, p.x - s.x);
            const sp = Math.min(1100, Math.hypot(s.vx, s.vy) + 2400 * dt);
            s.vx = Math.cos(a) * sp; s.vy = Math.sin(a) * sp;
            if (Math.hypot(p.x - s.x, p.y - s.y) < 28 || p.dead > 0) s.gone = true;
          }
          s.x += s.vx * dt; s.y += s.vy * dt;
          for (const e of this.enemies) if (live(e) && !s.hit.includes(e) && boxHit(s, e)) { s.hit.push(e); this.mainHit(s, e, spawned); }
          if (s.t > 3) s.gone = true;
          continue;
        }

        if (s.kind === "lob") {
          s.vy += 1500 * dt;
          s.x += s.vx * dt; s.y += s.vy * dt;
          const target = this.enemies.find((e) => live(e) && boxHit(s, e));
          if (target || s.y > C.groundY - 8) {
            this.explode(s.x, Math.min(s.y, C.groundY - 8), s.radius, s.dmg * s.boom);
            s.gone = true;
          }
          continue;
        }

        if (s.kind === "tornado") {
          // 천천히 나아가며 닿은 적을 0.15초마다 때리고, 적 탄을 날려 버린다
          s.x += s.vx * dt;
          s.y += Math.sin(s.t * 3) * 30 * dt;
          if (s.t > s.life) s.gone = true;
          for (const e of this.enemies) {
            if (!live(e) || !boxHit(s, e)) continue;
            const last = s.tick.get(e) || -1;
            if (s.t - last >= 0.18) { s.tick.set(e, s.t); this.damage(e, s.dmg, true); }
          }
          // 회오리 하나가 지울 수 있는 탄 수에는 한도가 있다
          s.absorbed = s.absorbed || 0;
          this.bullets = this.bullets.filter((b) => {
            if (s.absorbed >= RD.OWL_ABSORB || b.boss || Math.abs(b.x - s.x) > s.w / 2 + b.r || Math.abs(b.y - s.y) > s.h / 2 + b.r) return true;
            s.absorbed++;
            return false;
          });
          continue;
        }

        if (s.homing) {
          let best = null, bd = 1e9;
          for (const e of this.enemies) {
            if (e.dead || e.delay > 0 || e.x > C.width + 10 || e.x < s.x - 30) continue;
            const d = Math.hypot(e.x - s.x, e.y - s.y);
            if (d < bd) { bd = d; best = e; }
          }
          if (best) {
            const sp = Math.hypot(s.vx, s.vy);
            const cur = Math.atan2(s.vy, s.vx);
            let da = Math.atan2(best.y - s.y, best.x - s.x) - cur;
            while (da > Math.PI) da -= Math.PI * 2;
            while (da < -Math.PI) da += Math.PI * 2;
            const turn = s.kind === "missile" ? 6 : 9;
            const na = cur + Math.max(-turn * dt, Math.min(turn * dt, da));
            const nsp = s.kind === "missile" ? Math.min(900, sp + 900 * dt) : sp;
            s.vx = Math.cos(na) * nsp;
            s.vy = Math.sin(na) * nsp;
          }
        }
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        for (const e of this.enemies) {
          if (!live(e) || s.hit.includes(e) || !boxHit(s, e)) continue;
          this.mainHit(s, e, spawned);
          s.hit.push(e);
          if (s.hit.length > s.pierce) { s.gone = true; this.effects.push({ type: "spark", x: s.x, y: s.y, t: 0, life: 0.15 }); break; }
        }
      }
      for (const o of spawned) this.addShot(o);
      this.shots = this.shots.filter((s) => !s.gone && (s.kind === "boomerang" || s.x < C.width + 80) && s.x > -80 && s.y > -200 && s.y < C.height + 60 && s.t < 4);
    }

    damage(e, dmg, quiet) {
      if (e.dead) return;
      const D0 = RD.ENEMIES[e.type];
      if (!this.ult) {
        if (D0.armor && !e.dashing) dmg *= D0.armor; // 딱정벌레 갑옷 (돌진 중에는 없음)
        if (D0.style === "crystal" && this.enemies.some((o) => o.type === "shard" && !o.dead)) dmg *= 0.35; // 수정 갑옷
      }
      e.hp -= dmg;
      if (!quiet) RD.audio && RD.audio.sfx("hit");
      if (!quiet || e.flash <= 0) e.flash = 0.06;
      if (e.hp > 0) return;
      const def = RD.ENEMIES[e.type];
      e.dead = true;
      this.kills++;
      RD.audio && RD.audio.sfx(def.boss || def.midboss ? "boom" : "kill");
      this.addScore(def.score * this.loop);
      this.gainExp(def.exp);
      this.effects.push({ type: "boom", x: e.x, y: e.y, t: 0, life: def.boss ? 2 : def.midboss ? 1 : 0.5, big: def.boss || def.midboss });
      const drop = (type, n = 1) => {
        if (this.M.noHeal && (type === "heal" || type === "life")) return; // 하드코어
        for (let i = 0; i < n; i++) this.items.push({ type, x: e.x + rand(-20, 20), y: e.y + rand(-20, 20), vx: rand(-40, 80), vy: rand(-220, -80) });
      };
      const heartChance = 0.03 * (1 + this.lv("luck")) * (this.terrain === "bless" ? 2 : 1);
      if (Math.random() < heartChance) drop("heal");
      // 죽을 때 특성
      this._firing = e;
      if (e.type === "slime") for (let i = 0; i < 2; i++) this.addEnemy("slimelet", e.x + i * 24, C.groundY - 8, { path: "ground", variant: e.variant });
      if (e.type === "mushroom") this.ring(e, 8, this.bulletSpeed * 0.45, rand(0, 1), "#c8ff6a"); // 포자
      if (e.type === "bomber") this.ring(e, 8, this.bulletSpeed * 0.6, rand(0, 1), "#ff8a3d");
      this._firing = null;
      if (this.M.special === "dream") drop("candy", 2);
      if (e.type === "angel") { drop("power", 2); drop("heal"); }
      if (e.type === "bat") drop("coin");
      if (e.type === "slime") drop("coin", 2);
      if (e.type === "mushroom") drop("gem", 2);
      if (e.type === "wisp") { drop(Math.random() < 0.3 ? "bomb" : "power"); drop("gem", 2); if (Math.random() < 0.25) drop("heal"); }
      if (def.midboss) this.coins += RD.COIN_VALUE.golem;
      if (def.boss) this.coins += RD.COIN_VALUE.boss;
      if (def.midboss) { drop("power", 2); drop("bomb"); drop("heal", 2); drop("star", 4); this.shake = 0.5; }
      if (def.boss) {
        drop("star", 12);
        drop("heal", 2);
        drop("life");
        this.shake = 1;
        this.bullets = [];
        const M = this.mode;
        RD.audio && RD.audio.sfx("clear");
        if (def.style === "abaddon") {
          this.banner = { text: "첫째 화가 지나갔다", sub: "그러나 아직 두 화가 남았다", color: "#ffd34d", t: 0, life: 3 };
          return;
        }
        if (def.style === "nightmare" || def.style === "dragon") {
          this.over = true;
          this.win = true;
          this.coins += def.style === "dragon" ? 300 : 150;
          this.banner = def.style === "dragon"
            ? { text: "심판 완료", sub: "큰 붉은 용이 쫓겨났다. 세상 나라가 이루어졌다", color: "#ffd34d", t: 0, life: 99 }
            : { text: "좋은 꿈 꿨어!", sub: "악몽을 물리치고 달콤하게 잠들었다", color: "#ff9ad8", t: 0, life: 99 };
          return;
        }
        if (M === "stageselect" || (STORYLIKE.includes(M) && this.stageNo >= STORY_STAGES - 1)) {
          // 마지막 지역(또는 스테이지 선택의 한 판) 클리어
          this.over = true;
          this.win = true;
          this.reached = Math.max(this.reached, this.stageNo + 1);
          this.banner = { text: M === "stageselect" ? "STAGE CLEAR!" : "ALL CLEAR!", sub: `${this.stage.bossName}을(를) 쓰러뜨렸다`, color: "#ffd34d", t: 0, life: 99 };
        } else if (STORYLIKE.includes(M)) {
          this.banner = { text: `${this.stage.name} 클리어`, sub: `다음 지역: ${RD.STAGES[this.stageNo + 1].name}`, color: "#ffd34d", t: 0, life: 3.5 };
          this.loop++;
          this.stageT = -6;
          this.stageIdx = 0;
          this.setStage(this.stageNo + 1);
        } else {
          // 무한 / 보스 러시 / 혼돈 / 타임 어택: 다음 지역으로, 적이 더 강해진다
          this.loop++;
          this.banner = { text: "BOSS DOWN", sub: M === "bossrush" ? `${this.loop}라운드` : "적이 더 강해진다", color: "#ffd34d", t: 0, life: 3 };
          if (M !== "chaos") this.setStage((this.stageNo + 1) % STORY_STAGES);
        }
      }
      if (e.group) {
        const g = this.groups[e.group];
        if (++g.killed === g.total) drop("power");
      }
    }

    updateEnemies(dt) {
      const bs = this.bulletSpeed;
      const fr = this.D.fireRate;
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (e.delay > 0) { e.delay -= dt; continue; }
        e.t += dt;
        e.flash = Math.max(0, e.flash - dt);
        switch (e.path) {
          case "sine":
            e.x -= 210 * dt;
            e.y = e.baseY + Math.sin(e.t * 3) * 55;
            break;
          case "straight":
            e.x -= 240 * dt;
            break;
          case "dive":
            if (e.t < 1.2) e.x -= 260 * dt;
            else {
              if (!e.dvx) { const a = this.aimAt(e); e.dvx = Math.cos(a) * 330; e.dvy = Math.sin(a) * 330; }
              e.x += e.dvx * dt; e.y += e.dvy * dt;
            }
            break;
          case "hover":
            if (e.t < 6 || e.stay) e.x += (e.stopX - e.x) * Math.min(1, dt * 2);
            else { e.x += 60 * dt; e.y -= 160 * dt; }
            e.y += Math.sin(e.t * 2) * 20 * dt;
            break;
          case "ground":
            e.x -= (C.scrollSpeed + (e.type === "slime" ? 30 : 0)) * dt;
            if (e.type === "slime") e.y = C.groundY - RD.ENEMIES.slime.h / 2 - Math.abs(Math.sin(e.t * 3.2)) * 70;
            break;
          case "snipe":
            // 저격 눈알: 오른쪽 뒤에 자리 잡고, 시간이 지나면 떠난다
            if (e.t < 10) e.x += (e.stopX - e.x) * Math.min(1, dt * 2);
            else e.x += 120 * dt;
            e.y += Math.sin(e.t * 1.5) * 15 * dt;
            break;
          case "charge": {
            // 딱정벌레: 천천히 오다가 같은 높이가 되면 몸을 떨고 돌진
            const p = this.player;
            if (!e.dashing && !e.wind) {
              e.x -= 70 * dt;
              e.y += Math.sign(p.y - e.y) * Math.min(Math.abs(p.y - e.y), 40 * dt);
              if (Math.abs(p.y - e.y) < 50 && e.x - p.x > 120 && e.x < C.width - 30) e.wind = 0.6;
            } else if (e.wind) {
              e.wind -= dt;
              e.x += Math.sin(e.t * 60) * 2;
              if (e.wind <= 0) {
                e.wind = 0; e.dashing = true;
                if (e.type === "horseman") {
                  // 불과 연기와 유황
                  this._firing = e;
                  const a0 = Math.PI;
                  ["#ff5a1a", "#9a9aa8", "#ffe14d", "#ff5a1a", "#9a9aa8"].forEach((c, q) => this.shot(e.x - 20, e.y, a0 + (q - 2) * 0.22, this.bulletSpeed * 0.9, q % 3 === 1 ? "smoke" : "fireball", { color: c, r: 7 }));
                  this._firing = null;
                }
              }
            } else e.x -= 560 * dt;
            break;
          }
          case "homing": {
            // 자폭 가시공: 플레이어 쪽으로 방향을 튼다
            const p = this.player;
            const a = Math.atan2(p.y - e.y, p.x - e.x);
            e.vx += Math.cos(a) * 420 * dt; e.vy += Math.sin(a) * 420 * dt;
            const sp = Math.hypot(e.vx, e.vy), max = 230;
            if (sp > max) { e.vx *= max / sp; e.vy *= max / sp; }
            e.x += e.vx * dt; e.y += e.vy * dt;
            if (e.t > 9) e.vy -= 600 * dt; // 오래되면 날아가 버린다
            break;
          }
          case "swarm":
            e.x -= 330 * dt;
            e.y += Math.cos(e.t * 7) * 120 * dt;
            break;
          case "orbit": {
            // 수정 거인 주위를 도는 수정
            const b = e.parent;
            if (!b || b.dead) { e.dead = true; break; }
            e.ang += dt * 1.4;
            e.x = b.x + Math.cos(e.ang) * 120;
            e.y = b.y + Math.sin(e.ang) * 110;
            break;
          }
          case "midboss":
            if (e.t < e.life) e.x += (e.stopX - e.x) * Math.min(1, dt * 1.2);
            else e.x -= C.scrollSpeed * dt; // 시간이 지나면 떠난다
            break;
          case "boss": {
            const def = RD.ENEMIES[e.type];
            if (!(def.style === "storm" && e.lastPh >= 2)) e.x += (760 - e.x) * Math.min(1, dt * 0.8);
            if (def.style === "fire") {
              // 마그마 슬라임 왕: 크게 뛰었다가 착지할 때 탄을 뿌린다
              const hop = Math.abs(Math.sin(e.t * 1.6));
              const wasUp = e.air;
              e.air = hop > 0.08;
              e.y = e.baseY - hop * 170;
              if (wasUp && !e.air && e.x < C.width - 40) {
                this._firing = e; this.ring(e, 14 + 2 * this.loop, bs * 0.7, rand(0, 1), "#ff7a3d"); this.shake = 0.2; this._firing = null;
                // 용암 자국: 플레이어 근처 땅에서 용암이 솟는다
                this.hazards.push({ type: "lava", x: this.player.x + rand(-50, 50), t: 0, warn: 0.8, active: 0.7, w: 60 });
              }
            } else if (def.ground) {
              e.y = e.baseY;
            } else if (!(def.style === "storm" && e.lastPh >= 2)) {
              e.y = 240 + Math.sin(e.t * 0.9) * 110;
            }
            break;
          }
        }

        if (e.x > C.width - 20 || e.x < 20) continue;
        e.fireT -= dt;
        if (e.fireT > 0) continue;
        const L = this.loop;
        this._firing = e;
        switch (e.type) {
          case "bat":
            e.fireT = 99; // 한 번만 쏜다
            if (Math.random() < Math.min(1, (0.45 + 0.12 * L) * fr)) this.fire(e.x, e.y, this.aimAt(e), bs);
            break;
          case "slime":
            e.fireT = 2 / fr;
            this.fire(e.x, e.y, this.aimAt(e), bs * 0.9, 7, "#9fff6a");
            break;
          case "mushroom":
            e.fireT = 1.8 / (1 + 0.2 * (L - 1)) / fr;
            this.fan(e, 3, 0.22, bs * 0.85, "#ff7a3d");
            break;
          case "wisp":
            e.fireT = 1.4 / fr;
            this.ring(e, 8 + 2 * L, bs * 0.75, e.t, "#7fd0ff");
            break;
          case "eye":
            // 1초 동안 조준선을 보여 준 뒤 그 방향으로 빠른 탄
            if (!e.aiming) { e.aiming = 1.0; e.aimA = this.aimAt(e); e.fireT = 1.0; }
            else { this.fire(e.x - 16, e.y, e.aimA, bs * 2.3, 7, "#ff3048"); e.aiming = 0; e.fireT = 2.2 / fr; }
            break;
          case "fairy":
            e.fireT = 3 / fr;
            this.ring(e, 6, bs * 0.6, e.t, "#9fffb0");
            break;
          case "angel":
            e.fireT = 1.5 / fr;
            for (let q = 0; q < 12; q++) this.shot(e.x, e.y, (q / 12) * Math.PI * 2 + e.t, bs * 0.7, "star", { color: "#ffe9a0", r: 7 });
            if ((e.n = (e.n || 0) + 1) % 2) this.fan(e, 3, 0.18, bs * 1.1, "#ffffff");
            break;
          case "beetle": case "bomber": case "slimelet": case "shard": case "locust": case "horseman":
            e.fireT = 99;
            break;
          case "golem":
            e.fireT = 1.15 / fr;
            e.volley = (e.volley || 0) + 1;
            if (e.volley % 2) this.fan(e, 4 + L, 0.17, bs, "#ffb347");
            else for (let i = 0; i < 6; i++) this.fire(e.x - 30, e.y - 40, -Math.PI / 2 - 0.9 - i * 0.12, bs * 1.1, 8, "#c4945c");
            break;
          default:
            if (RD.ENEMIES[e.type].boss) this.bossAttack(e, bs, fr);
        }
      }
      this._firing = null;
      for (const f of this.enemies) {
        if (f.dead || f.type !== "fairy" || f.delay > 0) continue;
        for (const o of this.enemies) {
          if (o === f || o.dead || Math.hypot(o.x - f.x, o.y - f.y) > 170) continue;
          o.hp = Math.min(o.maxHp, o.hp + (RD.ENEMIES[o.type].boss ? 3 : 6) * dt);
          o.healed = 0.2;
        }
      }
      for (const e of this.enemies) if (e.healed) e.healed = Math.max(0, e.healed - dt);
      this.bossTraits(dt);
      for (const e of this.enemies) {
        if (!e.dead && (e.x < -120 || e.y < -150 || e.y > C.height + 150)) {
          e.gone = true;
          if (e.group) this.groups[e.group].total = -1;
        }
      }
      this.enemies = this.enemies.filter((e) => !e.gone && !e.dead);
    }

    // ---------- 보스 특성 ----------
    bossTraits(dt) {
      const b = this.enemies.find((e) => !e.dead && RD.ENEMIES[e.type].boss);
      if (!b) return;
      const style = RD.ENEMIES[b.type].style;
      const k = b.hp / b.maxHp;
      const ph = k > 0.6 ? 1 : k > 0.3 ? 2 : 3;
      if (ph !== b.lastPh) {
        if (b.lastPh) {
          if (style === "crystal") this.spawnShards(b);
          if (style === "fire") for (let i = 0; i < 3; i++) this.addEnemy("slime", b.x - 60 - i * 50, C.groundY - 15, { path: "ground", variant: "fire" });
          this.banner = { text: ph === 3 ? "보스 분노!" : "보스 패턴 변화", color: "#ff8a3d", t: 0, life: 1.2, small: true };
        }
        b.lastPh = ph;
      }
      if (style === "storm" && ph >= 2 && (b.tp = (b.tp || 3) - dt) <= 0) {
        // 순간이동
        b.tp = ph === 3 ? 2.6 : 3.6;
        this.effects.push({ type: "boom", x: b.x, y: b.y, t: 0, life: 0.3, r: 60 });
        b.x = rand(560, 880); b.baseY = rand(110, 360);
        this.effects.push({ type: "ring", x: b.x, y: b.baseY, t: 0, life: 0.4 });
      }
      if (style === "storm" && ph >= 2 && b.baseY != null) b.y += (b.baseY - b.y) * Math.min(1, dt * 6);
      if (style === "bat" && ph === 3) b.y = 240 + Math.sin(b.t * 2.2) * 150; // 분노: 빨라진다
    }

    // ---------- 보스 전용 탄 ----------
    // shape: 탄 모양 (그리기용), 그 밖의 선택 값:
    //   g 중력, decel 감속, redirect 몇 초 뒤 플레이어 쪽으로 다시 조준, wob 위아래 흔들림,
    //   spiral 중심을 돌며 빨려듦, fuse 시간차 폭발, lava 땅에 닿으면 용암 자국
    shot(x, y, ang, speed, shape, opt = {}) {
      const src = this._firing ? RD.ENEMIES[this._firing.type] : null;
      const b = { x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, r: opt.r || 7, color: opt.color || "#ff5aa8", shape, age: 0, boss: !!(src && (src.boss || src.midboss)), ...opt };
      this.bullets.push(b);
      return b;
    }

    beam(e, ang, angVel, warn = 1.0, active = 1.4, w = 26) {
      this.hazards.push({ type: "beam", src: e, x: e.x, y: e.y, ang, angVel, t: 0, warn, active, w, len: 1400 });
    }

    lineStrike(x1, y1, x2, y2, warn = 0.9) {
      this.hazards.push({ type: "line", x1, y1, x2, y2, t: 0, warn, active: 0.25, w: 22 });
    }

    // ---------- 지역 보스 공격 (체력에 따라 3단계) ----------
    bossAttack(e, bs, fr) {
      const def = RD.ENEMIES[e.type];
      const k = e.hp / e.maxHp;
      e.phase = k > 0.6 ? 1 : k > 0.3 ? 2 : 3;
      const ph = e.phase, p = this.player;
      e.n = (e.n || 0) + 1;
      const aim = this.aimAt(e);
      switch (def.style) {
        case "bat": // 박쥐 왕: 피 방울, 초음파, 박쥐 떼
          if (ph === 1) {
            e.fireT = 1.0 / fr;
            for (let i = -3; i <= 3; i++) this.shot(e.x - 40, e.y, aim + i * 0.13, bs, "blood", { color: "#d8202a" });
            if (e.n % 3 === 0) this.batSwarm(e, bs, 8);
          } else if (ph === 2) {
            // 초음파 고리: 빈틈이 하나 있는 고리가 퍼진다
            e.fireT = 1.35 / fr;
            const gap = aim + rand(-0.6, 0.6), n = 30;
            for (let i = 0; i < n; i++) {
              const a = (i / n) * Math.PI * 2;
              if (Math.abs(((a - gap + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.42) continue;
              this.shot(e.x, e.y, a, bs * 0.7, "wave", { color: "#c58aff", r: 8 });
            }
            if (e.n % 2) this.batSwarm(e, bs, 6);
          } else {
            e.fireT = 0.8 / fr;
            // 분노: 하늘에서 피의 비 + 박쥐 떼
            for (let i = 0; i < 6; i++) this.shot(rand(120, C.width - 40), -10, Math.PI / 2 + rand(-0.2, 0.2), bs * 0.35, "blood", { g: 260, color: "#d8202a" });
            if (e.n % 2) this.batSwarm(e, bs, 10);
            else for (let i = -2; i <= 2; i++) this.shot(e.x - 40, e.y, aim + i * 0.1, bs * 1.25, "blood", { color: "#ff4d5e" });
          }
          break;
        case "crystal": // 수정 거인: 멈췄다 다시 날아오는 수정, 휩쓰는 레이저, 수정 감옥
          if (ph === 1) {
            e.fireT = 1.2 / fr;
            for (let i = -2; i <= 2; i++) this.shot(e.x - 60, e.y - 50, aim + i * 0.35, bs * 1.1, "shard", { decel: 3, redirect: 0.7, rspeed: bs * 1.2, color: "#9fe8ff" });
          } else if (ph === 2) {
            e.fireT = 0.55 / fr;
            if (e.n % 7 === 0) { this.beam(e, aim - 0.5, 0.45); this.beam(e, aim + 0.5, -0.45); }
            for (let i = 0; i < 3; i++) this.shot(rand(150, C.width - 60), -10, Math.PI / 2 + rand(0.05, 0.3), bs * 0.6, "shard", { color: "#c58aff" });
          } else {
            e.fireT = 2.4 / fr;
            // 수정 감옥: 플레이어 주위에 수정이 둘러서고, 잠시 뒤 한가운데로 날아온다
            const n = 12, cx = p.x, cy = p.y;
            for (let i = 0; i < n; i++) {
              const a = (i / n) * Math.PI * 2;
              if (i % 4 === e.n % 4) continue; // 빠져나갈 틈
              this.shot(cx + Math.cos(a) * 170, cy + Math.sin(a) * 170, a + Math.PI, 0, "shard", { redirect: 0.9, rspeed: bs * 1.1, aimCenter: true, cx, cy, color: "#9fe8ff" });
            }
            this.beam(e, aim, rand(-0.3, 0.3), 1.2, 1.2);
          }
          break;
        case "fire": // 마그마 슬라임 왕: (착지 탄은 이동에서) 용암 덩이, 터지는 불덩이, 분화
          if (ph === 1) {
            e.fireT = 1.4 / fr;
            this.lavaLob(e, 4, bs);
          } else if (ph === 2) {
            e.fireT = 1.3 / fr;
            for (let i = -1; i <= 1; i++) this.shot(e.x - 40, e.y - 30, aim + i * 0.35, bs * 0.6, "fireball", { r: 13, fuse: 0.9, burst: 10, color: "#ff5a1a" });
            if (e.n % 2) this.lavaLob(e, 3, bs);
          } else {
            e.fireT = 0.1 / Math.sqrt(fr);
            e.spin = (e.spin || 0) + 0.27;
            for (let i = 0; i < 3; i++) this.shot(e.x - 20, e.y - 40, e.spin + (i * Math.PI * 2) / 3, bs * 0.75, "fireball", { r: 7, color: "#ff7a3d" });
            if (e.n % 25 === 0) for (let i = -1; i <= 1; i++) this.hazards.push({ type: "lava", x: p.x + i * 110, t: 0, warn: 1.0, active: 0.8, w: 66 });
          }
          break;
        case "frost": // 서리 여왕: 떠다니는 눈꽃, 눈보라 숨결, 고드름 벽, 얼음 감옥
          if (ph === 1) {
            e.fireT = 0.6 / fr;
            e.spin = (e.spin || 0) + 0.21;
            for (let i = 0; i < 6; i++) this.shot(e.x, e.y, e.spin + (i * Math.PI) / 3, bs * 0.9, "flake", { decel: 1.2, drift: -60, freeze: true, color: "#dff4ff", r: 8 });
          } else if (ph === 2) {
            e.fireT = (e.n % 3 === 0 ? 1.7 : 0.9) / fr;
            if (e.n % 3 === 0) {
              const gap = Math.max(90, Math.min(C.groundY - 60, p.y + rand(-80, 80)));
              for (let y = 40; y < C.groundY; y += 34) if (Math.abs(y - gap) > 55) this.shot(C.width + 10, y, Math.PI, bs * 0.7, "icicle", { freeze: true, color: "#bfe8ff", r: 8 });
            } else {
              // 눈보라 숨결: 플레이어 쪽 부채꼴로 느린 눈송이가 쏟아진다
              for (let i = 0; i < 14; i++) this.shot(e.x - 50, e.y + 10, aim + rand(-0.45, 0.45), bs * rand(0.4, 0.8), "flake", { freeze: true, color: "#ffffff", r: 6 });
            }
          } else {
            e.fireT = 2.2 / fr;
            // 얼음 감옥: 고드름이 플레이어를 둘러싸고 잠시 뒤 찌른다
            const n = 10, cx = p.x, cy = p.y;
            for (let i = 0; i < n; i++) {
              const a = (i / n) * Math.PI * 2;
              if (i === e.n % n) continue;
              this.shot(cx + Math.cos(a) * 150, cy + Math.sin(a) * 150, a + Math.PI, 0, "icicle", { redirect: 0.8, rspeed: bs * 1.2, aimCenter: true, cx, cy, freeze: true, color: "#bfe8ff", r: 8 });
            }
            for (let i = 0; i < 6; i++) this.shot(e.x, e.y, (i * Math.PI) / 3 + e.n, bs * 0.8, "flake", { freeze: true, color: "#dff4ff" });
          }
          break;
        case "storm": // 폭풍 군주: 번개 연속탄, 연쇄 번개, 폭풍 소용돌이
          if (ph === 1) {
            e.fireT = 1.1 / fr;
            for (let i = 0; i < 6; i++) this.shot(e.x - 20 - i * 18, e.y, aim, bs * (1.25 + i * 0.05), "bolt", { color: "#ffe66b", r: 6 });
          } else if (ph === 2) {
            e.fireT = 0.9 / fr;
            if (e.n % 3 === 0) {
              // 연쇄 번개: 플레이어 근처를 잇는 번개 줄기 3개 (예고 후)
              let x = p.x + rand(-200, -80), y = rand(60, 200);
              for (let i = 0; i < 3; i++) {
                const nx = p.x + rand(-120, 160), ny = Math.min(C.groundY - 20, y + rand(90, 170));
                this.lineStrike(x, y, nx, ny);
                x = nx; y = ny;
              }
            }
            for (let i = 0; i < 8; i++) this.shot(e.x, e.y, Math.PI + rand(-1.1, 1.1), bs * rand(0.5, 1.0), "bolt", { color: "#c8a0ff", r: 6 });
            if (e.n % 6 === 0) this.batLine(rand(100, 400), 5, "dive");
          } else {
            e.fireT = 1.6 / fr;
            // 폭풍 소용돌이: 플레이어 주위 큰 원에서 탄이 돌며 빨려 들어온다
            const cx = p.x, cy = p.y, n = 14;
            for (let i = 0; i < n; i++) {
              if (i % 7 === 0) continue;
              this.shot(cx, cy, 0, 0, "bolt", { spiral: { cx, cy, rad: 330, ang: (i / n) * Math.PI * 2 + e.n, angVel: 1.3, radVel: -95 }, color: "#ffe66b", r: 6 });
            }
            this.strike(p.x + rand(-60, 60), 0.8);
          }
          break;
        default:
          if (def.style) this.extraBossAttack(e, bs, fr, ph, aim);
      }
    }

    // 특별 모드 보스: 악몽, 아바돈, 큰 붉은 용
    extraBossAttack(e, bs, fr, ph, aim) {
      const def = RD.ENEMIES[e.type], p = this.player;
      switch (def.style) {
        case "nightmare":
          if (ph === 1) {
            // 달콤한 줄 알았지? 사탕 고리가 잠시 뒤 검게 변해 덮쳐 온다
            e.fireT = 1.5 / fr;
            for (let q = 0; q < 12; q++) this.shot(e.x, e.y, (q / 12) * Math.PI * 2 + e.n * 0.2, bs * 0.8, "candy", { decel: 2.2, redirect: 0.9, rspeed: bs * 1.15, color: "#ff9ad8", r: 8 });
          } else if (ph === 2) {
            // 잠꼬대: 흐느적거리며 떠다니는 Z
            e.fireT = 0.7 / fr;
            for (let q = 0; q < 5; q++) this.shot(e.x - 40, e.y + rand(-60, 60), Math.PI + rand(-0.4, 0.4), bs * rand(0.45, 0.7), "z", { wob: { amp: 30, f: 3, ph: q }, color: "#c8b8ff", r: 9 });
            if (e.n % 3 === 0) for (let q = -2; q <= 2; q++) this.shot(e.x, e.y, aim + q * 0.15, bs * 1.1, "candy", { color: "#7a3aa0", r: 7 });
          } else {
            e.fireT = 1.1 / fr;
            if (e.n % 7 === 0) {
              p.inverted = 3;
              this.banner = { text: "악몽: 조작 반전!", color: "#c58aff", t: 0, life: 1.4, small: true };
            }
            const gap = aim + rand(-0.4, 0.4), n = 24;
            for (let q = 0; q < n; q++) {
              const a = (q / n) * Math.PI * 2;
              if (Math.abs(((a - gap + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.45) continue;
              this.shot(e.x, e.y, a, bs * 0.75, "candy", { color: q % 2 ? "#ff9ad8" : "#7a3aa0", r: 7 });
            }
          }
          break;
        case "abaddon":
          if (ph === 1) {
            e.fireT = 1.2 / fr;
            for (let q = 0; q < 10; q++) this.shot(e.x - 30 - q * 12, e.y + (q - 5) * 18, Math.PI, bs * 0.9, "minibat", { wob: { amp: 35, f: 6, ph: q }, color: "#c8a030", r: 7 });
            for (let q = -1; q <= 1; q++) this.shot(e.x - 40, e.y, aim + q * 0.12, bs * 1.3, "bolt", { color: "#ffd34d" });
          } else if (ph === 2) {
            // 무저갱의 연기와 전갈 꼬리 같은 휘어지는 독침
            e.fireT = 1.0 / fr;
            for (let q = 0; q < 10; q++) this.shot(e.x, e.y, (q / 10) * Math.PI * 2 + e.n, bs * 0.5, "smoke", { color: "#5a4a3a", r: 14 });
            for (let q = 0; q < 4; q++) this.shot(e.x - 40, e.y, aim + (q - 1.5) * 0.25, bs, "bolt", { wob: { amp: 60, f: 4, ph: q }, color: "#9fff6a" });
          } else {
            e.fireT = 0.9 / fr;
            if (e.n % 3 === 0) { const y = rand(80, C.groundY - 80); for (let q = 0; q < 10; q++) this.addEnemy("locust", C.width + 30 + q * 24, y, { path: "swarm" }); }
            for (let q = 0; q < 12; q++) this.shot(e.x - 30 - q * 10, e.y + (q - 6) * 20, Math.PI + rand(-0.2, 0.2), bs, "minibat", { wob: { amp: 30, f: 7, ph: q }, color: "#c8a030" });
          }
          break;
        case "dragon": {
          // 일곱 머리: 용 주위 일곱 곳에서 쏜다
          const heads = [];
          for (let q = 0; q < 7; q++) heads.push([e.x - 70 - Math.abs(q - 3) * 18, e.y - 90 + q * 30]);
          if (ph === 1) {
            e.fireT = 1.3 / fr;
            heads.forEach(([hx, hy], q) => { const a = Math.atan2(p.y - hy, p.x - hx); this.shot(hx, hy, a, bs * (0.9 + q * 0.04), "fireball", { color: "#ff3a1a", r: 8 }); });
          } else if (ph === 2) {
            // 꼬리로 하늘의 별 삼분의 일을 끌어 땅에 던진다 + 불 숨결
            e.fireT = 1.2 / fr;
            for (let q = 0; q < 9; q++) this.shot(rand(80, C.width), -20, Math.PI / 2 + rand(-0.3, 0.1), bs * 0.4, "star", { g: 220, color: "#ffe9a0", r: 8 });
            for (let q = 0; q < 10; q++) this.shot(heads[3][0], heads[3][1], aim + rand(-0.35, 0.35), bs * rand(0.7, 1.1), "fireball", { color: "#ff7a1a", r: 7 });
          } else {
            e.fireT = 1.6 / fr;
            if (e.n % 2) {
              // 입에서 물을 강같이 토한다: 빈틈 하나 있는 물의 벽
              const gap = Math.max(90, Math.min(C.groundY - 60, p.y + rand(-90, 90)));
              for (let y = 30; y < C.groundY; y += 30) if (Math.abs(y - gap) > 58) this.shot(C.width + 10, y, Math.PI, bs * 0.75, "drop", { color: "#4aa8ff", r: 8 });
            } else {
              heads.forEach(([hx, hy]) => { const a = Math.atan2(p.y - hy, p.x - hx); for (let q = -1; q <= 1; q++) this.shot(hx, hy, a + q * 0.12, bs, "fireball", { color: "#ff3a1a", r: 7 }); });
            }
          }
          break;
        }
      }
    }

    // 박쥐 떼: 물결치며 날아오는 작은 박쥐 탄
    batSwarm(e, bs, n) {
      for (let i = 0; i < n; i++) {
        const y = e.y + (i - n / 2) * 22;
        this.shot(e.x - 30 - i * 14, y, Math.PI, bs * 0.85, "minibat", { wob: { amp: 40, f: 5, ph: i * 0.7 }, color: "#6a4a9a", r: 7 });
      }
    }

    // 용암 덩이: 플레이어 근처로 포물선을 그리며 떨어지고, 땅에 닿으면 용암 자국
    lavaLob(e, n, bs) {
      const p = this.player, G = 700;
      for (let i = 0; i < n; i++) {
        const tx = p.x + (i - (n - 1) / 2) * 90 + rand(-20, 20), T = 1.1 + i * 0.08;
        const ty = C.groundY - 10, sx = e.x - 40, sy = e.y - 60;
        const vx = (tx - sx) / T, vy = (ty - sy - 0.5 * G * T * T) / T;
        const b = this.shot(sx, sy, 0, 0, "lava", { g: G, lava: true, color: "#ff6a1a", r: 11 });
        b.vx = vx; b.vy = vy;
      }
    }

    // ---------- 지형 효과 ----------
    strike(x, warn = 1.0) { this.hazards.push({ type: "bolt", x: Math.max(30, Math.min(C.width - 30, x)), t: 0, warn, active: 0.25, w: 46 }); }

    updateTerrain(dt) {
      const p = this.player;
      this.terrainT += dt;
      const tr = this.terrain;
      if (this.M.special === "judgment" && this.tr >= 0) this.trumpetPlague(dt);
      if (this.rush > 0) {
        // 슈가 러시: 무적, 적 탄이 사탕으로 바뀐다
        this.rush -= dt;
        p.invuln = Math.max(p.invuln, 0.15);
        for (const b of this.bullets.splice(0, 40)) this.items.push({ type: "candy", x: b.x, y: b.y, vx: 0, vy: -40 });
        this.bullets = [];
      }
      if (tr === "lava") {
        // 용암 기둥 (예고 후 분출) + 떨어지는 불똥
        if ((this.lavaT = (this.lavaT || 2) - dt) <= 0) {
          this.lavaT = rand(2.6, 4) / Math.sqrt(this.D.fireRate);
          const x = Math.random() < 0.6 ? p.x + rand(-40, 40) : rand(80, C.width - 80);
          this.hazards.push({ type: "lava", x, t: 0, warn: 1.2, active: 0.9, w: 70 });
        }
        if ((this.emberT = (this.emberT || 1) - dt) <= 0) {
          this.emberT = rand(0.5, 0.9);
          this.bullets.push({ x: rand(100, C.width), y: -10, vx: rand(-60, -20), vy: rand(110, 160), r: 5, color: "#ff8a3d" });
        }
      }
      if (tr === "storm") {
        if ((this.boltT = (this.boltT || 2.5) - dt) <= 0) {
          this.boltT = rand(2.2, 3.4) / Math.sqrt(this.D.fireRate);
          this.strike(Math.random() < 0.7 ? p.x + rand(-30, 30) : rand(60, C.width - 60));
        }
      }
      if (tr === "ice") {
        // 강풍: 몇 초마다 옆으로 민다
        if (!this.wind && (this.windT = (this.windT || 5) - dt) <= 0) {
          this.wind = { dir: Math.random() < 0.5 ? -1 : 1, t: 0, life: 2.2 };
          this.windT = rand(5, 8);
        }
        if (this.wind) {
          if (p.dead <= 0) p.x = Math.max(30, Math.min(C.width - 40, p.x + this.wind.dir * 150 * dt));
          if ((this.wind.t += dt) > this.wind.life) this.wind = null;
        }
      }
      for (const h of this.hazards) {
        h.t += dt;
        const on = h.t > h.warn && h.t < h.warn + h.active;
        if (h.type === "beam") {
          if (h.src && !h.src.dead) { h.x = h.src.x - 30; h.y = h.src.y - (RD.ENEMIES[h.src.type].ground ? 40 : 0); }
          if (on) h.ang += h.angVel * dt;
          h.x2 = h.x + Math.cos(h.ang) * h.len; h.y2 = h.y + Math.sin(h.ang) * h.len;
        }
        const segDist = (x1, y1, x2, y2) => {
          const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy || 1;
          const t = Math.max(0, Math.min(1, ((p.x - x1) * dx + (p.y - y1) * dy) / l2));
          return Math.hypot(p.x - (x1 + dx * t), p.y - (y1 + dy * t));
        };
        if (h.type === "meteor") {
          const k = Math.max(0, Math.min(1, (h.t - h.warn) / h.active));
          h.x = h.sx + (h.ex - h.sx) * k; h.y = h.sy + (h.ey - h.sy) * k;
          if (h.t >= h.warn + h.active && !h.landed) {
            h.landed = true; this.shake = 0.8;
            for (let q = 0; q < 18; q++) this.shot(h.ex, h.ey, Math.PI + (q / 17) * Math.PI, rand(150, 230), "blood", { color: "#d8202a" });
          }
        }
        if (h.type === "star" && h.t >= h.warn && !h.fell) {
          h.fell = true;
          for (let q = 0; q < 8; q++) this.shot(h.x, C.groundY - 20, -Math.PI + (q / 7) * Math.PI, 170, "drop", { color: "#8ad840", r: 7 });
          this.hazards.push({ type: "zone", x: h.x, w: 120, top: C.groundY - 170, t: 0, warn: 0.01, active: 4, dmg: 14 });
        }
        const inside = h.type === "meteor" ? Math.hypot(p.x - h.x, p.y - h.y) < h.r :
          h.type === "beam" ? segDist(h.x, h.y, h.x2, h.y2) < h.w / 2
          : h.type === "line" ? segDist(h.x1, h.y1, h.x2, h.y2) < h.w / 2
          : h.type === "zone" ? Math.abs(p.x - h.x) < h.w / 2 && p.y > h.top
          : Math.abs(p.x - h.x) < h.w / 2;
        if (on && !h.hit && p.dead <= 0 && p.invuln <= 0 && inside) {
          h.hit = true;
          this.hurt(h.dmg || (h.type === "lava" ? 24 : 22));
        }
        if (on && !h.boomed) { h.boomed = true; this.shake = Math.max(this.shake, 0.15); RD.audio && RD.audio.sfx(h.type === "lava" ? "explode_small" : "hurt"); }
      }
      this.hazards = this.hazards.filter((h) => h.t < h.warn + h.active + 0.3 || (h.type === "meteor" && !h.landed));
    }

    updateBullets(dt) {
      const p = this.player;
      for (const b of this.bullets) {
        b.age = (b.age || 0) + dt;
        if (b.spiral) {
          const sp = b.spiral;
          sp.ang += sp.angVel * dt; sp.rad = Math.max(0, sp.rad + sp.radVel * dt);
          const nx = sp.cx + Math.cos(sp.ang) * sp.rad, ny = sp.cy + Math.sin(sp.ang) * sp.rad;
          b.vx = (nx - b.x) / dt; b.vy = (ny - b.y) / dt;
          b.x = nx; b.y = ny;
          if (sp.rad <= 0) b.dead = true;
          continue;
        }
        if (b.g) b.vy += b.g * dt;
        if (b.decel) { const k = Math.max(0, 1 - b.decel * dt); b.vx *= k; b.vy *= k; if (b.drift) b.vx += b.drift * dt; }
        if (b.redirect != null && b.age >= b.redirect && !b.redone) {
          // 멈춰 있다가 플레이어(또는 감옥의 한가운데) 쪽으로 다시 날아간다
          b.redone = true;
          const tx = b.aimCenter ? b.cx : p.x, ty = b.aimCenter ? b.cy : p.y;
          const a = Math.atan2(ty - b.y, tx - b.x);
          b.vx = Math.cos(a) * b.rspeed; b.vy = Math.sin(a) * b.rspeed;
          b.decel = 0;
        }
        if (b.wob) b.y += Math.cos(b.age * b.wob.f + b.wob.ph) * b.wob.amp * b.wob.f * dt;
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.lava && b.y >= C.groundY - 10) {
          b.dead = true;
          this.hazards.push({ type: "lava", x: b.x, t: 0, warn: 0.35, active: 0.6, w: 50 });
        }
        if (b.fuse != null && (b.fuse -= dt) <= 0) {
          // 터지는 탄
          b.dead = true;
          const prev = this._firing;
          for (let i = 0; i < b.burst; i++) this.bullets.push({ x: b.x, y: b.y, vx: Math.cos((i / b.burst) * Math.PI * 2) * 150, vy: Math.sin((i / b.burst) * Math.PI * 2) * 150, r: 6, color: b.color, boss: b.boss });
          this._firing = prev;
        }
      }
      this.bullets = this.bullets.filter((b) => !b.dead);
      this.bullets = this.bullets.filter((b) => !b.dead && (b.spiral || (b.x > -40 && b.x < C.width + 40 && b.y > -60 && b.y < C.height + 20)));
    }

    updateItems(dt) {
      const p = this.player;
      const R = this.magnetR;
      for (const it of this.items) {
        it.t = (it.t || 0) + dt;
        const d = Math.hypot(p.x - it.x, p.y - it.y);
        if (p.dead <= 0 && (d < R || p.x > C.width - 220)) {
          it.x += (p.x - it.x) * Math.min(1, dt * 10);
          it.y += (p.y - it.y) * Math.min(1, dt * 10);
        } else {
          it.vy = Math.min(120, it.vy + 400 * dt);
          it.vx += (-C.scrollSpeed * 0.6 - it.vx) * Math.min(1, dt * 2);
          it.x += it.vx * dt;
          it.y += it.vy * dt;
          if (it.y > C.groundY - 14) { it.y = C.groundY - 14; it.vy = -Math.abs(it.vy) * 0.4; }
        }
        if (p.dead <= 0 && d < 32) this.take(it);
      }
      this.items = this.items.filter((it) => !it.taken && it.x > -40);
    }

    take(it) {
      it.taken = true;
      const def = RD.ITEMS[it.type];
      this.coins += RD.COIN_VALUE[it.type] || 0;
      RD.audio && RD.audio.sfx(def.heal ? "heal" : def.exp || def.life || it.type === "bomb" ? "power" : "coin");
      this.addScore(def.score * this.loop);
      if (def.exp) this.gainExp(def.exp);
      if (def.heal) {
        this.player.hp = Math.min(this.maxHp, this.player.hp + def.heal);
        this.text("+" + def.heal, "#ff8aa8");
      }
      if (def.sugar && this.rush <= 0) {
        this.sugar += def.sugar;
        if (this.sugar >= 30) {
          this.sugar = 0; this.rush = 6;
          this.banner = { text: "슈가 러시!", sub: "6초 동안 무적, 연사 2배, 적 탄이 사탕으로", color: "#ff9ad8", t: 0, life: 1.8 };
          RD.audio && RD.audio.sfx("levelup");
        }
      }
      if (it.type === "bomb") this.bombs = Math.min(C.maxBombs, this.bombs + 1);
      if (def.life) { this.lives++; this.text("1UP!", "#9fffb0"); }
    }

    text(t, color) {
      const p = this.player;
      this.effects.push({ type: "text", x: p.x, y: p.y - 50, text: t, color, t: 0, life: 0.9 });
    }

    updateEffects(dt) {
      for (const e of this.effects) { e.t += dt; if (e.type === "text") e.y -= 40 * dt; }
      this.effects = this.effects.filter((e) => e.t < e.life);
    }
  }

  RD.Run = Run;
})();
