// 화면 그리기: 배경, 땅, 장애물, 아이템, 캐릭터, HUD
(function () {
  const C = RD.CONFIG;
  const FONT = '"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif';
  RD.FONT = FONT;

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
  RD.text = text;

  function drawBackground(g, camX) {
    const bg = RD.img("bg_forest");
    const h = C.height, w = (bg.width / bg.height) * h;
    let x = -((camX * 0.15) % w);
    for (; x < C.width; x += w) g.drawImage(bg, Math.floor(x), 0, Math.ceil(w) + 1, h);
  }
  RD.drawBackground = drawBackground;

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
      const def = RD.OBSTACLES[o.type];
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
      const def = RD.ITEMS[it.type];
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
    const ch = RD.CHARACTERS.find((c) => c.id === run.charId);
    text(g, ch.skill, 268, 63, 14, run.skill.active > 0 ? "#7fe6ff" : "#cfd8ff");

    // 점수와 코인
    text(g, run.score.toLocaleString(), C.width - 24, 36, 32, "#fff", "right");
    g.drawImage(RD.img("item_coin"), C.width - 130, 62, 24, 24);
    text(g, run.coins.toLocaleString(), C.width - 24, 75, 22, "#ffd34d", "right");
  }

  RD.drawRun = function (g, run) {
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
