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

  // ---------- 배경 ----------
  // 지역 이미지(bg, ground)가 있으면 그 이미지를, 없으면 코드로 그린 임시 배경을 쓴다
  const hasImg = (name) => { const im = RD.img(name); return im && im.complete && im.naturalWidth > 0; };
  const layerCache = {};
  function rng(seed) { return () => ((seed = (seed * 16807) % 2147483647) / 2147483647); }

  // 좌우가 이어지는 임시 배경 레이어 (먼 산, 가까운 풍경)
  function stageLayers(st) {
    if (layerCache[st.id]) return layerCache[st.id];
    const W = C.width, H = C.height;
    const mk = () => { const c = document.createElement("canvas"); c.width = W; c.height = H; return c; };
    const far = mk(), mid = mk();
    const f = far.getContext("2d"), m = mid.getContext("2d");
    const r = rng(st.id.length * 999 + 7);
    const both = (ctx, draw) => { draw(ctx, 0); ctx.save(); ctx.translate(-W, 0); draw(ctx, 0); ctx.restore(); ctx.save(); ctx.translate(W, 0); draw(ctx, 0); ctx.restore(); };
    const tri = (ctx, x, y, w, h, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.lineTo(x, y - h); ctx.lineTo(x + w / 2, y); ctx.fill(); };
    const items = [];
    for (let i = 0; i < 9; i++) items.push({ x: (i / 9) * W + r() * 60, w: 160 + r() * 160, h: 120 + r() * 160, k: r() });
    const items2 = [];
    for (let i = 0; i < 14; i++) items2.push({ x: (i / 14) * W + r() * 40, w: 40 + r() * 60, h: 90 + r() * 170, k: r() });
    both(f, (ctx) => items.forEach((it) => {
      if (st.shape === "crystals") { tri(ctx, it.x, 0, it.w * 0.5, -it.h * 0.9, st.far); tri(ctx, it.x + 60, H - 60, it.w * 0.5, it.h * 0.8, st.far); }
      else if (st.shape === "clouds" || st.shape === "candy") { ctx.fillStyle = st.far; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(it.x + k * 40, 330 - it.k * 140, 50 + k * 8, 0, Math.PI * 2); ctx.fill(); } }
      else if (st.shape === "ruins") { tri(ctx, it.x, H - 70, it.w * 1.8, it.h * 0.6, st.far); ctx.fillStyle = "#3a0a0a"; ctx.fillRect(it.x - 3, H - 70 - it.h * 0.6, 6, it.h * 0.25); }
      else {
        tri(ctx, it.x, H - 70, it.w * 1.6, it.h + 40, st.far);
        if (st.shape === "pines") tri(ctx, it.x, H - 70 - (it.h + 40) * 0.72, it.w * 1.6 * 0.28, (it.h + 40) * 0.28, "#f4f8fc");
        if (st.shape === "volcano" && it.k > 0.6) { tri(ctx, it.x, H - 70 - (it.h + 40) * 0.8, 50, 30, "#ff6a1a"); ctx.fillStyle = "rgba(255,106,26,0.5)"; ctx.fillRect(it.x - 4, H - 70 - (it.h + 40) * 0.8, 8, (it.h + 40) * 0.8); }
      }
    }));
    both(m, (ctx) => items2.forEach((it) => {
      const base = H - 60;
      if (st.shape === "trees") { ctx.fillStyle = "#2a1c12"; ctx.fillRect(it.x - 6, base - it.h * 0.5, 12, it.h * 0.5); ctx.fillStyle = st.mid; ctx.beginPath(); ctx.arc(it.x, base - it.h * 0.6, it.w * 0.7, 0, Math.PI * 2); ctx.fill(); }
      else if (st.shape === "pines") { for (let k = 0; k < 3; k++) tri(ctx, it.x, base - k * it.h * 0.25, it.w * (1.1 - k * 0.25), it.h * 0.45, k % 2 ? "#3e5e7a" : st.mid); tri(ctx, it.x, base - it.h * 0.75, it.w * 0.3, it.h * 0.18, "#ffffff"); }
      else if (st.shape === "crystals") { const c = it.k > 0.5 ? "#7f6fe0" : "#4fb8e8"; ctx.globalAlpha = 0.85; tri(ctx, it.x, base, it.w * 0.6, it.h * 0.9, c); tri(ctx, it.x + it.w * 0.3, base, it.w * 0.4, it.h * 0.55, "#b8a8ff"); ctx.globalAlpha = 1; }
      else if (st.shape === "candy") {
        // 막대사탕과 솜사탕 나무
        ctx.fillStyle = "#ffffff"; ctx.fillRect(it.x - 3, base - it.h * 0.8, 6, it.h * 0.8);
        ctx.fillStyle = it.k > 0.5 ? "#ff8ac8" : "#8ad8ff"; ctx.beginPath(); ctx.arc(it.x, base - it.h * 0.8, it.w * 0.45, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(it.x, base - it.h * 0.8, it.w * 0.25, 0, Math.PI * 1.5); ctx.stroke();
      }
      else if (st.shape === "ruins") {
        // 무너진 기둥
        ctx.fillStyle = st.mid; ctx.fillRect(it.x - 14, base - it.h * 0.7, 28, it.h * 0.7);
        ctx.fillStyle = "#2a1010"; ctx.fillRect(it.x - 20, base - it.h * 0.7, 40, 10);
        ctx.fillStyle = "rgba(255,60,20,0.25)"; ctx.fillRect(it.x - 14, base - 8, 28, 8);
      }
      else if (st.shape === "volcano") { tri(ctx, it.x, base, it.w * 1.2, it.h * 0.5, st.mid); ctx.fillStyle = "rgba(255,90,20,0.6)"; ctx.fillRect(it.x - 2, base - 6, 4, 6); }
      else { ctx.fillStyle = "rgba(220,220,255,0.35)"; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(it.x + k * 26, base - it.h * 0.6, 26 + k * 6, 0, Math.PI * 2); ctx.fill(); } }
    }));
    // 땅 타일
    const gt = document.createElement("canvas"); gt.width = 256; gt.height = 100;
    const gg = gt.getContext("2d");
    gg.fillStyle = st.groundCol[1]; gg.fillRect(0, 0, 256, 100);
    gg.fillStyle = st.groundCol[0]; gg.fillRect(0, 0, 256, 16);
    for (let i = 0; i < 140; i++) { gg.fillStyle = i % 3 ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.12)"; gg.fillRect(Math.floor(r() * 64) * 4, 16 + Math.floor(r() * 21) * 4, 4, 4); }
    for (let x = 0; x < 256; x += 8) { gg.fillStyle = st.groundCol[0]; gg.fillRect(x, 16, 8, 4 + Math.floor(r() * 3) * 4); }
    return (layerCache[st.id] = { far, mid, ground: gt });
  }

  // 이미지를 좌우로 뒤집어 번갈아 이어 붙인다 (이음새가 안 보이게)
  function tileMirrored(g, im, offset, y, h) {
    const w = (im.width / im.height) * h;
    const start = Math.floor(offset / w);
    let x = -(offset - start * w);
    for (let i = start; x < C.width; i++, x += w) {
      if (i % 2) {
        g.save(); g.translate(Math.floor(x) + Math.ceil(w), y); g.scale(-1, 1);
        g.drawImage(im, 0, 0, Math.ceil(w) + 1, h); g.restore();
      } else g.drawImage(im, Math.floor(x), y, Math.ceil(w) + 1, h);
    }
  }

  function drawBackground(g, scroll, stage) {
    const st = stage || RD.STAGES[0];
    if (hasImg(st.bg)) {
      tileMirrored(g, RD.img(st.bg), scroll * 0.4, 0, C.height);
    } else {
      const L = stageLayers(st);
      const grad = g.createLinearGradient(0, 0, 0, C.height);
      grad.addColorStop(0, st.sky[0]); grad.addColorStop(1, st.sky[1]);
      g.fillStyle = grad; g.fillRect(0, 0, C.width, C.height);
      const fx = -((scroll * 0.15) % C.width), mx = -((scroll * 0.45) % C.width);
      g.drawImage(L.far, Math.floor(fx), 0); g.drawImage(L.far, Math.floor(fx) + C.width, 0);
      g.drawImage(L.mid, Math.floor(mx), 0); g.drawImage(L.mid, Math.floor(mx) + C.width, 0);
    }
    g.fillStyle = "rgba(8,6,20,0.18)"; // 탄이 잘 보이도록 살짝 어둡게
    g.fillRect(0, 0, C.width, C.height);
    if (hasImg(st.ground)) {
      const tile = RD.img(st.ground);
      // 새 땅 이미지는 위쪽 경계가 이미지 맨 위라 조금 위로 올려 그린다
      const th = st.ground === "ground" ? 100 : 92;
      tileMirrored(g, tile, scroll, C.groundY - (st.ground === "ground" ? 8 : 18), th);
    } else {
      const t = stageLayers(st).ground;
      let gx = -(scroll % 256);
      for (; gx < C.width; gx += 256) g.drawImage(t, Math.floor(gx), C.groundY - 8);
    }
  }
  RD.drawBackground = drawBackground;

  function drawEnemies(g, run) {
    for (const e of run.enemies) {
      if (e.delay > 0) continue;
      const def = RD.ENEMIES[e.type];
      const sc = def.scale;
      const size = RD.MONSTER_SIZE * sc;
      const f = Math.floor(e.t * (def.sprite === "bat" || def.sprite === "batking" ? 10 : 5)) % 2;
      if (def.img && hasImg(def.img[0])) {
        // 이미지 보스: 날개짓은 시간, 마그마 슬라임은 점프 중일 때 두 번째 프레임
        let fi = Math.floor(e.t * (def.fps || (def.style === "crystal" ? 1.5 : 4))) % def.img.length;
        if (def.style === "fire") fi = e.air ? 1 : 0;
        if (e.type === "bomber") fi = Math.hypot(e.x - run.player.x, e.y - run.player.y) < 160 ? 1 : 0; // 가까우면 눈이 빨개진다
        if (e.type === "beetle" && (e.wind || e.dashing)) fi = 3;
        // 보스는 고유 색, 나머지는 지역 색으로
        const im = def.boss ? RD.img(def.img[fi]) : RD.tintImage(def.img[fi], e.variant);
        const h = def.drawH, w = (im.width / im.height) * h;
        const top = def.ground ? e.y + def.h / 2 - h + 6 : e.y - h / 2;
        g.imageSmoothingEnabled = true;
        g.save();
        // flip: 그림이 오른쪽을 보고 있으면 좌우로 뒤집어 플레이어(왼쪽)를 보게 한다
        if (def.flip) { g.translate(Math.round(e.x), 0); g.scale(-1, 1); g.translate(-Math.round(e.x), 0); }
        g.drawImage(im, Math.round(e.x - w / 2), Math.round(top), w, h);
        if (e.flash > 0) { g.globalCompositeOperation = "lighter"; g.globalAlpha = 0.5; g.drawImage(im, Math.round(e.x - w / 2), Math.round(top), w, h); g.globalAlpha = 1; g.globalCompositeOperation = "source-over"; }
        g.restore();
        g.imageSmoothingEnabled = false;
        if (RD.debug) { const b = run.enemyBox(e); g.strokeStyle = "orange"; g.strokeRect(b.x, b.y, b.w, b.h); }
        continue;
      }
      const spr = RD.getMonsterFrame(def.sprite, f, e.flash > 0, e.variant);
      // 특성 표시
      if (e.type === "eye" && e.aiming && e.fireT > 0) {
        // 저격 조준선
        g.strokeStyle = `rgba(255,48,72,${0.3 + 0.5 * (Math.floor(run.t * 12) % 2)})`;
        g.lineWidth = 2;
        g.beginPath(); g.moveTo(e.x, e.y); g.lineTo(e.x + Math.cos(e.aimA) * 1200, e.y + Math.sin(e.aimA) * 1200); g.stroke();
      }
      if (e.type === "fairy") {
        g.strokeStyle = "rgba(127,224,138,0.35)"; g.lineWidth = 2;
        g.beginPath(); g.arc(e.x, e.y, 170, 0, Math.PI * 2); g.stroke();
      }
      if (e.healed) { g.fillStyle = "rgba(127,224,138,0.35)"; g.beginPath(); g.arc(e.x, e.y, def.w * 0.7, 0, Math.PI * 2); g.fill(); }
      if (e.type === "beetle" && e.wind) text(g, "!", e.x, e.y - 34, 24, "#ff4d5e", "center");
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
      } else if (s.kind === "missile") {
        // 보조무기: 유도 미사일
        g.rotate(Math.atan2(s.vy, s.vx));
        P(-22, -2, 10, 4, "rgba(255,160,60,0.7)");
        P(-12, -4, 18, 8, "#d8dde6");
        P(4, -3, 6, 6, "#ff4d5e");
        P(-12, -6, 5, 12, "#8a93a0");
      } else if (s.kind === "orb") {
        // 고양이: 마법 구슬 + 꼬리
        g.rotate(Math.atan2(s.vy, s.vx));
        if (s.small) g.scale(0.6, 0.6);
        P(-30, -4, 20, 8, "rgba(197,138,255,0.3)");
        P(-16, -6, 8, 12, "rgba(197,138,255,0.6)");
        P(-9, -9, 18, 18, s.color);
        P(-5, -5, 8, 8, "#fff");
      } else if (s.kind === "meteor") {
        // 고양이 궁극기: 별똥별
        g.rotate(Math.atan2(s.vy, s.vx));
        P(-50, -4, 40, 8, "rgba(255,211,77,0.35)");
        P(-26, -6, 18, 12, "rgba(255,240,180,0.7)");
        g.rotate(-Math.atan2(s.vy, s.vx) + s.t * 6);
        g.fillStyle = "#ffd34d";
        g.beginPath();
        for (let i = 0; i < 10; i++) {
          const r = i % 2 ? 7 : 16, a = (i * Math.PI) / 5;
          g[i ? "lineTo" : "moveTo"](Math.cos(a) * r, Math.sin(a) * r);
        }
        g.fill();
        P(-4, -4, 8, 8, "#fff");
      } else if (s.kind === "boomerang") {
        // 토끼: 빙글빙글 도는 부메랑 단검
        g.rotate(s.t * 22);
        P(-14, -3, 22, 6, "#e6ecf2");
        P(-14, -1, 22, 2, "#fff");
        P(-3, -14, 6, 22, "#e6ecf2");
        P(-4, -4, 8, 8, "#6b4528");
        g.rotate(-s.t * 22);
        g.strokeStyle = s.back ? "rgba(159,255,176,0.5)" : "rgba(255,255,255,0.35)";
        g.lineWidth = 2;
        g.beginPath(); g.arc(0, 0, 16, 0, Math.PI * 2); g.stroke();
      } else if (s.kind === "tornado") {
        // 부엉이: 회오리 (층층이 흔들리는 띠)
        const hh = s.h / 2, ww = s.w / 2;
        const fade = Math.min(1, (s.life - s.t) * 3);
        g.globalAlpha = 0.85 * fade;
        for (let i = 0; i < 8; i++) {
          const k = i / 7; // 0 = 아래, 1 = 위
          const w = ww * (0.35 + 0.65 * k);
          const off = Math.sin(s.t * 14 + i * 0.9) * ww * 0.35;
          P(-w + off, hh - (i + 1) * (s.h / 8), w * 2, s.h / 8 - 2, i % 2 ? "#bff5d8" : "#e8fff2");
          P(-w + off + w * 0.5, hh - (i + 1) * (s.h / 8), w * 0.5, 3, "#ffffff");
        }
        g.globalAlpha = 0.25 * fade;
        g.fillStyle = s.color;
        g.beginPath(); g.ellipse(0, 0, ww + 8, hh + 6, 0, 0, Math.PI * 2); g.fill();
        g.globalAlpha = 1;
      } else if (s.kind === "lob" || s.kind === "hammer") {
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

  // 적 탄: 보스마다 모양이 다르다
  function drawBullets(g, run) {
    const P = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
    for (const b of run.bullets) {
      const ang = Math.atan2(b.vy, b.vx);
      const shape = b.shape;
      if (!shape) {
        g.fillStyle = b.color;
        g.globalAlpha = 0.35;
        g.beginPath(); g.arc(b.x, b.y, b.r + 4, 0, Math.PI * 2); g.fill();
        g.globalAlpha = 1;
        g.beginPath(); g.arc(b.x, b.y, b.r, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#fff";
        g.beginPath(); g.arc(b.x, b.y, b.r * 0.5, 0, Math.PI * 2); g.fill();
        continue;
      }
      g.save();
      g.translate(b.x, b.y);
      if (b.fake) g.globalAlpha = 0.55 + 0.35 * Math.sin(b.age * 18 + b.x);
      if (shape === "blood") {
        // 피 방울: 진행 방향으로 뾰족한 물방울
        g.rotate(ang);
        g.fillStyle = "rgba(216,32,42,0.35)"; g.beginPath(); g.ellipse(-4, 0, 14, 8, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = b.color; g.beginPath(); g.moveTo(10, 0); g.lineTo(-4, -6); g.arc(-4, 0, 6, -Math.PI / 2, Math.PI / 2, true); g.closePath(); g.fill();
        P(-6, -3, 3, 3, "#ff9aa0");
      } else if (shape === "wave") {
        // 초음파: 진행 방향으로 휜 초승달
        g.rotate(ang);
        g.strokeStyle = b.color; g.lineWidth = 4;
        g.beginPath(); g.arc(-6, 0, 11, -1.1, 1.1); g.stroke();
        g.strokeStyle = "rgba(255,255,255,0.8)"; g.lineWidth = 2;
        g.beginPath(); g.arc(-8, 0, 11, -0.9, 0.9); g.stroke();
      } else if (shape === "minibat") {
        // 작은 박쥐
        const f = Math.floor(b.age * 14) % 2;
        P(-5, -4, 10, 8, "#4b3270"); P(-3, -2, 2, 2, "#ff4d5e"); P(1, -2, 2, 2, "#ff4d5e");
        if (f) { P(-13, -8, 8, 5, "#6a4a9a"); P(5, -8, 8, 5, "#6a4a9a"); } else { P(-13, 2, 8, 5, "#6a4a9a"); P(5, 2, 8, 5, "#6a4a9a"); }
      } else if (shape === "shard") {
        // 수정 조각: 길쭉한 마름모, 멈춰 있을 때는 빛난다
        g.rotate(b.redirect != null && !b.redone ? b.age * 8 : ang);
        if (b.redirect != null && !b.redone) { g.fillStyle = "rgba(159,232,255,0.3)"; g.beginPath(); g.arc(0, 0, 16, 0, Math.PI * 2); g.fill(); }
        g.fillStyle = b.color; g.beginPath(); g.moveTo(14, 0); g.lineTo(0, -6); g.lineTo(-12, 0); g.lineTo(0, 6); g.closePath(); g.fill();
        g.fillStyle = "#ffffff"; g.beginPath(); g.moveTo(10, 0); g.lineTo(0, -3); g.lineTo(-4, 0); g.closePath(); g.fill();
      } else if (shape === "fireball" || shape === "lava") {
        // 불덩이와 용암 덩이: 꼬리를 끈다
        g.rotate(ang);
        const r = b.r;
        g.fillStyle = "rgba(255,90,20,0.35)"; g.beginPath(); g.ellipse(-r * 1.4, 0, r * 2, r * 0.8, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = shape === "lava" ? "#a8300a" : "#ff5a1a"; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
        g.fillStyle = shape === "lava" ? "#ff8a3d" : "#ffd34d"; g.beginPath(); g.arc(r * 0.2, -r * 0.1, r * 0.55, 0, Math.PI * 2); g.fill();
        if (b.fuse != null) { g.fillStyle = Math.floor(b.age * 12) % 2 ? "#ffffff" : "#ff3048"; g.fillRect(-3, -3, 6, 6); }
      } else if (shape === "flake") {
        // 눈꽃: 빙글빙글 도는 육각 별
        g.rotate(b.age * 4);
        g.strokeStyle = b.color; g.lineWidth = 2.5;
        for (let i = 0; i < 3; i++) { g.rotate(Math.PI / 3); g.beginPath(); g.moveTo(-b.r - 3, 0); g.lineTo(b.r + 3, 0); g.stroke(); }
        P(-2, -2, 4, 4, "#ffffff");
      } else if (shape === "icicle") {
        // 고드름: 길고 뾰족
        g.rotate(b.redirect != null && !b.redone ? Math.atan2((b.cy || 0) - b.y, (b.cx || 0) - b.x) : ang);
        g.fillStyle = b.color; g.beginPath(); g.moveTo(18, 0); g.lineTo(-12, -6); g.lineTo(-12, 6); g.closePath(); g.fill();
        g.fillStyle = "#ffffff"; g.fillRect(-10, -2, 20, 2);
      } else if (shape === "bolt") {
        // 번개탄: 지그재그
        g.rotate(ang);
        g.strokeStyle = b.color; g.lineWidth = 4;
        g.beginPath(); g.moveTo(-14, 0); g.lineTo(-6, -5); g.lineTo(0, 4); g.lineTo(8, -3); g.lineTo(14, 0); g.stroke();
        g.strokeStyle = "#ffffff"; g.lineWidth = 1.5; g.stroke();
      } else if (shape === "candy") {
        // 사탕: 멈춰 있다 검게 변하면 덮쳐 온다
        const dark = b.redirect != null && b.age > b.redirect * 0.6;
        g.rotate(b.age * 5);
        g.fillStyle = dark ? "#2a1038" : b.color; g.beginPath(); g.arc(0, 0, b.r, 0, Math.PI * 2); g.fill();
        g.strokeStyle = dark ? "#c58aff" : "#ffffff"; g.lineWidth = 2;
        g.beginPath(); g.arc(0, 0, b.r * 0.55, 0, Math.PI * 1.3); g.stroke();
        g.fillStyle = dark ? "#c58aff" : "#ffffff";
        g.beginPath(); g.moveTo(b.r, 0); g.lineTo(b.r + 6, -4); g.lineTo(b.r + 6, 4); g.fill();
        g.beginPath(); g.moveTo(-b.r, 0); g.lineTo(-b.r - 6, -4); g.lineTo(-b.r - 6, 4); g.fill();
      } else if (shape === "z") {
        text(g, "Z", 0, 0, 20, b.color, "center", "#3a2060");
      } else if (shape === "star") {
        g.rotate(b.age * 3);
        g.fillStyle = b.color; g.beginPath();
        for (let i = 0; i < 10; i++) { const r = i % 2 ? b.r * 0.45 : b.r * 1.3, a = (i * Math.PI) / 5; g[i ? "lineTo" : "moveTo"](Math.cos(a) * r, Math.sin(a) * r); }
        g.fill();
      } else if (shape === "drop") {
        g.rotate(ang);
        g.fillStyle = b.color; g.beginPath(); g.moveTo(11, 0); g.lineTo(-3, -6); g.arc(-3, 0, 6, -Math.PI / 2, Math.PI / 2, true); g.closePath(); g.fill();
        g.fillStyle = "rgba(255,255,255,0.7)"; g.fillRect(-5, -3, 3, 3);
      } else if (shape === "smoke") {
        g.fillStyle = "rgba(60,50,40,0.75)"; g.beginPath(); g.arc(0, 0, b.r, 0, Math.PI * 2); g.fill();
        g.fillStyle = "rgba(120,100,80,0.6)"; g.beginPath(); g.arc(-b.r * 0.3, -b.r * 0.3, b.r * 0.5, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#ff6a1a"; g.fillRect(-2, -2, 4, 4);
      } else {
        g.fillStyle = b.color; g.beginPath(); g.arc(0, 0, b.r, 0, Math.PI * 2); g.fill();
      }
      g.restore();
    }
  }

  function drawItems(g, run) {
    for (const it of run.items) {
      const def = RD.ITEMS[it.type];
      const bob = Math.sin((it.t || 0) * 6) * 2;
      if (def.candy) {
        // 사탕: 줄무늬 동그라미와 포장
        const r = def.size / 2 - 3;
        g.save(); g.translate(it.x, it.y + bob); g.rotate((it.t || 0) * 2);
        g.fillStyle = "#ff9ad8"; g.beginPath(); g.moveTo(r, 0); g.lineTo(r + 7, -6); g.lineTo(r + 7, 6); g.fill();
        g.beginPath(); g.moveTo(-r, 0); g.lineTo(-r - 7, -6); g.lineTo(-r - 7, 6); g.fill();
        g.fillStyle = "#ffffff"; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
        g.strokeStyle = "#ff4d8a"; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, r * 0.6, 0, Math.PI * 1.4); g.stroke();
        g.restore();
        continue;
      }
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
    const petOn = run.lv("pet") > 0;
    const pw = petOn ? 40 + run.lv("pet") * 3 : 32;
    g.globalAlpha = petOn ? 1 : 0.55;
    g.drawImage(petImg, pet.x - pw / 2, pet.y - (petImg.height / petImg.width) * pw / 2, pw, (petImg.height / petImg.width) * pw);
    g.globalAlpha = 1;

    // 레이저
    if (run.sub.laserOn > 0) {
      const half = 8 + 4 * run.lv("laser");
      const k = Math.min(1, run.sub.laserOn / 0.15);
      g.fillStyle = `rgba(127,230,255,${0.35 * k})`;
      g.fillRect(p.x + 20, p.y - half - 6, C.width, (half + 6) * 2);
      g.fillStyle = `rgba(127,230,255,${0.9 * k})`;
      g.fillRect(p.x + 20, p.y - half, C.width, half * 2);
      g.fillStyle = `rgba(255,255,255,${k})`;
      g.fillRect(p.x + 20, p.y - half / 3, C.width, (half / 3) * 2);
    }
    // 수호 구슬
    const ob = run.lv("orbit");
    for (let i = 0; i < ob; i++) {
      const a = run.t * 3 + (i / ob) * Math.PI * 2;
      const ox = p.x + Math.cos(a) * 70, oy = p.y + Math.sin(a) * 70;
      g.fillStyle = "rgba(255,211,77,0.35)";
      g.beginPath(); g.arc(ox, oy, 16, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#ffd34d"; g.fillRect(ox - 8, oy - 8, 16, 16);
      g.fillStyle = "#fff"; g.fillRect(ox - 4, oy - 4, 6, 6);
    }

    if (p.slow > 0) {
      g.fillStyle = "rgba(160,220,255,0.35)";
      g.beginPath(); g.arc(p.x, p.y, 34, 0, Math.PI * 2); g.fill();
    }
    if (p.shielded) {
      g.strokeStyle = `rgba(197,138,255,${0.6 + Math.sin(run.t * 6) * 0.25})`;
      g.lineWidth = 3;
      g.beginPath(); g.arc(p.x, p.y, 40, 0, Math.PI * 2); g.stroke();
      g.fillStyle = "rgba(197,138,255,0.12)";
      g.fill();
    }
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
    // 여우 베기 (부채꼴 궤적)
    for (const sl of run.slashes) {
      const k = sl.t / sl.life;
      const a0 = sl.dir < 0 ? -1.25 : 1.25, a1 = -a0;
      const cur = a0 + (a1 - a0) * Math.min(1, k * 1.4);
      g.save();
      g.globalAlpha = 1 - k * 0.6;
      g.strokeStyle = "rgba(191,228,255,0.55)";
      g.lineWidth = sl.r * 0.35;
      g.beginPath();
      g.arc(p.x, p.y, sl.r * 0.78, Math.min(a0, cur), Math.max(a0, cur));
      g.stroke();
      g.strokeStyle = "#ffffff";
      g.lineWidth = 4;
      g.beginPath();
      g.arc(p.x, p.y, sl.r * 0.95, Math.min(a0, cur), Math.max(a0, cur));
      g.stroke();
      g.restore();
    }
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
        const r = (e.r || (e.big ? 90 : 34)) * (0.3 + k);
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
      } else if (e.type === "pillar") {
        // 곰 대지 강타: 땅에서 솟는 바위 기둥
        const rise = Math.min(1, e.t / 0.12);
        const h = 300 * rise;
        g.globalAlpha = e.t > 0.45 ? 1 - (e.t - 0.45) / 0.25 : 1;
        g.fillStyle = "#6b4a2e";
        g.fillRect(e.x - 28, C.groundY + 10 - h, 56, h);
        g.fillStyle = "#8a6440";
        g.fillRect(e.x - 20, C.groundY + 10 - h, 16, h);
        g.fillStyle = "#c4945c";
        g.fillRect(e.x - 28, C.groundY + 10 - h, 56, 10);
        for (let y = C.groundY - h + 30; y < C.groundY; y += 46) { g.fillStyle = "#4a3020"; g.fillRect(e.x - 8, y, 24, 4); }
        g.fillStyle = "#d8b48a";
        g.fillRect(e.x - 46, C.groundY - 4, 92, 10);
        g.globalAlpha = 1;
      } else if (e.type === "bolt") {
        // 번개: 하늘에서 지그재그로 떨어진다
        g.strokeStyle = `rgba(200,240,255,${1 - k})`;
        g.lineWidth = 5;
        g.beginPath();
        g.moveTo(e.x, 0);
        for (let y = 40; y < e.y; y += 40) g.lineTo(e.x + ((y / 40) % 2 ? 14 : -14), y);
        g.lineTo(e.x, e.y);
        g.stroke();
        g.strokeStyle = `rgba(255,255,255,${1 - k})`;
        g.lineWidth = 2;
        g.stroke();
      } else if (e.type === "flash") {
        g.fillStyle = `rgba(255,40,60,${0.3 * (1 - k)})`;
        g.fillRect(0, 0, C.width, C.height);
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
  // 궁극기 연출 (캐릭터마다 다름)
  function drawUltBack(g, run) {
    const u = run.ult;
    if (!u) return;
    const k = u.t / u.life;
    if (u.kind === "fox") {
      g.fillStyle = `rgba(0,0,10,${0.45 * (1 - k)})`;
      g.fillRect(0, 0, C.width, C.height);
    } else if (u.kind === "bear" && u.t < 0.5) {
      g.fillStyle = `rgba(120,70,20,${0.35 * (1 - u.t / 0.5)})`;
      g.fillRect(0, 0, C.width, C.height);
    } else if (u.kind === "owl" && u.cx) {
      // 거대한 회오리
      const fade = Math.min(1, u.t * 3, (u.life - u.t) * 2);
      g.save();
      g.globalAlpha = 0.8 * fade;
      for (let i = 0; i < 16; i++) {
        const y = u.cy + 230 - i * 30;
        const w = 40 + i * 13;
        const off = Math.sin(u.t * 9 + i * 0.7) * 30;
        g.fillStyle = i % 2 ? "rgba(191,245,216,0.75)" : "rgba(232,255,242,0.8)";
        g.fillRect(u.cx - w + off, y - 12, w * 2, 22);
        g.fillStyle = "#ffffff";
        g.fillRect(u.cx - w + off + w * 1.3, y - 12, w * 0.35, 4);
      }
      g.strokeStyle = "rgba(191,245,216,0.5)";
      g.lineWidth = 3;
      for (let i = 0; i < 5; i++) {
        g.beginPath();
        g.arc(u.cx, u.cy, 120 + i * 50, u.t * 4 + i, u.t * 4 + i + 1.4);
        g.stroke();
      }
      g.restore();
    } else if (u.kind === "cat") {
      g.fillStyle = `rgba(40,10,80,${0.35 * Math.min(1, u.t * 4, (u.life - u.t) * 3)})`;
      g.fillRect(0, 0, C.width, C.height);
    }
  }

  function drawUltFront(g, run) {
    const u = run.ult;
    if (!u) return;
    const p = run.player;
    if (u.kind === "fox") {
      if (u.t < 0.42) {
        // 돌진 궤적
        g.fillStyle = "rgba(191,228,255,0.8)";
        g.fillRect(u.x0, u.y0 - 3, p.x - u.x0, 6);
        g.fillStyle = "#fff";
        g.fillRect(u.x0, u.y0 - 1, p.x - u.x0, 2);
      } else {
        // 베어진 가로줄
        const k = Math.min(1, (u.t - 0.42) / 0.5);
        g.fillStyle = `rgba(255,255,255,${0.9 * (1 - k)})`;
        g.fillRect(0, u.y0 - 80 * (1 - k) - 2, C.width, 160 * (1 - k) + 4);
        g.fillStyle = `rgba(191,228,255,${1 - k})`;
        g.fillRect(0, u.y0 - 3 - k * 40, C.width, 3);
        g.fillRect(0, u.y0 + k * 40, C.width, 3);
      }
    } else if (u.kind === "rabbit" && u.clones) {
      // 그림자 분신
      const spr = RD.getCharacterFrame("rabbit", "jump", 0);
      const s = C.spriteScale, size = RD.SPRITE_SIZE * s;
      const fade = Math.min(1, u.t * 5, (u.life - u.t) * 3);
      for (const [x, y] of u.clones) {
        g.globalAlpha = 0.35 * fade;
        g.fillStyle = "#1d3a24";
        g.beginPath(); g.arc(x, y, 34, 0, Math.PI * 2); g.fill();
        g.globalAlpha = 0.55 * fade;
        g.drawImage(spr, x - 20 * s, y - 24 * s, size, size);
      }
      g.globalAlpha = 1;
    } else if (u.kind === "cat") {
      // 마법진
      const fade = Math.min(1, u.t * 4, (u.life - u.t) * 3);
      g.save();
      g.translate(p.x, p.y);
      g.globalAlpha = fade;
      g.strokeStyle = "#c58aff";
      g.lineWidth = 3;
      g.beginPath(); g.arc(0, 0, 110, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.arc(0, 0, 86, 0, Math.PI * 2); g.stroke();
      g.rotate(u.t * 1.5);
      g.strokeStyle = "#ffd34d";
      g.beginPath();
      for (let i = 0; i <= 5; i++) {
        const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
        g[i ? "lineTo" : "moveTo"](Math.cos(a) * 86, Math.sin(a) * 86);
      }
      g.stroke();
      g.fillStyle = "#ffd34d";
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        g.fillRect(Math.cos(a) * 110 - 4, Math.sin(a) * 110 - 4, 8, 8);
      }
      g.restore();
    }
  }

  function bar(g, x, y, w, h, k, color) {
    g.fillStyle = "#1d1622";
    g.fillRect(x - 2, y - 2, w + 4, h + 4);
    g.fillStyle = "#3a2d48";
    g.fillRect(x, y, w, h);
    g.fillStyle = color;
    g.fillRect(x, y, w * Math.max(0, Math.min(1, k)), h);
    g.fillStyle = "rgba(255,255,255,0.25)";
    g.fillRect(x, y, w * Math.max(0, Math.min(1, k)), Math.ceil(h / 3));
  }

  function drawHud(g, run) {
    const p = run.player;
    text(g, run.score.toLocaleString(), 18, 22, 20, "#fff");
    text(g, "HI " + Math.max(RD.best || 0, run.score).toLocaleString(), C.width / 2, 22, 15, "#ffd34d", "center");
    const D = run.D, M = RD.MODES[run.mode];
    const right = run.mode === "timeattack"
      ? `남은 시간 ${Math.ceil(run.timeLeft)}`
      : `${run.stage.name}` + (run.mode === "bossrush" || run.mode === "endless" ? ` · ${run.loop}라운드` : "");
    text(g, right, C.width - 18, 22, 16, run.mode === "timeattack" && run.timeLeft < 20 ? "#ff4d5e" : "#9fd0ff", "right");
    text(g, `${M.name} · ${D.name} · ${run.stage.effectName}`, C.width - 18, 44, 12, D.color, "right");

    // 체력
    const hpK = Math.max(0, p.hp) / run.maxHp;
    bar(g, 46, 40, 170 + run.lv("hp") * 14, 12, hpK, hpK < 0.3 ? "#ff4d5e" : "#5fdc6a");
    const HEART = ["0110110", "1111111", "1111111", "0111110", "0011100", "0001000"];
    HEART.forEach((row, y) => [...row].forEach((v, x) => {
      if (v === "1") { g.fillStyle = "#ff4d6a"; g.fillRect(18 + x * 3, 38 + y * 3, 3, 3); }
    }));
    text(g, `${Math.max(0, Math.ceil(p.hp))}`, 52 + 170 + run.lv("hp") * 14, 46, 12, "#fff");
    // 경험치와 레벨
    bar(g, 46, 60, 170, 6, run.exp / run.expNeed, "#7fe6ff");
    text(g, "Lv." + run.level, 18, 63, 12, "#7fe6ff");
    // 특별 모드 표시
    if (run.M.special === "dream") {
      text(g, run.rush > 0 ? "슈가 러시!" : "사탕", 14, 100, 11, "#ff9ad8");
      bar(g, 58, 96, 120, 6, run.rush > 0 ? run.rush / 6 : run.sugar / 30, "#ff9ad8");
    }
    if (run.M.special === "judgment") {
      for (let i = 0; i < 7; i++) {
        const done = i < run.tr, now = i === run.tr;
        const x = C.width / 2 - 7 * 15 + i * 30, y = 92;
        g.fillStyle = done ? "#7a6020" : now ? "#ffd34d" : "#3a2d48";
        g.fillRect(x, y - 3, 16, 6); g.beginPath(); g.moveTo(x + 16, y - 7); g.lineTo(x + 24, y - 10); g.lineTo(x + 24, y + 10); g.lineTo(x + 16, y + 7); g.fill();
      }
      text(g, run.tr >= 0 ? RD.TRUMPETS[run.tr].name : "나팔을 불 준비", C.width / 2, 112, 12, "#ffd34d", "center");
    }
    if (p.inverted > 0) text(g, `조작 반전 ${p.inverted.toFixed(1)}`, p.x, p.y - 60, 14, "#c58aff", "center");
    // 패시브 표시
    if (run.charId === "fox") {
      text(g, "베기", 18, 82, 11, "#bfe4ff");
      for (let i = 0; i < RD.FOX_PARRY.max; i++) {
        const f = Math.max(0, Math.min(1, run.parry - i));
        g.fillStyle = "#1d1622"; g.fillRect(46 + i * 22, 76, 20, 10);
        g.fillStyle = f >= 1 ? "#bfe4ff" : "#4a5a6a"; g.fillRect(48 + i * 22, 78, 16 * f, 6);
      }
    }
    if (run.charId === "cat") {
      text(g, "보호막", 14, 82, 11, "#c58aff");
      bar(g, 58, 78, 80, 6, p.shielded ? 1 : run.shield / RD.CAT_SHIELD.every, p.shielded ? "#c58aff" : "#6a4a90");
    }

    // 아래: 잔기, 폭탄, 가진 강화
    const head = RD.getCharacterFrame(run.charId, "jump", 0);
    for (let i = 0; i < Math.min(run.lives, 6); i++) g.drawImage(head, 6 + i * 26, C.height - 80, 34, 34);
    text(g, "궁극기", 12, C.height - 24, 12, "#9fd0ff");
    for (let i = 0; i < run.bombs; i++) {
      g.fillStyle = "#1d1622";
      g.beginPath(); g.arc(70 + i * 18, C.height - 24, 7, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#4aa8ff";
      g.beginPath(); g.arc(70 + i * 18, C.height - 24, 5, 0, Math.PI * 2); g.fill();
    }
    let ux = 190;
    for (const u of RD.UPGRADES) {
      const lv = run.lv(u.id);
      if (!lv) continue;
      const name = u.id === "sig" ? run.char.sig.name : u.name;
      g.font = `bold 11px ${FONT}`;
      const w = g.measureText(name).width + 26;
      if (ux + w > C.width - 140) break;
      g.fillStyle = "rgba(20,12,30,0.7)";
      g.fillRect(ux, C.height - 33, w, 18);
      g.fillStyle = u.color;
      g.fillRect(ux, C.height - 33, 3, 18);
      text(g, `${name} ${lv}`, ux + 7, C.height - 24, 11, "#fff");
      ux += w + 4;
    }

    // 보스 체력바
    const boss = run.boss;
    if (boss) {
      const def = RD.ENEMIES[boss.type];
      const w = 440, x = (C.width - w) / 2;
      bar(g, x, 40, w, 10, boss.hp / boss.maxHp, def.boss ? "#ff4d5e" : "#ffb347");
      text(g, boss.name || (def.boss ? "보스" : "골렘"), x, 62, 12, "#fff");
    }

    // WARNING / STAGE CLEAR 등
    const b = run.banner;
    if (b) {
      const blink = b.text === "WARNING" ? Math.floor(b.t * 6) % 2 === 0 : true;
      if (b.text === "WARNING") {
        g.fillStyle = "rgba(255,40,60,0.25)";
        g.fillRect(0, C.height / 2 - 60, C.width, 120);
      }
      if (blink) text(g, b.text, C.width / 2, C.height / 2 - (b.sub ? 14 : 0), b.small ? 34 : 60, b.color, "center");
      if (b.sub) text(g, b.sub, C.width / 2, C.height / 2 + 32, 20, "#fff", "center");
      if (b.sub2) text(g, b.sub2, C.width / 2, C.height / 2 + 62, 15, "#ffc49a", "center");
    }
    if (run.choosing) drawChoice(g, run);
    if (run.cutscene) drawCutscene(g, run);
    RD.drawSoundButton(g);
  }

  // 소리 켜기/끄기 버튼 (오른쪽 위)
  RD.SOUND_BTN = { x: C.width - 24, y: 72, r: 14 };
  RD.drawSoundButton = function (g) {
    const b = RD.SOUND_BTN, m = RD.audio && RD.audio.muted;
    g.fillStyle = "rgba(20,12,30,0.7)";
    g.beginPath(); g.arc(b.x, b.y, b.r, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#fff";
    g.fillRect(b.x - 8, b.y - 3, 4, 6);
    g.beginPath(); g.moveTo(b.x - 4, b.y - 3); g.lineTo(b.x + 1, b.y - 8); g.lineTo(b.x + 1, b.y + 8); g.lineTo(b.x - 4, b.y + 3); g.fill();
    g.strokeStyle = m ? "#ff4d5e" : "#fff"; g.lineWidth = 2;
    if (m) { g.beginPath(); g.moveTo(b.x + 4, b.y - 5); g.lineTo(b.x + 10, b.y + 5); g.moveTo(b.x + 10, b.y - 5); g.lineTo(b.x + 4, b.y + 5); g.stroke(); }
    else { g.beginPath(); g.arc(b.x + 2, b.y, 6, -0.9, 0.9); g.stroke(); }
  };

  // ---------- 나팔 컷씬 ----------
  // 도트 천사 (오른쪽에서 왼쪽을 보고 나팔을 분다)
  function drawAngel(g, x, y, S, t, blowing, idx) {
    // 그림이 있으면 그림으로 (나팔을 불 때는 두 번째 프레임)
    if (hasImg("cut_angel_0")) {
      const im = RD.img(blowing ? "cut_angel_1" : "cut_angel_0");
      const h = S * 44, w = (im.width / im.height) * h;
      const cx = x + 16 * S + (blowing ? -w * 0.12 : 0);
      g.imageSmoothingEnabled = true;
      g.drawImage(im, cx - w / 2, y - S * 4 + Math.sin(t * 2) * 4, w, h);
      g.imageSmoothingEnabled = false;
      return;
    }
    const P = (px, py, w, h, c) => { g.fillStyle = c; g.fillRect(x + px * S, y + py * S, w * S, h * S); };
    const flap = Math.sin(t * 3) > 0 ? 0 : 2;
    // 날개 (뒤쪽)
    P(4, 6 + flap, 10, 4, "#fff6d8"); P(1, 4 + flap, 6, 4, "#fff6d8"); P(-2, 2 + flap, 5, 3, "#ffe9a0");
    P(18, 6 + flap, 10, 4, "#fff6d8"); P(25, 4 + flap, 6, 4, "#fff6d8"); P(29, 2 + flap, 5, 3, "#ffe9a0");
    P(5, 10 + flap, 8, 3, "#ffe9a0"); P(19, 10 + flap, 8, 3, "#ffe9a0");
    // 후광
    g.strokeStyle = "#ffd34d"; g.lineWidth = S;
    g.beginPath(); g.ellipse(x + 16 * S, y - 1 * S, 5 * S, 1.6 * S, 0, 0, Math.PI * 2); g.stroke();
    // 머리와 얼굴
    P(12, 1, 8, 8, "#ffe0c0"); P(11, 0, 10, 3, "#ffd34d"); P(11, 2, 2, 5, "#ffd34d"); P(19, 2, 2, 5, "#ffd34d");
    P(13, 4, 1, 2, "#3a2a1a"); P(16, 4, 1, 2, "#3a2a1a");
    // 옷
    P(11, 9, 10, 4, "#ffffff"); P(10, 13, 12, 6, "#ffffff"); P(9, 19, 14, 6, "#ffffff"); P(9, 24, 14, 1, "#ffd34d");
    P(15, 9, 2, 16, "#f0e6c8");
    // 나팔: 불 때는 입에 대고 앞(왼쪽)으로 든다
    if (blowing) {
      P(-6, 5, 18, 2, "#ffd34d"); P(-10, 3, 5, 6, "#ffd34d"); P(-11, 2, 2, 8, "#ffe9a0");
      g.strokeStyle = "rgba(255,233,160,0.8)"; g.lineWidth = 3;
      for (let k = 0; k < 3; k++) { const r = ((t * 140 + k * 40) % 120) + 10; g.beginPath(); g.arc(x - 11 * S, y + 6 * S, r, Math.PI * 0.6, Math.PI * 1.4); g.stroke(); }
    } else {
      P(20, 12, 2, 12, "#ffd34d"); P(19, 23, 4, 3, "#ffd34d");
    }
    text(g, ["첫째", "둘째", "셋째", "넷째", "다섯째", "여섯째", "일곱째"][idx] || "", x + 16 * S, y + 30 * S, 14, "#ffd34d", "center");
  }

  // 독수리 (화, 화, 화)
  function drawEagle(g, x, y, S, t) {
    const P = (px, py, w, h, c) => { g.fillStyle = c; g.fillRect(x + px * S, y + py * S, w * S, h * S); };
    const flap = Math.sin(t * 5) > 0 ? -3 : 3;
    P(-14, 4 + flap, 14, 3, "#4a3020"); P(14, 4 + flap, 14, 3, "#4a3020"); P(-18, 6 + flap, 6, 2, "#6b4a2e"); P(26, 6 + flap, 6, 2, "#6b4a2e");
    P(4, 2, 10, 8, "#6b4a2e"); P(5, -3, 6, 6, "#f4f0e8"); P(3, 0, 3, 2, "#ffd34d"); P(6, -1, 1, 1, "#1d1622");
    P(6, 10, 6, 3, "#4a3020"); P(5, 13, 2, 2, "#ffd34d"); P(10, 13, 2, 2, "#ffd34d");
  }

  RD.cutSkip = { x: C.width - 150, y: 18, w: 130, h: 34 };
  function drawCutscene(g, run) {
    const c = run.cutscene, line = c.lines[c.idx];
    g.fillStyle = "rgba(6,2,10,0.72)";
    g.fillRect(0, 0, C.width, C.height);
    // 하늘에서 내려오는 빛
    const glow = g.createLinearGradient(0, 0, 0, C.height);
    glow.addColorStop(0, "rgba(255,233,160,0.35)"); glow.addColorStop(1, "rgba(255,233,160,0)");
    g.fillStyle = glow; g.fillRect(560, 0, 260, C.height);
    const drop = Math.min(1, c.t / 0.7);
    const ay = -260 + (90 + 260) * (1 - Math.pow(1 - drop, 3));
    const blowing = c.blowAt != null && c.t - c.blowAt < 2.5 && line.blow;
    if (line.who === "독수리") drawEagle(g, 640, 120, 5, c.t);
    else if (c.angel >= 0) drawAngel(g, 600, ay, 7, c.t, blowing, c.angel);
    else {
      // 처음 장면: 일곱 천사가 나란히 선다
      for (let k = 0; k < 7; k++) drawAngel(g, 70 + k * 122, ay + (k % 2) * 30 + 40, 3.2, c.t + k, false, -1);
    }
    // 대사창
    const bx = 50, by = 372, bw = C.width - 100, bh = 128;
    g.fillStyle = "rgba(20,10,20,0.92)"; g.fillRect(bx, by, bw, bh);
    g.strokeStyle = "#ffd34d"; g.lineWidth = 3; g.strokeRect(bx, by, bw, bh);
    if (line.who) {
      g.fillStyle = "#ffd34d"; g.fillRect(bx + 16, by - 18, Math.max(110, line.who.length * 18 + 30), 32);
      text(g, line.who, bx + 30, by - 2, 17, "#1d1622", "left", "#ffd34d");
    }
    // 한 글자씩 나오는 대사 (줄바꿈)
    const shown = line.text.slice(0, Math.floor(c.lt * 28));
    g.font = `bold 21px ${FONT}`;
    const words = shown.split(" "), lines = [""];
    for (const w of words) {
      const t = (lines[lines.length - 1] + " " + w).trim();
      if (g.measureText(t).width > bw - 60) lines.push(w); else lines[lines.length - 1] = t;
    }
    lines.slice(0, 3).forEach((l, i) => text(g, l, bx + 30, by + 34 + i * 32, 21, line.who ? "#ffffff" : "#ffe9a0"));
    if (c.lt * 28 >= line.text.length && Math.floor(c.t * 2) % 2) text(g, "▶ 터치 / Space", bx + bw - 20, by + bh - 18, 13, "#ffd34d", "right");
    text(g, `${c.idx + 1} / ${c.lines.length}`, bx + 20, by + bh - 18, 12, "#9a8aa8");
    // 건너뛰기
    const sk = RD.cutSkip;
    g.fillStyle = "rgba(255,255,255,0.12)"; g.fillRect(sk.x, sk.y, sk.w, sk.h);
    text(g, "건너뛰기 ▶▶", sk.x + sk.w / 2, sk.y + sk.h / 2 + 1, 14, "#ffffff", "center");
  }

  // 레벨업 강화 카드 3장
  RD.cardRects = [];
  function drawChoice(g, run) {
    g.fillStyle = "rgba(10,6,20,0.72)";
    g.fillRect(0, 0, C.width, C.height);
    text(g, `LEVEL UP!  Lv.${run.level - run.pendingLevels + 1}`, C.width / 2, 70, 36, "#7fe6ff", "center");
    text(g, run.pendingLevels > 1 ? `강화를 하나 고르세요 (남은 선택 ${run.pendingLevels})` : "강화를 하나 고르세요", C.width / 2, 108, 18, "#fff", "center");
    const opts = run.choosing.options;
    const cw = 250, ch = 270, gap = 26;
    const x0 = (C.width - (cw * opts.length + gap * (opts.length - 1))) / 2;
    const y = 140;
    RD.cardRects = [];
    const pop = Math.min(1, run.choosing.t * 5);
    opts.forEach((u, i) => {
      const x = x0 + i * (cw + gap);
      const yy = y + (1 - pop) * 40;
      const lv = run.lv(u.id);
      const info = run.upgradeInfo(u);
      g.fillStyle = run.choosing.sel === i ? "#ffffff" : "#1d1622";
      g.fillRect(x - 4, yy - 4, cw + 8, ch + 8);
      g.fillStyle = "#2b2140";
      g.fillRect(x, yy, cw, ch);
      g.fillStyle = u.color;
      g.fillRect(x, yy, cw, 34);
      text(g, u.cat, x + 12, yy + 17, 14, "#1d1622", "left", u.color);
      text(g, `${i + 1}`, x + cw - 16, yy + 17, 16, "#1d1622", "right", u.color);
      text(g, info.name, x + cw / 2, yy + 80, 26, "#fff", "center");
      // 단계 표시
      for (let k = 0; k < u.max; k++) {
        const px = x + cw / 2 - (u.max * 22) / 2 + k * 22;
        g.fillStyle = "#1d1622"; g.fillRect(px, yy + 112, 18, 14);
        g.fillStyle = k < lv ? u.color : k === lv ? "#ffffff" : "#3a2d48";
        g.fillRect(px + 2, yy + 114, 14, 10);
      }
      text(g, lv ? `Lv.${lv} → Lv.${lv + 1}` : "NEW!", x + cw / 2, yy + 146, 15, lv ? "#cfd8ff" : "#ffd34d", "center");
      // 설명 (두 줄까지 줄바꿈)
      g.font = `bold 16px ${FONT}`;
      const words = info.desc.split(" ");
      const lines = [""];
      for (const w of words) {
        const tryLine = (lines[lines.length - 1] + " " + w).trim();
        if (g.measureText(tryLine).width > cw - 30) lines.push(w);
        else lines[lines.length - 1] = tryLine;
      }
      lines.slice(0, 3).forEach((l, li) => text(g, l, x + cw / 2, yy + 190 + li * 24, 16, "#fff", "center"));
      RD.cardRects.push({ x, y: yy, w: cw, h: ch });
    });
  }

  // ---------- 지형 효과 그리기 ----------
  function drawHazards(g, run) {
    for (const h of run.hazards) {
      const warn = h.t < h.warn, on = !warn && h.t < h.warn + h.active;
      if (h.type === "lava") {
        if (warn) {
          const blink = Math.floor(h.t * 8) % 2;
          g.fillStyle = `rgba(255,80,20,${0.12 + 0.1 * blink})`;
          g.fillRect(h.x - h.w / 2, 0, h.w, C.groundY);
          g.fillStyle = blink ? "#ff4d1a" : "#ffb347";
          g.fillRect(h.x - h.w / 2, C.groundY - 6, h.w, 8);
          text(g, "!", h.x, C.groundY - 30, 26, "#ffd34d", "center");
        } else if (on) {
          const k = Math.min(1, (h.t - h.warn) / 0.12);
          const top = C.groundY - (C.groundY + 20) * k;
          const cols = h.quake ? ["#4a3020", "#8a6440", "#c4945c"] : ["#c2200a", "#ff6a1a", "#ffd34d"];
          g.fillStyle = cols[0]; g.fillRect(h.x - h.w / 2, top, h.w, C.groundY - top);
          g.fillStyle = cols[1]; g.fillRect(h.x - h.w / 2 + 10, top, h.w - 20, C.groundY - top);
          g.fillStyle = cols[2]; g.fillRect(h.x - 8, top, 16, C.groundY - top);
          for (let i = 0; i < 6; i++) { g.fillStyle = "#ffb347"; g.fillRect(h.x - h.w / 2 + ((i * 23 + h.t * 300) % h.w), top + ((i * 71 + h.t * 500) % (C.groundY - top + 1)), 6, 6); }
        }
      } else if (h.type === "meteor") {
        // 불붙은 큰 산
        if (warn) {
          g.strokeStyle = `rgba(255,80,20,${0.3 + 0.4 * (Math.floor(h.t * 8) % 2)})`;
          g.lineWidth = h.r * 2; g.globalAlpha = 0.25;
          g.beginPath(); g.moveTo(h.sx, h.sy); g.lineTo(h.ex, h.ey); g.stroke(); g.globalAlpha = 1;
          text(g, "!", h.ex, h.ey - 40, 34, "#ffd34d", "center");
        } else if (!h.landed && h.x != null) {
          g.fillStyle = "rgba(255,120,20,0.4)"; g.beginPath(); g.arc(h.x + 40, h.y - 40, h.r * 1.3, 0, Math.PI * 2); g.fill();
          g.fillStyle = "#3a2018"; g.beginPath(); g.moveTo(h.x - h.r, h.y + h.r * 0.6); g.lineTo(h.x - h.r * 0.2, h.y - h.r); g.lineTo(h.x + h.r * 0.3, h.y - h.r * 0.5); g.lineTo(h.x + h.r, h.y + h.r * 0.6); g.closePath(); g.fill();
          g.fillStyle = "#ff6a1a"; g.fillRect(h.x - h.r * 0.5, h.y - h.r * 0.4, h.r, 10); g.fillRect(h.x - 10, h.y - h.r * 0.9, 20, h.r * 0.8);
          g.fillStyle = "#ffd34d"; g.fillRect(h.x - 6, h.y - h.r * 0.95, 12, 14);
        }
      } else if (h.type === "star") {
        if (warn) {
          g.strokeStyle = `rgba(160,230,90,${0.35 + 0.35 * (Math.floor(h.t * 10) % 2)})`; g.lineWidth = 2; g.setLineDash([10, 8]);
          g.beginPath(); g.moveTo(h.x, 0); g.lineTo(h.x, C.groundY); g.stroke(); g.setLineDash([]);
          const y = (h.t / h.warn) * C.groundY;
          g.fillStyle = "#c8ff6a"; g.beginPath(); g.arc(h.x, y, 10, 0, Math.PI * 2); g.fill();
          g.fillStyle = "rgba(200,255,106,0.4)"; g.fillRect(h.x - 4, y - 50, 8, 50);
        }
      } else if (h.type === "beam" || h.type === "line") {
        // 수정 레이저 (휩쓸기) / 연쇄 번개: 예고선 → 굵은 빛
        const x1 = h.type === "beam" ? h.x : h.x1, y1 = h.type === "beam" ? h.y : h.y1;
        const x2 = h.x2, y2 = h.y2;
        if (x2 == null) continue;
        const col = h.type === "beam" ? "159,232,255" : "255,230,107";
        if (warn) {
          g.strokeStyle = `rgba(${col},${0.35 + 0.35 * (Math.floor(h.t * 10) % 2)})`;
          g.lineWidth = 2; g.setLineDash([12, 8]);
          g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); g.setLineDash([]);
        } else if (on) {
          g.strokeStyle = `rgba(${col},0.45)`; g.lineWidth = h.w + 14;
          g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
          g.strokeStyle = `rgb(${col})`; g.lineWidth = h.w;
          g.stroke();
          g.strokeStyle = "#ffffff"; g.lineWidth = h.w / 3; g.stroke();
        }
      } else if (h.type === "zone") {
        // 독 연기 (셋째 나팔)
        const k = warn ? 0.15 + 0.1 * (Math.floor(h.t * 8) % 2) : on ? 0.45 : 0;
        g.fillStyle = h.fire ? `rgba(255,90,20,${k})` : `rgba(120,200,60,${k})`;
        g.fillRect(h.x - h.w / 2, h.top, h.w, C.groundY - h.top);
        if (on) for (let i = 0; i < 8; i++) { g.fillStyle = h.fire ? "rgba(255,200,60,0.7)" : "rgba(170,230,90,0.6)"; g.fillRect(h.x - h.w / 2 + ((i * 37 + h.t * 60) % h.w), C.groundY - ((i * 53 + h.t * 90) % (C.groundY - h.top)), 8, 8); }
      } else if (h.type === "bolt") {
        if (warn) {
          g.strokeStyle = `rgba(255,230,107,${0.35 + 0.35 * (Math.floor(h.t * 10) % 2)})`;
          g.lineWidth = 2;
          g.setLineDash([10, 8]);
          g.beginPath(); g.moveTo(h.x, 0); g.lineTo(h.x, C.groundY); g.stroke();
          g.setLineDash([]);
          g.fillStyle = "rgba(255,230,107,0.12)";
          g.fillRect(h.x - h.w / 2, 0, h.w, C.groundY);
        } else if (on) {
          g.fillStyle = "rgba(255,255,220,0.25)";
          g.fillRect(0, 0, C.width, C.height);
          g.strokeStyle = "#ffe66b"; g.lineWidth = 12;
          g.beginPath(); g.moveTo(h.x, 0);
          for (let y = 30; y < C.groundY; y += 30) g.lineTo(h.x + ((y / 30) % 2 ? 16 : -16), y);
          g.lineTo(h.x, C.groundY); g.stroke();
          g.strokeStyle = "#ffffff"; g.lineWidth = 4; g.stroke();
        }
      }
    }
  }

  // 수정 동굴: 어둠 (캐릭터 주변만 밝다)
  let darkCv = null;
  function drawDarkness(g, run) {
    if (run.terrain !== "dark" && run.terrain !== "t4") return;
    if (!darkCv) { darkCv = document.createElement("canvas"); darkCv.width = C.width; darkCv.height = C.height; }
    const d = darkCv.getContext("2d");
    d.globalCompositeOperation = "source-over";
    d.clearRect(0, 0, C.width, C.height);
    d.fillStyle = "rgba(4,2,12,0.93)";
    d.fillRect(0, 0, C.width, C.height);
    d.globalCompositeOperation = "destination-out";
    const hole = (x, y, r) => {
      const gr = d.createRadialGradient(x, y, r * 0.3, x, y, r);
      gr.addColorStop(0, "rgba(0,0,0,1)"); gr.addColorStop(1, "rgba(0,0,0,0)");
      d.fillStyle = gr; d.beginPath(); d.arc(x, y, r, 0, Math.PI * 2); d.fill();
    };
    const p = run.player;
    if (p.dead <= 0) hole(p.x + 40, p.y, run.blackout > 0 ? 120 : run.terrain === "t4" ? 300 : 250);
    const boss = run.boss; // 보스는 어둠 속에서도 어렴풋이 보인다
    if (boss) hole(boss.x, boss.y, 190);
    for (const e of run.effects) if (e.type === "boom") hole(e.x, e.y, 90 * (1 - e.t / e.life) + 20);
    if (run.ult) hole(C.width / 2, C.height / 2, 700);
    g.drawImage(darkCv, 0, 0);
  }

  // 설원: 눈, 강풍
  function drawWeather(g, run) {
    if (run.terrain === "ice") {
      const w = run.wind;
      const drift = w ? w.dir * 500 : -80;
      g.fillStyle = "rgba(255,255,255,0.85)";
      for (let i = 0; i < 70; i++) {
        const x = ((i * 137 + run.t * drift) % C.width + C.width) % C.width;
        const y = ((i * 53 + run.t * (60 + (i % 5) * 20)) % C.height);
        g.fillRect(x, y, i % 3 ? 3 : 5, i % 3 ? 3 : 5);
      }
      if (w) {
        g.fillStyle = "rgba(255,255,255,0.35)";
        for (let i = 0; i < 18; i++) g.fillRect(((i * 211 + run.t * w.dir * 1200) % C.width + C.width) % C.width, (i * 31) % C.height, 90, 2);
        text(g, w.dir > 0 ? "강풍 →" : "← 강풍", C.width / 2, 120, 24, "#dff4ff", "center");
      }
    }
    if (run.M.special === "judgment" && run.tr >= 0) {
      g.fillStyle = RD.TRUMPETS[run.tr].tint;
      g.fillRect(0, 0, C.width, C.height);
      if (run.tr === 3) {
        // 핏빛 달
        const mx = 820, my = 90;
        const gl = g.createRadialGradient(mx, my, 20, mx, my, 140);
        gl.addColorStop(0, "rgba(255,40,40,0.5)"); gl.addColorStop(1, "rgba(255,40,40,0)");
        g.fillStyle = gl; g.fillRect(mx - 140, my - 140, 280, 280);
        g.fillStyle = "#c01818"; g.beginPath(); g.arc(mx, my, 46, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#8a0e0e"; g.beginPath(); g.arc(mx - 14, my - 10, 10, 0, Math.PI * 2); g.arc(mx + 16, my + 14, 7, 0, Math.PI * 2); g.fill();
        g.fillStyle = "rgba(0,0,0,0.55)"; g.beginPath(); g.arc(mx + 18, my - 6, 44, 0, Math.PI * 2); g.fill(); // 삼분의 일이 어두워진 달
      }
      if (run.dreamT > 0) {
        // 악몽 속: 보랏빛으로 일렁인다
        g.fillStyle = `rgba(90,20,140,${0.28 + 0.08 * Math.sin(run.t * 6)})`;
        g.fillRect(0, 0, C.width, C.height);
        g.strokeStyle = "rgba(200,140,255,0.25)"; g.lineWidth = 2;
        for (let y = 20; y < C.height; y += 40) { g.beginPath(); for (let x = 0; x <= C.width; x += 40) g.lineTo(x, y + Math.sin(x * 0.02 + run.t * 4) * 10); g.stroke(); }
      }
      if (run.tr === 4) { // 무저갱의 연기
        g.fillStyle = "rgba(40,30,20,0.35)";
        for (let i = 0; i < 8; i++) { g.beginPath(); g.arc(((i * 173 - run.t * 40) % 1100 + 1100) % 1100 - 70, 60 + (i * 61) % 200, 90, 0, Math.PI * 2); g.fill(); }
      }
    }
    if (run.rush > 0) {
      g.fillStyle = `rgba(255,154,216,${0.12 + 0.06 * Math.sin(run.t * 10)})`;
      g.fillRect(0, 0, C.width, C.height);
    }
    if (run.terrain === "lava") {
      g.fillStyle = "rgba(255,120,40,0.08)";
      g.fillRect(0, 0, C.width, C.height);
    }
  }

  // 지역 시작 안내
  function drawIntro(g, run) {
    const it = run.intro;
    if (!it || it.t < it.delay) return;
    const k = (it.t - it.delay) / it.life;
    g.globalAlpha = Math.min(1, k * 5, (1 - k) * 4);
    g.fillStyle = "rgba(10,6,20,0.6)";
    g.fillRect(0, 150, C.width, 110);
    text(g, it.name, C.width / 2, 186, 38, "#ffd34d", "center");
    text(g, it.effect, C.width / 2, 230, 17, "#fff", "center");
    g.globalAlpha = 1;
  }

  RD.drawRun = function (g, run) {
    g.save();
    if (run.shake > 0) g.translate((Math.random() - 0.5) * 12 * run.shake * 2, (Math.random() - 0.5) * 10 * run.shake * 2);
    drawBackground(g, run.scroll, run.stage);
    drawUltBack(g, run);
    drawItems(g, run);
    drawEnemies(g, run);
    drawShots(g, run);
    drawPlayer(g, run);
    drawEffects(g, run);
    drawUltFront(g, run);
    drawDarkness(g, run);
    drawHazards(g, run);
    drawBullets(g, run);
    drawWeather(g, run);
    g.restore();
    drawIntro(g, run);
    drawHud(g, run);
  };
})();
