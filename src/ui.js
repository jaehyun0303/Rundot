// UI 공통 그리기 도구 (Claude UI 목업 스타일)
// 각진 도트 패널, 아래쪽 진한 띠로 입체감을 준 버튼, 픽셀 아이콘, 칸 막대, 별
(function () {
  const COL = {
    bg: "#120c1c", panel: "#2b2140", panel2: "#231a36", edge: "#1d1622", line: "#3d2f5a",
    gold: "#ffd34d", orange: "#ff8a3d", cyan: "#7fe6ff", purple: "#c58aff", green: "#9fffb0", red: "#ff4d5e", text: "#ffffff", dim: "#9a8ab8",
  };

  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
    return "#" + [f((n >> 16) & 255), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, "0")).join("");
  }

  // 패널: 진한 테두리 + 위쪽 밝은 선 + 아래쪽 진한 띠
  function panel(g, x, y, w, h, fill = COL.panel, border = COL.edge) {
    g.fillStyle = border; g.fillRect(x - 3, y - 3, w + 6, h + 6);
    g.fillStyle = fill; g.fillRect(x, y, w, h);
    g.fillStyle = "rgba(255,255,255,0.07)"; g.fillRect(x, y, w, 3);
    g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(x, y + h - 4, w, 4);
  }

  // 입체 버튼: 아래쪽 진한 띠
  function btn(g, x, y, w, h, color, pressed) {
    g.fillStyle = COL.edge; g.fillRect(x - 3, y - 3, w + 6, h + 6);
    g.fillStyle = color; g.fillRect(x, y, w, h);
    g.fillStyle = "rgba(255,255,255,0.22)"; g.fillRect(x, y, w, 4);
    g.fillStyle = shade(color, 0.7); g.fillRect(x, y + h - (pressed ? 3 : 7), w, pressed ? 3 : 7);
  }

  // 작은 태그 (등급 배지 등)
  function chip(g, x, y, w, h, color, label, size = 12, textCol = "#1d1622") {
    g.fillStyle = COL.edge; g.fillRect(x - 2, y - 2, w + 4, h + 4);
    g.fillStyle = color; g.fillRect(x, y, w, h);
    g.fillStyle = "rgba(255,255,255,0.3)"; g.fillRect(x, y, w, 2);
    RD.text(g, label, x + w / 2, y + h / 2 + 1, size, textCol, "center", color);
  }

  // 칸으로 나뉜 막대 (체력, 경험치, 능력치)
  function segBar(g, x, y, w, h, k, color, segs = 0) {
    g.fillStyle = COL.edge; g.fillRect(x - 2, y - 2, w + 4, h + 4);
    g.fillStyle = "#1a1228"; g.fillRect(x, y, w, h);
    k = Math.max(0, Math.min(1, k));
    if (!segs) {
      g.fillStyle = color; g.fillRect(x, y, w * k, h);
      g.fillStyle = "rgba(255,255,255,0.3)"; g.fillRect(x, y, w * k, Math.ceil(h / 3));
      return;
    }
    const sw = w / segs;
    for (let i = 0; i < segs; i++) {
      const f = Math.max(0, Math.min(1, k * segs - i));
      g.fillStyle = "#3a2d48"; g.fillRect(x + i * sw + 1, y + 1, sw - 2, h - 2);
      if (f > 0) { g.fillStyle = color; g.fillRect(x + i * sw + 1, y + 1, (sw - 2) * f, h - 2); g.fillStyle = "rgba(255,255,255,0.3)"; g.fillRect(x + i * sw + 1, y + 1, (sw - 2) * f, 2); }
    }
  }

  // 도트 별 (각성)
  const STAR = ["0001000", "0011100", "1111111", "0111110", "0110110", "1100011"];
  function stars(g, x, y, n, max, px = 2) {
    for (let i = 0; i < max; i++) {
      const on = i < n;
      const king = i === 5; // 6번째 = 왕별 (분홍빛 왕관 별)
      STAR.forEach((row, yy) => [...row].forEach((v, xx) => {
        if (v === "1") { g.fillStyle = on ? (king ? (yy < 2 ? "#ffd0f0" : "#ff5ad8") : yy < 2 ? "#fff3a0" : COL.gold) : "#3a2d48"; g.fillRect(x + i * (7 * px + 3) + xx * px, y + yy * px, px, px); }
      }));
      if (king && on) { g.fillStyle = "#ffd34d"; g.fillRect(x + i * (7 * px + 3) + 1 * px, y - 2 * px, px, 2 * px); g.fillRect(x + i * (7 * px + 3) + 3 * px, y - 3 * px, px, 3 * px); g.fillRect(x + i * (7 * px + 3) + 5 * px, y - 2 * px, px, 2 * px); }
    }
    return max * (7 * px + 3);
  }

  // 픽셀 아이콘 (8x8). 문자: 1 = 주 색, 2 = 흰색, 3 = 진한 테두리
  const ICONS = {
    sword: ["00000033", "00000322", "00003223", "30032230", "33322300", "03223000", "03330000", "30030000"],
    book: ["33333333", "31122113", "31212213", "31122113", "31212213", "31122113", "33333333", "00000000"],
    skull: ["03333330", "31111113", "32211223", "32211223", "31133113", "03111130", "03131310", "00333300"],
    target: ["00333300", "03111130", "31322313", "31211213", "31211213", "31322313", "03111130", "00333300"],
    flag: ["33000000", "31333300", "31111130", "31111113", "31111130", "31333300", "31000000", "33000000"],
    heart: ["03300330", "31133113", "31111113", "31111113", "03111130", "00311300", "00033000", "00000000"],
    clock: ["00333300", "03222230", "32221223", "32221223", "32211123", "32222223", "03222230", "00333300"],
    bolt: ["00000330", "00003130", "00031300", "00311330", "03331130", "00031300", "00313000", "00330000"],
    candy: ["30000003", "13033031", "01311310", "00311300", "00311300", "01311310", "13033031", "30000003"],
    run: ["00033000", "00311300", "00033000", "03311330", "30311003", "00311000", "03303300", "33000330"],
    trumpet: ["00000000", "30000033", "13333313", "11111113", "13333313", "30000033", "00000000", "00000000"],
    star: ["00033000", "00311300", "33311333", "31111113", "03111130", "03133130", "31300313", "33000033"],
    chest: ["03333330", "31111113", "31111113", "33322333", "31122113", "31111113", "31111113", "33333333"],
    gear: ["00300300", "03333330", "33111133", "03122130", "03122130", "33111133", "03333330", "00300300"],
    sound: ["00030000", "00331030", "33313103", "31113103", "31113103", "33313103", "00331030", "00030000"],
    pause: ["00000000", "03303300", "03303300", "03303300", "03303300", "03303300", "03303300", "00000000"],
    lock: ["00333300", "03000030", "03000030", "33333333", "31111113", "31133113", "31111113", "33333333"],
    shield: ["33333333", "31111113", "31111113", "31111113", "03111130", "03111130", "00311300", "00033000"],
    up: ["00033000", "00311300", "03111130", "31111113", "33311333", "00311300", "00311300", "00333300"],
    coin: ["00333300", "03111130", "31122113", "31211113", "31211113", "31122113", "03111130", "00333300"],
    back: ["00003000", "00031000", "00311000", "03111333", "03111333", "00311000", "00031000", "00003000"],
    chaos: ["30000003", "03100130", "00311300", "00133100", "00133100", "00311300", "03100130", "30000003"],
  };
  function icon(g, name, x, y, size, color) {
    const m = ICONS[name];
    if (!m) return;
    const px = size / 8;
    m.forEach((row, yy) => [...row].forEach((v, xx) => {
      if (v === "0") return;
      g.fillStyle = v === "1" ? color : v === "2" ? "#ffffff" : "#1d1622";
      g.fillRect(Math.round(x + xx * px), Math.round(y + yy * px), Math.ceil(px), Math.ceil(px));
    }));
  }
  // 아이콘이 들어간 네모 칸
  function iconBox(g, x, y, s, name, color, bg) {
    g.fillStyle = COL.edge; g.fillRect(x - 2, y - 2, s + 4, s + 4);
    g.fillStyle = bg || color; g.fillRect(x, y, s, s);
    g.fillStyle = "rgba(0,0,0,0.2)"; g.fillRect(x, y + s - 3, s, 3);
    icon(g, name, x + s * 0.18, y + s * 0.18, s * 0.64, bg ? color : "#ffffff");
  }

  // 캐릭터 그림 (일러스트가 없으면 도트 캐릭터)
  function portrait(g, ch, x, y, w, h, frame = 0) {
    g.fillStyle = "#3a2d58"; g.fillRect(x, y, w, h);
    // 각성: 각성 일러스트 → 각성 도트 그림 → 원래 일러스트 순서
    const ok = (x) => x && x.complete && x.naturalWidth;
    let im = RD.img(ch.illust);
    if (ch.awakened) { const ai = RD.img(ch.illust + "_awake"); if (ok(ai)) im = ai; else if (RD.playerPic && RD.img(`player_${ch.id}_awake_0`) && ok(RD.img(`player_${ch.id}_awake_0`))) im = null; }
    if (ok(im)) {
      const ar = w / h, iar = im.width / im.height;
      let sw = im.width, sh = im.height, sx = 0, sy = 0;
      if (iar > ar) { sw = im.height * ar; sx = (im.width - sw) / 2; } else { sh = im.width / ar; sy = 0; }
      g.imageSmoothingEnabled = true;
      g.drawImage(im, sx, sy, sw, sh, x, y, w, h);
      g.imageSmoothingEnabled = false;
    } else {
      const pic = RD.playerPic && RD.playerPic(ch.id, 0, ch.awakened);
      if (pic) {
        const k = Math.min(w / pic.width, h / pic.height) * 0.9;
        g.imageSmoothingEnabled = true;
        g.drawImage(pic, x + (w - pic.width * k) / 2, y + (h - pic.height * k) / 2, pic.width * k, pic.height * k);
        g.imageSmoothingEnabled = false;
        return;
      }
      const s = Math.min(w, h) * 0.95;
      g.drawImage(RD.getCharacterFrame(ch.id, "jump", frame), x + (w - s) / 2, y + (h - s) / 2, s, s);
    }
  }

  // 글자가 칸을 넘으면 줄여서
  function fitText(g, s, x, y, maxW, size, color, align = "left", stroke) {
    g.font = `bold ${size}px ${RD.FONT}`;
    while (size > 8 && g.measureText(s).width > maxW) { size--; g.font = `bold ${size}px ${RD.FONT}`; }
    RD.text(g, s, x, y, size, color, align, stroke);
  }

  // 로마 숫자 (강화 단계)
  const roman = (n) => ["", "I", "II", "III", "IV", "V", "VI"][n] || String(n);

  // 등급 색 테두리
  const gradeCol = (gr) => (RD.GRADES[gr] || {}).color || "#cfd8e6";

  RD.UI = { COL, shade, panel, btn, chip, segBar, stars, icon, iconBox, portrait, fitText, roman, gradeCol };
})();
