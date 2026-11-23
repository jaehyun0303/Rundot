// 소리: 음악 파일 없이 Web Audio 로 칩튠 효과음과 배경음악을 만든다.
// 브라우저 정책 때문에 첫 터치/키 입력 뒤에 소리가 켜진다.
(function () {
  let ctx = null, master, musicGain, sfxGain, noiseBuf;
  let muted = false;
  try { muted = localStorage.getItem("rundot_muted") === "1"; } catch { /* 저장 불가 */ }
  const last = {}; // 효과음 연타 방지

  function init() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.8;
    master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.32; musicGain.connect(master);
    sfxGain = ctx.createGain(); sfxGain.gain.value = 0.55; sfxGain.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (wanted) startMusic(wanted, true);
  }

  // ---------- 소리 재료 ----------
  const hz = (n) => 440 * Math.pow(2, (n - 69) / 12); // MIDI 번호 → 주파수

  function tone(freq, dur, { type = "square", vol = 0.2, slide = 0, at = 0, out = sfxGain, attack = 0.005 } = {}) {
    if (!ctx) return;
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noise(dur, { vol = 0.2, freq = 2000, q = 1, type = "bandpass", slide = 0, at = 0, out = sfxGain } = {}) {
    if (!ctx) return;
    const t = ctx.currentTime + at;
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf;
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(out);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  }

  // ---------- 효과음 ----------
  const SFX = {
    click: () => tone(880, 0.06, { vol: 0.15 }),
    shot_fox: () => noise(0.08, { vol: 0.09, freq: 5000, slide: 0.4, q: 3 }),
    shot_rabbit: () => tone(1600, 0.04, { vol: 0.05, slide: 0.7 }),
    shot_bear: () => tone(180, 0.1, { type: "triangle", vol: 0.18, slide: 0.5 }),
    shot_owl: () => noise(0.25, { vol: 0.07, freq: 900, slide: 1.8, q: 2 }),
    shot_cat: () => tone(1320, 0.07, { type: "sine", vol: 0.06, slide: 1.3 }),
    explode_small: () => noise(0.18, { vol: 0.16, freq: 1400, slide: 0.3, type: "lowpass" }),
    hit: () => noise(0.04, { vol: 0.05, freq: 3000, q: 4 }),
    kill: () => { noise(0.2, { vol: 0.14, freq: 1800, slide: 0.25, type: "lowpass" }); tone(440, 0.12, { vol: 0.06, slide: 0.4 }); },
    boom: () => { noise(0.9, { vol: 0.35, freq: 900, slide: 0.1, type: "lowpass" }); tone(110, 0.6, { type: "triangle", vol: 0.3, slide: 0.3 }); },
    hurt: () => { tone(320, 0.25, { type: "sawtooth", vol: 0.16, slide: 0.35 }); noise(0.15, { vol: 0.12, freq: 600 }); },
    die: () => { tone(500, 0.8, { type: "sawtooth", vol: 0.18, slide: 0.15 }); noise(0.8, { vol: 0.25, freq: 700, slide: 0.2, type: "lowpass" }); },
    coin: () => { tone(1568, 0.05, { vol: 0.06 }); tone(2093, 0.08, { vol: 0.06, at: 0.04 }); },
    heal: () => [60, 64, 67, 72].forEach((n, i) => tone(hz(n + 12), 0.1, { type: "triangle", vol: 0.12, at: i * 0.05 })),
    power: () => [60, 64, 67, 72, 76].forEach((n, i) => tone(hz(n + 12), 0.08, { vol: 0.1, at: i * 0.04 })),
    levelup: () => [67, 72, 76, 79, 84].forEach((n, i) => tone(hz(n), 0.14, { vol: 0.13, at: i * 0.07 })),
    choose: () => { tone(hz(84), 0.08, { vol: 0.12 }); tone(hz(91), 0.16, { vol: 0.12, at: 0.06 }); },
    parry: () => { tone(2400, 0.12, { type: "triangle", vol: 0.12 }); tone(3600, 0.08, { type: "sine", vol: 0.06 }); },
    warning: () => { for (let i = 0; i < 4; i++) { tone(660, 0.28, { type: "sawtooth", vol: 0.13, at: i * 0.6 }); tone(440, 0.28, { type: "sawtooth", vol: 0.13, at: i * 0.6 + 0.3 }); } },
    clear: () => [72, 76, 79, 84, 79, 84, 88].forEach((n, i) => tone(hz(n), 0.18, { vol: 0.14, at: i * 0.1 })),
    gameover: () => [67, 63, 60, 55].forEach((n, i) => tone(hz(n), 0.35, { type: "triangle", vol: 0.16, at: i * 0.25 })),
    // 궁극기
    ult_fox: () => { noise(0.3, { vol: 0.25, freq: 6000, slide: 0.2, q: 2 }); tone(2600, 0.6, { type: "triangle", vol: 0.12, at: 0.4 }); noise(0.4, { vol: 0.3, freq: 3000, slide: 0.1, at: 0.42 }); },
    ult_rabbit: () => { noise(0.5, { vol: 0.18, freq: 400, slide: 4 }); for (let i = 0; i < 12; i++) tone(1800 + i * 80, 0.04, { vol: 0.04, at: 0.2 + i * 0.2 }); },
    ult_bear: () => { tone(70, 1.2, { type: "triangle", vol: 0.4, slide: 0.5 }); for (let i = 0; i < 8; i++) noise(0.3, { vol: 0.25, freq: 500, type: "lowpass", at: 0.1 + i * 0.1 }); },
    ult_owl: () => { noise(3.4, { vol: 0.22, freq: 300, slide: 6, q: 3 }); noise(3.4, { vol: 0.12, freq: 1200, slide: 0.5, q: 5 }); },
    ult_cat: () => { [72, 76, 79, 83, 86, 91].forEach((n, i) => tone(hz(n), 0.4, { type: "sine", vol: 0.1, at: i * 0.08 })); for (let i = 0; i < 10; i++) tone(hz(96 - (i % 5) * 2), 0.15, { type: "sine", vol: 0.05, at: 0.6 + i * 0.22 }); },
    shield: () => [79, 84, 88].forEach((n, i) => tone(hz(n), 0.12, { type: "sine", vol: 0.08, at: i * 0.05 })),
    shieldbreak: () => { tone(1800, 0.25, { type: "triangle", vol: 0.14, slide: 0.4 }); noise(0.2, { vol: 0.12, freq: 4000, q: 2 }); },
    // 나팔: 떨림이 있는 금관 소리 (세 음을 길게)
    trumpet: () => [[67, 0, 0.5], [72, 0.45, 0.5], [79, 0.9, 1.4]].forEach(([n, at, d]) => {
      tone(hz(n), d, { type: "sawtooth", vol: 0.16, at, attack: 0.05 });
      tone(hz(n) * 1.005, d, { type: "square", vol: 0.06, at, attack: 0.05 });
    }),
    gacha: () => [60, 64, 67, 72].forEach((n, i) => tone(hz(n), 0.12, { vol: 0.1, at: i * 0.06 })),
    gacha_rare: () => [72, 76, 79, 84, 88, 91].forEach((n, i) => tone(hz(n), 0.25, { type: "triangle", vol: 0.14, at: i * 0.07 })),
  };
  const MIN_GAP = { hit: 0.05, coin: 0.06, kill: 0.04, explode_small: 0.05, shot_rabbit: 0.06, shot_cat: 0.09, shot_fox: 0.1, shot_owl: 0.3, shot_bear: 0.12, parry: 0.06 };

  function sfx(name) {
    if (!ctx || muted || !SFX[name]) return;
    const now = ctx.currentTime;
    if (MIN_GAP[name] && now - (last[name] || 0) < MIN_GAP[name]) return;
    last[name] = now;
    SFX[name]();
  }

  // ---------- 배경음악 (단순한 스텝 시퀀서) ----------
  // 각 곡: 템포, 베이스와 멜로디 (MIDI 번호, 0 = 쉼), 드럼 (k 킥, s 스네어, h 하이햇)
  const TRACKS = {
    menu: {
      bpm: 96,
      bass: [45, 0, 52, 0, 45, 0, 52, 0, 41, 0, 48, 0, 43, 0, 50, 0],
      lead: [69, 72, 76, 72, 69, 72, 76, 79, 65, 69, 72, 69, 67, 71, 74, 71],
      drum: "k...h...k...h...",
      leadType: "triangle",
    },
    stage: {
      bpm: 150,
      bass: [45, 45, 57, 45, 45, 45, 57, 45, 41, 41, 53, 41, 43, 43, 55, 43, 45, 45, 57, 45, 45, 45, 57, 45, 40, 40, 52, 40, 43, 43, 55, 43],
      lead: [76, 0, 76, 79, 81, 0, 79, 76, 77, 0, 77, 76, 74, 0, 72, 74, 76, 0, 76, 79, 81, 0, 84, 83, 79, 0, 76, 74, 76, 0, 0, 0],
      drum: "k.h.s.h.k.k.s.h.",
      leadType: "square",
    },
    boss: {
      bpm: 168,
      bass: [38, 38, 50, 38, 39, 39, 51, 39, 38, 38, 50, 38, 36, 36, 48, 41],
      lead: [74, 0, 77, 74, 75, 0, 74, 72, 74, 0, 77, 81, 80, 0, 77, 75],
      drum: "k.hsk.hsk.hsk.ss",
      leadType: "sawtooth",
    },
  };
  // 특별 모드 곡
  TRACKS.dream = {
    bpm: 108,
    bass: [53, 0, 60, 0, 50, 0, 57, 0, 46, 0, 53, 0, 48, 0, 55, 0],
    lead: [77, 81, 84, 81, 79, 76, 72, 76, 74, 77, 81, 77, 72, 76, 79, 84],
    drum: "k.h.h.h.k.h.h.h.",
    leadType: "sine",
  };
  TRACKS.judgment = {
    bpm: 132,
    bass: [40, 40, 40, 52, 41, 41, 41, 53, 38, 38, 38, 50, 39, 39, 46, 51],
    lead: [64, 0, 67, 0, 71, 0, 72, 71, 65, 0, 64, 0, 62, 0, 63, 0],
    drum: "k..sk..sk.k.s.ss",
    leadType: "sawtooth",
  };
  let current = null, wanted = null, step = 0, nextTime = 0, timer = null;

  let transpose = 0;
  function playStep(tr, i, t) {
    const at = t - ctx.currentTime;
    const len = 60 / tr.bpm / 2; // 8분음표
    const b = tr.bass[i % tr.bass.length];
    if (b) tone(hz(b + transpose), len * 0.9, { type: "triangle", vol: 0.32, at, out: musicGain });
    const l = tr.lead[i % tr.lead.length];
    if (l) tone(hz(l + transpose), len * 0.85, { type: tr.leadType, vol: tr.leadType === "sawtooth" ? 0.07 : 0.09, at, out: musicGain });
    const d = tr.drum[i % tr.drum.length];
    if (d === "k") tone(140, 0.12, { type: "sine", vol: 0.5, slide: 0.3, at, out: musicGain });
    if (d === "s") noise(0.12, { vol: 0.18, freq: 1800, at, out: musicGain });
    if (d === "h") noise(0.03, { vol: 0.08, freq: 8000, type: "highpass", at, out: musicGain });
  }

  function startMusic(name, force) {
    wanted = name;
    if (!ctx || (!force && current === name)) return;
    current = name;
    clearInterval(timer);
    if (!name) return;
    // "stage:-3" 처럼 뒤에 붙은 숫자만큼 조를 바꾼다 (지역마다 다른 느낌)
    const [base, tp] = name.split(":");
    transpose = Number(tp) || 0;
    const tr = TRACKS[base];
    step = 0;
    nextTime = ctx.currentTime + 0.1;
    timer = setInterval(() => {
      if (muted) { nextTime = ctx.currentTime + 0.1; return; }
      while (nextTime < ctx.currentTime + 0.15) {
        playStep(tr, step++, nextTime);
        nextTime += 60 / tr.bpm / 2;
      }
    }, 30);
  }

  function setMuted(m) {
    muted = m;
    try { localStorage.setItem("rundot_muted", m ? "1" : "0"); } catch { /* 저장 불가 */ }
    if (master) master.gain.value = m ? 0 : 0.8;
  }

  RD.audio = {
    init,
    sfx,
    music: (name) => startMusic(name),
    get muted() { return muted; },
    toggle() { setMuted(!muted); },
  };
})();
