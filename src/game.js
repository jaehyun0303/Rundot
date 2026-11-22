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
    [11, (r) => r.batLine(240, 6, "dive")],
    [14, (r) => r.wisp(150)],
    [17, (r) => { r.batLine(110, 5, "sine"); r.batLine(390, 5, "sine"); }],
    [21, (r) => r.ground("mushroom", 2)],
    [23, (r) => r.batV(250)],
    [27, (r) => { r.wisp(130); r.wisp(360); }],
    [31, (r) => r.ground("slime", 4)],
    [33, (r) => r.batLine(200, 7, "dive")],
    [37, (r) => r.midboss()],
    [39, (r) => r.batV(170)],
    [42, (r) => { r.ground("mushroom", 3); r.batLine(140, 5, "sine"); }],
    [46, (r) => { r.wisp(120); r.wisp(250); r.wisp(380); }],
    [51, (r) => { r.batV(140); r.batV(360); }],
    [55, (r) => { r.ground("slime", 5); r.batLine(300, 6, "dive"); }],
    [59, (r) => { r.batLine(100, 6, "sine"); r.batLine(250, 6, "sine"); r.batLine(400, 6, "sine"); }],
    [64, (r) => { r.wisp(180); r.wisp(330); r.ground("mushroom", 3); }],
    [70, (r) => r.warning()],
    [73, (r) => r.spawnBoss()],
  ];
  const STORY_STAGES = 3;

  // 무한 / 타임 어택 모드에서 무작위로 고르는 적 등장 패턴 (k = 강도 1~4)
  const PATTERNS = [
    (r, k) => r.batLine(rand(80, 420), 4 + k, pick(["sine", "dive"])),
    (r, k) => r.batV(rand(150, 350)),
    (r, k) => { for (let i = 0; i < Math.ceil(k / 2); i++) r.wisp(rand(90, 400)); },
    (r, k) => r.ground(pick(["slime", "mushroom"]), 1 + Math.ceil(k)),
    (r, k) => { r.batLine(rand(80, 200), 3 + k, "sine"); r.batLine(rand(300, 420), 3 + k, "sine"); },
  ];

  class Run {
    constructor(charId, mode = "story", diff = "normal", opts = {}) {
      this.stars = opts.stars || 1; // 각성 단계 (뽑기에서 중복으로 얻으면 오른다)
      this.coins = 0; // 이번 판에 모은 코인
      this.slashes = []; // 여우 베기
      this.charId = charId;
      this.char = RD.CHARACTERS.find((c) => c.id === charId);
      this.mode = mode;
      this.diff = diff;
      this.D = RD.DIFFICULTY[diff];
      this.t = 0;
      this.stageT = 0;
      this.stageIdx = 0;
      this.loop = 1; // 스테이지 번호 (또는 보스 러시 라운드)
      this.score = 0;
      this.nextExtend = C.extendEvery;
      this.lives = this.D.lives;
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

      this.player = { x: 160, y: 260, hp: C.maxHp + RD.GACHA.starHp * (this.stars - 1), invuln: C.respawnInvuln, hurt: 0, dead: 0, animT: 0, shotCd: 0, tilt: 0 };
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
      this.openChoice();
    }

    // ---------- 능력치 (강화 단계에서 계산) ----------
    lv(id) { return this.up[id] || 0; }
    get power() { return 1 + this.lv("multi"); }
    get dmgMul() { return (1 + 0.2 * this.lv("dmg")) * (1 + RD.GACHA.starDmg * (this.stars - 1)); }
    get maxHp() { return C.maxHp + 25 * this.lv("hp") + RD.GACHA.starHp * (this.stars - 1); }
    get armor() { return 1 - 0.15 * this.lv("armor"); }
    get magnetR() { return 100 * (1 + 0.6 * this.lv("magnet")); }
    get scoreMul() { return this.D.score * (1 + 0.15 * this.lv("luck")); }
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
      const e = { type, x, y, hp, maxHp: hp, t: 0, flash: 0, dead: false, fireT: rand(0.6, 1.6) / this.D.fireRate, ...extra };
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

    ground(type, n) {
      const def = RD.ENEMIES[type];
      for (let i = 0; i < n; i++) this.addEnemy(type, C.width + 40 + i * 110, C.groundY - def.h / 2, { path: "ground" });
    }

    midboss() {
      const def = RD.ENEMIES.golem;
      this.addEnemy("golem", C.width + 80, C.groundY - def.h / 2, { path: "midboss", stopX: 780, life: 30 });
    }

    warning() { this.banner = { text: "WARNING", sub: "박쥐 왕이 다가온다", color: "#ff4d5e", t: 0, life: 3 }; }
    spawnBoss() { this.addEnemy("boss", C.width + 160, 240, { path: "boss", phase: 1 }); }

    // ---------- 모드별 진행 ----------
    direct(dt) {
      const M = this.mode;
      if (M === "story") {
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
        else { this.warning(); this.spawnBoss(); rs.next = "golem"; }
        rs.wait = 3;
        return;
      }
      // 무한 / 타임 어택: 무작위 패턴 + 주기적인 보스
      if (this.bossAlive) return;
      this.bossClock += dt;
      const bossEvery = M === "timeattack" ? 70 : 80;
      if (this.bossClock >= bossEvery) {
        this.bossClock = 0;
        this.bossCount++;
        if (M === "endless" && this.bossCount % 2 === 0) { this.warning(); this.spawnBoss(); }
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

    // ---------- 적 탄 ----------
    fire(x, y, ang, speed = this.bulletSpeed, r = RD.BULLET.radius, color = "#ff5aa8") {
      this.bullets.push({ x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, r, color });
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
      p.shotCd = s.cd * Math.pow(0.88, this.lv("rate"));
      const sig = this.lv("sig");
      const pw = this.power;
      const dmg = s.dmg * this.dmgMul;

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
          const n = s.multi[pw - 1];
          for (let i = 0; i < n; i++) {
            const a = (i - (n - 1) / 2) * 0.22;
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
        const before = this.bullets.length;
        this.bullets = this.bullets.filter((b) => {
          if (!inArc(b.x, b.y, b.r)) return true;
          this.effects.push({ type: "pop", x: b.x, y: b.y, t: 0, life: 0.25 });
          return false;
        });
        this.addScore((before - this.bullets.length) * 10);
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
      const life = { fox: 1.0, rabbit: 3.0, bear: 1.5, owl: 3.5, cat: 3.0 }[this.charId];
      this.bombT = life;
      this.ult = { kind: this.charId, t: 0, life, x0: p.x, y0: p.y, done: {}, spawnT: 0, mul: 1 + 0.3 * this.lv("bomb") };
      p.invuln = Math.max(p.invuln, life + 0.6);
      this.banner = { text: this.char.bomb.name + "!", color: this.char.bomb.color, t: 0, life: 1.2, small: true };

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
      p.hp -= amount * this.D.damage * this.armor;
      p.invuln = C.hitInvuln;
      p.hurt = 0.3;
      this.shake = Math.max(this.shake, 0.15);
      this.effects.push({ type: "flash", t: 0, life: 0.2 });
      if (p.hp <= 0) this.die();
    }

    die() {
      const p = this.player;
      this.effects.push({ type: "boom", x: p.x, y: p.y, t: 0, life: 0.8, big: true });
      this.shake = 0.4;
      this.lives--;
      this.bombs = Math.max(this.bombs, C.bombs);
      this.bullets = [];
      if (this.lives <= 0) { this.over = true; p.dead = 99; p.hp = 0; return; }
      p.dead = 1; // 1초 뒤 체력을 모두 채워 다시 등장
    }

    addScore(n) {
      this.score += Math.round(n * this.scoreMul);
      while (this.score >= this.nextExtend) {
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

      // 이동 (키보드: dx/dy, 터치: moveX/moveY 만큼 바로 이동)
      const inp = this.input;
      if (p.dead > 0) {
        p.dead -= dt;
        if (p.dead <= 0) { p.x = 120; p.y = 260; p.hp = this.maxHp; p.invuln = C.respawnInvuln; }
        inp.moveX = inp.moveY = 0;
      } else {
        const sp = (inp.focus ? C.focusSpeed : C.moveSpeed) * (1 + 0.12 * this.lv("speed"));
        const my = inp.dy * sp * dt + inp.moveY;
        p.x += inp.dx * sp * dt + inp.moveX;
        p.y += my;
        p.tilt += (Math.max(-1, Math.min(1, my / Math.max(1, sp * dt))) - p.tilt) * Math.min(1, dt * 10);
        inp.moveX = inp.moveY = 0;
        p.x = Math.max(30, Math.min(C.width - 40, p.x));
        p.y = Math.max(50, Math.min(C.groundY - 20, p.y));
        p.hp = Math.min(this.maxHp, p.hp + this.lv("regen") * dt);
      }
      p.invuln = Math.max(0, p.invuln - dt);
      p.hurt = Math.max(0, p.hurt - dt);
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
          this.bullets.splice(bi, 1);
          this.hurt(C.bulletDamage);
        } else if (this.enemies.some((e) => !e.dead && e.t > 0 && this.inBox(p, e, -6))) {
          this.hurt(C.contactDamage);
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
            if (s.t - last >= 0.15) { s.tick.set(e, s.t); this.damage(e, s.dmg, true); }
          }
          this.bullets = this.bullets.filter((b) => Math.abs(b.x - s.x) > s.w / 2 + b.r || Math.abs(b.y - s.y) > s.h / 2 + b.r);
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
      this.shots = this.shots.filter((s) => !s.gone && s.x < C.width + 80 && s.x > -80 && s.y > -200 && s.y < C.height + 60 && s.t < 4);
    }

    damage(e, dmg, quiet) {
      if (e.dead) return;
      e.hp -= dmg;
      if (!quiet || e.flash <= 0) e.flash = 0.06;
      if (e.hp > 0) return;
      const def = RD.ENEMIES[e.type];
      e.dead = true;
      this.kills++;
      this.addScore(def.score * this.loop);
      this.gainExp(def.exp);
      this.effects.push({ type: "boom", x: e.x, y: e.y, t: 0, life: def.boss ? 2 : def.midboss ? 1 : 0.5, big: def.boss || def.midboss });
      const drop = (type, n = 1) => {
        for (let i = 0; i < n; i++) this.items.push({ type, x: e.x + rand(-20, 20), y: e.y + rand(-20, 20), vx: rand(-40, 80), vy: rand(-220, -80) });
      };
      const heartChance = 0.03 * (1 + this.lv("luck"));
      if (Math.random() < heartChance) drop("heal");
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
        if (this.mode === "story") {
          if (this.loop >= STORY_STAGES) {
            this.over = true;
            this.win = true;
            this.banner = { text: "ALL CLEAR!", sub: "박쥐 왕을 완전히 쓰러뜨렸다", color: "#ffd34d", t: 0, life: 99 };
          } else {
            this.banner = { text: `STAGE ${this.loop} CLEAR`, sub: `더 어려운 스테이지 ${this.loop + 1}로`, color: "#ffd34d", t: 0, life: 4 };
            this.loop++;
            this.stageT = -5;
            this.stageIdx = 0;
          }
        } else {
          this.loop++;
          this.banner = { text: "BOSS DOWN", sub: this.mode === "bossrush" ? `${this.loop}라운드 시작` : "적이 더 강해진다", color: "#ffd34d", t: 0, life: 3 };
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
            if (e.t < 6) e.x += (e.stopX - e.x) * Math.min(1, dt * 2);
            else { e.x += 60 * dt; e.y -= 160 * dt; }
            e.y += Math.sin(e.t * 2) * 20 * dt;
            break;
          case "ground":
            e.x -= (C.scrollSpeed + (e.type === "slime" ? 30 : 0)) * dt;
            if (e.type === "slime") e.y = C.groundY - RD.ENEMIES.slime.h / 2 - Math.abs(Math.sin(e.t * 3.2)) * 70;
            break;
          case "midboss":
            if (e.t < e.life) e.x += (e.stopX - e.x) * Math.min(1, dt * 1.2);
            else e.x -= C.scrollSpeed * dt; // 시간이 지나면 떠난다
            break;
          case "boss":
            e.x += (760 - e.x) * Math.min(1, dt * 0.8);
            e.y = 240 + Math.sin(e.t * 0.9) * 110;
            break;
        }

        if (e.x > C.width - 20 || e.x < 20) continue;
        e.fireT -= dt;
        if (e.fireT > 0) continue;
        const L = this.loop;
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
          case "golem":
            e.fireT = 1.15 / fr;
            e.volley = (e.volley || 0) + 1;
            if (e.volley % 2) this.fan(e, 4 + L, 0.17, bs, "#ffb347");
            else for (let i = 0; i < 6; i++) this.fire(e.x - 30, e.y - 40, -Math.PI / 2 - 0.9 - i * 0.12, bs * 1.1, 8, "#c4945c");
            break;
          case "boss": {
            const k = e.hp / e.maxHp;
            e.phase = k > 0.6 ? 1 : k > 0.3 ? 2 : 3;
            if (e.phase === 1) {
              e.fireT = 1.0 / fr;
              this.fan(e, 7, 0.14, bs, "#ff5aa8");
              if ((e.summon = (e.summon || 0) + 1) % 4 === 0) this.batLine(rand(100, 400), 4, "dive");
            } else if (e.phase === 2) {
              e.fireT = 0.1 / Math.sqrt(fr);
              e.spin = (e.spin || 0) + 0.33;
              this.fire(e.x - 20, e.y, e.spin, bs * 0.8, 6, "#c58aff");
              this.fire(e.x - 20, e.y, e.spin + Math.PI, bs * 0.8, 6, "#c58aff");
            } else {
              e.fireT = 0.9 / fr;
              e.ringN = (e.ringN || 0) + 1;
              this.ring(e, 18, bs * 0.7, e.ringN * 0.17, "#ff4d5e");
              if (e.ringN % 2) this.fan(e, 3, 0.1, bs * 1.25, "#ffd34d");
            }
            break;
          }
        }
      }
      for (const e of this.enemies) {
        if (!e.dead && (e.x < -120 || e.y < -150 || e.y > C.height + 150)) {
          e.gone = true;
          if (e.group) this.groups[e.group].total = -1;
        }
      }
      this.enemies = this.enemies.filter((e) => !e.gone && !e.dead);
    }

    updateBullets(dt) {
      for (const b of this.bullets) { b.x += b.vx * dt; b.y += b.vy * dt; }
      this.bullets = this.bullets.filter((b) => b.x > -20 && b.x < C.width + 20 && b.y > -20 && b.y < C.height + 20);
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
      this.addScore(def.score * this.loop);
      if (def.exp) this.gainExp(def.exp);
      if (def.heal) {
        this.player.hp = Math.min(this.maxHp, this.player.hp + def.heal);
        this.text("+" + def.heal, "#ff8aa8");
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
