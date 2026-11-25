"""플레이어 스프라이트 시트(가로 4칸, 마젠타 배경)를 프레임 4장으로 자른다.

사용법:  python3 tools/process_players.py
입력: assets/raw/sheets/player_<id>.png  →  출력: assets/game/player_<id>_0..3.png
- 마젠타 배경과 칸 테두리(진한 마젠타 선)를 투명으로 바꾼다.
- 오른쪽 아래 Gemini 반짝이 표시 같은 작은 조각은 지운다.
- 4칸의 위치 관계를 유지하도록 같은 크기로 잘라, 높이 OUT_H 로 줄인다.
"""
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "raw" / "sheets"
OUT = ROOT / "assets" / "game"
OUT_H = 150  # 메카는 아래에서 MECH_H
MECH_H = 200


def key_mask(rgb):
    r, g, b = (rgb[..., i].astype(int) for i in range(3))
    # 마젠타 계열(배경, 칸 테두리, 가장자리 번짐): 초록이 아주 낮고 빨강≈파랑
    mag = (g < np.minimum(r, b) * 0.38) & (np.abs(r - b) < 45) & (np.minimum(r, b) > 95)
    return mag


def components(fg):
    h, w = fg.shape
    seen = np.zeros_like(fg, dtype=bool)
    out = []
    for y0, x0 in zip(*np.nonzero(fg)):
        if seen[y0, x0]:
            continue
        q = deque([(y0, x0)]); seen[y0, x0] = True; pix = []
        while q:
            y, x = q.popleft(); pix.append((y, x))
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = y + dy, x + dx
                if 0 <= ny < h and 0 <= nx < w and fg[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True; q.append((ny, nx))
        out.append(pix)
    return out


def process(path):
    im = Image.open(path).convert("RGB")
    rgb = np.array(im)
    H, W = rgb.shape[:2]
    fg = ~key_mask(rgb)
    # 작은 조각 지우기 (가장 큰 덩어리의 1.5% 미만, 반짝이 표시 영역은 더 엄격하게)
    comps = components(fg)
    big = max(len(c) for c in comps)
    for c in comps:
        ys = [p[0] for p in c]; xs = [p[1] for p in c]
        corner = min(xs) > W - 130 and min(ys) > H - 130
        if len(c) < big * 0.015 or (corner and len(c) < big * 0.2):
            for y, x in c:
                fg[y, x] = False
    cw = W / 4
    # 칸 경계에 걸친 작은 조각(옆 칸에서 넘어온 단검 끝 등)은 지운다
    for i in range(4):
        x0, x1 = int(round(i * cw)), int(round((i + 1) * cw))
        cell = fg[:, x0:x1]
        cc = components(cell)
        cbig = max(len(c) for c in cc)
        for c in cc:
            xs = [q[1] for q in c]
            if len(c) < cbig * 0.03 and (min(xs) <= 2 or max(xs) >= x1 - x0 - 3):
                for y, x in c:
                    cell[y, x] = False
    alpha = (fg * 255).astype(np.uint8)
    rgba = np.dstack([rgb, alpha])
    boxes = []
    for i in range(4):
        x0, x1 = int(round(i * cw)), int(round((i + 1) * cw))
        cell = fg[:, x0:x1]
        ys, xs = np.nonzero(cell)
        boxes.append((xs.min(), ys.min(), xs.max(), ys.max()))
    # 4칸 공통 상자 (칸 안 좌표)
    bx0 = min(b[0] for b in boxes); by0 = min(b[1] for b in boxes)
    bx1 = max(b[2] for b in boxes); by1 = max(b[3] for b in boxes)
    name = path.stem
    for i in range(4):
        x0 = int(round(i * cw))
        fr = Image.fromarray(rgba[by0:by1 + 1, x0 + bx0:x0 + bx1 + 1], "RGBA")
        oh = MECH_H if name.startswith("mech_") else OUT_H
        k = oh / fr.height
        fr = fr.resize((max(1, round(fr.width * k)), oh), Image.LANCZOS)
        fr.save(OUT / f"{name}_{i}.png", optimize=True)
    print(name, "cells", boxes, "→", fr.size)


def process_grid(path, cols, rows, names, out_h=110):
    """여러 줄 격자 시트 (아군 정령 등): names[열] 마다 <이름>_<줄>.png"""
    im = Image.open(path).convert("RGB")
    rgb = np.array(im)
    H, W = rgb.shape[:2]
    fg = ~key_mask(rgb)
    # 빛번짐과 마젠타가 섞인 보라빛 가장자리를 2px 깎는다
    r_, g_, b_ = (rgb[..., i].astype(int) for i in range(3))
    purple = (r_ > g_ + 12) & (b_ > g_ + 12)
    for _ in range(3):
        bg = ~fg
        near = np.zeros_like(bg)
        near[1:, :] |= bg[:-1, :]; near[:-1, :] |= bg[1:, :]; near[:, 1:] |= bg[:, :-1]; near[:, :-1] |= bg[:, 1:]
        fg &= ~(near & purple)
    cw, ch = W / cols, H / rows
    for c in range(cols):
        cells = []
        for r in range(rows):
            x0, x1 = int(round(c * cw)), int(round((c + 1) * cw))
            y0, y1 = int(round(r * ch)), int(round((r + 1) * ch))
            cell = fg[y0:y1, x0:x1].copy()
            cc = components(cell)
            cbig = max(len(q) for q in cc)
            for q in cc:
                ys = [a[0] for a in q]; xs = [a[1] for a in q]
                edge = min(xs) <= 2 or max(xs) >= x1 - x0 - 3 or min(ys) <= 2 or max(ys) >= y1 - y0 - 3
                if len(q) < cbig * (0.03 if edge else 0.004):
                    for y, x in q:
                        cell[y, x] = False
            cells.append((x0, y0, cell))
        # 같은 열의 줄들은 같은 상자로 (움직여도 제자리)
        bx0 = min(np.nonzero(cl)[1].min() for _, _, cl in cells); bx1 = max(np.nonzero(cl)[1].max() for _, _, cl in cells)
        by0 = min(np.nonzero(cl)[0].min() for _, _, cl in cells); by1 = max(np.nonzero(cl)[0].max() for _, _, cl in cells)
        for r, (x0, y0, cl) in enumerate(cells):
            a = (cl[by0:by1 + 1, bx0:bx1 + 1] * 255).astype(np.uint8)
            fr = Image.fromarray(np.dstack([rgb[y0 + by0:y0 + by1 + 1, x0 + bx0:x0 + bx1 + 1], a]), "RGBA")
            k = out_h / fr.height
            fr = fr.resize((max(1, round(fr.width * k)), out_h), Image.LANCZOS)
            fr.save(OUT / f"{names[c]}_{r}.png", optimize=True)
        print(names[c], fr.size)


if __name__ == "__main__":
    for p in sorted(SRC.glob("player_*.png")) + sorted(SRC.glob("mech_mk*.png")):
        process(p)
    g = SRC / "grid_ally.png"
    if g.exists():
        process_grid(g, 5, 3, ["ally_fairy", "ally_slime", "ally_wisp", "ally_beetle", "ally_mushroom"])
