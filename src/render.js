// 화면 그리기: 배경, 적, 탄, 아이템, 플레이어, 폭탄 연출, HUD
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

  // 배경: 숲 그림이 천천히, 땅이 빠르게 흘러간다
  function drawBackground(g, scroll) {
    const bg = RD.img("bg_forest");
    const h = C.height, w = (bg.width / bg.height) * h;
    let x = -((scroll * 0.4) % w);
    for (; x < C.width; x += w) g.drawImage(bg, Math.floor(x), 0, Math.ceil(w) + 1, h);
    g.fillStyle = "rgba(8,6,20,0.18)"; // 탄이 잘 보이도록 살짝 어둡게
    g.fillRect(0, 0, C.width, C.height);
    const tile = RD.img("ground");
    const th = 100, tw = (tile.width / tile.height) * th;
    let gx = -(scroll % tw);
    for (; gx < C.width; gx += tw) g.drawImage(tile, Math.floor(gx), C.groundY - 8, Math.ceil(tw) + 1, th);
  }
  RD.drawBackground = drawBackground;

  function drawEnemies(g, run) {
    for (const e of run.enemies) {
      if (e.delay > 0) continue;
      const def = RD.ENEMIES[e.type];
      const sc = def.scale;
      const size = RD.MONSTER_SIZE * sc;
      const f = Math.floor(e.t * (def.sprite === "bat" || def.sprite === "batking" ? 10 : 5)) % 2;
      const spr = RD.getMonsterFrame(def.sprite, f, e.flash > 0);
      const top = def.ground ? e.y + def.h / 2 - 30 * sc : e.y - 15 * sc;
      g.drawImage(spr, Math.round(e.x - size / 2), Math.round(top), size, size);
      // 단단한 적은 체력바
      if (!def.boss && !def.midboss && e.maxHp >= 10 && e.hp < e.maxHp) {
        g.fillStyle = "#1d1622";
        g.fillRect(e.x - 22, e.y - def.h / 2 - 12, 44, 6);
        g.fillStyle = "#ff4d5e";
        g.fillRect(e.x - 21, e.y - def.h / 2 - 11, 42 * Math.max(0, e.hp / e.maxHp), 4);
      }
      if (RD.debug) {
        const b = run.enemyBox(e);
        g.strokeStyle = "orange";
        g.strokeRect(b.x, b.y, b.w, b.h);
      }
    }
  }

  function drawShots(g, run) {
    const P = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
    for (const s of run.shots) {
      g.save();
      g.translate(Math.round(s.x), Math.round(s.y));
      if (s.kind === "wave") {
        // 여우: 초승달 검기
        const h = s.h / 2;
        g.fillStyle = "rgba(191,228,255,0.3)";
        g.beginPath(); g.ellipse(-10, 0, 18, h, 0, -Math.PI / 2, Math.PI / 2); g.fill();
        g.strokeStyle = s.color; g.lineWidth = 6;
        g.beginPath(); g.ellipse(-2, 0, 12, h - 3, 0, -Math.PI / 2, Math.PI / 2); g.stroke();
        g.strokeStyle = "#fff"; g.lineWidth = 2;
        g.beginPath(); g.ellipse(0, 0, 11, h - 6, 0, -Math.PI / 2, Math.PI / 2); g.stroke();
      } else if (s.kind === "orb") {
        // 고양이: 마법 구슬 + 꼬리
        g.rotate(Math.atan2(s.vy, s.vx));
        P(-30, -4, 20, 8, "rgba(197,138,255,0.3)");
        P(-16, -6, 8, 12, "rgba(197,138,255,0.6)");
        P(-9, -9, 18, 18, s.color);
        P(-5, -5, 8, 8, "#fff");
      } else if (s.kind === "hammer") {
        // 곰: 빙글빙글 도는 쇠망치
        g.rotate(s.t * 18);
        P(-4, -2, 18, 5, "#8a5a35");
        P(-14, -10, 12, 20, "#aab1ba");
        P(-14, -10, 12, 4, "#eef1f5");
        g.rotate(-s.t * 18);
        g.fillStyle = "rgba(255,179,71,0.25)";
        g.beginPath(); g.arc(0, 0, 18, 0, Math.PI * 2); g.fill();
      } else if (s.kind === "dagger") {
        // 토끼: 단검
        P(-12, -2, 18, 4, "#e6ecf2");
        P(-12, -1, 18, 1, "#fff");
        P(6, -4, 3, 8, "#3e2817");
        P(9, -2, 5, 4, "#6b4528");
        P(-26, -1, 12, 2, "rgba(255,255,255,0.35)");
      } else if (s.kind === "feather") {
        // 부엉이: 바람 깃털
        g.rotate(Math.atan2(s.vy, s.vx));
        P(-26, -2, 16, 4, "rgba(191,245,216,0.35)");
        P(-10, -4, 20, 8, s.color);
        P(-10, -1, 20, 2, "#fff");
        P(8, -3, 4, 6, "#fff");
      } else {
        // 펫 탄
        P(-8, -3, 16, 6, s.color);
        P(-4, -1, 10, 2, "#fff");
      }
      g.restore();
    }
  }

  function drawBullets(g, run) {
    for (const b of run.bullets) {
      g.fillStyle = b.color;
      g.globalAlpha = 0.35;
      g.beginPath(); g.arc(b.x, b.y, b.r + 4, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
      g.beginPath(); g.arc(b.x, b.y, b.r, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#fff";
      g.beginPath(); g.arc(b.x, b.y, b.r * 0.5, 0, Math.PI * 2); g.fill();
    }
  }

  function drawItems(g, run) {
    for (const it of run.items) {
      const def = RD.ITEMS[it.type];
      const bob = Math.sin((it.t || 0) * 6) * 2;
      if (def.label) {
        // P / B 아이템
        const s = def.size;
        g.fillStyle = "#1d1622";
        g.fillRect(it.x - s / 2 - 2, it.y - s / 2 - 2 + bob, s + 4, s + 4);
        g.fillStyle = def.color;
        g.fillRect(it.x - s / 2, it.y - s / 2 + bob, s, s);
        g.fillStyle = "rgba(255,255,255,0.35)";
        g.fillRect(it.x - s / 2, it.y - s / 2 + bob, s, s / 3);
        text(g, def.label, it.x, it.y + bob + 1, 20, "#fff", "center");
      } else {
        const s = def.size;
        g.drawImage(RD.img(def.img), it.x - s / 2, it.y - s / 2 + bob, s, s);
      }
    }
  }

  function drawPlayer(g, run) {
    const p = run.player;
    if (p.dead > 0) return;
    const pet = run.pet;
    const petImg = RD.img("pet_" + (Math.floor(pet.t * 10) % 4));
    const pw = run.power >= 2 ? 44 : 34;
    g.globalAlpha = run.power >= 2 ? 1 : 0.6;
    g.drawImage(petImg, pet.x - pw / 2, pet.y - (petImg.height / petImg.width) * pw / 2, pw, (petImg.height / petImg.width) * pw);
    g.globalAlpha = 1;

    if (p.invuln > 0 && Math.floor(run.t * 16) % 2 === 0) return;
    const frame = run.charId === "owl" ? Math.floor(p.animT * 12) % 4 : 0;
    const spr = RD.getCharacterFrame(run.charId, run.charId === "owl" ? "run" : "jump", frame);
    const s = C.spriteScale, size = RD.SPRITE_SIZE * s;
    g.save();
    g.translate(Math.round(p.x), Math.round(p.y));
    g.rotate(p.tilt * 0.18);
    // 비행 꼬리 (속도감)
    g.fillStyle = "rgba(255,255,255,0.25)";
    g.fillRect(-46 - Math.random() * 6, 6, 22, 3);
    g.fillRect(-40 - Math.random() * 6, 14, 14, 2);
    g.drawImage(spr, -20 * s, -24 * s, size, size);
    g.restore();
    // 피격 판정 점 (이 점에만 맞지 않으면 된다)
    g.fillStyle = "#ff4d5e";
    g.beginPath(); g.arc(p.x, p.y, C.hitRadius + 2, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#fff";
    g.beginPath(); g.arc(p.x, p.y, C.hitRadius - 1, 0, Math.PI * 2); g.fill();
  }

  function drawEffects(g, run) {
    for (const e of run.effects) {
      const k = e.t / e.life;
      if (e.type === "boom") {
        // 도트 폭발: 원이 퍼지고 파편이 튄다
        const r = (e.big ? 90 : 34) * (0.3 + k);
        g.globalAlpha = 1 - k;
        g.fillStyle = "#ffd34d";
        g.beginPath(); g.arc(e.x, e.y, r, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#ff8a3d";
        g.beginPath(); g.arc(e.x, e.y, r * 0.7, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#fff";
        g.beginPath(); g.arc(e.x, e.y, r * 0.35 * (1 - k), 0, Math.PI * 2); g.fill();
        g.fillStyle = "#ffd34d";
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + e.x;
          g.fillRect(e.x + Math.cos(a) * r * 1.3 - 3, e.y + Math.sin(a) * r * 1.3 - 3, 6, 6);
        }
        g.globalAlpha = 1;
      } else if (e.type === "spark") {
        g.fillStyle = `rgba(255,255,220,${1 - k})`;
        g.fillRect(e.x - 5, e.y - 5, 10, 10);
      } else if (e.type === "pop") {
        g.strokeStyle = `rgba(255,230,120,${1 - k})`;
        g.lineWidth = 2;
        g.beginPath(); g.arc(e.x, e.y, 4 + k * 12, 0, Math.PI * 2); g.stroke();
      } else if (e.type === "text") {
        g.globalAlpha = Math.min(1, (1 - k) * 2);
        text(g, e.text, e.x, e.y, 22, e.color || "#ffe66b", "center");
        g.globalAlpha = 1;
      }
    }
  }

  // 폭탄 연출: 캐릭터 색으로 화면이 번쩍이고 고리가 퍼진다
  function drawBomb(g, run) {
    if (run.bombT <= 0) return;
    const k = 1 - run.bombT / 1.2;
    const col = run.char.bomb.color;
    g.save();
    g.globalAlpha = 0.35 * (1 - k);
    g.fillStyle = col;
    g.fillRect(0, 0, C.width, C.height);
    g.globalAlpha = 1 - k;
    g.strokeStyle = col;
    for (let i = 0; i < 3; i++) {
      g.lineWidth = 14 - i * 4;
      g.beginPath();
      g.arc(run.player.x, run.player.y, (k * 1.4 + i * 0.15) * C.width, 0, Math.PI * 2);
      g.stroke();
    }
    g.fillStyle = "#fff";
    for (let i = 0; i < 14; i++) {
      const y = ((i * 73 + run.t * 900) % C.height);
      g.fillRect(((i * 197) % C.width) - k * 200, y, 120, 4);
    }
    g.restore();
  }

  function drawHud(g, run) {
    text(g, "SCORE " + run.score.toLocaleString(), 18, 24, 20, "#fff");
    text(g, "HI " + Math.max(RD.best || 0, run.score).toLocaleString(), C.width / 2, 24, 16, "#ffd34d", "center");
    text(g, run.loop + "주차", C.width - 18, 24, 16, "#9fd0ff", "right");

    // 남은 잔기 (캐릭터 얼굴)
    const head = RD.getCharacterFrame(run.charId, "jump", 0);
    for (let i = 0; i < Math.min(run.lives, 6); i++) g.drawImage(head, 8 + i * 28, C.height - 104, 38, 38);
    // 파워
    text(g, "POWER", 18, C.height - 52, 13, "#ff8a8a");
    for (let i = 0; i < C.maxPower; i++) {
      g.fillStyle = "#1d1622";
      g.fillRect(70 + i * 18, C.height - 59, 15, 14);
      g.fillStyle = i < run.power ? "#ff5a5a" : "#3a2d48";
      g.fillRect(72 + i * 18, C.height - 57, 11, 10);
    }
    // 폭탄
    text(g, "BOMB", 18, C.height - 28, 13, "#9fd0ff");
    for (let i = 0; i < run.bombs; i++) {
      g.fillStyle = "#1d1622";
      g.beginPath(); g.arc(78 + i * 20, C.height - 28, 8, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#4aa8ff";
      g.beginPath(); g.arc(78 + i * 20, C.height - 28, 6, 0, Math.PI * 2); g.fill();
    }

    // 보스 체력바
    const boss = run.boss;
    if (boss) {
      const def = RD.ENEMIES[boss.type];
      const w = 520, x = (C.width - w) / 2;
      g.fillStyle = "#1d1622";
      g.fillRect(x - 3, 40, w + 6, 16);
      g.fillStyle = def.boss ? "#ff4d5e" : "#ffb347";
      g.fillRect(x, 43, w * Math.max(0, boss.hp / boss.maxHp), 10);
      text(g, def.boss ? "박쥐 왕" : "돌 골렘", x, 68, 13, "#fff");
    }

    // WARNING / STAGE CLEAR
    const b = run.banner;
    if (b) {
      const blink = b.text === "WARNING" ? Math.floor(b.t * 6) % 2 === 0 : true;
      if (b.text === "WARNING") {
        g.fillStyle = "rgba(255,40,60,0.25)";
        g.fillRect(0, C.height / 2 - 60, C.width, 120);
      }
      if (blink) text(g, b.text, C.width / 2, C.height / 2 - (b.sub ? 14 : 0), b.small ? 34 : 64, b.color, "center");
      if (b.sub) text(g, b.sub, C.width / 2, C.height / 2 + 34, 20, "#fff", "center");
    }
  }

  RD.drawRun = function (g, run) {
    g.save();
    if (run.shake > 0) g.translate((Math.random() - 0.5) * 12 * run.shake * 2, (Math.random() - 0.5) * 10 * run.shake * 2);
    drawBackground(g, run.scroll);
    drawItems(g, run);
    drawEnemies(g, run);
    drawShots(g, run);
    drawPlayer(g, run);
    drawEffects(g, run);
    drawBomb(g, run);
    drawBullets(g, run);
    g.restore();
    drawHud(g, run);
  };
})();
