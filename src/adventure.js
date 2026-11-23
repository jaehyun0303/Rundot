// 어드벤처 런: 쿠키런 오븐브레이크 방식 (자동으로 달리며 점프/슬라이드, 체력이 계속 줄고 아이템을 모은다)
// 첫 프로토타입의 러너 코드를 그대로 살려 RD.AdvRun / RD.drawAdv 로 쓴다.
// 게임 진행: 달리기, 점프/슬라이드, 장애물, 아이템, 스킬, 펫
(function () {
  const C = RD.ADV.CONFIG;

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
        const kinds = ["flat", "pillar", "log", "gap"];
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
          this.effects.push({ type: "text", x: p.x, y: p.y - 140, text: RD.ADV.SKILLS[this.charId] + "!", t: 0, life: 1.2 });
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
      const def = RD.ADV.OBSTACLES[o.type];
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
      const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

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
      const def = RD.ADV.ITEMS[it.type];
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

  RD.AdvRun = Run;
})();
// 화면 그리기: 배경, 땅, 장애물, 아이템, 캐릭터, HUD
(function () {
  const C = RD.ADV.CONFIG;
  const FONT = '"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif';

  function text(g, s, x, y, size, color = "#fff", align = "left", stroke = "#1d1622") {
    g.font = `bold ${size}px ${FONT}`;
    g.textAlign = align;
    g.textBaseline = "middle";
    g.lineWidth = Math.max(3, size / 6);
    g.strokeStyle = stroke;
    g.strokeText(s, x, y);
    g.fillStyle = color;
    g.fillText(s, x, y);
  }

  function drawBackground(g, camX) {
    const bg = RD.img("bg_forest");
    const h = C.height, w = (bg.width / bg.height) * h;
    let x = -((camX * 0.15) % w);
    for (; x < C.width; x += w) g.drawImage(bg, Math.floor(x), 0, Math.ceil(w) + 1, h);
  }

  function drawGround(g, run) {
    const tile = RD.img("ground");
    const top = C.groundY - 18;
    const h = 150, w = (tile.width / tile.height) * h;
    const camX = run.camX;
    // 구멍: 땅이 없는 곳은 어두운 낭떠러지로 보이게
    const pit = g.createLinearGradient(0, top + 20, 0, C.height);
    pit.addColorStop(0, "#1a1424");
    pit.addColorStop(1, "#05030a");
    g.fillStyle = pit;
    g.fillRect(0, top + 20, C.width, C.height);
    for (const [a, b] of run.ground) {
      const sx = a - camX, ex = b - camX;
      if (ex < 0 || sx > C.width) continue;
      g.save();
      g.beginPath();
      g.rect(sx, top - 20, ex - sx, C.height);
      g.clip();
      const start = Math.floor(a / w) * w;
      for (let x = start; x < b; x += w) g.drawImage(tile, Math.floor(x - camX), top, Math.ceil(w) + 1, h);
      g.restore();
      // 구멍 가장자리 그림자
      g.fillStyle = "rgba(0,0,0,0.35)";
      g.fillRect(ex - 6, top + 10, 6, C.height);
      g.fillRect(sx, top + 10, 6, C.height);
    }
  }

  function drawObstacles(g, run) {
    for (const o of run.obstacles) {
      const def = RD.ADV.OBSTACLES[o.type];
      const box = run.obstacleBox(o);
      const d = box.draw;
      const x = d.x - run.camX;
      if (x > C.width || x + d.w < -50) continue;
      g.save();
      if (o.flying) {
        g.translate(x + d.w / 2, d.y + d.h / 2 + (o.flyY || 0));
        g.rotate(o.flying.rot);
        g.drawImage(RD.img(def.img), -d.w / 2, -d.h / 2, d.w, d.h);
      } else {
        if (def.kind === "hanging") {
          // 위쪽 밧줄
          g.strokeStyle = "#7a5a32";
          g.lineWidth = 4;
          g.beginPath();
          g.moveTo(x + d.w * 0.25, 0); g.lineTo(x + d.w * 0.25, d.y + 10);
          g.moveTo(x + d.w * 0.82, 0); g.lineTo(x + d.w * 0.82, d.y + 10);
          g.stroke();
        } else {
          g.fillStyle = "rgba(0,0,0,0.3)";
          g.beginPath();
          g.ellipse(x + d.w / 2, C.groundY + 2, d.w * 0.45, 6, 0, 0, Math.PI * 2);
          g.fill();
        }
        g.drawImage(RD.img(def.img), x, d.y, d.w, d.h);
      }
      g.restore();
      if (RD.debug) {
        g.strokeStyle = "red";
        g.strokeRect(box.x - run.camX, box.y, box.w, box.h);
      }
    }
  }

  function drawItems(g, run) {
    for (const it of run.items) {
      const def = RD.ADV.ITEMS[it.type];
      const x = it.x - run.camX;
      if (x < -60 || x > C.width + 60) continue;
      const bob = Math.sin(run.t * 5 + it.x * 0.02) * (def.effect || def.heal ? 5 : 2);
      const s = def.size;
      if (def.effect || def.heal || it.type === "bigcoin") {
        g.fillStyle = "rgba(255,240,180,0.25)";
        g.beginPath();
        g.arc(x, it.y + bob, s * 0.75, 0, Math.PI * 2);
        g.fill();
      }
      g.drawImage(RD.img(def.img), x - s / 2, it.y - s / 2 + bob, s, s);
    }
  }

  function drawPet(g, run) {
    const pet = run.pet;
    const f = Math.floor(pet.t * 8) % 4;
    const img = RD.img("pet_" + f);
    const w = 56, h = (img.height / img.width) * w;
    g.drawImage(img, pet.x - run.camX - w / 2, pet.y - h / 2, w, h);
  }

  function drawPlayer(g, run) {
    const p = run.player;
    let pose = "run", frame = Math.floor(p.animT * 10) % 4;
    if (p.hurtTimer > 0) pose = "hurt";
    else if (p.sliding) pose = "slide";
    else if (!p.onGround) pose = "jump";
    const owlFly = run.charId === "owl" && run.skill.active > 0 && !p.onGround;
    if (owlFly) frame = Math.floor(run.t * 20) % 4;

    if (p.invuln > 0 && !run.over && Math.floor(run.t * 20) % 2 === 0) return;

    const spr = RD.getCharacterFrame(run.charId, pose, pose === "run" || owlFly ? frame : 0);
    const s = C.spriteScale * p.scale;
    const x = p.x - run.camX, size = RD.SPRITE_SIZE * s;
    const dx = Math.round(x - size / 2), dy = Math.round(p.y - (RD.SPRITE_FEET + 1) * s);

    // 그림자
    if (run.groundAt(p.x)) {
      g.fillStyle = "rgba(0,0,0,0.3)";
      g.beginPath();
      g.ellipse(x, C.groundY + 2, 22 * p.scale, 5, 0, 0, Math.PI * 2);
      g.fill();
    }
    // 스킬/부스트 효과
    const dash = run.boost > 0 || (run.charId === "fox" && run.skill.active > 0);
    if (dash) {
      g.globalAlpha = 0.3;
      g.drawImage(spr, dx - 30, dy, size, size);
      g.globalAlpha = 0.15;
      g.drawImage(spr, dx - 60, dy, size, size);
      g.globalAlpha = 1;
    }
    if (run.charId === "cat" && run.skill.active > 0 || run.magnet > 0) {
      g.strokeStyle = "rgba(197,138,255,0.6)";
      g.lineWidth = 3;
      g.beginPath();
      g.arc(x, p.y - 34, 50 + Math.sin(run.t * 8) * 6, 0, Math.PI * 2);
      g.stroke();
    }
    g.drawImage(spr, dx, dy, size, size);
    if (RD.debug) {
      const hb = run.hitbox();
      g.strokeStyle = "lime";
      g.strokeRect(hb.x - run.camX, hb.y, hb.w, hb.h);
    }
  }

  function drawEffects(g, run) {
    for (const e of run.effects) {
      const k = 1 - e.t / e.life;
      if (e.type === "dust") {
        g.globalAlpha = k;
        g.fillStyle = e.color;
        g.fillRect(e.x - run.camX - 3, e.y - 3, 6, 6);
        g.globalAlpha = 1;
      } else if (e.type === "spark") {
        g.strokeStyle = `rgba(255,250,200,${k})`;
        g.lineWidth = 2;
        g.beginPath();
        g.arc(e.x - run.camX, e.y, 10 + (1 - k) * 20, 0, Math.PI * 2);
        g.stroke();
      } else if (e.type === "text") {
        g.globalAlpha = Math.min(1, k * 2);
        text(g, e.text, e.x - run.camX, e.y, 28, e.color || "#ffe66b", "center");
        g.globalAlpha = 1;
      } else if (e.type === "flash") {
        g.fillStyle = `rgba(255,60,60,${0.35 * k})`;
        g.fillRect(0, 0, C.width, C.height);
      }
    }
  }

  function drawHud(g, run) {
    // 체력바
    const hpw = 360;
    g.fillStyle = "rgba(20,12,30,0.75)";
    g.fillRect(56, 22, hpw + 8, 28);
    const k = Math.max(0, run.hp) / C.maxHp;
    g.fillStyle = k < 0.3 ? "#ff4d5e" : "#ff8a3d";
    g.fillRect(60, 26, hpw * k, 20);
    g.fillStyle = "rgba(255,255,255,0.3)";
    g.fillRect(60, 26, hpw * k, 6);
    // 빨간 도트 하트
    const HEART = ["0110110", "1111111", "1111111", "0111110", "0011100", "0001000"];
    HEART.forEach((row, y) => [...row].forEach((v, x) => {
      if (v === "1") { g.fillStyle = y === 1 && x === 1 ? "#ffd0d8" : "#ff4d6a"; g.fillRect(24 + x * 5, 22 + y * 5, 5, 5); }
    }));

    // 스킬 게이지
    const sk = run.skill.active > 0 ? run.skill.active / C.skillDuration : run.skill.charge / C.skillCharge;
    g.fillStyle = "rgba(20,12,30,0.75)";
    g.fillRect(60, 56, 200, 14);
    g.fillStyle = run.skill.active > 0 ? "#7fe6ff" : "#5b8ff0";
    g.fillRect(62, 58, 196 * sk, 10);
    text(g, RD.ADV.SKILLS[run.charId], 268, 63, 14, run.skill.active > 0 ? "#7fe6ff" : "#cfd8ff");

    // 점수와 코인
    text(g, run.score.toLocaleString(), C.width - 24, 36, 32, "#fff", "right");
    g.drawImage(RD.img("item_coin"), C.width - 130, 62, 24, 24);
    text(g, run.coins.toLocaleString(), C.width - 24, 75, 22, "#ffd34d", "right");
  }

  RD.drawAdv = function (g, run) {
    drawBackground(g, run.camX);
    drawGround(g, run);
    drawItems(g, run);
    drawObstacles(g, run);
    drawPet(g, run);
    drawPlayer(g, run);
    drawEffects(g, run);
    drawHud(g, run);
  };
})();
