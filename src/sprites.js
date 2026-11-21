// 임시 도트 캐릭터. 진짜 스프라이트 시트가 나오기 전까지 코드로 그린 34x34 픽셀 캐릭터를 쓴다.
// 나중에 PNG 스프라이트로 바꿀 때는 RD.getCharacterFrame 만 교체하면 된다.
(function () {
  const SIZE = 40;
  const OX = 3, OY = 7; // 귀나 모자가 위로 잘리지 않도록 여백
  const OUTLINE = "#1d1622";

  // pose: run | jump | slide | hurt,  frame: 0~3 (달리기 프레임)
  function drawBase(g, c, pose, frame) {
    const p = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x + OX, y + OY, w, h); };
    const bob = pose === "run" && frame % 2 === 1 ? -1 : 0;
    let L; // 레이아웃
    if (pose === "slide") {
      L = { hx: 15, hy: 15 + 1, tx: 6, ty: 22, tw: 12, th: 6, slide: true };
    } else {
      L = { hx: 10, hy: 4 + bob, tx: 12, ty: 16 + bob, tw: 10, th: 9, slide: false };
    }
    c.back && c.back(p, L, pose, frame);

    // 다리
    const leg = c.leg || shade(c.body);
    if (L.slide) {
      p(18, 26, 8, 3, leg); p(24, 27, 3, 2, leg);
    } else if (pose === "jump") {
      p(13, 25, 4, 3, leg); p(18, 24, 4, 3, leg);
    } else if (pose === "hurt") {
      p(12, 25, 3, 4, leg); p(19, 25, 3, 4, leg);
    } else {
      const off = [[-3, 3], [0, 0], [3, -3], [0, 0]][frame];
      p(14 + off[0], 25 + bob, 3, 4 - Math.max(0, bob), leg);
      p(18 + off[1], 25 + bob, 3, 4 - Math.max(0, bob), leg);
    }
    // 몸통
    p(L.tx, L.ty, L.tw, L.th, c.body);
    p(L.tx + 2, L.ty + 1, L.tw - 4, L.th - 2, c.belly);
    c.torso && c.torso(p, L, pose, frame);
    // 머리
    const { hx, hy } = L;
    p(hx + 1, hy, 12, 12, c.body);
    p(hx, hy + 1, 14, 10, c.body);
    c.ears && c.ears(p, L);
    if (c.snout) { p(hx + 11, hy + 6, 4, 4, c.belly); p(hx + 14, hy + 6, 2, 2, OUTLINE); }
    // 눈
    if (pose === "hurt") {
      p(hx + 4, hy + 5, 1, 1, OUTLINE); p(hx + 5, hy + 6, 1, 1, OUTLINE); p(hx + 4, hy + 7, 1, 1, OUTLINE);
      p(hx + 9, hy + 5, 1, 1, OUTLINE); p(hx + 10, hy + 6, 1, 1, OUTLINE); p(hx + 9, hy + 7, 1, 1, OUTLINE);
    } else {
      const eye = c.eye || OUTLINE;
      p(hx + 4, hy + 5, 2, 3, eye); p(hx + 9, hy + 5, 2, 3, eye);
      if (c.pupil) { p(hx + 5, hy + 6, 1, 2, c.pupil); p(hx + 10, hy + 6, 1, 2, c.pupil); }
      p(hx + 4, hy + 5, 1, 1, "#fff"); p(hx + 9, hy + 5, 1, 1, "#fff");
    }
    p(hx + 2, hy + 8, 2, 1, "#f28b9a"); p(hx + 11, hy + 8, 2, 1, "#f28b9a");
    c.head && c.head(p, L, pose, frame);
    c.front && c.front(p, L, pose, frame);
  }

  function shade(hex, k = 0.78) {
    const n = parseInt(hex.slice(1), 16);
    const r = ((n >> 16) & 255) * k, g = ((n >> 8) & 255) * k, b = (n & 255) * k;
    return "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  }

  const DEFS = {
    fox: {
      body: "#e8792b", belly: "#fbeee0", snout: true,
      back(p, L, pose, f) {
        // 망토와 꼬리
        const fl = f % 2;
        p(L.tx - 4, L.ty, 5, L.th - 1 + fl, "#c8312f");
        p(L.tx - 6, L.ty + 2 + fl, 3, 4, "#c8312f");
        p(L.tx - 8, L.ty + 3 - fl, 6, 5, "#e8792b");
        p(L.tx - 10, L.ty + 2 - fl, 3, 4, "#fbeee0");
      },
      torso(p, L) {
        p(L.tx, L.ty + 2, L.tw, 2, "#6b4528");
        p(L.tx + 4, L.ty + 2, 2, 2, "#e0b040");
      },
      head(p, L) {
        const { hx, hy } = L;
        // 투구
        p(hx - 1, hy - 1, 15, 5, "#c9ced6");
        p(hx - 1, hy + 4, 3, 5, "#c9ced6");
        p(hx + 1, hy + 2, 12, 1, "#5d6570");
        p(hx + 1, hy - 1, 12, 1, "#eef1f5");
        // 깃털
        p(hx + 5, hy - 4, 3, 3, "#3a6fd8"); p(hx + 2, hy - 5, 4, 2, "#3a6fd8"); p(hx - 1, hy - 4, 3, 2, "#5b8ff0");
        // 귀
        p(hx + 2, hy - 3, 2, 2, "#e8792b"); p(hx + 11, hy - 3, 2, 2, "#e8792b");
      },
      front(p, L, pose) {
        if (L.slide) return;
        p(L.tx + L.tw, L.ty + 3, 2, 2, "#e8792b");
        p(L.tx + L.tw + 1, L.ty - 4, 2, 8, "#b07a3c");
        p(L.tx + L.tw, L.ty + 2, 4, 1, "#6b4528");
      },
    },
    cat: {
      body: "#2a2633", belly: "#3b3546", eye: "#f3c640", pupil: "#1d1622", leg: "#2a2633",
      ears(p, L) { p(L.hx + 1, L.hy - 2, 3, 3, "#2a2633"); p(L.hx + 10, L.hy - 2, 3, 3, "#2a2633"); },
      back(p, L, pose, f) {
        p(L.tx - 3, L.ty + 2 + (f % 2), 2, 6, "#2a2633");
        p(L.tx - 5, L.ty + 1 + (f % 2), 3, 2, "#2a2633");
      },
      torso(p, L) {
        // 로브
        p(L.tx - 1, L.ty, L.tw + 2, L.th + (L.slide ? 0 : 2), "#6a3fa0");
        p(L.tx - 1, L.ty + L.th + (L.slide ? -1 : 1), L.tw + 2, 1, "#e0b040");
        p(L.tx + 3, L.ty + 3, 1, 1, "#f3c640"); p(L.tx + 7, L.ty + 6, 1, 1, "#f3c640");
      },
      head(p, L) {
        const { hx, hy } = L;
        p(hx - 2, hy + 1, 18, 2, "#6a3fa0");
        p(hx + 2, hy - 3, 10, 4, "#6a3fa0");
        p(hx + 3, hy - 6, 7, 3, "#6a3fa0");
        p(hx + 4, hy - 8, 4, 2, "#6a3fa0");
        p(hx + 1, hy - 9, 4, 2, "#6a3fa0");
        p(hx + 5, hy - 2, 1, 1, "#f3c640"); p(hx + 9, hy - 4, 1, 1, "#f3c640"); p(hx + 2, hy, 1, 1, "#f3c640");
      },
      front(p, L) {
        if (L.slide) return;
        p(L.tx + L.tw + 1, L.ty - 8, 1, 18, "#8a5a35");
        p(L.tx + L.tw, L.ty - 11, 3, 3, "#7fe6ff");
        p(L.tx + L.tw + 1, L.ty - 10, 1, 1, "#ff8af0");
      },
    },
    bear: {
      body: "#8a5a35", belly: "#c49a6c", snout: true,
      ears(p, L) {
        p(L.hx, L.hy - 2, 4, 3, "#8a5a35"); p(L.hx + 10, L.hy - 2, 4, 3, "#8a5a35");
        p(L.hx + 1, L.hy - 1, 2, 1, "#c49a6c"); p(L.hx + 11, L.hy - 1, 2, 1, "#c49a6c");
      },
      back(p, L) {
        if (L.slide) return;
        // 어깨에 멘 망치
        p(L.hx - 4, L.hy + 6, 6, 5, "#7d848e");
        p(L.hx - 4, L.hy + 6, 6, 1, "#aab1ba");
        p(L.hx + 1, L.hy + 10, 2, 2, "#6b4528");
        p(L.hx + 3, L.hy + 12, 2, 2, "#6b4528");
      },
      torso(p, L) {
        p(L.tx, L.ty, L.tw, 2, "#d8c8a4");
        p(L.tx + 1, L.ty + 2, L.tw - 2, L.th - 2, "#7a5230");
        p(L.tx + 3, L.ty + 5, 2, 2, "#aab1ba");
      },
      head(p, L) { p(L.hx + 3, L.hy + 9, 2, 1, "#4a3020"); p(L.hx + 9, L.hy + 2, 2, 1, "#4a3020"); },
    },
    rabbit: {
      body: "#f2f0ec", belly: "#ffffff", leg: "#e0dcd4",
      ears(p, L) {
        const { hx, hy } = L;
        if (L.slide) { p(hx - 8, hy + 1, 9, 3, "#f2f0ec"); p(hx - 7, hy + 2, 7, 1, "#f2a0b0"); return; }
        p(hx + 3, hy - 9, 3, 10, "#f2f0ec"); p(hx + 4, hy - 8, 1, 8, "#f2a0b0");
        p(hx + 8, hy - 10, 3, 11, "#f2f0ec"); p(hx + 9, hy - 9, 1, 9, "#f2a0b0");
      },
      torso(p, L) {
        p(L.tx, L.ty, L.tw, L.th, "#6b4528");
        p(L.tx, L.ty + 4, L.tw, 1, "#3e2817");
        p(L.tx + 6, L.ty + 5, 1, 3, "#d0d6de");
      },
      head(p, L) {
        const { hx, hy } = L;
        // 두건과 스카프
        p(hx - 1, hy, 2, 11, "#3d6b3a"); p(hx + 1, hy, 12, 2, "#3d6b3a");
        p(hx + 3, hy + 8, 12, 4, "#3d6b3a");
      },
    },
    owl: {
      body: "#8a6440", belly: "#d8c09a", eye: "#f0a830", pupil: "#1d1622", leg: "#c8963c",
      back(p, L, pose, f) {
        if (L.slide) return;
        // 프로펠러 배낭
        p(L.tx - 4, L.ty - 1, 5, 7, "#c8963c");
        p(L.tx - 3, L.ty, 3, 1, "#e8c070");
        const up = f % 2 === 0;
        p(L.tx - 6, up ? L.ty - 5 : L.ty + 1, 2, up ? 6 : 6, "#9a6a38");
        p(L.tx - 6, up ? L.ty + 3 : L.ty - 5, 2, 2, "#9a6a38");
      },
      torso(p, L) {
        p(L.tx - 1, L.ty - 1, L.tw + 2, L.th + 1, "#8a6440");
        p(L.tx + 1, L.ty + 1, L.tw - 2, L.th - 2, "#d8c09a");
        p(L.tx + 3, L.ty + 3, 1, 1, "#8a6440"); p(L.tx + 6, L.ty + 5, 1, 1, "#8a6440");
      },
      head(p, L) {
        const { hx, hy } = L;
        // 비행모와 고글, 스카프, 부리
        p(hx, hy - 1, 14, 4, "#6b4a2e");
        p(hx + 2, hy, 4, 2, "#b8d4e0"); p(hx + 8, hy, 4, 2, "#b8d4e0");
        p(hx - 1, hy + 3, 2, 5, "#6b4a2e");
        p(hx + 7, hy + 8, 2, 2, "#e0b040");
        p(hx + 2, hy + 11, 12, 2, "#f4f4f0");
        p(hx - 4, hy + 11, 7, 2, "#f4f4f0");
      },
    },
  };

  function outline(cv) {
    const g = cv.getContext("2d");
    const img = g.getImageData(0, 0, cv.width, cv.height);
    const d = img.data, w = cv.width, h = cv.height;
    const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 0;
    const add = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!solid(x, y) && (solid(x + 1, y) || solid(x - 1, y) || solid(x, y + 1) || solid(x, y - 1))) add.push(x, y);
    }
    g.fillStyle = OUTLINE;
    for (let i = 0; i < add.length; i += 2) g.fillRect(add[i], add[i + 1], 1, 1);
  }

  const cache = {};
  RD.SPRITE_SIZE = SIZE;
  RD.SPRITE_FEET = 29 + OY; // 발바닥이 있는 픽셀 줄
  RD.getCharacterFrame = function (id, pose, frame) {
    const key = id + pose + frame;
    if (!cache[key]) {
      const cv = document.createElement("canvas");
      cv.width = cv.height = SIZE;
      const g = cv.getContext("2d");
      drawBase(g, DEFS[id], pose, frame);
      outline(cv);
      cache[key] = cv;
    }
    return cache[key];
  };
})();
