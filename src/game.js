// 게임 진행: 달리기, 점프/슬라이드, 장애물, 아이템, 스킬, 펫
(function () {
  const C = RD.CONFIG;
  const lerp = (a, b, k) => a + (b - a) * k;
  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  class Run {
    constructor(charId) {
      this.charId = charId;
      this.t = 0;
      this.speed = C.startSpeed;
      this.hp = C.maxHp;
      this.score = 0;
      this.coins = 0;
      this.over = false;
      this.overTimer = 0;
      this.player = {
        x: 0, y: C.groundY, vy: 0, jumps: 0, onGround: true,
        sliding: false, invuln: 0, hurtTimer: 0, animT: 0, scale: 1,
      };
      this.pet = { x: -60, y: C.groundY - 140, t: 0 };
      this.skill = { charge: 0, active: 0 };
      this.boost = 0;
      this.magnet = 0;
      this.ground = [[-1000, 900]]; // 땅이 있는 구간 [시작, 끝]
      this.obstacles = [];
      this.items = [];
      this.effects = [];
      this.nextX = 900;
      this.chunkCount = 0;
      this.input = { jumpHeld: false, slideHeld: false };
      this.char = RD.CHARACTERS.find((c) => c.id === charId);
      this.monsters = [];
      this.shots = []; // 날아가는 공격 (마법 구슬, 단검, 깃털)
      this.slashes = [];
      this.attackCd = 0;
      this.attackAnim = 0;
      this.kills = 0;
      this.shake = 0;
      this.curSpeed = C.startSpeed;
      this.hordeT = 0;
      this.level = 1;
      this.exp = 0;
      this.expNeed = RD.LEVELS.expBase;
    }

    // 레벨에 따른 현재 공격 능력치
    get attackStats() {
      const a = this.char.attack, L = RD.LEVELS, lv = this.level - 1;
      return {
        dmg: a.dmg * (1 + lv * L.dmgPerLevel),
        cd: Math.max(0.08, a.cd * Math.pow(L.cdPerLevel, lv)),
        count: (a.spread || 1) + Math.floor(lv / L.extraShotEvery),
      };
    }

    get camX() { return this.player.x - C.playerScreenX; }
    get invincible() {
      return this.boost > 0 || this.player.invuln > 0 || (this.skill.active > 0 && ["fox", "bear"].includes(this.charId));
    }

    // ---------- 입력 ----------
    jump() {
      const p = this.player;
      if (this.over) return;
      const maxJumps = this.charId === "rabbit" && this.skill.active > 0 ? 3 : 2;
      if (p.jumps < maxJumps) {
        p.vy = -(p.jumps === 0 ? C.jumpVelocity : C.doubleJumpVelocity);
        p.jumps++;
        p.onGround = false;
        p.sliding = false;
        if (p.jumps > 1) this.puff(p.x, p.y, "#ffffff");
      }
    }

    // 자동 공격: 공격 간격마다 알아서 발사된다
    attack() {
      if (this.over || this.attackCd > 0) return;
      const a = this.char.attack, p = this.player, s = p.scale;
      const st = this.attackStats;
      this.attackCd = st.cd;
      this.attackAnim = 0.15;
      const baseY = a.ground ? C.groundY - 34 : p.y - 42 * s;
      // 가장 가까운 앞쪽 몬스터를 조준한다 (위아래 최대 30도)
      let aim = 0;
      let target = null, bd = 1e9;
      for (const m of this.monsters) {
        const dx = m.x - p.x;
        if (m.dead || dx < 20 || dx > 650) continue;
        if (dx < bd) { bd = dx; target = m; }
      }
      if (target && !a.ground) {
        const ty = target.y - RD.MONSTERS[target.type].h / 2;
        aim = Math.max(-0.55, Math.min(0.55, (ty - baseY) / Math.max(80, bd)));
      }
      for (let i = 0; i < st.count; i++) {
        const off = i - (st.count - 1) / 2; // 가운데를 기준으로 퍼진다
        let vx = a.speed, vy = a.speed * aim, y = baseY;
        if (a.kind === "feather") vy += off * 190; // 부채꼴
        else if (a.ground) { y = baseY; }
        else y = baseY + off * 26; // 위아래로 나란히
        this.shots.push({
          kind: a.kind, x: p.x + 20 - Math.abs(off) * 14, y, vx, vy,
          w: a.w * s, h: a.h * s, dmg: st.dmg, pierce: !!a.pierce, homing: !!a.homing, ground: !!a.ground,
          color: a.color, t: 0, life: a.life, hit: [], delay: a.ground ? i * 0.08 : 0,
        });
      }
      if (a.ground) this.shake = Math.max(this.shake, 0.1);
    }

    gainExp(n) {
      this.exp += n;
      while (this.exp >= this.expNeed) {
        this.exp -= this.expNeed;
        this.level++;
        this.expNeed = Math.round(this.expNeed * RD.LEVELS.expGrowth + 2);
        this.effects.push({ type: "text", x: this.player.x, y: this.player.y - 150, text: "LEVEL UP!", color: "#7fe6ff", size: 34, t: 0, life: 1.2 });
        this.effects.push({ type: "ring", x: this.player.x, y: this.player.y - 40, t: 0, life: 0.5 });
      }
    }

    // ---------- 몬스터 떼 ----------
    updateHorde(dt) {
      const H = RD.HORDE;
      this.hordeT -= dt;
      if (this.t < H.firstAt || this.hordeT > 0) return;
      const k = Math.min(1, this.t / H.rampTime);
      this.hordeT = lerp(H.interval[0], H.interval[1], k) * (0.7 + Math.random() * 0.6);
      const size = Math.max(1, Math.round(lerp(H.packSize[0], H.packSize[1], k) * (0.6 + Math.random() * 0.6)));
      const weights = { slime: 4, mushroom: 3, bat: 3, golem: 0.6 };
      const pool = Object.keys(RD.MONSTERS).filter((t) => this.t >= RD.MONSTERS[t].from);
      const total = pool.reduce((a, t) => a + weights[t], 0);
      const pick = () => {
        let r = Math.random() * total;
        for (const t of pool) if ((r -= weights[t]) < 0) return t;
        return pool[0];
      };
      let x = this.player.x + C.width + 80;
      let golems = 0;
      for (let i = 0; i < size; i++) {
        let type = pick();
        if (type === "golem" && golems++ > 0) type = "slime";
        if (!RD.MONSTERS[type].fly && !this.groundAt(x)) { x += 80; continue; }
        this.spawnMonster(type, x);
        x += 45 + Math.random() * 55;
      }
    }

    // ---------- 몬스터 ----------
    spawnMonster(type, x) {
      const def = RD.MONSTERS[type];
      // 박쥐는 머리 높이 / 점프 높이 / 높은 곳 중 하나로 날아온다
      const y = def.fly ? C.groundY - [58, 58, 130, 200][Math.floor(Math.random() * 4)] : C.groundY;
      const hp = Math.round(def.hp * (1 + this.t * RD.HORDE.hpGrowth));
      this.monsters.push({ type, x, y, baseY: y, vy: 0, hp, maxHp: hp, t: Math.random() * 2, flash: 0, dead: false });
    }

    monsterBox(m) {
      const def = RD.MONSTERS[m.type];
      return { x: m.x - def.w / 2, y: m.y - def.h, w: def.w, h: def.h };
    }

    hitMonster(m, dmg) {
      if (m.dead) return;
      m.hp -= dmg;
      m.flash = 0.1;
      m.x += 10; // 살짝 밀려남
      this.effects.push({ type: "text", x: m.x + (Math.random() - 0.5) * 20, y: m.y - RD.MONSTERS[m.type].h - 6, text: String(Math.round(dmg)), color: "#ffffff", size: 16, t: 0, life: 0.45 });
      if (m.hp > 0) return;
      const def = RD.MONSTERS[m.type];
      m.dead = { vx: 260, vy: -650, rot: 0 };
      this.kills++;
      this.gainExp(def.exp);
      const mult = this.charId === "rabbit" && this.skill.active > 0 ? 2 : 1;
      this.score += def.score * mult;
      this.effects.push({ type: "text", x: m.x, y: m.y - def.h - 20, text: "+" + def.score * mult, color: "#ffe66b", t: 0, life: 0.8 });
      this.puff(m.x, m.y - def.h / 2, "#ffffff");
      // 가끔 하트를 떨어뜨린다
      if (Math.random() < 0.035) this.items.push({ x: m.x + 10, y: Math.min(C.groundY - 60, m.y - 40), type: "heart", taken: false });
      // 코인을 떨어뜨린다
      for (let i = 0; i < def.coins; i++) {
        this.items.push({ x: m.x + 20 + i * 34, y: Math.min(C.groundY - 40, m.y - 30) - (i % 2) * 24, type: def.coins >= 5 && i === 0 ? "bigcoin" : "coin", taken: false });
      }
    }

    updateMonsters(dt) {
      const p = this.player;
      for (const m of this.monsters) {
        m.t += dt;
        m.flash = Math.max(0, m.flash - dt);
        if (m.dead) {
          m.dead.vy += C.gravity * 0.6 * dt;
          m.x += m.dead.vx * dt;
          m.y += m.dead.vy * dt;
          m.dead.rot += dt * 10;
          continue;
        }
        const def = RD.MONSTERS[m.type];
        if (m.x - p.x > C.width + 300) continue; // 화면에 들어오기 전에는 가만히
        m.x -= def.speed * dt;
        if (def.fly) {
          m.y = m.baseY + Math.sin(m.t * 4) * 12;
          continue;
        }
        // 땅 위의 몬스터: 슬라임은 통통 뛰고, 구멍 위에서는 떨어진다
        m.vy += C.gravity * dt;
        m.y += m.vy * dt;
        if (this.groundAt(m.x) && m.y >= C.groundY && m.y - m.vy * dt <= C.groundY + 4) {
          m.y = C.groundY;
          m.vy = 0;
          if (m.type === "slime" && (m.hopT = (m.hopT || 0) + dt) > 0.9) { m.hopT = 0; m.vy = -560; }
        }
      }
      this.monsters = this.monsters.filter((m) => m.y < C.height + 200 && m.x > this.camX - 200);
    }

    updateAttacks(dt) {
      this.attackCd = Math.max(0, this.attackCd - dt);
      this.attackAnim = Math.max(0, this.attackAnim - dt);
      this.attack(); // 자동 공격
      for (const sh of this.shots) {
        if (sh.delay > 0) { sh.delay -= dt; continue; }
        sh.t += dt;
        if (sh.homing) {
          // 가장 가까운 앞쪽 몬스터를 향해 휘어진다
          let best = null, bd = 1e9;
          for (const m of this.monsters) {
            if (m.dead || m.x < sh.x - 40 || m.x - this.player.x > C.width) continue;
            const d = Math.hypot(m.x - sh.x, m.y - 30 - sh.y);
            if (d < bd) { bd = d; best = m; }
          }
          if (best) {
            const sp = Math.hypot(sh.vx, sh.vy);
            const ang = Math.atan2(best.y - RD.MONSTERS[best.type].h / 2 - sh.y, best.x - sh.x);
            const cur = Math.atan2(sh.vy, sh.vx);
            let da = ang - cur;
            while (da > Math.PI) da -= 2 * Math.PI;
            while (da < -Math.PI) da += 2 * Math.PI;
            const na = cur + Math.max(-6 * dt, Math.min(6 * dt, da));
            sh.vx = Math.cos(na) * sp;
            sh.vy = Math.sin(na) * sp;
          }
          sh.x += sh.vx * dt + this.curSpeed * dt;
        } else {
          sh.x += (sh.vx + this.curSpeed) * dt;
        }
        sh.y += sh.vy * dt;
        if (sh.ground && !this.groundAt(sh.x)) { sh.t = sh.life; continue; } // 충격파는 구멍에서 끊긴다
        const box = { x: sh.x - sh.w / 2, y: sh.y - sh.h / 2, w: sh.w, h: sh.h };
        for (const m of this.monsters) {
          if (m.dead || sh.hit.includes(m)) continue;
          if (overlap(box, this.monsterBox(m))) {
            this.hitMonster(m, sh.dmg);
            sh.hit.push(m);
            if (!sh.pierce) { sh.t = sh.life; break; }
          }
        }
      }
      this.shots = this.shots.filter((sh) => sh.t < sh.life);
      this.shake = Math.max(0, this.shake - dt);
    }

    // ---------- 맵 생성 ----------
    groundAt(x) { return this.ground.some(([a, b]) => x >= a && x <= b); }

    addGroundTo(x) {
      const last = this.ground[this.ground.length - 1];
      if (x > last[1]) last[1] = x;
    }

    itemRow(x0, y, n, gap, type = "gem") {
      for (let i = 0; i < n; i++) this.items.push({ x: x0 + i * gap, y, type, taken: false });
    }

    // 점프 궤적을 따라 아이템을 배치 (장애물 위)
    itemArc(xc, width, height, n, type = "gem") {
      for (let i = 0; i < n; i++) {
        const u = i / (n - 1);
        const x = xc - width / 2 + u * width;
        const y = C.groundY - 40 - height * 4 * u * (1 - u);
        this.items.push({ x, y, type, taken: false });
      }
    }

    spawnChunk() {
      const x = this.nextX;
      const n = this.chunkCount++;
      const level = Math.min(1, n / 40); // 0 → 1 로 점점 어려워짐
      const r = Math.random();
      let len;

      const pick = () => {
        const kinds = ["flat", "flat", "pillar", "log", "gap"];
        if (level > 0.3) kinds.push("pillar2", "logpillar", "gap");
        return kinds[Math.floor(Math.random() * kinds.length)];
      };
      const kind = n < 2 ? "flat" : pick();
      const special = n > 3 && r < 0.12;

      switch (kind) {
        case "flat":
          len = 520;
          this.itemRow(x + 40, C.groundY - 40, 10, 48, n % 3 === 2 ? "star" : "gem");
          break;
        case "pillar": {
          len = 520;
          const type = ["stone", "totem", "crystal"][Math.floor(Math.random() * 3)];
          this.obstacles.push({ type, x: x + 260 });
          this.itemRow(x + 30, C.groundY - 40, 3, 48);
          this.itemArc(x + 290, 260, 150, 7, "star");
          break;
        }
        case "pillar2": {
          len = 680;
          this.obstacles.push({ type: "stone", x: x + 220 }, { type: "totem", x: x + 460 });
          this.itemArc(x + 250, 220, 150, 5);
          this.itemArc(x + 490, 220, 150, 5);
          break;
        }
        case "log":
          len = 560;
          this.obstacles.push({ type: "log", x: x + 220 });
          this.itemRow(x + 160, C.groundY - 22, 7, 46, "coin");
          break;
        case "logpillar":
          len = 760;
          this.obstacles.push({ type: "log", x: x + 160 }, { type: "crystal", x: x + 540 });
          this.itemRow(x + 120, C.groundY - 22, 6, 46, "coin");
          this.itemArc(x + 570, 260, 150, 7, "star");
          break;
        case "gap": {
          len = 560;
          const gw = 130 + level * 90 + Math.random() * 40;
          const gx = x + 220;
          this.addGroundTo(gx);
          this.ground.push([gx + gw, x + len]);
          this.itemArc(gx + gw / 2, gw + 200, 170, 8, "gem");
          break;
        }
      }
      if (kind !== "gap") this.addGroundTo(x + len);

      if (special) {
        const type = this.hp < 50 && Math.random() < 0.6 ? "heart" : ["boost", "magnet", "bigcoin", "heart"][Math.floor(Math.random() * 4)];
        this.items.push({ x: x + len - 80, y: C.groundY - 170, type, taken: false });
      }
      this.nextX = x + len;
    }

    // ---------- 갱신 ----------
    update(dt) {
      this.t += dt;
      const p = this.player;

      if (this.over) {
        this.overTimer += dt;
        p.vy += C.gravity * dt;
        p.y = Math.min(p.y + p.vy * dt, C.height + 200);
        if (this.groundAt(p.x) && p.y > C.groundY && p.y < C.groundY + 40) { p.y = C.groundY; p.vy = 0; }
        this.updateEffects(dt);
        this.updateMonsters(dt);
        return;
      }

      // 속도와 체력
      this.speed = Math.min(C.maxSpeed, C.startSpeed + this.t * C.speedGain);
      let speed = this.speed;
      if (this.boost > 0) speed *= 1.5;
      if (this.charId === "fox" && this.skill.active > 0) speed *= 1.6;
      this.hp -= (C.hpDrain + this.t * C.hpDrainGain) * dt;

      // 스킬 (오븐브레이크처럼 게이지가 차면 자동 발동)
      if (this.skill.active > 0) {
        this.skill.active -= dt;
        if (this.skill.active <= 0) this.skill.active = 0;
      } else {
        this.skill.charge += dt;
        if (this.skill.charge >= C.skillCharge) {
          this.skill.charge = 0;
          this.skill.active = C.skillDuration;
          this.effects.push({ type: "text", x: p.x, y: p.y - 140, text: RD.CHARACTERS.find((c) => c.id === this.charId).skill + "!", t: 0, life: 1.2 });
        }
      }
      const giant = this.charId === "bear" && this.skill.active > 0;
      p.scale += ((giant ? 2 : 1) - p.scale) * Math.min(1, dt * 8);
      this.boost = Math.max(0, this.boost - dt);
      this.magnet = Math.max(0, this.magnet - dt);
      p.invuln = Math.max(0, p.invuln - dt);
      p.hurtTimer = Math.max(0, p.hurtTimer - dt);

      // 이동
      p.x += speed * dt;
      p.animT += dt * (speed / 360);
      const flying = this.charId === "owl" && this.skill.active > 0;
      if (flying && this.input.jumpHeld) {
        p.vy = Math.max(p.vy - 4200 * dt, -420);
      }
      p.vy += C.gravity * (flying ? 0.45 : 1) * dt;
      p.y += p.vy * dt;
      if (flying && p.y < 80) { p.y = 80; p.vy = 0; }

      const overGround = this.groundAt(p.x - 10) || this.groundAt(p.x + 10);
      const safeFloor = this.boost > 0 || giant || flying; // 이때는 구멍 위도 걸을 수 있다
      if ((overGround || safeFloor) && p.y >= C.groundY && p.y - p.vy * dt <= C.groundY + 4) {
        p.y = C.groundY;
        p.vy = 0;
        p.jumps = 0;
        p.onGround = true;
      } else {
        p.onGround = false;
      }
      p.sliding = p.onGround && this.input.slideHeld;
      if (p.jumps === 0 && !p.onGround && p.vy > 0) p.jumps = 1; // 땅에서 떨어지면 1단 점프 사용한 것으로

      // 맵 생성과 정리
      while (this.nextX < p.x + C.width * 1.5) this.spawnChunk();
      const cut = this.camX - 300;
      this.obstacles = this.obstacles.filter((o) => o.x > cut || o.flying);
      this.items = this.items.filter((it) => it.x > cut && !it.gone);
      while (this.ground.length > 1 && this.ground[0][1] < cut) this.ground.shift();

      this.curSpeed = speed;
      this.updateHorde(dt);
      this.updateMonsters(dt);
      this.updateAttacks(dt);
      this.collide(dt);
      this.updatePet(dt);
      this.updateEffects(dt);

      if (p.y > C.height + 60 || this.hp <= 0) this.gameOver();
    }

    hitbox() {
      const p = this.player, s = p.scale;
      const w = (p.sliding ? 54 : 36) * s;
      const h = (p.sliding ? 34 : 68) * s;
      return { x: p.x - w / 2, y: p.y - h, w, h };
    }

    obstacleBox(o) {
      const def = RD.OBSTACLES[o.type];
      const img = RD.img(def.img);
      if (def.kind === "hanging") {
        const w = def.w, h = (img.height / img.width) * w;
        const bottom = C.groundY - 50;
        return { x: o.x + 10, y: 0, w: w - 20, h: bottom, draw: { x: o.x, y: bottom - h, w, h } };
      }
      const h = def.h, w = (img.width / img.height) * h;
      return { x: o.x + w * 0.22, y: C.groundY - h * 0.9, w: w * 0.56, h: h * 0.9, draw: { x: o.x, y: C.groundY - h + 4, w, h } };
    }

    collide() {
      const p = this.player;
      const hb = this.hitbox();

      for (const o of this.obstacles) {
        if (o.flying || o.passed) continue;
        const box = this.obstacleBox(o);
        if (!overlap(hb, box)) continue;
        const smash = this.boost > 0 || (this.skill.active > 0 && ["fox", "bear"].includes(this.charId));
        if (smash) {
          o.flying = { vx: 500, vy: -700, rot: 0 };
          this.score += 50;
          this.puff(box.x + box.w / 2, C.groundY - 40, "#ffe08a");
        } else if (p.invuln <= 0) {
          this.hp -= C.hitDamage;
          p.invuln = C.hitInvuln;
          p.hurtTimer = 0.4;
          o.passed = true;
          this.effects.push({ type: "flash", t: 0, life: 0.25 });
        }
      }

      // 몬스터: 위에서 밟으면 쓰러뜨리고, 옆에서 부딪히면 다친다
      for (const m of this.monsters) {
        if (m.dead) continue;
        const box = this.monsterBox(m);
        if (!overlap(hb, box)) continue;
        const smash = this.boost > 0 || (this.skill.active > 0 && ["fox", "bear"].includes(this.charId));
        const prevBottom = p.y - p.vy * (1 / 60);
        if (p.vy > 0 && prevBottom <= box.y + 16) {
          this.hitMonster(m, this.attackStats.dmg * 2);
          p.vy = -620;
          p.jumps = 1;
          this.floatText("밟기!", "#9fffb0");
        } else if (smash) {
          this.hitMonster(m, 99);
        } else if (p.invuln <= 0) {
          this.hp -= RD.HORDE.contactDamage;
          p.invuln = C.hitInvuln;
          p.hurtTimer = 0.4;
          this.effects.push({ type: "flash", t: 0, life: 0.25 });
        }
      }

      // 아이템
      const pull = this.magnet > 0 || (this.charId === "cat" && this.skill.active > 0);
      const cx = p.x, cy = p.y - 34 * p.scale;
      for (const it of this.items) {
        if (it.taken) continue;
        const dx = cx - it.x, dy = cy - it.y;
        const d = Math.hypot(dx, dy);
        // 펫은 가까운 아이템을 살짝 끌어당긴다
        const radius = pull ? 420 : 90;
        if (d < radius && it.x > this.camX) {
          const k = pull ? 14 : 7;
          it.x += dx * Math.min(1, k * (1 / 60));
          it.y += dy * Math.min(1, k * (1 / 60));
        }
        if (d < 40 * p.scale + 10) this.take(it);
      }
    }

    take(it) {
      const def = RD.ITEMS[it.type];
      it.taken = true;
      it.gone = true;
      const mult = this.charId === "rabbit" && this.skill.active > 0 ? 2 : 1;
      this.score += def.score * mult;
      if (def.coins) this.coins += def.coins;
      if (def.heal) { this.hp = Math.min(C.maxHp, this.hp + def.heal); this.floatText("+" + def.heal, "#ff6b8a"); }
      if (def.effect === "boost") { this.boost = 4; this.floatText("부스트!", "#ffd34d"); }
      if (def.effect === "magnet") { this.magnet = 6; this.floatText("자석!", "#c58aff"); }
      this.effects.push({ type: "spark", x: it.x, y: it.y, t: 0, life: 0.3 });
    }

    floatText(text, color) {
      const p = this.player;
      this.effects.push({ type: "text", x: p.x, y: p.y - 120, text, color, t: 0, life: 1 });
    }

    puff(x, y, color) {
      for (let i = 0; i < 6; i++) {
        this.effects.push({ type: "dust", x, y, vx: (Math.random() - 0.5) * 200, vy: -Math.random() * 150, color, t: 0, life: 0.4 });
      }
    }

    updatePet(dt) {
      const p = this.player, pet = this.pet;
      pet.t += dt;
      const tx = p.x - 90, ty = p.y - 120 * p.scale + Math.sin(pet.t * 3) * 10;
      pet.x += (tx - pet.x) * Math.min(1, dt * 6);
      pet.y += (ty - pet.y) * Math.min(1, dt * 4);
    }

    updateEffects(dt) {
      for (const o of this.obstacles) {
        if (!o.flying) continue;
        o.flying.vy += C.gravity * 0.6 * dt;
        o.x += o.flying.vx * dt;
        o.flyY = (o.flyY || 0) + o.flying.vy * dt;
        o.flying.rot += dt * 8;
      }
      for (const e of this.effects) {
        e.t += dt;
        if (e.type === "dust") { e.x += e.vx * dt; e.y += e.vy * dt; }
        if (e.type === "text") e.y -= 40 * dt;
      }
      this.effects = this.effects.filter((e) => e.t < e.life);
    }

    gameOver() {
      if (this.over) return;
      this.over = true;
      this.player.hurtTimer = 99;
      this.player.vy = -500;
      if (this.player.y > C.groundY + 20) this.player.vy = 0;
    }
  }

  RD.Run = Run;
})();
