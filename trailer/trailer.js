// Rundot 트레일러: 게임 엔진으로 실제 플레이 화면을 돌리고, 광대 개구리 빌런 이야기로 엮는다.
// RD.trailer.frame(i) 로 i 번째 프레임(30fps)을 그린다 (녹화 도구가 순서대로 부른다).
// RD.trailer.music() 은 같은 길이의 배경음악을 만들어 WAV(base64)로 돌려준다.
(function () {
  const C = RD.CONFIG, FPS = 30, DUR = 80;
  const cv = document.getElementById("game");
  cv.width = C.width; cv.height = C.height;
  const g = cv.getContext("2d");
  g.imageSmoothingEnabled = false;
  const W = C.width, H = C.height, UI = RD.UI;

  // ---------- 이미지 ----------
  const images = {};
  RD.img = (n) => images[n];
  const names = [...RD.IMAGES, ...RD.ILLUSTS];
  const ready = Promise.all(names.map((n) => new Promise((res) => {
    const im = new Image();
    im.onload = res; im.onerror = res;
    im.src = (n.startsWith("illust_") ? "../assets/raw/" : "../assets/game/") + n + ".png";
    images[n] = im;
  })));
  const ok = (im) => im && im.complete && im.naturalWidth;

  // ---------- 도구 ----------
  const T = (s, x, y, size, color = "#fff", align = "left", stroke) => RD.text(g, s, x, y, size, color, align, stroke);
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const ease = (k) => 1 - Math.pow(1 - clamp(k), 3);
  const fadeIO = (lt, len, f = 0.4) => Math.min(clamp(lt / f), clamp((len - lt) / f));
  function black(a) { if (a <= 0) return; g.fillStyle = `rgba(0,0,0,${clamp(a)})`; g.fillRect(0, 0, W, H); }
  function imgFit(im, cx, cy, h, alpha = 1, smooth = true) {
    if (!ok(im)) return;
    const w = im.width * h / im.height;
    g.save(); g.globalAlpha = alpha; g.imageSmoothingEnabled = smooth;
    g.drawImage(im, cx - w / 2, cy - h / 2, w, h); g.restore();
  }
  function imgCover(im, alpha = 1, zoom = 1, ox = 0, oy = 0) {
    if (!ok(im)) return;
    const s = Math.max(W / im.width, H / im.height) * zoom, w = im.width * s, h = im.height * s;
    g.save(); g.globalAlpha = alpha; g.imageSmoothingEnabled = true;
    g.drawImage(im, (W - w) / 2 + ox, (H - h) / 2 + oy, w, h); g.restore();
  }
  // 아래쪽 자막 띠
  function caption(s, a, color = "#fff", size = 22) {
    if (a <= 0) return;
    g.save(); g.globalAlpha = a;
    g.fillStyle = "rgba(10,6,20,0.72)"; g.fillRect(0, H - 86, W, 60);
    T(s, W / 2, H - 56, size, color, "center");
    g.restore();
  }
  // 왼쪽 위 모드 이름
  function modeTag(name, sub, a, col) {
    if (a <= 0) return;
    g.save(); g.globalAlpha = a;
    const x = 30 - (1 - a) * 60;
    g.fillStyle = "#1d1622"; g.fillRect(x - 4, 402, 344, 82);
    g.fillStyle = col; g.fillRect(x, 406, 336, 74);
    g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(x, 470, 336, 10);
    T(name, x + 18, 432, 30, "#1d1622", "left", col);
    T(sub, x + 18, 462, 14, "#1d1622", "left", col);
    g.restore();
  }
  function letterbox(k) { g.fillStyle = "#000"; g.fillRect(0, 0, W, 46 * k); g.fillRect(0, H - 46 * k, W, 46 * k); }
  function shake(amt) { g.translate((Math.random() - 0.5) * amt, (Math.random() - 0.5) * amt); }
  function curtains(open) {
    const w = (W / 2) * (1 - open);
    for (const side of [0, 1]) {
      const x = side ? W - w : 0;
      g.fillStyle = "#7a1428"; g.fillRect(x, 0, w, H);
      for (let i = 0; i < w; i += 26) { g.fillStyle = "#5a0c1c"; g.fillRect(x + i + 4, 0, 9, H); g.fillStyle = "#9a2038"; g.fillRect(x + i + 14, 0, 5, H); }
      g.fillStyle = "#ffd34d"; g.fillRect(side ? x : x + w - 6, 0, 6, H);
    }
    g.fillStyle = "#5a0c1c"; g.fillRect(0, 0, W, 34);
    for (let x = 0; x < W; x += 40) { g.fillStyle = "#7a1428"; g.beginPath(); g.arc(x + 20, 34, 20, 0, Math.PI); g.fill(); }
    g.fillStyle = "#ffd34d"; g.fillRect(0, 32, W, 3);
  }
  function spotlight(x, y, r, a) {
    g.save();
    const gr = g.createRadialGradient(x, y, 10, x, y, r);
    gr.addColorStop(0, `rgba(255,240,200,${0.35 * a})`); gr.addColorStop(1, "rgba(255,240,200,0)");
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.fillStyle = `rgba(255,240,200,${0.08 * a})`;
    g.beginPath(); g.moveTo(x - 30, 0); g.lineTo(x + 30, 0); g.lineTo(x + r * 0.8, y + r * 0.4); g.lineTo(x - r * 0.8, y + r * 0.4); g.fill();
    g.restore();
  }
  // 흩날리는 카드
  function cards(t, n, cx, cy, spread, a) {
    g.save(); g.globalAlpha = a;
    for (let i = 0; i < n; i++) {
      const an = i * 2.4 + t * (1 + (i % 3) * 0.3), r = spread * (0.4 + ((i * 37) % 60) / 100);
      const x = cx + Math.cos(an) * r, y = cy + Math.sin(an * 1.3) * r * 0.6;
      g.save(); g.translate(x, y); g.rotate(an * 2);
      g.fillStyle = "#1d1622"; g.fillRect(-9, -12, 18, 24);
      g.fillStyle = "#fff"; g.fillRect(-7, -10, 14, 20);
      g.fillStyle = i % 2 ? "#ff3048" : "#1d1622"; g.fillRect(-2, -3, 4, 6);
      g.restore();
    }
    g.restore();
  }
  function hahaha(t, x, y, a) {
    const s = ["히", "히", "히", "히", "!"];
    g.save(); g.globalAlpha = a;
    s.forEach((c, i) => T(c, x + i * 34 - 68, y + Math.sin(t * 14 + i) * 8, 34 + (i === 4 ? 6 : 0), "#ff5ad8", "center", "#1d1622"));
    g.restore();
  }

  // ---------- 플레이 장면 (실제 게임 엔진) ----------
  function play(charId, mode, opts = {}, prep = {}) {
    let run;
    if (mode === "adventure") {
      run = new RD.AdvRun(charId);
      Object.assign(run, { isAdv: true, mode, D: RD.DIFFICULTY.normal, M: RD.MODES.adventure, stage: RD.STAGES[0] });
    } else run = new RD.Run(charId, mode, opts.diff || "normal", opts);
    if (prep.setup) prep.setup(run);
    run._bot = { t: 0, j: 0 };
    for (let i = 0; i < (prep.warm || 0) * 30; i++) step(run, 1 / 30);
    if (prep.after) prep.after(run);
    return run;
  }
  function step(run, dt) {
    const b = run._bot; b.t += dt;
    if (run.isAdv) {
      run.hp = 9999; run.player.invuln = 1;
      if ((b.j -= dt) <= 0) { b.j = 0.55 + Math.random() * 0.5; run.jump(); if (Math.random() < 0.5) setTimeout(() => {}, 0); }
      run.update(dt); return;
    }
    if (run.choosing) { run.choose(0); return; }
    const p = run.player;
    p.invuln = Math.max(p.invuln, 0.2); p.hp = Math.max(p.hp, run.maxHp * 0.6);
    if (run.raid) {
      const tg = run.enemies.find((e) => (e.raidBoss || e.rival) && !e.dead) || run.enemies.find((e) => !e.dead);
      if (tg) {
        const a = Math.atan2(p.y - tg.y, p.x - tg.x) + Math.sin(b.t * 0.8) * 0.9, want = run.charId === "fox" ? 130 : 270;
        run.input.moveX = (tg.x + Math.cos(a) * want - p.x) * 0.06; run.input.moveY = (tg.y + Math.sin(a) * want - p.y) * 0.06;
        if (run.brawl.ammo >= 1) run.brawlAttack(Math.atan2(tg.y - p.y, tg.x - p.x));
        if (run.superReady && b.t > 1) run.brawlSuper();
      }
    } else {
      // 위아래로 움직이며 앞쪽 적을 노린다
      const tg = run.enemies.filter((e) => !e.dead && e.x > p.x).sort((a, c) => a.x - c.x)[0];
      const ty = tg ? tg.y : 260 + Math.sin(b.t * 1.3) * 120, tx = 180 + Math.sin(b.t * 0.7) * 60;
      run.input.moveX = (tx - p.x) * 0.08; run.input.moveY = (ty - p.y) * 0.06;
    }
    run.update(dt);
    run.banner = null; run.intro = null;
  }
  function drawRun(run) { if (run.isAdv) RD.drawAdv(g, run); else RD.drawRun(g, run); }

  // ---------- 장면 표 ----------
  // [시작, 끝, 준비(), 그리기(lt, len, t)]
  const heroes = [
    ["fox", "여우 견습기사", "검으로 탄을 베는 견습기사"], ["rabbit", "토끼 도적", "그림자처럼 빠른 도적"], ["bear", "곰 대장장이", "망치 한 방의 대장장이"],
    ["owl", "부엉이 비행사", "회오리를 부르는 비행사"], ["cat", "고양이 마법사", "별을 부르는 마법사"], ["panda", "판다 정령술사", "숲의 정령과 함께 싸운다"], ["mech", "다람쥐 메카닉", "진화하는 메카의 조종사"],
  ];
  let runs = {};
  const S = [
    // 1. 극장의 막이 오른다
    [0, 7.5, null, (lt, len, t) => {
      g.fillStyle = "#08040c"; g.fillRect(0, 0, W, H);
      const open = ease((lt - 1.2) / 2.2);
      spotlight(W / 2, 300, 300, clamp((lt - 2) / 1));
      imgFit(RD.img("illust_frog"), W / 2, 290, 420 * (1 + lt * 0.01), clamp((lt - 2.3) / 1));
      curtains(open);
      letterbox(1);
      caption("어느 날 밤, 숲속 극장에 막이 올랐다", fadeIO(lt - 0.3, 3.6));
      if (lt > 4.3) { g.save(); shake(4); hahaha(t, W / 2, 110, clamp((lt - 4.3) * 3)); g.restore(); caption("\"히히히… 쇼타임이다!\"", fadeIO(lt - 4.3, 3.2), "#ff9ad8", 26); }
    }],
    // 2. 광대가 미쳐 날뛴다
    [7.5, 14.5, null, (lt, len, t) => {
      g.fillStyle = "#12060e"; g.fillRect(0, 0, W, H);
      // 빨간 빛 깜빡임
      if (Math.floor(lt * 8) % 4 === 0) { g.fillStyle = "rgba(255,40,80,0.15)"; g.fillRect(0, 0, W, H); }
      g.save(); shake(lt < 1 ? 10 : 3);
      const fr = RD.img(`player_frog_awake_${lt < 3 ? 0 : 2}`);
      cards(t, 22, W / 2, 250, 340, 1);
      imgFit(fr, W / 2, 260, 300 + Math.sin(t * 6) * 8, 1, true);
      g.restore();
      // 괴물들이 튀어나온다
      const mons = ["boss_bat_0", "mon_golem_0", "boss_fire_0", "mon_eye_0", "boss_frost_0", "mon_bomber_0", "boss_storm_0", "mon_beetle_0", "boss_crystal_0", "mon_fairy_0"];
      mons.forEach((n, i) => {
        const k = clamp((lt - 2.2 - i * 0.28) / 1.6); if (k <= 0 || k >= 1) return;
        const an = i * 2.1 + 0.5, d = 60 + k * 620;
        imgFit(RD.img(n), W / 2 + Math.cos(an) * d, 260 + Math.sin(an) * d * 0.6, 60 + k * 220, 1 - k * 0.3);
      });
      letterbox(1);
      caption("\"관객은… 너희 모두야!!\"", fadeIO(lt - 0.2, 2.5), "#ff9ad8", 26);
      caption("미치광이 광대가 숲의 괴물들을 무대 밖으로 풀어놓았다", fadeIO(lt - 3, 3.8));
    }],
    // 3. 영웅들
    [14.5, 24, null, (lt) => {
      g.fillStyle = "#0c0a18"; g.fillRect(0, 0, W, H);
      const per = 9.5 / heroes.length, i = Math.min(heroes.length - 1, Math.floor(lt / per)), k = (lt - i * per) / per;
      const [id, name, line] = heroes[i];
      imgCover(RD.img("illust_" + id), 0.35, 1.15, 0, 0);
      g.fillStyle = "rgba(12,10,24,0.55)"; g.fillRect(0, 0, W, H);
      imgFit(RD.img("illust_" + id), W * 0.36 + (1 - ease(k * 4)) * -200, 270, 400, ease(k * 4));
      const pic = RD.img(`player_${id}_2`);
      imgFit(pic, W * 0.78, 220, 150 + Math.sin(lt * 5) * 4, ease(k * 4));
      T(name, W * 0.78, 330, 30, "#ffd34d", "center");
      T(line, W * 0.78, 366, 16, "#fff", "center");
      T("막을 내릴 영웅들", 40, 76, 22, "#7fe6ff");
      letterbox(1);
    }],
    // 4. 모드 몽타주 (실제 플레이)
    [24, 28, () => { runs.a = play("fox", "story", { stars: 6 }, { warm: 22, setup: (r) => { r.up.multi = 3; r.up.dmg = 2; r.up.sig = 2; } }); }, (lt) => {
      step(runs.a, 1 / 30); drawRun(runs.a); modeTag("스토리", "5개 지역을 지나 폭풍 군주까지", fadeIO(lt, 4, 0.3), "#ff8a3d");
    }],
    [28, 32, () => { runs.b = play("mech", "stageselect", { stage: 2, diff: "hard" }, { warm: 8, setup: (r) => { r.tech.pts = 50; for (const t of RD.MECH_TECH) r.unlockTech(t.id); r.up.multi = 3; r.banner = null; } }); }, (lt) => {
      step(runs.b, 1 / 30); drawRun(runs.b); modeTag("메카 테크트리", "Mk.III · 화염방사 · 프리즘 레이저", fadeIO(lt, 4, 0.3), "#ffb347");
    }],
    [32, 36, () => { runs.c = play("cat", "raid", { raidBoss: "boss_frost" }, { warm: 6 }); }, (lt) => {
      step(runs.c, 1 / 30); drawRun(runs.c); modeTag("레이드", "직접 조준하는 보스 레이드", fadeIO(lt, 4, 0.3), "#c58aff");
    }],
    [36, 40, () => { runs.d = play("rabbit", "duel", { duel: { rival: "fox", aiLv: 3, name: "번개같은 라이벌" } }, { warm: 3 }); }, (lt) => {
      step(runs.d, 1 / 30); drawRun(runs.d); modeTag("1대1 결투", "온라인 대전 · 상대가 없으면 AI", fadeIO(lt, 4, 0.3), "#ff5ad8");
    }],
    [40, 44, () => { runs.e = play("panda", "dream", {}, { warm: 14, setup: (r) => { r.up.multi = 4; } }); }, (lt) => {
      step(runs.e, 1 / 30); drawRun(runs.e); modeTag("달콤한 꿈", "사탕을 모아 슈가 러시!", fadeIO(lt, 4, 0.3), "#ff9ad8");
    }],
    [44, 48, () => { runs.f = play("owl", "adventure", {}, { warm: 4 }); }, (lt) => {
      step(runs.f, 1 / 30); drawRun(runs.f); modeTag("어드벤처 런", "달리고 뛰고 미끄러지고", fadeIO(lt, 4, 0.3), "#7fe08a");
    }],
    [48, 51, () => {
      runs.g = ["cat", "bear", "owl"].map((id) => play(id, "story", { awakened: true, stars: 6 }, { warm: 9, setup: (r) => { r.up.multi = 3; } }));
    }, (lt) => {
      const i = Math.min(2, Math.floor(lt)), r = runs.g[i];
      step(r, 1 / 30); drawRun(r);
      const F = RD.AWAKEN.forms[r.charId];
      modeTag(F.name, `각성 · [${F.epithet}]`, clamp((lt - i) * 5), F.color);
      if ((lt - i) < 0.08) { g.fillStyle = "rgba(255,255,255,0.6)"; g.fillRect(0, 0, W, H); }
    }],
    // 5. 빌런의 반격
    [51, 58.5, null, (lt, len, t) => {
      g.fillStyle = "#050208"; g.fillRect(0, 0, W, H);
      const k = ease((lt - 1.6) / 1.2);
      g.save(); if (lt > 1.6) shake(14 * (1 - clamp((lt - 1.6) / 3)));
      imgCover(RD.img("illust_megafrog"), k, 1.05 + lt * 0.012, 0, 0);
      // 포효 고리
      for (let i = 0; i < 4; i++) { const r = ((lt * 300 + i * 120) % 520); g.strokeStyle = `rgba(159,255,106,${0.6 * k * (1 - r / 520)})`; g.lineWidth = 8; g.beginPath(); g.arc(W / 2, 220, r, 0, Math.PI * 2); g.stroke(); }
      g.restore();
      letterbox(1);
      caption("\"히히… 이 정도로는 막이 안 내려가지!\"", fadeIO(lt - 0.1, 1.8), "#ff9ad8", 24);
      if (lt > 2.8) { T("MEGA FROG", W / 2, 120, 64 * (0.8 + 0.2 * ease((lt - 2.8) * 3)), "#9fff6a", "center"); }
      caption("광대는 더 큰 괴물로 변했다", fadeIO(lt - 3.2, 3.6), "#9fff6a");
    }],
    // 6. 영웅들의 각성
    [58.5, 65, null, (lt) => {
      g.fillStyle = "#0a0614"; g.fillRect(0, 0, W, H);
      const order = ["fox", "rabbit", "bear", "owl", "cat", "panda", "mech"], per = 5.6 / order.length;
      const i = Math.min(order.length - 1, Math.floor(lt / per)), k = (lt - i * per) / per, id = order[i], F = RD.AWAKEN.forms[id];
      // 빛살
      g.save(); g.translate(W / 2, 250);
      for (let r = 0; r < 14; r++) { g.rotate(Math.PI / 7 + lt * 0.02); g.fillStyle = F.color; g.globalAlpha = 0.07; g.beginPath(); g.moveTo(0, 0); g.lineTo(700, -50); g.lineTo(700, 50); g.fill(); }
      g.restore();
      if (k < 0.12) { g.fillStyle = "rgba(255,255,255,0.7)"; g.fillRect(0, 0, W, H); }
      imgFit(RD.img(`player_${id}_2`), W / 2, 230, 230 * (0.9 + 0.1 * ease(k * 3)), 1);
      T("각성", W / 2, 70, 26, "#ff5ad8", "center");
      T(F.name, W / 2, 392, 34, "#fff", "center");
      T(`[${F.epithet}]`, W / 2, 430, 18, F.color, "center");
      letterbox(1);
      caption("하지만 영웅들도 각성한다", fadeIO(lt, 1.8));
    }],
    // 7. 다 함께: 월드보스
    [65, 71, () => { runs.h = play("fox", "raid", { raidBoss: "boss_fire", worldBoss: { season: 1, hp: 150000 }, awakened: true, stars: 6 }, { warm: 5 }); }, (lt) => {
      step(runs.h, 1 / 30); drawRun(runs.h);
      modeTag("월드보스", "모두가 함께 깎는 보스 체력", fadeIO(lt, 3, 0.3), "#ff4d5e");
      if (lt > 3) modeTag("파티 · 거래소 · 랭킹", "친구와 함께 막을 내려라", fadeIO(lt - 3, 3, 0.3), "#7fe6ff");
    }],
    // 8. 로고
    [71, 80, null, (lt, len, t) => {
      g.fillStyle = "#120c1c"; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,255,255,${0.2 + ((i * 7) % 10) / 20})`; g.fillRect((i * 97 + t * 20) % W, (i * 53) % H, 2, 2); }
      const k = ease(lt / 0.8);
      T("RUNDOT", W / 2, 180, 110 * (0.85 + 0.15 * k), "#ffd34d", "center");
      T("광대의 무대를 끝내러 가자", W / 2, 250, 22, "#fff", "center");
      const ids = ["fox", "rabbit", "bear", "owl", "cat", "panda", "mech"];
      ids.forEach((id, i) => imgFit(RD.img(`player_${id}_${Math.floor(t * 6 + i) % 2}`), W / 2 + (i - 3) * 110, 360 + Math.sin(t * 3 + i) * 6, 92, clamp((lt - 0.6 - i * 0.12) * 3)));
      if (lt < 6.2) { UI.btn(g, W / 2 - 130, 430, 260, 56, "#ff8a3d"); T("지금 플레이", W / 2, 455, 24, "#1d1622", "center", "#ff8a3d"); }
      // 쿠키: 광대가 다시 튀어나온다
      if (lt > 6.2) {
        g.fillStyle = "rgba(0,0,0,0.94)"; g.fillRect(0, 0, W, H);
        const pk = ease((lt - 6.2) * 3);
        imgFit(RD.img("player_frog_awake_0"), W - 160 * pk, H - 120, 220, 1);
        T("\"다음 공연도 기대해… 히히\"", W / 2 - 120, H / 2, 24, "#ff9ad8", "center");
        T("개구리 광대 · 신화 등급 · 플레이 가능", W / 2 - 120, H / 2 + 40, 14, "#b9add0", "center");
      }
      black(clamp((lt - 8.6) / 0.4));
    }],
  ];

  let cur = -1;
  function frame(i) {
    const t = i / FPS;
    const k = S.findIndex(([a, b]) => t >= a && t < b);
    const idx = k < 0 ? S.length - 1 : k;
    if (idx !== cur) { cur = idx; if (S[idx][2]) S[idx][2](); }
    const [a, b, , draw] = S[idx];
    g.save(); g.imageSmoothingEnabled = false;
    draw(t - a, b - a, t);
    g.restore();
    // 장면 사이 짧은 암전
    const edge = Math.min(t - a, b - t);
    if (edge < 0.12) black(1 - edge / 0.12);
  }

  // ---------- 배경음악 (오프라인 합성 → WAV) ----------
  async function music() {
    const SR = 44100, ctx = new OfflineAudioContext(2, SR * DUR, SR);
    const master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
    const noise = ctx.createBuffer(1, SR, SR); { const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);
    function tone(t, n, dur, { type = "square", vol = 0.1, slide = 0, attack = 0.005, release = 0.08, lp = 0 } = {}) {
      const o = ctx.createOscillator(), gn = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(hz(n), t);
      if (slide) o.frequency.exponentialRampToValueAtTime(hz(n) * slide, t + dur);
      gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(vol, t + attack); gn.gain.setValueAtTime(vol, t + Math.max(attack, dur - release)); gn.gain.linearRampToValueAtTime(0, t + dur);
      let node = o;
      if (lp) { const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = lp; o.connect(f); node = f; }
      node.connect(gn); gn.connect(master); o.start(t); o.stop(t + dur + 0.02);
    }
    function hit(t, { vol = 0.3, freq = 1000, dur = 0.1, type = "highpass" } = {}) {
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), gn = ctx.createGain();
      s.buffer = noise; f.type = type; f.frequency.value = freq;
      gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
      s.connect(f); f.connect(gn); gn.connect(master); s.start(t); s.stop(t + dur + 0.02);
    }
    const kick = (t, v = 0.6) => { tone(t, 40, 0.18, { type: "sine", vol: v, slide: 0.4, release: 0.12 }); };
    const snare = (t, v = 0.25) => { hit(t, { vol: v, freq: 1800, dur: 0.16 }); tone(t, 55, 0.08, { type: "triangle", vol: 0.12 }); };
    const hat = (t, v = 0.06) => hit(t, { vol: v, freq: 7000, dur: 0.04 });
    const boom = (t, v = 0.8) => { tone(t, 28, 1.2, { type: "sine", vol: v, slide: 0.5, release: 1 }); hit(t, { vol: 0.4, freq: 300, dur: 0.8, type: "lowpass" }); };
    // 1~2장: 소름 돋는 오르골 서커스 왈츠 (A 단조, 3박자)
    const waltz = [81, 80, 81, 76, 77, 76, 72, 74, 76, 69, 71, 72, 74, 72, 71, 68, 69, 0];
    const bt = 60 / 132;
    for (let i = 0; i < 40; i++) {
      const t = 0.6 + i * bt; if (t > 14.3) break;
      const n = waltz[i % waltz.length];
      if (n) tone(t, n, bt * 0.9, { type: "triangle", vol: t < 7.5 ? 0.07 : 0.1, release: 0.2 });
      if (t > 7.5) { if (i % 3 === 0) tone(t, i % 6 === 0 ? 45 : 40, bt * 0.8, { type: "square", vol: 0.12, lp: 600 }); else tone(t, i % 6 < 3 ? 57 : 52, bt * 0.5, { type: "square", vol: 0.05, lp: 1400 }); }
    }
    tone(0.2, 33, 7, { type: "sawtooth", vol: 0.05, lp: 200, attack: 2, release: 2 }); // 낮은 웅웅거림
    boom(7.5); boom(14.5, 0.6);
    // 광대 웃음 (높은 음이 미끄러진다)
    for (const base of [4.4, 7.8]) for (let i = 0; i < 4; i++) tone(base + i * 0.16, 84 - i, 0.13, { type: "square", vol: 0.05, slide: 1.25 });
    // 3장: 영웅 테마 (현악기처럼)
    const prog = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
    for (let bar = 0; bar < 5; bar++) {
      const t = 14.5 + bar * 1.9, ch = prog[bar % 4];
      for (const n of ch) tone(t, n, 1.9, { type: "sawtooth", vol: 0.035, lp: 1200, attack: 0.3, release: 0.4 });
      tone(t, ch[0] - 12, 1.9, { type: "triangle", vol: 0.12 });
    }
    for (let i = 0; i < 16; i++) snare(22 + i * 0.125, 0.06 + i * 0.012); // 스네어 롤
    // 4장: 달리는 비트 (150bpm)
    const b4 = 60 / 150, lead = [69, 72, 76, 74, 72, 69, 67, 69, 72, 74, 76, 79, 77, 76, 74, 72];
    const playDrive = (t0, t1, hi) => {
      for (let i = 0; ; i++) {
        const t = t0 + i * b4 / 2; if (t >= t1) break;
        const beat = i / 2, bar = Math.floor(beat / 4), ch = prog[bar % 4];
        if (i % 2 === 0) kick(t, 0.5);
        if (i % 4 === 2) snare(t);
        hat(t, i % 2 ? 0.05 : 0.03);
        tone(t, ch[0] - 12 + (i % 2 ? 12 : 0), b4 / 2 * 0.9, { type: "square", vol: 0.07, lp: 900 });
        if (i % 2 === 0) { const n = lead[(i / 2) % lead.length] + (hi ? 12 : 0); tone(t, n, b4 * 0.85, { type: "square", vol: 0.045, lp: 3000 }); }
      }
    };
    playDrive(24, 51, false);
    for (const t of [28, 32, 36, 40, 44, 48, 49, 50]) hit(t, { vol: 0.25, freq: 4000, dur: 0.6 }); // 장면 전환 심벌
    // 5장: 메가 프로그 (무거운 타격)
    boom(51); boom(52.6, 0.9); boom(53.4);
    for (let i = 0; i < 8; i++) tone(53.4 + i * 0.6, 33, 0.5, { type: "sawtooth", vol: 0.12, lp: 300 });
    for (let i = 0; i < 4; i++) tone(52 + i * 0.2, 86 - i, 0.16, { type: "square", vol: 0.05, slide: 1.3 });
    // 6장: 각성 (올라가는 아르페지오)
    for (let i = 0; i < 26; i++) { const t = 58.5 + i * 0.25; tone(t, 57 + [0, 3, 7, 12, 15, 19][i % 6] + Math.floor(i / 6) * 2, 0.24, { type: "triangle", vol: 0.07 }); if (i % 4 === 0) kick(t, 0.4); }
    // 7장: 다시 달린다 (한 옥타브 위)
    playDrive(65, 71, true);
    // 8장: 로고 화음
    boom(71, 0.7);
    for (const n of [57, 64, 69, 72, 76]) tone(71, n, 5.5, { type: "sawtooth", vol: 0.04, lp: 2000, attack: 0.05, release: 3 });
    for (let i = 0; i < 4; i++) tone(77.3 + i * 0.15, 84 - i, 0.12, { type: "square", vol: 0.05, slide: 1.25 }); // 마지막 웃음
    const buf = await ctx.startRendering();
    // WAV 로
    const n = buf.length, out = new DataView(new ArrayBuffer(44 + n * 4));
    const wr = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
    wr(0, "RIFF"); out.setUint32(4, 36 + n * 4, true); wr(8, "WAVE"); wr(12, "fmt "); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 2, true);
    out.setUint32(24, SR, true); out.setUint32(28, SR * 4, true); out.setUint16(32, 4, true); out.setUint16(34, 16, true); wr(36, "data"); out.setUint32(40, n * 4, true);
    const L = buf.getChannelData(0), R = buf.getChannelData(1);
    for (let i = 0; i < n; i++) { out.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true); out.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true); }
    const bytes = new Uint8Array(out.buffer); let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }

  RD.trailer = { ready, frame, music, FPS, DUR, frames: FPS * DUR };
  // 그냥 열면 실시간으로 재생
  ready.then(() => {
    if (location.hash === "#record") return;
    let i = 0, t0 = performance.now();
    const loop = () => { const want = Math.floor((performance.now() - t0) / 1000 * FPS); while (i <= want && i < FPS * DUR) frame(i++); if (i < FPS * DUR) requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  });
})();
