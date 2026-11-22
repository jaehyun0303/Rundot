// 슈팅 게임 진행: 플레이어 이동과 자동 사격, 적 편대와 탄막, 아이템, 폭탄, 잔기, 보스
(function () {
  const C = RD.CONFIG;
  const rand = (a, b) => a + Math.random() * (b - a);

  // ---------- 스테이지 진행표 ----------
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

  class Run {
    constructor(charId) {
      this.charId = charId;
      this.char = RD.CHARACTERS.find((c) => c.id === charId);
      this.t = 0;
      this.stageT = 0;
      this.stageIdx = 0;
      this.loop = 1; // 주차 (보스를 잡으면 더 어려워져서 다시 시작)
      this.score = 0;
      this.nextExtend = C.extendEvery;
      this.lives = C.lives;
      this.bombs = C.bombs;
      this.power = 1;
      this.kills = 0;
      this.over = false;
      this.overTimer = 0;
      this.scroll = 0;
      this.player = { x: 160, y: 260, invuln: C.respawnInvuln, dead: 0, animT: 0, shotCd: 0, tilt: 0 };
      this.pet = { x: 100, y: 260, t: 0 };
      this.shots = [];
      this.enemies = [];
      this.bullets = [];
      this.items = [];
      this.effects = [];
      this.groups = {}; // 편대: 전부 잡으면 P 아이템
      this.groupId = 0;
      this.bombT = 0; // 폭탄 연출 남은 시간
      this.banner = null; // WARNING, STAGE CLEAR 등 화면 가운데 글자
      this.shake = 0;
      this.input = { dx: 0, dy: 0, focus: false, moveX: 0, moveY: 0 };
    }

    get bossAlive() { return this.enemies.some((e) => !e.dead && (RD.ENEMIES[e.type].boss || RD.ENEMIES[e.type].midboss)); }
    get boss() { return this.enemies.find((e) => !e.dead && (RD.ENEMIES[e.type].boss || RD.ENEMIES[e.type].midboss)); }
    get bulletSpeed() { return RD.BULLET.speed * (1 + 0.12 * (this.loop - 1)); }

    // ---------- 적 등장 ----------
    addEnemy(type, x, y, extra = {}) {
      const def = RD.ENEMIES[type];
      const hp = def.hp * (1 + 0.6 * (this.loop - 1));
      const e = { type, x, y, hp, maxHp: hp, t: 0, flash: 0, dead: false, fireT: rand(0.6, 1.6), ...extra };
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
      this.addEnemy("golem", C.width + 80, C.groundY - def.h / 2, { path: "midboss", stopX: 780, life: 28 });
    }

    warning() { this.banner = { text: "WARNING", sub: "박쥐 왕이 다가온다", color: "#ff4d5e", t: 0, life: 3 }; }

    spawnBoss() { this.addEnemy("boss", C.width + 160, 240, { path: "boss", phase: 1 }); }

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

    // ---------- 플레이어 ----------
    shoot(dt) {
      const p = this.player;
      p.shotCd -= dt;
      if (p.shotCd > 0 || p.dead > 0) return;
      const s = this.char.shot;
      p.shotCd = s.cd;
      for (const [oy, deg] of s.lanes[this.power - 1]) {
        const a = s.kind === "feather" ? (oy / 8) * 0.13 : (deg * Math.PI) / 180; // 깃털은 부채꼴
        this.shots.push({
          kind: s.kind, x: p.x + 30, y: p.y + (s.kind === "feather" ? 0 : oy),
          vx: Math.cos(a) * s.speed, vy: Math.sin(a) * s.speed,
          w: s.w, h: s.h, dmg: s.dmg, pierce: !!s.pierce, homing: !!s.homing, hit: [], t: 0, color: s.color,
        });
      }
      // 펫(옵션): 파워 2부터 같이 쏜다
      if (this.power >= 2) {
        const pet = this.pet, n = this.power >= 4 ? 2 : 1;
        for (let i = 0; i < n; i++) {
          this.shots.push({ kind: "pet", x: pet.x + 16, y: pet.y + (n === 2 ? (i ? 8 : -8) : 0), vx: 900, vy: 0, w: 16, h: 10, dmg: 1, hit: [], t: 0, color: "#7fe6ff" });
        }
      }
    }

    bomb() {
      if (this.over || this.bombs <= 0 || this.bombT > 0 || this.player.dead > 0) return;
      this.bombs--;
      this.bombT = 1.2;
      this.player.invuln = Math.max(this.player.invuln, C.bombInvuln);
      this.shake = 0.5;
      for (const b of this.bullets) this.effects.push({ type: "pop", x: b.x, y: b.y, t: 0, life: 0.3 });
      this.addScore(this.bullets.length * 10);
      this.bullets = [];
      this.banner = { text: this.char.bomb.name + "!", color: this.char.bomb.color, t: 0, life: 1.2, small: true };
    }

    die() {
      const p = this.player;
      this.effects.push({ type: "boom", x: p.x, y: p.y, t: 0, life: 0.8, big: true });
      this.shake = 0.4;
      this.lives--;
      if (this.power > 1) this.items.push({ type: "power", x: p.x + 40, y: p.y - 20, vx: 60, vy: -120 });
      this.power = Math.max(1, this.power - 1);
      this.bombs = Math.max(this.bombs, C.bombs);
      this.bullets = [];
      if (this.lives <= 0) { this.over = true; p.dead = 99; return; }
      p.dead = 1; // 1초 뒤 다시 등장
    }

    addScore(n) {
      this.score += n;
      while (this.score >= this.nextExtend) {
        this.nextExtend += C.extendEvery;
        this.lives++;
        this.banner = { text: "1UP!", color: "#9fffb0", t: 0, life: 1.2, small: true };
      }
    }

    // ---------- 갱신 ----------
    update(dt) {
      this.t += dt;
      this.scroll += C.scrollSpeed * dt;
      this.shake = Math.max(0, this.shake - dt);
      if (this.banner && (this.banner.t += dt) > this.banner.life) this.banner = null;
      const p = this.player;

      if (this.over) {
        this.overTimer += dt;
        this.updateEffects(dt);
        this.updateBullets(dt);
        return;
      }

      // 스테이지 진행표 (중간 보스나 보스가 있으면 멈춘다)
      if (!this.bossAlive) this.stageT += dt;
      while (this.stageIdx < STAGE.length && this.stageT >= STAGE[this.stageIdx][0]) STAGE[this.stageIdx++][1](this);

      // 플레이어 이동 (키보드: dx/dy, 터치: moveX/moveY 만큼 바로 이동)
      const inp = this.input;
      if (p.dead > 0) {
        p.dead -= dt;
        if (p.dead <= 0) { p.x = 120; p.y = 260; p.invuln = C.respawnInvuln; }
        inp.moveX = inp.moveY = 0;
      } else {
        const sp = inp.focus ? C.focusSpeed : C.moveSpeed;
        const my = inp.dy * sp * dt + inp.moveY;
        p.x += inp.dx * sp * dt + inp.moveX;
        p.y += my;
        p.tilt += (Math.max(-1, Math.min(1, my / Math.max(1, sp * dt))) - p.tilt) * Math.min(1, dt * 10);
        inp.moveX = inp.moveY = 0;
        p.x = Math.max(30, Math.min(C.width - 40, p.x));
        p.y = Math.max(50, Math.min(C.groundY - 20, p.y));
      }
      p.invuln = Math.max(0, p.invuln - dt);
      p.animT += dt;
      this.bombT = Math.max(0, this.bombT - dt);

      // 펫이 뒤를 따라온다
      const pet = this.pet;
      pet.t += dt;
      pet.x += (p.x - 56 - pet.x) * Math.min(1, dt * 8);
      pet.y += (p.y - 34 + Math.sin(pet.t * 4) * 6 - pet.y) * Math.min(1, dt * 8);

      this.shoot(dt);
      this.updateShots(dt);
      this.updateEnemies(dt);
      this.updateBullets(dt);
      this.updateItems(dt);
      this.updateEffects(dt);

      // 폭탄: 터지는 동안 화면의 적에게 계속 피해, 적 탄은 사라진다
      if (this.bombT > 0) {
        this.bullets = [];
        for (const e of this.enemies) if (!e.dead && e.x < C.width + 20) this.damage(e, (C.bombDamage / 1.2) * dt);
      }

      // 피격 판정 (판정은 캐릭터 가운데의 작은 점)
      if (p.dead <= 0 && p.invuln <= 0) {
        const hit = this.bullets.some((b) => Math.hypot(b.x - p.x, b.y - p.y) < b.r + C.hitRadius) ||
          this.enemies.some((e) => !e.dead && e.t > 0 && this.inBox(p, e, -6));
        if (hit) this.die();
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
      for (const s of this.shots) {
        s.t += dt;
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
            const na = cur + Math.max(-9 * dt, Math.min(9 * dt, da));
            s.vx = Math.cos(na) * sp;
            s.vy = Math.sin(na) * sp;
          }
        }
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        for (const e of this.enemies) {
          if (e.dead || e.delay > 0 || s.hit.includes(e) || e.x > C.width + 20) continue;
          const b = this.enemyBox(e);
          if (s.x + s.w / 2 > b.x && s.x - s.w / 2 < b.x + b.w && s.y + s.h / 2 > b.y && s.y - s.h / 2 < b.y + b.h) {
            this.damage(e, s.dmg);
            s.hit.push(e);
            if (!s.pierce) { s.gone = true; this.effects.push({ type: "spark", x: s.x, y: s.y, t: 0, life: 0.15 }); break; }
          }
        }
      }
      this.shots = this.shots.filter((s) => !s.gone && s.x < C.width + 60 && s.x > -60 && s.y > -60 && s.y < C.height + 60);
    }

    damage(e, dmg) {
      if (e.dead) return;
      e.hp -= dmg;
      e.flash = 0.06;
      if (e.hp > 0) return;
      const def = RD.ENEMIES[e.type];
      e.dead = true;
      this.kills++;
      this.addScore(def.score * this.loop);
      this.effects.push({ type: "boom", x: e.x, y: e.y, t: 0, life: def.boss ? 2 : def.midboss ? 1 : 0.5, big: def.boss || def.midboss });
      const drop = (type, n = 1) => {
        for (let i = 0; i < n; i++) this.items.push({ type, x: e.x + rand(-20, 20), y: e.y + rand(-20, 20), vx: rand(-40, 80), vy: rand(-220, -80) });
      };
      if (e.type === "bat") drop("coin");
      if (e.type === "slime") drop("coin", 2);
      if (e.type === "mushroom") drop("gem", 2);
      if (e.type === "wisp") { drop(Math.random() < 0.3 ? "bomb" : "power"); drop("gem", 2); }
      if (def.midboss) { drop("power"); drop("bomb"); drop("star", 4); this.shake = 0.5; }
      if (def.boss) {
        drop("star", 12);
        drop("life");
        this.shake = 1;
        this.bullets = [];
        this.banner = { text: "STAGE CLEAR", sub: `${this.loop}주차 클리어! 더 어려운 ${this.loop + 1}주차로`, color: "#ffd34d", t: 0, life: 4 };
        this.loop++;
        this.stageT = -5;
        this.stageIdx = 0;
      }
      // 편대를 모두 잡으면 P 아이템
      if (e.group) {
        const g = this.groups[e.group];
        if (++g.killed === g.total) drop(this.power < C.maxPower ? "power" : "gem", 1);
      }
    }

    updateEnemies(dt) {
      const bs = this.bulletSpeed;
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
            // 들어오다가 플레이어 쪽으로 방향을 튼다
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

        // 공격 (화면 안에 들어왔을 때만)
        if (e.x > C.width - 20 || e.x < 20) continue;
        e.fireT -= dt;
        if (e.fireT > 0) continue;
        const L = this.loop;
        switch (e.type) {
          case "bat":
            e.fireT = 99; // 한 번만 쏜다
            if (Math.random() < 0.55 + 0.15 * L) this.fire(e.x, e.y, this.aimAt(e), bs);
            break;
          case "slime":
            e.fireT = 2;
            this.fire(e.x, e.y, this.aimAt(e), bs * 0.9, 7, "#9fff6a");
            break;
          case "mushroom":
            e.fireT = 1.8 / (1 + 0.2 * (L - 1));
            this.fan(e, 3, 0.22, bs * 0.85, "#ff7a3d");
            break;
          case "wisp":
            e.fireT = 1.4;
            this.ring(e, 10 + 2 * L, bs * 0.75, e.t, "#7fd0ff");
            break;
          case "golem":
            e.fireT = 1.15;
            e.volley = (e.volley || 0) + 1;
            if (e.volley % 2) this.fan(e, 4 + L, 0.17, bs, "#ffb347");
            else for (let i = 0; i < 6; i++) this.fire(e.x - 30, e.y - 40, -Math.PI / 2 - 0.9 - i * 0.12, bs * 1.1, 8, "#c4945c");
            break;
          case "boss": {
            const k = e.hp / e.maxHp;
            e.phase = k > 0.6 ? 1 : k > 0.3 ? 2 : 3;
            if (e.phase === 1) {
              e.fireT = 1.0;
              this.fan(e, 7, 0.14, bs, "#ff5aa8");
              if ((e.summon = (e.summon || 0) + 1) % 4 === 0) this.batLine(rand(100, 400), 4, "dive");
            } else if (e.phase === 2) {
              // 회전하는 나선 탄막
              e.fireT = 0.1;
              e.spin = (e.spin || 0) + 0.33;
              this.fire(e.x - 20, e.y, e.spin, bs * 0.8, 6, "#c58aff");
              this.fire(e.x - 20, e.y, e.spin + Math.PI, bs * 0.8, 6, "#c58aff");
            } else {
              e.fireT = 0.9;
              e.ringN = (e.ringN || 0) + 1;
              this.ring(e, 18, bs * 0.7, e.ringN * 0.17, "#ff4d5e");
              if (e.ringN % 2) this.fan(e, 3, 0.1, bs * 1.25, "#ffd34d");
            }
            break;
          }
        }
      }
      // 화면 밖으로 빠져나간 적 정리 (편대 보상에서 제외)
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
      for (const it of this.items) {
        it.t = (it.t || 0) + dt;
        const d = Math.hypot(p.x - it.x, p.y - it.y);
        // 가까이 가거나, 화면 오른쪽(자동 회수 구역)에 있으면 끌려온다
        if (p.dead <= 0 && (d < 100 || p.x > C.width - 220)) {
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
      this.addScore(RD.ITEMS[it.type].score * this.loop);
      if (it.type === "power") {
        if (this.power < C.maxPower) { this.power++; this.text(this.power === C.maxPower ? "MAX POWER!" : "POWER UP!", "#ff8a8a"); }
        else this.addScore(5000);
      }
      if (it.type === "bomb") this.bombs = Math.min(C.maxBombs, this.bombs + 1);
      if (it.type === "life") { this.lives++; this.text("1UP!", "#9fffb0"); }
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
