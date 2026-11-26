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

  // 레이드 경기장: 위에서 내려다본 바닥 (지역 색)
  const arenaCache = {};
  function drawArena(g, run) {
    const st = run.stage;
    if (!arenaCache[st.id]) {
      const cv = document.createElement("canvas"); cv.width = C.width; cv.height = C.height;
      const a = cv.getContext("2d"), r = rng(st.id.length * 77 + 3);
      // 바닥은 지역의 어두운 색으로 (너무 밝으면 탄이 안 보인다)
      const top = st.mid, deep = st.far;
      a.fillStyle = deep; a.fillRect(0, 0, C.width, C.height);
      const T = 48;
      for (let y = 0; y < C.height; y += T) for (let x = 0; x < C.width; x += T) {
        a.fillStyle = (x / T + y / T) % 2 ? top : deep; a.globalAlpha = 0.35; a.fillRect(x, y, T, T); a.globalAlpha = 1;
        for (let k = 0; k < 3; k++) { a.fillStyle = r() < 0.5 ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.08)"; a.fillRect(x + Math.floor(r() * 11) * 4, y + Math.floor(r() * 11) * 4, 4, 4); }
      }
      // 장식: 바위와 덤불 (원 모양 그림자 포함)
      for (let k = 0; k < 14; k++) {
        const x = r() * C.width, y = r() * C.height, s = 10 + r() * 18;
        a.fillStyle = "rgba(0,0,0,0.25)"; a.beginPath(); a.ellipse(x + 3, y + s * 0.6, s, s * 0.45, 0, 0, Math.PI * 2); a.fill();
        a.fillStyle = st.groundCol[0]; a.globalAlpha = 0.55; a.beginPath(); a.arc(x, y, s, 0, Math.PI * 2); a.fill(); a.globalAlpha = 1;
        a.fillStyle = "rgba(255,255,255,0.15)"; a.beginPath(); a.arc(x - s * 0.3, y - s * 0.3, s * 0.35, 0, Math.PI * 2); a.fill();
      }
      // 테두리 벽
      a.fillStyle = "rgba(10,6,20,0.65)";
      a.fillRect(0, 0, C.width, 14); a.fillRect(0, C.height - 14, C.width, 14); a.fillRect(0, 0, 14, C.height); a.fillRect(C.width - 14, 0, 14, C.height);
      const vg = a.createRadialGradient(C.width / 2, C.height / 2, 200, C.width / 2, C.height / 2, 620);
      vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,0.45)");
      a.fillStyle = vg; a.fillRect(0, 0, C.width, C.height);
      arenaCache[st.id] = cv;
    }
    g.drawImage(arenaCache[st.id], 0, 0);
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

  // 결투 상대: 캐릭터 그림 (적이라는 표시로 빨간 테두리 그림자)
  function drawRival(g, run, e) {
    const A = RD.DUEL.ai[e.ch];
    const fr = e.flash > 0 ? 3 : e.cd > 0.25 ? 2 : Math.floor(e.t * 6) % 2;
    const pic = RD.playerPic(e.ch, fr);
    g.fillStyle = "rgba(0,0,0,0.3)"; g.beginPath(); g.ellipse(e.x, e.y + 34, 22, 7, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "rgba(255,77,94,0.55)"; g.lineWidth = 3; g.beginPath(); g.ellipse(e.x, e.y + 34, 26, 9, 0, 0, Math.PI * 2); g.stroke();
    g.save(); g.translate(Math.round(e.x), Math.round(e.y));
    if (e.face < 0) g.scale(-1, 1);
    if (pic) { const hh = 88, ww = pic.width * hh / pic.height; g.imageSmoothingEnabled = true; g.drawImage(pic, -ww / 2, -hh / 2 - 4, ww, hh); if (e.flash > 0) { g.globalCompositeOperation = "lighter"; g.globalAlpha = 0.5; g.drawImage(pic, -ww / 2, -hh / 2 - 4, ww, hh); } }
    else { const spr = RD.getCharacterFrame(e.ch, "jump", 0), s = C.spriteScale; g.drawImage(spr, -20 * s, -24 * s, RD.SPRITE_SIZE * s, RD.SPRITE_SIZE * s); }
    g.restore(); g.imageSmoothingEnabled = false;
    // 머리 위 이름표와 체력
    const k = Math.max(0, e.hp / e.maxHp);
    text(g, e.name, e.x, e.y - 62, 11, "#ff8a9a", "center");
    g.fillStyle = "#1d1622"; g.fillRect(e.x - 30, e.y - 54, 60, 8);
    g.fillStyle = "#ff4d5e"; g.fillRect(e.x - 29, e.y - 53, 58 * k, 6);
    for (let i = 0; i < 3; i++) { g.fillStyle = "#1d1622"; g.fillRect(e.x - 22 + i * 15, e.y + 44, 13, 5); g.fillStyle = A.color; g.fillRect(e.x - 21 + i * 15, e.y + 45, 11 * Math.max(0, Math.min(1, e.ammo - i)), 3); }
  }

  function drawEnemies(g, run) {
    for (const e of run.enemies) {
      if (e.delay > 0) continue;
      if (e.rival) { if (!e.dead) drawRival(g, run, e); continue; }
      const def = RD.ENEMIES[e.type];
      const sc = def.scale;
      const size = RD.MONSTER_SIZE * sc;
      const f = Math.floor(e.t * (def.sprite === "bat" || def.sprite === "batking" ? 10 : 5)) % 2;
      if (def.img && hasImg(def.img[0])) {
        // 이미지 보스: 날개짓은 시간, 마그마 슬라임은 점프 중일 때 두 번째 프레임
        let fi = Math.floor(e.t * (def.fps || (def.style === "crystal" ? 1.5 : 4))) % def.img.length;
        if (def.style === "fire") fi = e.air ? 1 : 0;
        if (def.style === "angel") {
          fi = e.blowAt != null && e.t - e.blowAt < 1 ? 1 : 0;
          const col = RD.ANGELS[e.no || 0].color;
          const gl = g.createRadialGradient(e.x, e.y, 20, e.x, e.y, 170);
          gl.addColorStop(0, col + "88"); gl.addColorStop(1, col + "00");
          g.fillStyle = gl; g.fillRect(e.x - 170, e.y - 170, 340, 340);
        }
        if (e.type === "bomber") fi = Math.hypot(e.x - run.player.x, e.y - run.player.y) < 160 ? 1 : 0; // 가까우면 눈이 빨개진다
        if (e.type === "beetle" && (e.wind || e.dashing)) fi = 3;
        // 보스는 고유 색, 나머지는 지역 색으로
        const im = def.boss ? RD.img(def.img[fi]) : RD.tintImage(def.img[fi], e.variant);
        const h = def.drawH * (run.raid && def.boss ? 0.72 : 1), w = (im.width / im.height) * h; // 레이드 보스는 조금 작게
        const top = def.ground && !run.raid ? e.y + def.h / 2 - h + 6 : e.y - h / 2;
        if (run.raid) { g.fillStyle = "rgba(0,0,0,0.3)"; g.beginPath(); g.ellipse(e.x, e.y + h * 0.45, w * 0.35, 8, 0, 0, Math.PI * 2); g.fill(); }
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
      const top = def.ground && !run.raid ? e.y + def.h / 2 - 30 * sc : e.y - 15 * sc;
      if (run.raid) { g.fillStyle = "rgba(0,0,0,0.3)"; g.beginPath(); g.ellipse(e.x, e.y + def.h * 0.5, def.w * 0.45, 6, 0, 0, Math.PI * 2); g.fill(); }
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
      if (s.kind === "skull" || s.kind === "ghost") {
        // 망자의 해골 / 망령
        if (s.kind === "ghost") { g.globalAlpha = 0.75; g.fillStyle = "rgba(216,192,255,0.35)"; g.beginPath(); g.arc(0, 0, 18, 0, Math.PI * 2); g.fill(); P(-8, -10, 16, 18, "#e8dcff"); P(-8, 6, 4, 6, "#e8dcff"); P(0, 6, 4, 8, "#e8dcff"); P(-5, -4, 3, 4, "#3a2058"); P(2, -4, 3, 4, "#3a2058"); g.globalAlpha = 1; }
        else { g.fillStyle = "rgba(176,122,255,0.35)"; g.beginPath(); g.arc(0, 0, 14, 0, Math.PI * 2); g.fill(); P(-7, -8, 14, 12, "#f0eadc"); P(-5, 4, 10, 4, "#f0eadc"); P(-5, -4, 4, 4, "#5a2a8a"); P(1, -4, 4, 4, "#5a2a8a"); P(-2, 4, 1, 3, "#5a2a8a"); P(1, 4, 1, 3, "#5a2a8a"); }
      } else if (s.kind === "shuriken") {
        // 그림자 표창
        g.rotate(s.t * 20);
        g.fillStyle = "rgba(154,122,255,0.35)"; g.beginPath(); g.arc(0, 0, 15, 0, Math.PI * 2); g.fill();
        for (let k = 0; k < 4; k++) { g.rotate(Math.PI / 2); P(-3, -13, 6, 13, "#3a2d58"); P(-2, -12, 4, 10, s.color); }
        P(-4, -4, 8, 8, "#e8e0ff");
      } else if (s.kind === "quake") {
        // 대지 가르기: 땅에서 솟는 바위와 흙먼지 기둥
        g.translate(0, -s.y);
        const w = s.w;
        g.fillStyle = "rgba(216,160,96,0.18)"; g.fillRect(-w / 2, 0, w, C.groundY);
        for (let k = 0; k < 5; k++) { const hh = 30 + ((k * 37 + Math.floor(s.t * 30)) % 40); P(-w / 2 + k * (w / 5), C.groundY - hh, w / 5 - 2, hh, k % 2 ? "#8a6a40" : "#b08850"); P(-w / 2 + k * (w / 5), C.groundY - hh, w / 5 - 2, 4, "#e8c890"); }
        for (let k = 0; k < 6; k++) P(-w / 2 + Math.random() * w, C.groundY - 40 - Math.random() * 200, 5, 5, "rgba(232,200,144,0.7)");
      } else if (s.kind === "blackhole") {
        // 작은 블랙홀
        const k = Math.min(1, s.t * 4);
        g.rotate(s.t * 5);
        g.strokeStyle = "rgba(197,138,255,0.5)"; g.lineWidth = 3;
        for (let r = 0; r < 3; r++) { g.beginPath(); g.arc(0, 0, (40 + r * 16) * k, r, r + 4.2); g.stroke(); }
        g.fillStyle = "#c58aff"; g.beginPath(); g.arc(0, 0, 24 * k, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#1a0f2a"; g.beginPath(); g.arc(0, 0, 18 * k, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#fff"; g.fillRect(-2, -2, 4, 4);
      } else if (s.kind === "wave") {
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
      } else if (s.kind === "juggle") {
        // 저글링 공: 줄무늬 공
        g.rotate(s.t * 10);
        g.fillStyle = s.color; g.beginPath(); g.arc(0, 0, 9, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#ffffff"; g.fillRect(-9, -2, 18, 4);
        g.fillStyle = "rgba(255,255,255,0.7)"; g.fillRect(-4, -6, 3, 3);
      } else if (s.kind === "card") {
        // 쇼타임 카드
        g.rotate(s.t * 14);
        P(-7, -10, 14, 20, "#ffffff"); P(-7, -10, 14, 2, "#ff3048"); P(-2, -3, 4, 6, (Math.floor(s.x) % 2) ? "#ff3048" : "#1d1622");
      } else if (s.kind === "leaf") {
        // 판다: 잎사귀 다트
        g.rotate(Math.atan2(s.vy, s.vx) + Math.sin(s.t * 20) * 0.3);
        g.fillStyle = "#5fcf6a"; g.beginPath(); g.ellipse(0, 0, 11, 5, 0, 0, Math.PI * 2); g.fill();
        P(-10, -1, 20, 2, "#c8ffb0");
      } else if (s.kind === "spirit") {
        // 정령 탄: 초록빛 구슬
        const r = s.big ? 10 : 7;
        g.fillStyle = "rgba(159,255,176,0.35)"; g.beginPath(); g.arc(0, 0, r + 6, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#9fffb0"; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
        P(-2, -2, 4, 4, "#ffffff");
      } else if (s.kind === "bullet") {
        // 다람쥐: 개틀링 탄
        g.rotate(Math.atan2(s.vy, s.vx));
        P(-10, -2, 14, 4, "#ffd34d"); P(2, -2, 4, 4, "#ffffff"); P(-18, -1, 8, 2, "rgba(255,211,77,0.4)");
      } else if (s.kind === "shell") {
        // 메카 주포탄
        g.rotate(Math.atan2(s.vy, s.vx));
        P(-30, -4, 20, 8, "rgba(255,179,71,0.4)"); P(-12, -7, 22, 14, "#8a93a0"); P(6, -5, 8, 10, "#ffb347"); P(-12, -7, 22, 3, "#d8dde6");
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
      } else if (s.kind === "lob" && s.arc) {
        g.fillStyle = "rgba(0,0,0,0.3)"; g.beginPath(); g.ellipse(0, 4, 12, 5, 0, 0, Math.PI * 2); g.fill();
        g.translate(0, -(s.z || 0)); g.rotate(s.t * 14);
        P(-4, -2, 18, 5, "#8a5a35"); P(-14, -10, 12, 20, "#aab1ba"); P(-14, -10, 12, 4, "#eef1f5");
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
    // 판다: 함께 다니는 정령
    if (run.summons) for (const m of run.summons) {
      // 판다의 아군 정령 몬스터 (초록빛, 머리 위 새싹과 체력바)
      if (m.dead > 0 || !m.A) continue;
      const A = m.A, f = Math.floor(m.anim * 6) % 2;
      const apic = RD.img(`ally_${A.id}_${m.atkT > 0 ? 2 : Math.floor(m.anim * 3) % 2}`);
      const hasPic = apic && apic.complete && apic.naturalWidth;
      const spr = hasPic ? apic : RD.getMonsterFrame(A.sprite, f, false, "ally");
      const h = hasPic ? A.picH : spr.height * A.scale, w = hasPic ? spr.width * h / spr.height : spr.width * A.scale;
      g.save();
      const necro = run.awak && run.charId === "panda"; // 네크로맨서: 언데드 정령
      g.fillStyle = necro ? "rgba(140,80,220,0.35)" : "rgba(159,255,176,0.22)"; g.beginPath(); g.ellipse(m.x, m.y + h * 0.3, w * 0.35, 6, 0, 0, Math.PI * 2); g.fill();
      if (necro) { g.fillStyle = `rgba(120,60,200,${0.25 + Math.sin(m.anim * 5) * 0.1})`; g.beginPath(); g.arc(m.x, m.y, Math.max(w, h) * 0.55, 0, Math.PI * 2); g.fill(); }
      g.translate(Math.round(m.x), 0);
      if (hasPic ? m.face < 0 : m.face > 0) g.scale(-1, 1); // 그림 정령은 오른쪽, 도트 몬스터는 왼쪽을 본다
      g.imageSmoothingEnabled = !!hasPic;
      g.drawImage(spr, Math.round(-w / 2), Math.round(m.y - h / 2), w, h);
      if (m.flash > 0) { g.globalCompositeOperation = "lighter"; g.globalAlpha = 0.6; g.drawImage(spr, Math.round(-w / 2), Math.round(m.y - h / 2), w, h); }
      g.restore();
      g.imageSmoothingEnabled = false;
      const top = m.y - h * (hasPic ? 0.5 : 0.42);
      if (!hasPic) { g.fillStyle = "#5fcf6a"; g.fillRect(m.x - 2, top - 10, 4, 7); g.fillRect(m.x + 1, top - 12, 6, 3); } // 새싹 표시
      g.fillStyle = "#1d1622"; g.fillRect(m.x - 17, top - 4, 34, 6);
      g.fillStyle = "#9fffb0"; g.fillRect(m.x - 16, top - 3, 32 * Math.max(0, m.hp / m.maxHp), 4);
    }
    // 정령왕
    if (run.ult && run.ult.kind === "panda" && run.ult.kx != null) {
      const u = run.ult, fade = Math.min(1, u.t * 3, (u.life - u.t) * 2);
      g.save(); g.globalAlpha = fade;
      const gl = g.createRadialGradient(u.kx, u.ky, 10, u.kx, u.ky, 120);
      gl.addColorStop(0, "rgba(159,255,176,0.6)"); gl.addColorStop(1, "rgba(159,255,176,0)");
      g.fillStyle = gl; g.fillRect(u.kx - 120, u.ky - 120, 240, 240);
      g.drawImage(RD.getCharacterFrame("panda", "jump", 0), u.kx - 70, u.ky - 80, 140, 140);
      g.strokeStyle = "rgba(200,255,210,0.8)"; g.lineWidth = 3; g.beginPath(); g.arc(u.kx, u.ky, 105, u.t * 2, u.t * 2 + 4.5); g.stroke();
      g.restore();
    }
    // 메카 탑승: 캐릭터를 감싼 거대 메카
    const bigPic = run.ult && run.ult.kind === "mech" && run.mech ? RD.mechPic(run.mech.evo, Math.floor(run.t * 10) % 3 === 0 ? 2 : Math.floor(run.t * 4) % 2) : null;
    if (bigPic) {
      // 거대 메카: 지금 진화 단계 그림을 크게
      const hh = [190, 210, 230][run.mech.evo], ww = bigPic.width * hh / bigPic.height;
      g.imageSmoothingEnabled = true;
      g.drawImage(bigPic, p.x - ww / 2, p.y - hh / 2 - 20, ww, hh);
      g.imageSmoothingEnabled = false;
    } else if (run.ult && run.ult.kind === "mech") {
      // 지금 진화 단계의 색과 장비 그대로 커진다
      const evo = run.mech ? run.mech.evo : 0, [c1, c2, c0] = RD.MECH.colors[evo], K = 1 + 0.12 * evo;
      const P = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(p.x + x * K, p.y + y * K, w * K, h * K); };
      const step = Math.floor(run.t * 8) % 2 ? 2 : 0;
      P(-46, -56, 92, 72, c0); P(-42, -52, 84, 64, c1); P(-42, -52, 84, 8, c2);
      P(-20, -46, 40, 26, "#1d2a3a"); P(-16, -42, 32, 18, "rgba(127,230,255,0.35)"); // 조종석 창
      P(40, -30, 44, 16, c0); P(80, -34, 14, 24, "#8a93a0"); P(84, -28, 8, 12, c2); // 주포
      P(-60, -40, 16, 40, c0); P(-58, -30, 12, 6, "#ffd34d"); // 미사일 포드
      if (evo >= 2) { P(40, -2, 40, 12, c0); P(76, -6, 10, 20, "#8a93a0"); P(-20, -70, 40, 14, c0); P(-6, -80, 12, 12, "#ff4d5e"); }
      P(-36, 16 + step, 22, 26, c0); P(14, 16 - step, 22, 26, c0); P(-40, 40 + step, 30, 8, "#2a3440"); P(10, 40 - step, 30, 8, "#2a3440");
    }
    // 다람쥐 메카 (진화 단계마다 커지고 색이 바뀐다)
    const mechPic = run.mech ? RD.mechPic(run.mech.evo, p.hurt > 0 ? 3 : p.atkT > 0 ? 2 : Math.floor(run.t * 6) % 2) : null;
    if (run.mech && run.mech.alive && !(run.ult && run.ult.kind === "mech") && mechPic) {
      // 그림 메카 (다람쥐가 타고 있는 그림이라 다람쥐는 따로 안 그린다)
      const M = run.mech, hh = [96, 112, 124][M.evo], ww = mechPic.width * hh / mechPic.height;
      const flip = run.raid && run.brawl && Math.cos(run.brawl.aimAng) < 0 ? -1 : 1;
      g.save(); g.translate(Math.round(p.x), Math.round(p.y - 10)); g.scale(flip, 1);
      g.imageSmoothingEnabled = true;
      g.drawImage(mechPic, -ww / 2, -hh / 2, ww, hh);
      if (M.flash > 0 && Math.floor(run.t * 20) % 2 === 0) { g.globalCompositeOperation = "lighter"; g.globalAlpha = 0.6; g.drawImage(mechPic, -ww / 2, -hh / 2, ww, hh); }
      g.restore(); g.imageSmoothingEnabled = false;
      if (M.barrier) { g.strokeStyle = `rgba(127,230,255,${0.55 + Math.sin(run.t * 6) * 0.25})`; g.lineWidth = 3; g.beginPath(); g.arc(p.x, p.y - 10, hh * 0.55, 0, Math.PI * 2); g.stroke(); }
      const hk = M.hp / run.mechMax, ty = p.y - 10 - hh / 2 - 10;
      g.fillStyle = "#1d1622"; g.fillRect(p.x - 26, ty, 52, 7);
      g.fillStyle = hk < 0.3 ? "#ff4d5e" : "#ffb347"; g.fillRect(p.x - 25, ty + 1, 50 * hk, 5);
    } else if (run.mech && run.mech.alive && !(run.ult && run.ult.kind === "mech")) {
      const M = run.mech, k = [0.62, 0.72, 0.84][M.evo], [c1, c2, c0] = RD.MECH.colors[M.evo];
      const fl = M.flash > 0 && Math.floor(run.t * 20) % 2 === 0;
      const flip = run.raid && run.brawl && Math.cos(run.brawl.aimAng) < 0 ? -1 : 1;
      const step = Math.floor(run.t * 8) % 2 ? 2 : 0;
      const P = (x, y, w, h, c) => { g.fillStyle = fl ? "#ffffff" : c; g.fillRect(p.x + (flip > 0 ? x * k : -(x + w) * k), p.y + 6 + y * k, w * k, h * k); };
      P(-36, 16 + step, 22, 26, c0); P(14, 16 - step, 22, 26, c0); P(-40, 40 + step, 30, 8, "#2a3440"); P(10, 40 - step, 30, 8, "#2a3440");
      P(-46, -56, 92, 72, c0); P(-42, -52, 84, 64, c1); P(-42, -52, 84, 8, c2);
      P(40, -30, 44, 16, c0); P(80, -34, 14, 24, "#8a93a0"); P(84, -28, 8, 12, c2);
      if (M.evo >= 1) { P(-60, -40, 16, 40, c0); P(-58, -30, 12, 6, "#ffd34d"); }
      if (M.evo >= 2) { P(40, -2, 40, 12, c0); P(76, -6, 10, 20, "#8a93a0"); P(-20, -70, 40, 14, c0); P(-6, -80, 12, 12, "#ff4d5e"); }
      if (M.barrier) { g.strokeStyle = `rgba(127,230,255,${0.55 + Math.sin(run.t * 6) * 0.25})`; g.lineWidth = 3; g.beginPath(); g.arc(p.x, p.y, 52 * k + 10, 0, Math.PI * 2); g.stroke(); }
      // 메카 체력 (머리 위 작은 막대)
      const hk = M.hp / run.mechMax;
      g.fillStyle = "#1d1622"; g.fillRect(p.x - 26, p.y - 52, 52, 7);
      g.fillStyle = hk < 0.3 ? "#ff4d5e" : "#ffb347"; g.fillRect(p.x - 25, p.y - 51, 50 * hk, 5);
    }
    // 메카 진화 무기: 화염방사기, 플라즈마 레이저
    if (run.mech && run.mech.alive && p.dead <= 0) {
      const M = run.mech, flip = run.raid && run.brawl && Math.cos(run.brawl.aimAng) < 0 ? -1 : 1;
      const ox = p.x + 48 * flip, oy = p.y - 6;
      if (M.flameOn && M.flameAng != null) {
        const F = { range: M.flameRange || RD.MECH.flame.range, arc: RD.MECH.flame.arc };
        g.save(); g.translate(ox, oy); g.rotate(M.flameAng);
        const gr = g.createLinearGradient(0, 0, F.range, 0);
        gr.addColorStop(0, "rgba(255,255,200,0.95)"); gr.addColorStop(0.3, "rgba(255,180,60,0.8)"); gr.addColorStop(0.75, "rgba(255,80,20,0.55)"); gr.addColorStop(1, "rgba(255,40,0,0)");
        g.fillStyle = gr;
        g.beginPath(); g.moveTo(0, -5); g.lineTo(F.range, -Math.tan(F.arc) * F.range); g.lineTo(F.range, Math.tan(F.arc) * F.range); g.lineTo(0, 5); g.closePath(); g.fill();
        for (let i = 0; i < 14; i++) { // 불꽃 알갱이
          const d = ((run.t * 420 + i * 37) % F.range), sp = (Math.sin(i * 12.9 + run.t * 9)) * Math.tan(F.arc) * d * 0.8, r = 4 + d * 0.06;
          g.fillStyle = d < F.range * 0.4 ? "#fff3a0" : d < F.range * 0.7 ? "#ffb347" : "#ff5a2a";
          g.fillRect(d - r / 2, sp - r / 2, r, r);
        }
        g.restore();
      }
      if (M.beam) {
        const L = RD.MECH.laser, bm = M.beam, k = bm.t / L.life;
        for (const an of bm.angs || [bm.ang]) {
        g.save(); g.translate(ox, oy); g.rotate(an);
        if (bm.t < 0.15) { // 충전
          g.strokeStyle = `rgba(127,230,255,${0.5 + Math.random() * 0.5})`; g.lineWidth = 2;
          g.beginPath(); g.moveTo(0, 0); g.lineTo(1400, 0); g.stroke();
          g.fillStyle = "#c8f6ff"; g.beginPath(); g.arc(0, 0, 8 + bm.t * 80, 0, Math.PI * 2); g.fill();
        } else {
          const w = L.width * (1 - Math.max(0, k - 0.75) * 4) * (0.9 + Math.random() * 0.2);
          g.fillStyle = "rgba(90,200,255,0.35)"; g.fillRect(0, -w, 1400, w * 2);
          g.fillStyle = "#7fe6ff"; g.fillRect(0, -w / 2, 1400, w);
          g.fillStyle = "#ffffff"; g.fillRect(0, -w / 5, 1400, w / 2.5);
          g.fillStyle = "#ffffff"; g.beginPath(); g.arc(0, 0, w * 0.8, 0, Math.PI * 2); g.fill();
        }
        g.restore();
        }
      }
      if (M.empFx > 0) {
        g.strokeStyle = `rgba(127,230,255,${M.empFx * 1.6})`; g.lineWidth = 6;
        g.beginPath(); g.arc(p.x, p.y, 320 * (1 - M.empFx * 1.6) + 40, 0, Math.PI * 2); g.stroke();
      }
    }
    // 호위 드론
    if (run.mech && !run.mech.alive && run.tech.has.drone && p.dead <= 0) {
      for (let i = 0; i < 2; i++) {
        const a = run.t * 3 + i * Math.PI, dx = p.x + Math.cos(a) * 46, dy = p.y + Math.sin(a) * 46;
        g.fillStyle = "#1d1622"; g.fillRect(dx - 10, dy - 6, 20, 12);
        g.fillStyle = "#8ab0d0"; g.fillRect(dx - 8, dy - 4, 16, 8);
        g.fillStyle = "#9fffb0"; g.fillRect(dx - 2, dy - 2, 4, 4);
        g.fillStyle = "rgba(255,255,255,0.5)"; g.fillRect(dx - 12 + (Math.floor(run.t * 30) % 2) * 4, dy - 9, 8, 2); g.fillRect(dx + 4 - (Math.floor(run.t * 30) % 2) * 4, dy - 9, 8, 2);
      }
    }
    // 메가 프로그 포효 (퍼져 나가는 초록 고리)
    for (const r of run.roars) {
      const k = r.t / r.life, rad = r.rad || 0;
      g.save();
      g.globalAlpha = 0.8 * (1 - k);
      g.strokeStyle = "#9fff6a"; g.lineWidth = 10 * (1 - k) + 2;
      g.beginPath(); g.arc(p.x, p.y, rad, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = "#ffffff"; g.lineWidth = 2;
      g.beginPath(); g.arc(p.x, p.y, rad * 0.8, 0, Math.PI * 2); g.stroke();
      g.globalAlpha = 0.12 * (1 - k); g.fillStyle = "#9fff6a"; g.beginPath(); g.arc(p.x, p.y, rad, 0, Math.PI * 2); g.fill();
      g.restore();
    }
    if (run.awak && p.dead <= 0) {
      // 각성 오라
      const col = RD.AWAKEN.forms[run.charId].color, a = 0.25 + Math.sin(run.t * 4) * 0.1;
      g.save(); g.globalAlpha = a; g.strokeStyle = col; g.lineWidth = 3;
      for (let i = 0; i < 6; i++) { const an = run.t * 2 + (i / 6) * Math.PI * 2; g.beginPath(); g.arc(p.x, p.y - 6, 46, an, an + 0.5); g.stroke(); }
      g.restore();
    }
    if (run.mega) {
      const gl = g.createRadialGradient(p.x, p.y, 10, p.x, p.y, 70);
      gl.addColorStop(0, "rgba(159,255,106,0.35)"); gl.addColorStop(1, "rgba(159,255,106,0)");
      g.fillStyle = gl; g.fillRect(p.x - 70, p.y - 70, 140, 140);
    }
    if (run.mega && run.hunger < 6 && Math.floor(run.t * 3) % 2 === 0) text(g, "배고파!", p.x, p.y - 72, 14, "#ff8a3d", "center");
    if (p.gulp > 0) {
      g.strokeStyle = `rgba(159,255,106,${0.5 + Math.sin(run.t * 5) * 0.2})`; g.lineWidth = 4;
      g.beginPath(); g.arc(p.x, p.y, 58, 0, Math.PI * 2); g.stroke();
    }
    const riding = run.ult && run.ult.kind === "mech";
    if (!riding && p.invuln > 0 && Math.floor(run.t * 16) % 2 === 0) return;
    const frame = run.charId === "owl" ? Math.floor(p.animT * 12) % 4 : 0;
    // 메가 프로그: 0 둥실, 1 포효, 2 혀 (꿀꺽), 3 피격
    const megaPic = run.mega ? RD.playerPic("megafrog", p.hurt > 0 ? 3 : run.ult && run.ult.kind === "megafrog" ? 2 : p.atkT > 0 || run.roars.length ? 1 : 0) : null;
    const pic = megaPic || RD.playerPic(run.charId, p.hurt > 0 ? 3 : p.atkT > 0 ? 2 : Math.floor(run.t * 6) % 2, run.awak);
    const spr = pic || RD.getCharacterFrame(run.charId, run.charId === "owl" ? "run" : "jump", frame);
    const s = C.spriteScale * (run.mega ? 1.55 : 1), size = RD.SPRITE_SIZE * s;
    g.save();
    g.translate(Math.round(p.x), Math.round(p.y));
    g.rotate(p.tilt * 0.18);
    // 비행 꼬리 (속도감)
    g.fillStyle = "rgba(255,255,255,0.25)";
    g.fillRect(-46 - Math.random() * 6, 6, 22, 3);
    g.fillRect(-40 - Math.random() * 6, 14, 14, 2);
    if (run.raid) {
      g.fillStyle = "rgba(0,0,0,0.3)"; g.beginPath(); g.ellipse(0, 30, 22, 7, 0, 0, Math.PI * 2); g.fill();
      if (run.brawl && Math.cos(run.brawl.aimAng) < 0) g.scale(-1, 1); // 조준한 쪽을 본다
    }
    if (run.mega && !megaPic) g.filter = "saturate(1.6) hue-rotate(-25deg) brightness(0.9)";
    let topY = -24 * s;
    if (pic && run.mech && mechPic && (run.mech.alive || riding)) {
      // 메카 그림 안에 다람쥐가 이미 그려져 있다
    } else if (pic) {
      // 그림 캐릭터: 높이 84 (메가 1.55배, 메카 조종석 안에서는 작게)
      const inMech = run.mech && run.mech.alive && !riding;
      const hh = (inMech ? 56 : 90) * (run.mega ? 1.45 : 1), ww = pic.width * hh / pic.height;
      const oy = inMech ? -26 * [0.62, 0.72, 0.84][run.mech.evo] - hh / 2 + 6 : -hh / 2 - 4;
      g.imageSmoothingEnabled = true;
      g.drawImage(pic, -ww / 2 - 4, oy, ww, hh);
      topY = oy + hh * 0.12;
      g.imageSmoothingEnabled = false;
    } else g.drawImage(spr, -20 * s, -24 * s, size, size);
    g.filter = "none";
    if (run.mega && !megaPic) { // 왕관 (메가 프로그 그림이 없을 때)
      g.fillStyle = "#ffd34d"; g.fillRect(-14, topY - 6, 28, 8); g.fillRect(-14, topY - 14, 6, 8); g.fillRect(-3, topY - 16, 6, 10); g.fillRect(8, topY - 14, 6, 8);
      g.fillStyle = "#ff4d5e"; g.fillRect(-2, topY - 4, 4, 4);
    }
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
      } else if (e.type === "confetti") {
        const k = e.t / e.life;
        for (let i = 0; i < 6; i++) { g.fillStyle = ["#ff5ad8", "#ffd34d", "#7fe6ff", "#9fff6a"][i % 4]; g.fillRect(e.x + Math.cos(i * 1.1 + e.x) * 30 * k - 2, e.y + Math.sin(i * 1.1 + e.y) * 30 * k + 20 * k * k - 2, 4, 4); }
      } else if (e.type === "arcslash") {
        const k = e.t / e.life;
        g.save(); g.globalAlpha = 1 - k * 0.7;
        g.fillStyle = "rgba(191,228,255,0.35)";
        g.beginPath(); g.moveTo(e.x, e.y); g.arc(e.x, e.y, e.range, e.ang - e.arc, e.ang + e.arc); g.closePath(); g.fill();
        g.strokeStyle = "#ffffff"; g.lineWidth = 5;
        const cur = e.ang - e.arc + (e.arc * 2) * Math.min(1, k * 1.6);
        g.beginPath(); g.arc(e.x, e.y, e.range * 0.92, e.ang - e.arc, cur); g.stroke();
        g.restore();
      } else if (e.type === "rocks") {
        // 위에서 본 땅 갈라짐: 바위가 솟았다 가라앉는다
        if (e.t >= 0) {
          const up = Math.sin(Math.min(1, k) * Math.PI);
          g.fillStyle = "rgba(60,40,20,0.5)"; g.fillRect(e.x - 26, e.y - 6, 52, 12);
          for (let i = 0; i < 4; i++) { const ox = (i - 1.5) * 13, h = (14 + (i % 2) * 10) * up; g.fillStyle = i % 2 ? "#8a6a40" : "#b08850"; g.fillRect(e.x + ox - 6, e.y - h, 12, h); g.fillStyle = "#e8c890"; g.fillRect(e.x + ox - 6, e.y - h, 12, 3); }
        }
      } else if (e.type === "zap") {
        // 연쇄 번개
        g.strokeStyle = e.color || "#9fe8ff"; g.globalAlpha = 1 - k; g.lineWidth = 5;
        g.beginPath(); g.moveTo(e.x, e.y);
        const n = 6;
        for (let i = 1; i < n; i++) { const t = i / n; g.lineTo(e.x + (e.x2 - e.x) * t + (Math.random() - 0.5) * 22, e.y + (e.y2 - e.y) * t + (Math.random() - 0.5) * 22); }
        g.lineTo(e.x2, e.y2); g.stroke();
        g.strokeStyle = "#fff"; g.lineWidth = 2; g.stroke(); g.globalAlpha = 1;
      } else if (e.type === "vine") {
        // 덩굴 채찍
        g.save(); g.translate(e.x, e.y); g.rotate(e.ang); g.globalAlpha = 1 - k * 0.8;
        const L = e.len * Math.min(1, k * 4 + 0.3);
        g.strokeStyle = "#3a7a30"; g.lineWidth = 12; g.beginPath(); g.moveTo(0, 0);
        for (let x = 20; x <= L; x += 20) g.lineTo(x, Math.sin(x / 30 + e.t * 20) * 8);
        g.stroke(); g.strokeStyle = "#9fffb0"; g.lineWidth = 5; g.stroke();
        for (let x = 40; x < L; x += 60) { g.fillStyle = "#5fcf6a"; g.fillRect(x, Math.sin(x / 30) * 8 - 10, 10, 6); }
        g.restore(); g.globalAlpha = 1;
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
    if (u.kind.startsWith("aw_")) {
      // 각성 궁극기: 각성 색으로 물든 화면
      const col = RD.AWAKEN_KIT[run.charId].ult.color, fade = Math.min(1, u.t * 4, (u.life - u.t) * 3);
      const gr = g.createRadialGradient(C.width / 2, C.height / 2, 120, C.width / 2, C.height / 2, 620);
      gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, col);
      g.save(); g.globalAlpha = 0.35 * fade; g.fillStyle = gr; g.fillRect(0, 0, C.width, C.height); g.restore();
      if (u.kind === "aw_cat" && u.bh) {
        const r = 70 + Math.sin(u.t * 6) * 6 + Math.min(1, u.t) * 40;
        g.save(); g.translate(u.bh.x, u.bh.y); g.rotate(u.t * 3);
        for (let i = 0; i < 5; i++) { g.strokeStyle = `rgba(197,138,255,${0.5 - i * 0.08})`; g.lineWidth = 5; g.beginPath(); g.arc(0, 0, r + i * 34, i, i + 4); g.stroke(); }
        g.fillStyle = "#c58aff"; g.beginPath(); g.arc(0, 0, r * 0.75, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#0a0614"; g.beginPath(); g.arc(0, 0, r * 0.62, 0, Math.PI * 2); g.fill();
        g.restore();
      }
      if (u.kind === "aw_frog") {
        // 극장의 막
        const open = Math.min(1, u.t * 2) * Math.min(1, (u.life - u.t) * 2);
        const w = (C.width / 2) * (1 - open * 0.85);
        for (const side of [0, 1]) {
          const x = side ? C.width - w : 0;
          g.fillStyle = "#8a1830"; g.fillRect(x, 0, w, C.height);
          for (let i = 0; i < w; i += 24) { g.fillStyle = "#6a1024"; g.fillRect(x + i, 0, 8, C.height); }
          g.fillStyle = "#ffd34d"; g.fillRect(side ? x : x + w - 6, 0, 6, C.height);
        }
        g.fillStyle = "#6a1024"; g.fillRect(0, 0, C.width, 30); g.fillStyle = "#ffd34d"; g.fillRect(0, 28, C.width, 4);
      }
      return;
    }
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
    } else if (u.kind === "megafrog") {
      // 꿀꺽: 끌려오는 적마다 긴 혀
      const fade = Math.min(1, u.t * 6, (u.life - u.t) * 3);
      g.save(); g.globalAlpha = fade;
      g.fillStyle = "rgba(159,255,106,0.12)"; g.beginPath(); g.arc(p.x, p.y, RD.MEGA_FROG.gulpR, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "rgba(159,255,106,0.6)"; g.lineWidth = 2; g.setLineDash([8, 8]); g.beginPath(); g.arc(p.x, p.y, RD.MEGA_FROG.gulpR, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
      for (const e of u.pull || []) {
        g.strokeStyle = "#1d1622"; g.lineWidth = 10; g.beginPath(); g.moveTo(p.x + 24, p.y); g.lineTo(e.x, e.y); g.stroke();
        g.strokeStyle = "#ff7aa8"; g.lineWidth = 6; g.beginPath(); g.moveTo(p.x + 24, p.y); g.lineTo(e.x, e.y); g.stroke();
        g.fillStyle = "#ff7aa8"; g.beginPath(); g.arc(e.x, e.y, 9, 0, Math.PI * 2); g.fill();
      }
      g.restore();
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

  // 플레이 캐릭터 그림 (그림 파일이 있으면)
  RD.mechPic = function (evo, f) {
    const im = RD.img && RD.img(`mech_mk${evo + 1}_${f}`);
    return im && im.complete && im.naturalWidth ? im : null;
  };
  RD.playerPic = function (id, f, awake) {
    if (awake) { const a = RD.img && RD.img(`player_${id}_awake_${f}`); if (a && a.complete && a.naturalWidth) return a; }
    const im = RD.img && RD.img(`player_${id}_${f}`);
    return im && im.complete && im.naturalWidth ? im : null;
  };

  // 메가 프로그 변신 컷인
  function drawMegaCut(g, run) {
    const t = 2.6 - run.megaCut, im = RD.img("illust_megafrog");
    if (!(im && im.naturalWidth)) return;
    const k = Math.min(1, t * 4), out = Math.min(1, run.megaCut * 3);
    const h = 230, w = h * im.width / im.height, x = C.width - w - 20 + (1 - k) * 400, y = C.height - h - 70;
    g.save(); g.globalAlpha = out;
    g.fillStyle = "#1d1622"; g.fillRect(x - 4, y - 4, w + 8, h + 8);
    g.fillStyle = "#9fff6a"; g.fillRect(x - 4, y - 4, w + 8, 3);
    g.imageSmoothingEnabled = true; g.drawImage(im, x, y, w, h); g.imageSmoothingEnabled = false;
    text(g, "MEGA FROG!", x + 14, y + h - 20, 26, "#9fff6a");
    g.restore();
  }

  function drawHud(g, run) {
    const UI = RD.UI, p = run.player;
    const D = run.D, M = RD.MODES[run.mode];
    const hpK = Math.max(0, p.hp) / run.maxHp;
    const timed = run.mode === "timeattack" || run.mode === "raid";

    if (run.duel) drawDuelTop(g, run, hpK);
    else if (run.raid) drawRaidTop(g, run, hpK);
    else {
      // ── 왼쪽 위: 점수 · 체력 · 레벨 · 패시브
      const extra = run.charId === "fox" || run.charId === "cat" || run.mech || run.mega || run.M.special === "dream";
      UI.panel(g, 14, 12, 244, extra ? 92 : 70, "rgba(35,26,54,0.88)");
      text(g, "SCORE", 24, 28, 11, UI.COL.dim);
      text(g, String(run.score).padStart(7, "0"), 72, 28, 20, UI.COL.gold);
      text(g, "HI " + Math.max(RD.best || 0, run.score).toLocaleString(), 248, 28, 10, "#8a7aa8", "right");
      UI.icon(g, "heart", 22, 41, 14, "#ff4d6a");
      UI.segBar(g, 42, 44, 170, 8, hpK, hpK < 0.3 ? UI.COL.red : "#7fe08a");
      text(g, `${Math.max(0, Math.ceil(p.hp))}`, 248, 49, 12, "#fff", "right");
      text(g, "Lv." + run.level, 22, 66, 12, UI.COL.cyan);
      UI.segBar(g, 62, 63, 186, 5, run.exp / run.expNeed, UI.COL.cyan);
      if (run.charId === "fox") {
        text(g, "베기", 22, 88, 12, UI.COL.orange);
        const n = RD.FOX_PARRY.max;
        for (let i = 0; i < n; i++) {
          const f = Math.max(0, Math.min(1, run.parry - i));
          g.fillStyle = "#1d1622"; g.fillRect(56 + i * 34, 81, 30, 14);
          g.fillStyle = "#3a2d48"; g.fillRect(58 + i * 34, 83, 26, 10);
          g.fillStyle = f >= 1 ? UI.COL.orange : "#8a4a2a"; g.fillRect(58 + i * 34, 83, 26 * f, 10);
          if (f >= 1) { g.fillStyle = "rgba(255,255,255,0.35)"; g.fillRect(58 + i * 34, 83, 26, 2); }
        }
        const left = Math.max(0, Math.floor(run.parry));
        text(g, `${left}칸 남음`, 248, 88, 11, "#b9add0", "right");
      } else if (run.charId === "cat") {
        text(g, "보호막", 22, 88, 12, UI.COL.purple);
        UI.segBar(g, 70, 84, 178, 7, p.shielded ? 1 : run.shield / RD.CAT_SHIELD.every, p.shielded ? UI.COL.purple : "#6a4a90");
      } else if (run.mech) {
        drawMechRow(g, run, 22, 88, 226);
      } else if (run.mega) {
        drawMegaRow(g, run, 22, 88, 226);
      } else if (run.M.special === "dream") {
        text(g, run.rush > 0 ? "슈가 러시!" : "사탕", 22, 88, 12, "#ff9ad8");
        UI.segBar(g, 82, 84, 166, 7, run.rush > 0 ? run.rush / 6 : run.sugar / 30, "#ff9ad8");
      }

      // ── 오른쪽 위: 스테이지 · 모드 (일시정지·소리 버튼 옆)
      const rx = C.width - 262, rw = 196;
      UI.panel(g, rx, 12, rw, 48, "rgba(35,26,54,0.88)");
      const top = timed ? `남은 시간 ${Math.ceil(run.timeLeft)}` : run.stage.name + (run.mode === "bossrush" || run.mode === "endless" ? ` · ${run.loop}R` : "");
      UI.fitText(g, top, rx + rw - 10, 28, rw - 20, 16, timed && run.timeLeft < 20 ? UI.COL.red : UI.COL.green, "right");
      UI.fitText(g, `${M.name} · ${D.name}` + (run.stage.effectName ? ` · ${run.stage.effectName}` : ""), rx + rw - 10, 48, rw - 20, 11, D.color, "right");

      // ── 가운데 위: 보스 체력
      const boss = run.boss;
      if (boss) {
        const def = RD.ENEMIES[boss.type];
        const w = 380, x = (C.width - w) / 2;
        const k = Math.max(0, boss.hp / boss.maxHp);
        UI.panel(g, x, 12, w, 48, "rgba(35,26,54,0.9)");
        UI.icon(g, "skull", x + 10, 18, 14, UI.COL.red);
        UI.fitText(g, boss.name || (def.boss ? "보스" : "골렘"), x + 30, 26, w - 90, 14, "#fff");
        text(g, `${Math.ceil(k * 100)}%`, x + w - 10, 26, 11, "#b9add0", "right");
        UI.segBar(g, x + 10, 38, w - 20, 12, k, def.boss ? UI.COL.red : "#ffb347", 20);
      }
    }

    // 나팔 진행도
    if (run.M.special === "judgment") {
      for (let i = 0; i < 7; i++) {
        const done = i < run.tr, now = i === run.tr;
        const x = C.width / 2 - 7 * 15 + i * 30, y = 82;
        g.fillStyle = done ? "#7a6020" : now ? "#ffd34d" : "#3a2d48";
        g.fillRect(x, y - 3, 16, 6); g.beginPath(); g.moveTo(x + 16, y - 7); g.lineTo(x + 24, y - 10); g.lineTo(x + 24, y + 10); g.lineTo(x + 16, y + 7); g.fill();
      }
      text(g, run.tr >= 0 ? RD.TRUMPETS[run.tr].name : "나팔을 불 준비", C.width / 2, 102, 12, "#ffd34d", "center");
    }
    if (p.burn > 0) text(g, "화상!", p.x, p.y - 58, 13, "#ff8a3d", "center");
    if (p.poison > 0) text(g, `독한 종기 ${p.poison.toFixed(1)}`, p.x, p.y - 44, 13, "#9fff6a", "center");
    if (p.inverted > 0) text(g, `조작 반전 ${p.inverted.toFixed(1)}`, p.x, p.y - 60, 14, "#c58aff", "center");

    // ── 왼쪽 아래: 목숨 · 궁극기
    if (!run.raid) {
      const bx = 14, by = C.height - 74;
      UI.panel(g, bx, by, 176, 60, "rgba(35,26,54,0.88)");
      text(g, "목숨", bx + 10, by + 17, 11, UI.COL.dim);
      const head = RD.playerPic(run.charId, 0, run.awak) || RD.getCharacterFrame(run.charId, "jump", 0);
      const hw = head.width * 26 / head.height;
      g.imageSmoothingEnabled = true;
      for (let i = 0; i < Math.min(run.lives, 5); i++) g.drawImage(head, bx + 40 + i * 24, by + 3, Math.min(30, hw), 26);
      g.imageSmoothingEnabled = false;
      if (run.lives > 5) text(g, `×${run.lives}`, bx + 168, by + 17, 11, "#fff", "right");
      text(g, "궁", bx + 10, by + 43, 11, UI.COL.dim);
      const nb = Math.min(run.bombs, 4);
      for (let i = 0; i < Math.max(nb, 1); i++) UI.icon(g, "bolt", bx + 42 + i * 24, by + 34, 18, i < run.bombs ? UI.COL.gold : "#5a4a70");
      text(g, `×${run.bombs}`, bx + 168, by + 43, 12, "#fff", "right");
    }

    // ── 아래: 가진 강화 (로마 숫자 단계)
    let ux = run.raid ? 14 : 206;
    const uy = C.height - 40, maxX = run.raid ? C.width - 330 : C.width - 140;
    for (const u of run.raid ? RD.BRAWL_UPS[run.charId] : RD.UPGRADES) {
      const lv = run.lv(u.id);
      if (!lv) continue;
      const name = u.id === "sig" ? run.char.sig.name : u.name;
      g.font = `bold 11px ${FONT}`;
      const w = g.measureText(name).width + 22 + lv * 5;
      if (ux + w > maxX) break;
      g.fillStyle = "#1d1622"; g.fillRect(ux - 2, uy - 2, w + 4, 24);
      g.fillStyle = "rgba(43,33,64,0.92)"; g.fillRect(ux, uy, w, 20);
      g.fillStyle = u.color; g.fillRect(ux, uy, 4, 20);
      text(g, name, ux + 9, uy + 11, 11, "#fff");
      text(g, UI.roman(lv), ux + w - 6, uy + 11, 10, u.color, "right");
      ux += w + 7;
    }

    // WARNING / 배너
    const b = run.banner;
    if (b) {
      if (b.text === "WARNING") drawWarning(g, b);
      else {
        text(g, b.text, C.width / 2, C.height / 2 - (b.sub ? 14 : 0), b.small ? 34 : 60, b.color, "center");
        if (b.sub) text(g, b.sub, C.width / 2, C.height / 2 + 32, 20, "#fff", "center");
        if (b.sub2) text(g, b.sub2, C.width / 2, C.height / 2 + 62, 15, "#ffc49a", "center");
      }
    }
    if (run.megaCut > 0) drawMegaCut(g, run);
    if (run.mech && !run.choosing && !run.cutscene) drawTechButton(g, run);
    if (run.choosing) drawChoice(g, run);
    if (run.techOpen) drawTech(g, run);
    if (run.cutscene) drawCutscene(g, run);
    RD.drawSoundButton(g);
    if (!run.techOpen) RD.drawPauseButton(g);
  }

  // 메가 프로그: 꿀꺽 보호막 + 공격력
  function drawMegaRow(g, run, x, y, w) {
    const UI = RD.UI, p = run.player, MF = RD.MEGA_FROG;
    const k = run.hunger / MF.hungerMax, low = run.hunger < 6;
    text(g, "배고픔", x, y, 12, low && Math.floor(run.t * 4) % 2 ? UI.COL.red : "#9fff6a");
    UI.segBar(g, x + 48, y - 5, w - 120, 8, k, low ? UI.COL.red : k < 0.4 ? UI.COL.orange : "#9fff6a", 10);
    text(g, p.gulp > 0 ? `막 ${Math.ceil(p.gulp)} · +${Math.round(run.megaPow * 100)}%` : `공격 +${Math.round(run.megaPow * 100)}%`, x + w, y, 10, "#ffd34d", "right");
  }

  // 메카 테크트리 버튼 (왼쪽 위 패널 아래)
  RD.TECH_BTN = { x: 14, y: 112, w: 150, h: 32 };
  function drawTechButton(g, run) {
    const UI = RD.UI, B = RD.TECH_BTN, n = run.tech.pts;
    const y = run.duel ? 114 : run.raid ? 104 : 112;
    RD.TECH_BTN.y = y;
    if (n > 0) { g.globalAlpha = 0.35 + 0.25 * Math.sin(run.t * 6); g.fillStyle = "#ffb347"; g.fillRect(B.x - 6, y - 6, B.w + 12, B.h + 12); g.globalAlpha = 1; }
    UI.btn(g, B.x, y, B.w, B.h, n > 0 ? "#ff8a3d" : "#3a2d58");
    UI.icon(g, "gear", B.x + 8, y + 7, 18, "#fff");
    text(g, "테크트리", B.x + 32, y + 15, 13, "#fff");
    if (n > 0) UI.chip(g, B.x + B.w - 30, y + 6, 22, 18, "#ffd34d", String(n), 11);
  }

  // 메카 테크트리 화면
  RD.techRects = []; RD.techBtns = {};
  function drawTech(g, run) {
    const UI = RD.UI, T = run.tech;
    g.fillStyle = "rgba(10,6,20,0.85)"; g.fillRect(0, 0, C.width, C.height);
    text(g, "메카 테크트리", 30, 34, 26, UI.COL.gold);
    text(g, "레벨이 오를 때마다 테크 포인트 1점 · 게임은 멈춰 있어요", 30, 62, 12, "#b9add0");
    UI.panel(g, C.width - 400, 18, 150, 40, "#231a36");
    UI.icon(g, "gear", C.width - 390, 28, 20, "#ffb347");
    text(g, `포인트 ${T.pts}`, C.width - 260, 38, 17, "#fff", "right");
    const close = { x: C.width - 226, y: 18, w: 160, h: 40 };
    UI.btn(g, close.x, close.y, close.w, close.h, "#5a4a78");
    text(g, "닫기", close.x + close.w / 2, close.y + 19, 16, "#fff", "center", "#5a4a78");
    const NC = RD.MECH_TECH_COLS.length, cw = 212, ch = 60, gx = 18, x0 = (C.width - (cw * NC + gx * (NC - 1))) / 2, y0 = 108, gy = 18;
    RD.MECH_TECH_COLS.forEach(([nm, col], i) => text(g, nm, x0 + i * (cw + gx) + cw / 2, 92, 14, col, "center"));
    const pos = (t) => ({ x: x0 + t.col * (cw + gx), y: y0 + t.row * (ch + gy) });
    // 연결선
    for (const t of RD.MECH_TECH) if (t.req) {
      const a = pos(RD.MECH_TECH.find((q) => q.id === t.req)), b = pos(t);
      g.fillStyle = T.has[t.req] ? RD.MECH_TECH_COLS[t.col][1] : "#3a2d48";
      g.fillRect(a.x + cw / 2 - 3, a.y + ch, 6, b.y - a.y - ch);
    }
    RD.techRects = [];
    for (const t of RD.MECH_TECH) {
      const { x, y } = pos(t), col = RD.MECH_TECH_COLS[t.col][1];
      const has = T.has[t.id], open = run.techOpenFor(t), can = run.canUnlock(t), sel = run.techSel === t.id;
      if (sel) { g.fillStyle = UI.COL.gold; g.fillRect(x - 6, y - 6, cw + 12, ch + 12); }
      UI.panel(g, x, y, cw, ch, has ? UI.shade(col, 0.45) : open ? "#2b2140" : "#1d1428");
      UI.iconBox(g, x + 9, y + 10, 40, open ? t.icon : "lock", has ? "#fff" : open ? col : "#5a4a70", has ? col : null);
      UI.fitText(g, t.name, x + 58, y + 20, cw - 64, 14, open ? "#fff" : "#7a6a90");
      text(g, has ? "해금 완료" : `${t.cost}포인트` + (t.req2 ? ` · ${RD.MECH_TECH.find((q) => q.id === t.req2).name.split(" ")[0]} 필요` : ""), x + 58, y + 42, 11, has ? UI.COL.green : can ? UI.COL.gold : "#8a7aa8");
      RD.techRects.push({ id: t.id, x, y, w: cw, h: ch });
    }
    // 설명과 해금 버튼
    const t = RD.MECH_TECH.find((q) => q.id === run.techSel);
    const py = C.height - 92;
    UI.panel(g, 30, py, C.width - 330, 70, "#231a36");
    if (t) {
      text(g, t.name, 46, py + 22, 16, RD.MECH_TECH_COLS[t.col][1]);
      const need = [t.req, t.req2].filter((r) => r && !T.has[r]).map((r) => RD.MECH_TECH.find((q) => q.id === r).name);
      UI.fitText(g, t.desc + (need.length ? ` (먼저 ${need.join(", ")} 필요)` : ""), 46, py + 48, C.width - 370, 13, "#fff");
    } else text(g, "기술을 눌러서 설명을 보고, 해금하세요", 46, py + 35, 14, "#b9add0");
    const ub = { x: C.width - 280, y: py + 4, w: 250, h: 62 };
    const ok = t && run.canUnlock(t);
    UI.btn(g, ub.x, ub.y, ub.w, ub.h, ok ? UI.COL.orange : "#4a3d60");
    text(g, t && T.has[t.id] ? "이미 해금함" : ok ? `해금 (${t.cost}포인트)` : t ? "포인트 부족" : "해금", ub.x + ub.w / 2, ub.y + 29, 18, ok ? "#1d1622" : "#b9add0", "center", ok ? UI.COL.orange : "#4a3d60");
    RD.techBtns = { close, unlock: ub };
  }

  // 메카 상태 한 줄: 살아 있으면 메카 체력 + 진화 부품, 파괴되면 재조립 진행도
  function drawMechRow(g, run, x, y, w) {
    const UI = RD.UI, M = run.mech;
    if (M.alive) {
      text(g, "Mk." + UI.roman(M.evo + 1), x, y, 12, "#ffb347");
      const hk = M.hp / run.mechMax;
      UI.segBar(g, x + 46, y - 5, w - 110, 8, hk, hk < 0.3 ? UI.COL.red : "#ffb347", 10);
      text(g, M.barrier ? "방어막" : `${Math.ceil(M.hp)}`, x + w, y, 10, M.barrier ? UI.COL.cyan : "#c8d0e0", "right");
    } else {
      const blink = Math.floor(run.t * 4) % 2 === 0;
      text(g, "재조립", x, y, 12, blink ? UI.COL.red : "#ff8a8a");
      UI.segBar(g, x + 46, y - 5, w - 96, 8, M.prog, "#ff8a3d");
      text(g, `${Math.floor(M.prog * 100)}%`, x + w, y, 10, "#ff8a8a", "right");
    }
  }

  // 빨강·검정 사선 띠 WARNING
  function drawWarning(g, b) {
    const w = 520, h = 84, x = (C.width - w) / 2, y = 120;
    const slide = Math.min(1, b.t * 6), fade = b.t > b.life - 0.4 ? (b.life - b.t) / 0.4 : 1;
    g.save();
    g.globalAlpha = Math.max(0, fade);
    g.translate(0, (1 - slide) * -30);
    g.fillStyle = "#1d1622"; g.fillRect(x - 3, y - 3, w + 6, h + 6);
    g.fillStyle = "rgba(110,14,30,0.92)"; g.fillRect(x, y, w, h);
    const stripe = (sy) => {
      g.save(); g.beginPath(); g.rect(x, sy, w, 10); g.clip();
      g.fillStyle = "#1d1622"; g.fillRect(x, sy, w, 10);
      g.fillStyle = "#ff4d5e";
      const off = (b.t * 60) % 28;
      for (let sx = x - 28 + off; sx < x + w + 20; sx += 28) { g.beginPath(); g.moveTo(sx, sy + 10); g.lineTo(sx + 10, sy); g.lineTo(sx + 22, sy); g.lineTo(sx + 12, sy + 10); g.fill(); }
      g.restore();
    };
    stripe(y); stripe(y + h - 10);
    const blink = Math.floor(b.t * 6) % 2 === 0;
    g.font = `bold 36px ${FONT}`;
    text(g, "W A R N I N G", C.width / 2, y + 36, 34, blink ? "#ff6a7a" : "#ffb0b8", "center");
    if (b.sub) text(g, b.sub, C.width / 2, y + 62, 13, "#fff", "center");
    g.restore();
    if (b.sub2) text(g, b.sub2, C.width / 2, y + h + 18, 13, "#ffc49a", "center");
  }

  // 결투 위쪽 HUD: 나 (왼쪽) VS 상대 (오른쪽), 가운데 시간
  function drawDuelTop(g, run, hpK) {
    const UI = RD.UI, Du = run.duel, r = run.enemies.find((e) => e.rival);
    const rch = RD.CHARACTERS.find((c) => c.id === Du.rival);
    const side = (x, ch, name, k, col, right) => {
      UI.panel(g, x, 12, 330, 62, "rgba(35,26,54,0.92)");
      const px = right ? x + 330 - 56 : x + 6;
      UI.portrait(g, ch, px, 16, 50, 54);
      const tx = right ? x + 330 - 66 : x + 66, al = right ? "right" : "left";
      UI.fitText(g, name, tx, 28, 200, 13, "#fff", al);
      text(g, ch.name, right ? x + 10 : x + 320, 28, 10, "#b9add0", right ? "left" : "right");
      const bx = right ? x + 10 : x + 66;
      UI.segBar(g, bx, 42, 254, 14, k, col, 10);
      text(g, `${Math.round(k * 100)}%`, right ? bx + 4 : bx + 250, 64, 10, "#cfc6e0", right ? "left" : "right");
    };
    side(14, run.char, "나" + (RD.playerTitle ? " · " + RD.playerTitle : ""), hpK, hpK < 0.3 ? UI.COL.red : "#7fe08a", false);
    side(C.width - 344 - 60, rch, Du.name, r ? r.hp / r.maxHp : (Du.result === "win" ? 0 : 1), "#ff4d5e", true);
    if (run.mech) { UI.panel(g, 14, 82, 222, 22, "rgba(35,26,54,0.9)"); drawMechRow(g, run, 22, 93, 206); }
    if (run.mega) { UI.panel(g, 14, 82, 222, 22, "rgba(35,26,54,0.9)"); drawMegaRow(g, run, 22, 93, 206); }
    const s = Math.max(0, Math.ceil(run.timeLeft));
    UI.panel(g, C.width / 2 - 66 - 30, 12, 132, 62, "#1d1428");
    text(g, "VS", C.width / 2 - 30, 26, 13, "#ff5ad8", "center");
    text(g, `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`, C.width / 2 - 30, 52, 24, s < 20 ? UI.COL.red : UI.COL.cyan, "center");
  }

  // 레이드 위쪽 HUD: 캐릭터 · 보스 패널(광폭화 단계) · 시간과 준 피해
  function drawRaidTop(g, run, hpK) {
    const UI = RD.UI, R = run.raid, p = run.player;
    // 캐릭터
    UI.panel(g, 14, 12, 50, 50, "#231a36");
    UI.portrait(g, run.char, 16, 14, 46, 46);
    UI.panel(g, 72, 12, 164, 50, "rgba(35,26,54,0.9)");
    UI.fitText(g, run.char.name, 82, 26, 120, 12, "#fff");
    text(g, "Lv." + run.level, 228, 26, 11, UI.COL.cyan, "right");
    UI.segBar(g, 82, 38, 142, 8, hpK, hpK < 0.3 ? UI.COL.red : "#7fe08a");
    UI.segBar(g, 82, 52, 142, 3, run.exp / run.expNeed, UI.COL.cyan);
    if (run.mech) { UI.panel(g, 14, 72, 222, 22, "rgba(35,26,54,0.9)"); drawMechRow(g, run, 22, 83, 206); }
    if (run.mega) { UI.panel(g, 14, 72, 222, 22, "rgba(35,26,54,0.9)"); drawMegaRow(g, run, 22, 83, 206); }
    // 보스
    const boss = run.enemies.find((e) => e.raidBoss && !e.dead);
    const x = 250, w = 460;
    UI.panel(g, x, 12, w, 70, "rgba(35,26,54,0.92)");
    const def = RD.RAID_BOSSES.find((r) => r[0] === R.type);
    text(g, `[레이드 Lv.${R.lv}]`, x + 10, 27, 12, UI.COL.purple);
    UI.fitText(g, ((boss && boss.name) || (def && def[2]) || "").replace(/^\[[^\]]*\]\s*/, "") || "레이드 보스", x + 112, 27, 250, 14, "#fff");
    const k = boss ? Math.max(0, boss.hp / boss.maxHp) : 1;
    text(g, `HP ${Math.ceil(k * 100)}%`, x + w - 10, 27, 11, "#b9add0", "right");
    UI.segBar(g, x + 10, 38, w - 20, 12, k, UI.COL.red, 20);
    text(g, "광폭화", x + 10, 69, 11, UI.COL.dim);
    for (let i = 0; i < 3; i++) {
      const on = i < R.rage;
      g.fillStyle = "#1d1622"; g.fillRect(x + 52 + i * 26, 60, 22, 18);
      g.fillStyle = on ? UI.COL.red : "#3a2d48"; g.fillRect(x + 54 + i * 26, 62, 18, 14);
      text(g, UI.roman(i + 1), x + 63 + i * 26, 69, 10, on ? "#fff" : "#7a6a90", "center");
    }
    const every = RD.RAID.rageEvery || 45;
    text(g, R.rage ? `${R.rage}단계 · 공격 속도 +${R.rage * 20}%` : "평온", x + 136, 69, 11, R.rage ? "#ff8a8a" : "#b9add0");
    text(g, `다음 단계 ${Math.ceil(every - (run.t % every))}초`, x + w - 10, 69, 11, "#b9add0", "right");
    // 시간과 준 피해
    const rx = C.width - 236;
    UI.panel(g, rx, 12, 168, 70, "rgba(35,26,54,0.92)");
    const s = Math.max(0, Math.ceil(run.timeLeft));
    UI.icon(g, "clock", rx + 12, 20, 18, UI.COL.cyan);
    text(g, `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`, rx + 158, 30, 24, s < 20 ? UI.COL.red : UI.COL.cyan, "right");
    text(g, "준 피해", rx + 12, 64, 11, UI.COL.dim);
    text(g, Math.round(R.dmg).toLocaleString(), rx + 158, 64, 15, UI.COL.gold, "right");
  }

  // 소리 · 일시정지 버튼 (오른쪽 위, 네모 버튼)
  RD.SOUND_BTN = { x: C.width - 34, y: 78, r: 18 };
  RD.PAUSE_BTN = { x: C.width - 34, y: 32, r: 18 };
  RD.drawSoundButton = function (g) {
    const b = RD.SOUND_BTN, m = RD.audio && RD.audio.muted;
    RD.UI.btn(g, b.x - 18, b.y - 18, 36, 36, "#3a2d58");
    RD.UI.icon(g, "sound", b.x - 11, b.y - 13, 22, m ? "#7a6a90" : "#7fe6ff");
    if (m) { g.strokeStyle = "#ff4d5e"; g.lineWidth = 3; g.beginPath(); g.moveTo(b.x - 12, b.y - 12); g.lineTo(b.x + 10, b.y + 8); g.stroke(); }
  };
  RD.drawPauseButton = function (g) {
    const b = RD.PAUSE_BTN;
    RD.UI.btn(g, b.x - 18, b.y - 18, 36, 36, "#3a2d58");
    RD.UI.icon(g, "pause", b.x - 11, b.y - 13, 22, "#fff");
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
    else if (c.angel >= 7) {
      const col = RD.ANGELS[c.angel - 7].color;
      const gl = g.createRadialGradient(712, 230, 30, 712, 230, 260);
      gl.addColorStop(0, col + "99"); gl.addColorStop(1, col + "00");
      g.fillStyle = gl; g.fillRect(450, 0, 520, 500);
      drawAngel(g, 600, ay, 7, c.t, blowing, c.angel);
    }
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

  // 레벨업 강화 카드 3장 (눌러서 고르고 "이 강화 고르기"로 확정, "새로 뽑기"로 다시 뽑기)
  RD.cardRects = [];
  RD.choiceBtns = {};
  const CAT_ICON = { "주무기": "sword", "보조무기": "target", "공격": "sword", "일반 공격": "sword", "전용": "star", "궁극기": "bolt", "생존": "shield", "능력": "up", "자석 마법": "coin" };
  const UP_ICON = { hp: "heart", armor: "shield", shield: "shield", regen: "heart", bomb: "bolt", magnet: "coin" };
  function drawChoice(g, run) {
    const UI = RD.UI, ch = run.choosing;
    g.fillStyle = "rgba(10,6,20,0.78)";
    g.fillRect(0, 0, C.width, C.height);
    const lv = run.level - run.pendingLevels + 1;
    text(g, "LEVEL UP!", C.width / 2, 52, 40, UI.COL.gold, "center");
    text(g, `Lv.${lv - 1} → Lv.${lv} · 강화를 하나 고르세요` + (run.pendingLevels > 1 ? ` (남은 선택 ${run.pendingLevels})` : ""), C.width / 2, 88, 15, "#fff", "center");
    const opts = ch.options;
    const cw = 244, chh = 300, gap = 28;
    const x0 = (C.width - (cw * opts.length + gap * (opts.length - 1))) / 2;
    const y = 112;
    RD.cardRects = [];
    const pop = Math.min(1, ch.t * 5);
    opts.forEach((u, i) => {
      const x = x0 + i * (cw + gap);
      const sel = ch.sel === i;
      const yy = y + (1 - pop) * 40 + (sel ? -8 : 0);
      const lvNow = run.lv(u.id);
      const info = run.upgradeInfo(u);
      if (sel) { g.fillStyle = UI.COL.gold; g.fillRect(x - 8, yy - 8, cw + 16, chh + 16); }
      UI.panel(g, x, yy, cw, chh, "#2b2140");
      g.fillStyle = u.color; g.fillRect(x, yy, cw, 30);
      g.fillStyle = "rgba(255,255,255,0.25)"; g.fillRect(x, yy, cw, 3);
      g.fillStyle = "rgba(0,0,0,0.2)"; g.fillRect(x, yy + 26, cw, 4);
      text(g, u.cat === "전용" ? `전용 · ${run.char.name.split(" ")[0]}` : u.cat, x + 12, yy + 15, 13, "#1d1622", "left", u.color);
      if (!lvNow) UI.chip(g, x + cw - 52, yy + 6, 44, 17, UI.COL.red, "NEW", 11, "#fff");
      else text(g, `${i + 1}`, x + cw - 12, yy + 15, 13, "#1d1622", "right", u.color);
      UI.iconBox(g, x + cw / 2 - 34, yy + 46, 68, UP_ICON[u.id] || CAT_ICON[u.cat] || "star", u.color);
      UI.fitText(g, info.name, x + cw / 2, yy + 140, cw - 24, 22, "#fff", "center");
      const pw = 28, pg = 6, px0 = x + cw / 2 - (u.max * (pw + pg) - pg) / 2;
      for (let k = 0; k < u.max; k++) {
        const px = px0 + k * (pw + pg);
        g.fillStyle = "#1d1622"; g.fillRect(px - 2, yy + 164, pw + 4, 14);
        g.fillStyle = k < lvNow ? u.color : k === lvNow ? UI.shade(u.color, 0.6) : "#1a1228";
        g.fillRect(px, yy + 166, pw, 10);
        if (k === lvNow && Math.floor(ch.t * 3) % 2 === 0) { g.fillStyle = "rgba(255,255,255,0.4)"; g.fillRect(px, yy + 166, pw, 10); }
      }
      text(g, `${lvNow}단계 → ${lvNow + 1}단계`, x + cw / 2, yy + 192, 11, "#b9add0", "center");
      g.font = `bold 14px ${FONT}`;
      const words = info.desc.split(" ");
      const lines = [""];
      for (const w of words) {
        const tryLine = (lines[lines.length - 1] + " " + w).trim();
        if (g.measureText(tryLine).width > cw - 28) lines.push(w);
        else lines[lines.length - 1] = tryLine;
      }
      lines.slice(0, 4).forEach((l, li) => text(g, l, x + cw / 2, yy + 222 + li * 21, 14, "#fff", "center"));
      RD.cardRects.push({ x, y: yy, w: cw, h: chh });
    });
    // 아래 버튼
    const by = C.height - 76;
    const rr = run.rerolls || 0;
    const rb = { x: C.width / 2 + 10, y: by, w: 170, h: 50 };
    const cb = { x: C.width / 2 + 200, y: by, w: 240, h: 50 };
    UI.btn(g, rb.x, rb.y, rb.w, rb.h, rr > 0 ? UI.COL.cyan : "#4a3d60");
    text(g, `새로 뽑기 (${rr})`, rb.x + rb.w / 2, rb.y + 23, 16, rr > 0 ? "#1d1622" : "#8a7aa8", "center", rr > 0 ? UI.COL.cyan : "#4a3d60");
    const ok = ch.sel != null;
    UI.btn(g, cb.x, cb.y, cb.w, cb.h, ok ? UI.COL.orange : "#4a3d60");
    text(g, ok ? "이 강화 고르기" : "카드를 눌러 고르기", cb.x + cb.w / 2, cb.y + 23, ok ? 20 : 16, ok ? "#1d1622" : "#b9add0", "center", ok ? UI.COL.orange : "#4a3d60");
    RD.choiceBtns = { reroll: rb, confirm: cb };
  }

  // ---------- 지형 효과 그리기 ----------
  function drawHazards(g, run) {
    for (const h of run.hazards) {
      const warn = h.t < h.warn, on = !warn && h.t < h.warn + h.active;
      if (h.circle) {
        // 레이드: 원형 장판 (예고 → 폭발)
        const col = h.type === "lava" ? (h.quake ? "160,110,60" : "255,90,20") : h.type === "bolt" ? "255,230,107" : h.type === "flame" ? "255,90,20" : "140,220,80";
        if (warn) {
          const k = h.t / h.warn;
          g.fillStyle = `rgba(${col},0.18)`; g.beginPath(); g.arc(h.x, h.y, h.r, 0, Math.PI * 2); g.fill();
          g.strokeStyle = `rgba(${col},0.9)`; g.lineWidth = 3; g.beginPath(); g.arc(h.x, h.y, h.r, 0, Math.PI * 2); g.stroke();
          g.fillStyle = `rgba(${col},0.35)`; g.beginPath(); g.arc(h.x, h.y, h.r * k, 0, Math.PI * 2); g.fill();
        } else if (on) {
          g.fillStyle = `rgba(${col},0.75)`; g.beginPath(); g.arc(h.x, h.y, h.r, 0, Math.PI * 2); g.fill();
          g.fillStyle = "rgba(255,255,255,0.6)"; g.beginPath(); g.arc(h.x, h.y, h.r * 0.45, 0, Math.PI * 2); g.fill();
        }
        continue;
      }
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
        } else if (!h.landed && h.x != null && h.hail) {
          g.fillStyle = "rgba(220,240,255,0.4)"; g.beginPath(); g.arc(h.x, h.y, h.r * 1.3, 0, Math.PI * 2); g.fill();
          g.fillStyle = "#dff4ff"; g.beginPath(); g.arc(h.x, h.y, h.r, 0, Math.PI * 2); g.fill();
          g.fillStyle = "#9fc8e8"; g.beginPath(); g.arc(h.x + h.r * 0.25, h.y + h.r * 0.25, h.r * 0.55, 0, Math.PI * 2); g.fill();
          g.fillStyle = "#ffffff"; g.fillRect(h.x - h.r * 0.5, h.y - h.r * 0.5, h.r * 0.4, h.r * 0.4);
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
      } else if (h.type === "flame") {
        // 심판의 불꽃이 붙은 땅
        const k = warn ? 0.2 + 0.15 * (Math.floor(h.t * 8) % 2) : on ? 0.55 : 0;
        g.fillStyle = `rgba(255,70,10,${k * 0.6})`; g.fillRect(h.x - h.w / 2, h.top, h.w, C.groundY - h.top);
        if (on) for (let i = 0; i < 10; i++) {
          const fx = h.x - h.w / 2 + ((i * 29) % h.w), fh = 30 + ((i * 17 + Math.floor(h.t * 12) * 13) % 50);
          g.fillStyle = i % 2 ? "#ffb347" : "#ff4d1a"; g.fillRect(fx, C.groundY - fh, 10, fh);
          g.fillStyle = "#ffe14d"; g.fillRect(fx + 3, C.groundY - fh * 0.5, 4, fh * 0.5);
        }
      } else if (h.type === "flood") {
        // 범람하는 피바다
        const k = warn ? 0 : Math.min(1, (h.t - h.warn) / 0.6) * (h.t > h.warn + h.active - 0.4 ? (h.warn + h.active - h.t) / 0.4 : 1);
        if (warn) { g.fillStyle = `rgba(80,140,255,${0.15 + 0.1 * (Math.floor(h.t * 8) % 2)})`; g.fillRect(0, C.groundY - h.level, C.width, h.level); text(g, "범람!", C.width / 2, C.groundY - h.level - 20, 22, "#9fd0ff", "center"); }
        else if (on || k > 0) {
          const top = C.groundY - h.level * Math.max(0, k);
          g.fillStyle = "rgba(120,10,30,0.6)"; g.fillRect(0, top, C.width, C.height - top);
          g.fillStyle = "rgba(255,120,140,0.5)";
          for (let x = 0; x < C.width; x += 24) g.fillRect(x, top + Math.sin(x * 0.05 + h.t * 6) * 5, 16, 4);
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
    if (run.terrain !== "dark" && run.terrain !== "t4" && !(run.blackout > 0)) return;
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
      if (run.judgFire > 0) {
        g.fillStyle = `rgba(255,70,10,${0.14 + 0.06 * Math.sin(run.t * 8)})`;
        g.fillRect(0, 0, C.width, C.height);
        text(g, `심판의 불꽃 ${Math.ceil(run.judgFire)}초 · 받는 피해 +30% · 회복 불가`, C.width / 2, 130, 12, "#ffb347", "center");
      }
      if (run.darkWind) {
        g.fillStyle = "rgba(20,0,30,0.3)"; g.fillRect(0, 0, C.width, C.height);
        g.fillStyle = "rgba(160,80,220,0.45)";
        for (let i = 0; i < 22; i++) g.fillRect(((i * 211 + run.t * run.darkWind.dir * 1100) % C.width + C.width) % C.width, (i * 29) % C.height, 110, 3);
        text(g, run.darkWind.dir > 0 ? "어두운 바람 →" : "← 어두운 바람", C.width / 2, 160, 22, "#c890ff", "center");
      }
      if (run.tr === 6) {
        // 세상의 종말: 하늘이 갈라지고 금이 간다 (천사를 쓰러뜨릴수록 더)
        const no = run.ev.angelNo || 0;
        g.fillStyle = `rgba(40,0,0,${0.25 + no * 0.04 + 0.05 * Math.sin(run.t * 3)})`;
        g.fillRect(0, 0, C.width, C.height);
        g.strokeStyle = "rgba(255,220,180,0.55)"; g.lineWidth = 2;
        for (let k = 0; k < 4 + no * 2; k++) {
          let x = (k * 211) % C.width, y = 0;
          g.beginPath(); g.moveTo(x, y);
          for (let q = 0; q < 6; q++) { x += ((k * 37 + q * 53) % 60) - 30; y += 40 + ((k + q) % 3) * 15; g.lineTo(x, y); }
          g.stroke();
        }
        g.fillStyle = "rgba(255,120,60,0.8)";
        for (let k = 0; k < 20; k++) g.fillRect(((k * 97 + run.t * 30) % C.width), ((k * 53 + run.t * (80 + k * 5)) % C.height), 3, 3);
        text(g, "종말: 회복 절반 · 자연 회복 없음", C.width / 2, 130, 12, "#ff8a8a", "center");
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

  // ---------- 레이드: 브롤스타즈식 UI ----------
  RD.ATK_BTN = { x: C.width - 105, y: C.height - 110, r: 62 };
  RD.SUP_BTN = { x: C.width - 225, y: C.height - 70, r: 44 };
  RD.brawlUI = { move: null, atk: null, sup: null, mouse: null };
  function drawBrawl(g, run) {
    const B = run.brawl, p = run.player, U = RD.brawlUI;
    if (!B || p.dead > 0) return;
    // 조준 미리보기 (조준 스틱을 끄는 중이거나 마우스)
    const aiming = U.atk && U.atk.drag > 22 ? U.atk : U.sup && U.sup.drag > 22 ? U.sup : null;
    let ang = aiming ? aiming.ang : U.mouse ? Math.atan2(U.mouse.y - p.y, U.mouse.x - p.x) : null;
    if (ang != null) {
      const sup = aiming === U.sup;
      const W = RD.BRAWL[run.charId];
      const len = run.charId === "fox" ? W.range * (1 + run.bst("range")) : run.charId === "bear" ? W.dist : 420;
      g.save();
      g.strokeStyle = sup ? "rgba(255,211,77,0.7)" : "rgba(255,255,255,0.55)";
      g.fillStyle = sup ? "rgba(255,211,77,0.15)" : "rgba(255,255,255,0.12)";
      g.lineWidth = 3; g.setLineDash([10, 8]);
      if (run.charId === "fox" && !sup) { g.beginPath(); g.moveTo(p.x, p.y); g.arc(p.x, p.y, len, ang - W.arc, ang + W.arc); g.closePath(); g.fill(); g.stroke(); }
      else { g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x + Math.cos(ang) * len, p.y + Math.sin(ang) * len); g.stroke();
        if (run.charId === "bear" && !sup) { g.beginPath(); g.arc(p.x + Math.cos(ang) * len, Math.min(C.groundY - 10, p.y + Math.sin(ang) * len), W.radius * (1 + run.bst("size")), 0, Math.PI * 2); g.fill(); } }
      g.restore();
    }
    // 탄환 칸 (캐릭터 아래)
    const max = run.brawlMaxAmmo, w = 20;
    for (let i = 0; i < max; i++) {
      const x = p.x - (max * (w + 3)) / 2 + i * (w + 3), y = p.y + 40;
      g.fillStyle = "#1d1622"; g.fillRect(x - 1, y - 1, w + 2, 8);
      const f = Math.max(0, Math.min(1, B.ammo - i));
      g.fillStyle = f >= 1 ? "#ff8a3d" : "#7a4a2a"; g.fillRect(x, y, w * f, 6);
    }
    // 터치 조이스틱과 버튼
    if (matchMedia("(pointer: coarse)").matches) {
      // 도트 원 조이스틱
      const stick = (cx, cy, r, s, col, label, ready, iconName) => {
        if (ready) { g.globalAlpha = 0.25 + 0.15 * Math.sin(run.t * 8); g.fillStyle = col; g.beginPath(); g.arc(cx, cy, r + 10, 0, Math.PI * 2); g.fill(); }
        g.globalAlpha = 0.55; g.fillStyle = RD.UI.shade(col, 0.35); g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
        g.strokeStyle = "#1d1622"; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
        const kx = s ? cx + Math.cos(s.ang) * Math.min(r * 0.6, s.drag) : cx, ky = s ? cy + Math.sin(s.ang) * Math.min(r * 0.6, s.drag) : cy, kr = r * 0.42;
        g.fillStyle = "#1d1622"; g.beginPath(); g.arc(kx, ky, kr + 3, 0, Math.PI * 2); g.fill();
        g.fillStyle = col; g.beginPath(); g.arc(kx, ky, kr, 0, Math.PI * 2); g.fill();
        g.fillStyle = "rgba(0,0,0,0.2)"; g.beginPath(); g.arc(kx, ky + 3, kr - 3, 0.15 * Math.PI, 0.85 * Math.PI); g.fill();
        RD.UI.icon(g, iconName, kx - kr * 0.5, ky - kr * 0.5, kr, "#fff");
        text(g, label, cx, cy + r + 13, 12, ready ? "#ffd34d" : "#fff", "center");
      };
      if (U.move) {
        g.globalAlpha = 0.5; g.fillStyle = "#3a2d48"; g.beginPath(); g.arc(U.move.ox, U.move.oy, 60, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
        g.strokeStyle = "#1d1622"; g.lineWidth = 3; g.beginPath(); g.arc(U.move.ox, U.move.oy, 60, 0, Math.PI * 2); g.stroke();
        const mx = U.move.ox + U.move.dx * 50, my = U.move.oy + U.move.dy * 50;
        g.fillStyle = "#1d1622"; g.beginPath(); g.arc(mx, my, 25, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#b9b0c8"; g.beginPath(); g.arc(mx, my, 22, 0, Math.PI * 2); g.fill();
      }
      stick(RD.ATK_BTN.x, RD.ATK_BTN.y, RD.ATK_BTN.r, U.atk, B.ammo >= 1 ? "#ff8a3d" : "#7a4a2a", "공격 (끌어서 조준)", false, "sword");
      const ready = run.superReady;
      stick(RD.SUP_BTN.x, RD.SUP_BTN.y, RD.SUP_BTN.r, U.sup, ready ? "#ffd34d" : "#5a4a30", ready ? "궁극기 준비 완료" : `궁극기 ${Math.floor(B.charge * 100)}%`, ready, "bolt");
    }
  }

  // 파티 동료: 각자 화면에서 싸우는 동료의 위치를 반투명하게 보여 준다
  function drawPartyGhosts(g, run) {
    const O = RD.online;
    let total = run.score, k = 0;
    for (const p of run.party.st.peers) {
      if (p.sameTab || !p.presence || p.presence.x == null || !p.presence.inGame) continue;
      const pr = p.presence, pic = RD.playerPic(pr.ch, Math.floor(run.t * 6) % 2);
      g.globalAlpha = 0.5;
      if (pic) { const hh = 70, ww = pic.width * hh / pic.height; g.imageSmoothingEnabled = true; g.drawImage(pic, pr.x - ww / 2, pr.y - hh / 2 - 4, ww, hh); g.imageSmoothingEnabled = false; }
      g.globalAlpha = 1;
      text(g, p.by && O ? O.nameOf(p.by) : "동료", pr.x, pr.y - 48, 10, "#7fe6ff", "center");
      g.fillStyle = "#1d1622"; g.fillRect(pr.x - 20, pr.y - 40, 40, 5);
      g.fillStyle = "#7fe6ff"; g.fillRect(pr.x - 19, pr.y - 39, 38 * Math.max(0, (pr.hp || 0) / (pr.maxHp || 1)), 3);
      total += pr.score || 0; k++;
    }
    RD.UI.chip(g, C.width / 2 - 90, C.height - 30, 180, 18, "#7fe6ff", `파티 ${k + 1}명 · 합계 ${total.toLocaleString()}`, 10);
  }

  RD.drawRun = function (g, run) {
    g.save();
    if (run.shake > 0) g.translate((Math.random() - 0.5) * 12 * run.shake * 2, (Math.random() - 0.5) * 10 * run.shake * 2);
    if (run.raid) drawArena(g, run); else drawBackground(g, run.scroll, run.stage);
    drawUltBack(g, run);
    drawItems(g, run);
    drawEnemies(g, run);
    drawShots(g, run);
    drawPlayer(g, run);
    if (run.party && run.party.st) drawPartyGhosts(g, run);
    drawEffects(g, run);
    drawUltFront(g, run);
    drawDarkness(g, run);
    drawHazards(g, run);
    drawBullets(g, run);
    drawWeather(g, run);
    drawBrawl(g, run);
    g.restore();
    drawIntro(g, run);
    drawHud(g, run);
  };
})();
