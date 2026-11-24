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
    // 판다 정령술사: 흰 몸, 검은 귀와 눈 둘레, 초록 잎 망토, 정령 구슬
    panda: {
      body: "#f4f2ee", belly: "#ffffff", leg: "#2a2633", snout: true,
      ears(p, L) { p(L.hx, L.hy - 2, 4, 4, "#2a2633"); p(L.hx + 10, L.hy - 2, 4, 4, "#2a2633"); },
      back(p, L, pose, f) {
        if (L.slide) return;
        p(L.tx - 4, L.ty, 5, L.th + (f % 2), "#3f9a4a"); // 잎 망토
        p(L.tx - 6, L.ty + 3, 3, 4, "#5fcf6a");
      },
      torso(p, L) {
        p(L.tx, L.ty, L.tw, L.th, "#2a2633");
        p(L.tx + 2, L.ty + 1, L.tw - 4, 3, "#5fcf6a");
        p(L.tx + 3, L.ty + 5, 4, 1, "#e0c070");
      },
      head(p, L) {
        const { hx, hy } = L;
        p(hx + 3, hy + 4, 4, 4, "#2a2633"); p(hx + 8, hy + 4, 4, 4, "#2a2633"); // 눈 둘레
        p(hx + 4, hy + 5, 2, 2, "#ffffff"); p(hx + 9, hy + 5, 2, 2, "#ffffff");
        p(hx + 2, hy - 1, 10, 2, "#5fcf6a"); p(hx + 6, hy - 3, 3, 2, "#9fff8a"); // 잎 머리띠
      },
      front(p, L) {
        if (L.slide) return;
        p(L.tx + L.tw + 1, L.ty - 5, 1, 12, "#8a5a35"); // 지팡이
        p(L.tx + L.tw - 1, L.ty - 9, 5, 5, "#9fffb0"); p(L.tx + L.tw, L.ty - 8, 2, 2, "#ffffff");
      },
    },
    // 다람쥐 메카닉: 주황 털, 큰 꼬리, 고글, 렌치, 정비복
    mech: {
      body: "#d8843a", belly: "#f8dcb0", snout: true, leg: "#3a4a5a",
      ears(p, L) { p(L.hx + 1, L.hy - 3, 3, 4, "#d8843a"); p(L.hx + 10, L.hy - 3, 3, 4, "#d8843a"); },
      back(p, L, pose, f) {
        // 커다란 꼬리
        const fl = f % 2;
        p(L.tx - 7, L.ty - 8 - fl, 6, 10, "#c0702a"); p(L.tx - 9, L.ty - 12 - fl, 6, 6, "#d8843a"); p(L.tx - 8, L.ty - 11 - fl, 2, 3, "#f8dcb0");
      },
      torso(p, L) {
        p(L.tx, L.ty, L.tw, L.th, "#4a6a8a"); // 정비복
        p(L.tx + 1, L.ty + 2, L.tw - 2, 1, "#ffd34d");
        p(L.tx + 3, L.ty + 4, 2, 2, "#aab1ba");
      },
      head(p, L) {
        const { hx, hy } = L;
        p(hx + 1, hy + 1, 12, 2, "#3a2a1a"); p(hx + 2, hy, 4, 3, "#7fe6ff"); p(hx + 8, hy, 4, 3, "#7fe6ff"); // 고글
      },
      front(p, L) {
        if (L.slide) return;
        p(L.tx + L.tw, L.ty + 1, 5, 2, "#aab1ba"); p(L.tx + L.tw + 4, L.ty - 1, 2, 2, "#aab1ba"); p(L.tx + L.tw + 4, L.ty + 3, 2, 2, "#aab1ba"); // 렌치
      },
    },
    // 개구리 광대: 초록 몸, 툭 튀어나온 큰 눈, 빨간 코, 주름 칼라, 방울 달린 광대 모자
    frog: {
      body: "#5fc04a", belly: "#d8f0a0", leg: "#3f8a30",
      torso(p, L) {
        p(L.tx, L.ty, L.tw, L.th, "#ff5ad8"); p(L.tx + 2, L.ty, 2, L.th, "#ffd34d"); p(L.tx + 6, L.ty, 2, L.th, "#7fe6ff");
        p(L.tx - 2, L.ty - 1, L.tw + 4, 2, "#ffffff"); p(L.tx - 1, L.ty + 1, 2, 1, "#ffffff"); p(L.tx + L.tw - 1, L.ty + 1, 2, 1, "#ffffff"); // 주름 칼라
      },
      head(p, L) {
        const { hx, hy } = L;
        p(hx + 1, hy + 1, 5, 5, "#5fc04a"); p(hx + 8, hy + 1, 5, 5, "#5fc04a"); // 튀어나온 눈
        p(hx + 2, hy + 2, 3, 3, "#ffffff"); p(hx + 9, hy + 2, 3, 3, "#ffffff"); p(hx + 3, hy + 3, 1, 2, "#1d1622"); p(hx + 10, hy + 3, 1, 2, "#1d1622");
        p(hx + 12, hy + 7, 3, 3, "#ff3048"); // 빨간 코
        p(hx + 3, hy + 10, 8, 1, "#c03040"); // 큰 웃음
        p(hx + 1, hy - 4, 5, 4, "#ff5ad8"); p(hx + 8, hy - 4, 5, 4, "#7a3aa0"); p(hx - 1, hy - 5, 2, 2, "#ffd34d"); p(hx + 13, hy - 5, 2, 2, "#ffd34d"); // 광대 모자와 방울
      },
      front(p, L, pose, f) {
        if (L.slide) return;
        const b = f % 2;
        p(L.tx + L.tw + 1, L.ty - 6 - b * 2, 3, 3, "#ff5ad8"); p(L.tx + L.tw + 4, L.ty - 9 + b * 2, 3, 3, "#ffd34d"); p(L.tx + L.tw + 2, L.ty - 12, 3, 3, "#7fe6ff"); // 저글링 공
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

  // ---------- 몬스터 (32x32, 왼쪽을 보고 플레이어 쪽으로 온다) ----------
  const MSIZE = 32;
  const MON = {
    // 초록 슬라임: frame 0 = 납작, 1 = 늘어남
    slime(p, f, hurt) {
      const body = hurt ? "#ffffff" : "#5fcf5a", dark = "#3f9a3c";
      if (f % 2 === 0) {
        p(5, 20, 22, 10, body); p(7, 17, 18, 3, body); p(10, 15, 12, 2, body);
        p(7, 27, 18, 3, dark);
        p(11, 21, 3, 3, OUTLINE); p(18, 21, 3, 3, OUTLINE); p(11, 21, 1, 1, "#fff"); p(18, 21, 1, 1, "#fff");
        p(14, 26, 4, 1, OUTLINE); p(9, 17, 3, 2, "#c9f7b0");
      } else {
        p(8, 14, 16, 16, body); p(10, 11, 12, 3, body); p(12, 9, 8, 2, body);
        p(9, 27, 14, 3, dark);
        p(11, 17, 3, 3, OUTLINE); p(18, 17, 3, 3, OUTLINE); p(11, 17, 1, 1, "#fff"); p(18, 17, 1, 1, "#fff");
        p(14, 23, 4, 1, OUTLINE); p(11, 12, 3, 2, "#c9f7b0");
      }
    },
    // 독버섯: 빨간 갓, 화난 눈, 걷는 발
    mushroom(p, f, hurt) {
      const cap = hurt ? "#ffffff" : "#d8343c";
      p(4, 6, 24, 8, cap); p(7, 3, 18, 3, cap); p(10, 1, 12, 2, cap);
      p(8, 5, 4, 3, "#fff2e0"); p(18, 4, 3, 2, "#fff2e0"); p(22, 9, 3, 3, "#fff2e0"); p(5, 10, 2, 2, "#fff2e0");
      p(4, 13, 24, 1, "#8f1f28");
      p(9, 14, 14, 12, "#f0dcb8");
      p(10, 17, 4, 1, OUTLINE); p(18, 17, 4, 1, OUTLINE); // 화난 눈썹
      p(11, 18, 2, 3, OUTLINE); p(19, 18, 2, 3, OUTLINE);
      p(13, 23, 6, 1, OUTLINE);
      const step = f % 2 === 0 ? 0 : 2;
      p(9 + step, 26, 5, 4, "#a06a3c"); p(18 - step, 26, 5, 4, "#a06a3c");
    },
    // 박쥐: 날개 위/아래
    bat(p, f, hurt) {
      const body = hurt ? "#ffffff" : "#6a4a9a", wing = hurt ? "#ffffff" : "#4b3270";
      p(11, 12, 10, 9, body); p(12, 9, 2, 3, body); p(18, 9, 2, 3, body);
      p(12, 14, 2, 2, "#ff4d5e"); p(18, 14, 2, 2, "#ff4d5e");
      p(14, 18, 1, 2, "#fff"); p(17, 18, 1, 2, "#fff");
      if (f % 2 === 0) {
        p(2, 6, 9, 4, wing); p(4, 10, 7, 3, wing); p(21, 6, 9, 4, wing); p(21, 10, 7, 3, wing);
      } else {
        p(2, 17, 9, 4, wing); p(4, 14, 7, 3, wing); p(21, 17, 9, 4, wing); p(21, 14, 7, 3, wing);
      }
    },
    // 돌 골렘: 크고 단단함, 이끼, 빛나는 룬 눈
    golem(p, f, hurt) {
      const st = hurt ? "#ffffff" : "#8a8f99", dk = "#5d626c";
      p(7, 4, 18, 12, st); p(5, 7, 22, 7, st);
      p(9, 4, 6, 2, "#5a8f3a"); p(19, 5, 4, 2, "#5a8f3a");
      p(10, 9, 4, 3, "#59e0ff"); p(18, 9, 4, 3, "#59e0ff");
      p(12, 13, 8, 2, dk);
      p(4, 16, 24, 10, st); p(8, 18, 16, 6, dk); p(14, 19, 4, 4, "#59e0ff");
      p(1, 15, 4, 11, st); p(27, 15, 4, 11, st);
      const step = f % 2 === 0 ? 0 : 1;
      p(7, 26 - step, 7, 4 + step, dk); p(18, 26 - (1 - step), 7, 4 + (1 - step), dk);
    },
  };

  // 도깨비불: 파란 불꽃 정령 (탄을 원형으로 뿌린다)
  MON.wisp = function (p, f, hurt) {
    const a = hurt ? "#ffffff" : "#5fb8ff", b = hurt ? "#ffffff" : "#bfe8ff";
    const fl = f % 2;
    p(10, 10, 12, 14, a); p(8, 13, 16, 9, a); p(12, 6 - fl, 8, 4, a); p(14, 3 - fl, 4, 3, a); p(20, 4 + fl, 3, 4, a);
    p(12, 13, 8, 9, b);
    p(13, 15, 2, 3, OUTLINE); p(18, 15, 2, 3, OUTLINE);
    p(14, 20, 4, 1, OUTLINE);
    p(9, 24, 3, 3 + fl, a); p(15, 24, 3, 4 - fl, a); p(21, 24, 3, 3 + fl, a);
  };
  // 저격 눈알: 커다란 눈 하나, 촉수
  MON.eye = function (p, f, hurt) {
    const skin = hurt ? "#ffffff" : "#8a3a6a", dk = "#5a2246";
    p(8, 8, 16, 16, skin); p(6, 11, 20, 10, skin); p(10, 6, 12, 2, skin);
    p(10, 10, 12, 12, "#f4eef0"); p(12, 9, 8, 14, "#f4eef0");
    p(13, 12, 6, 8, hurt ? "#ffffff" : "#ff3048"); p(15, 14, 2, 4, OUTLINE); p(14, 12, 2, 2, "#fff");
    const w = f % 2;
    p(9, 24, 2, 4 + w, dk); p(14, 24, 2, 5 - w, dk); p(19, 24, 2, 4 + w, dk); p(23, 22, 2, 4 - w, dk); p(6, 22, 2, 3 + w, dk);
  };
  // 갑옷 딱정벌레: 단단한 등껍질, 앞으로 돌진
  MON.beetle = function (p, f, hurt) {
    const sh = hurt ? "#ffffff" : "#2f6a8a", hi = hurt ? "#ffffff" : "#5fb0d8";
    p(8, 10, 18, 12, sh); p(10, 8, 14, 2, sh); p(6, 13, 2, 7, sh);
    p(16, 9, 1, 13, OUTLINE);
    p(11, 11, 4, 2, hi); p(19, 11, 4, 2, hi);
    p(3, 14, 5, 6, "#3a2a1a"); p(1, 15, 2, 2, "#e0c070"); p(1, 19, 2, 2, "#e0c070"); // 머리와 뿔
    p(4, 15, 1, 1, "#ff4d5e");
    const w = f % 2;
    p(9 + w, 22, 2, 4, "#3a2a1a"); p(15 - w, 22, 2, 4, "#3a2a1a"); p(21 + w, 22, 2, 4, "#3a2a1a");
  };
  // 치유 요정: 주변 몬스터의 체력을 채운다
  MON.fairy = function (p, f, hurt) {
    const body = hurt ? "#ffffff" : "#7fe08a", wing = hurt ? "#ffffff" : "#d8fff0";
    const w = f % 2;
    p(4, 6 + w * 3, 8, 8 - w * 2, wing); p(20, 6 + w * 3, 8, 8 - w * 2, wing);
    p(12, 8, 8, 8, "#ffe0c0"); p(12, 7, 8, 3, body);
    p(13, 11, 2, 2, OUTLINE); p(17, 11, 2, 2, OUTLINE);
    p(12, 16, 8, 8, body); p(11, 22, 10, 3, body);
    p(22, 14, 2, 10, "#c8a060"); p(21, 12, 4, 3, "#ff8ad8"); // 지팡이
  };
  // 자폭 가시공: 플레이어에게 날아와 터진다
  MON.bomber = function (p, f, hurt) {
    const b = hurt ? "#ffffff" : "#3a3a48", sp = hurt ? "#ffffff" : "#c8c8d8";
    p(9, 9, 14, 14, b); p(7, 12, 18, 8, b); p(12, 7, 8, 18, b);
    p(15, 3, 2, 4, sp); p(15, 25, 2, 4, sp); p(3, 15, 4, 2, sp); p(25, 15, 4, 2, sp);
    p(7, 7, 3, 3, sp); p(22, 7, 3, 3, sp); p(7, 22, 3, 3, sp); p(22, 22, 3, 3, sp);
    p(11, 13, 3, 3, f % 2 ? "#ff3048" : "#ffd34d"); p(18, 13, 3, 3, f % 2 ? "#ff3048" : "#ffd34d");
    p(12, 19, 8, 2, "#ff8a3d");
  };
  // 수정 갑옷 (수정 거인 주위를 도는 방패 수정)
  MON.shard = function (p, f, hurt) {
    const c = hurt ? "#ffffff" : "#9fe8ff";
    p(13, 4, 6, 4, c); p(11, 8, 10, 12, c); p(13, 20, 6, 6, c); p(15, 26, 2, 3, c);
    p(13, 8, 2, 10, "#ffffff");
  };

  // 보스: 박쥐 왕 (왕관과 망토)
  MON.batking = function (p, f, hurt) {
    MON.bat(p, f, hurt);
    const gold = hurt ? "#ffffff" : "#ffd34d";
    p(11, 5, 10, 3, gold); p(11, 3, 2, 2, gold); p(15, 2, 2, 3, gold); p(19, 3, 2, 2, gold);
    p(15, 6, 2, 1, "#ff4d5e");
    p(12, 21, 8, 4, hurt ? "#ffffff" : "#8f1f28");
  };

  const mcache = {};
  RD.MONSTER_SIZE = MSIZE;
  // 지역 색으로 바꾸기: 색상 회전, 채도, 밝기 (테두리와 흰색은 그대로)
  function recolor(cv, v) {
    const g = cv.getContext("2d");
    const img = g.getImageData(0, 0, cv.width, cv.height), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      let r = d[i] / 255, gg = d[i + 1] / 255, b = d[i + 2] / 255;
      const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
      let h = 0, sat = 0, l = (mx + mn) / 2;
      if (mx - mn < 0.04 || l < 0.15 || l > 0.95) continue; // 회색, 테두리, 흰색
      const dd = mx - mn;
      sat = l > 0.5 ? dd / (2 - mx - mn) : dd / (mx + mn);
      h = mx === r ? (gg - b) / dd + (gg < b ? 6 : 0) : mx === gg ? (b - r) / dd + 2 : (r - gg) / dd + 4;
      h = h * 60;
      let dh = ((v.hueTo - h + 540) % 360) - 180; // 가장 가까운 쪽으로
      h = ((h + dh * v.mix) % 360 + 360) % 360 / 360;
      sat = Math.min(1, sat * v.sat);
      l = Math.min(0.92, l + v.light);
      const q = l < 0.5 ? l * (1 + sat) : l + sat - l * sat, pp = 2 * l - q;
      const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? pp + (q - pp) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? pp + (q - pp) * (2 / 3 - t) * 6 : pp; };
      d[i] = f(h + 1 / 3) * 255; d[i + 1] = f(h) * 255; d[i + 2] = f(h - 1 / 3) * 255;
    }
    g.putImageData(img, 0, 0);
  }

  // 그림 이미지를 지역 색으로 바꾼 사본 (캐시)
  const tintCache = {};
  RD.tintImage = function (name, variant) {
    const im = RD.img(name);
    if (!variant || !RD.VARIANTS[variant] || !im || !im.naturalWidth) return im;
    const key = name + "|" + variant;
    if (!tintCache[key]) {
      const cv = document.createElement("canvas");
      cv.width = im.naturalWidth; cv.height = im.naturalHeight;
      cv.getContext("2d").drawImage(im, 0, 0);
      recolor(cv, RD.VARIANTS[variant]);
      tintCache[key] = cv;
    }
    return tintCache[key];
  };

  RD.getMonsterFrame = function (type, frame, hurt, variant) {
    const key = type + frame + (hurt ? "h" : "") + (variant || "");
    if (!mcache[key]) {
      const cv = document.createElement("canvas");
      cv.width = cv.height = MSIZE;
      const g = cv.getContext("2d");
      const p = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
      MON[type](p, frame, hurt);
      outline(cv);
      if (variant && !hurt && RD.VARIANTS[variant]) recolor(cv, RD.VARIANTS[variant]);
      mcache[key] = cv;
    }
    return mcache[key];
  };

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
