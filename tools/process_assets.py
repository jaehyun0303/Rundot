"""원본 이미지(assets/raw)를 게임용 PNG(assets/game)로 가공하는 스크립트.

사용법:  python3 tools/process_assets.py

- AI가 그려 넣은 가짜 체크무늬 배경과 마젠타(#FF00FF) 배경을 투명으로 바꾼다.
- 시트에서 필요한 부분만 잘라 낸다 (CROPS 표 참고).
- 새 이미지를 마젠타 배경으로 다시 뽑으면 mode 를 "magenta" 로 바꾸면 된다.
"""
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "assets" / "raw"
OUT = ROOT / "assets" / "game"


def checker_mask(rgb: np.ndarray) -> np.ndarray:
    """테두리에서 시작해, 무채색(회색/검정) 픽셀을 따라 퍼지며 배경을 찾는다."""
    r, g, b = (rgb[..., i].astype(int) for i in range(3))
    mx, mn = np.maximum(np.maximum(r, g), b), np.minimum(np.minimum(r, g), b)
    lum = (r + g + b) // 3
    gray = (mx - mn) <= 10
    # 체크무늬 두 색(검정, 회색)과 그 사이 경계선까지 포함
    candidate = gray & (lum <= 155)
    bg = flood_from_border(candidate)
    # 어두운 테두리선이 배경으로 같이 지워지는 것을 막기 위해,
    # 물체에 맞닿은 1px 의 어두운 픽셀은 테두리로 되살린다.
    obj = ~bg
    near = np.zeros_like(obj)
    near[1:, :] |= obj[:-1, :]
    near[:-1, :] |= obj[1:, :]
    near[:, 1:] |= obj[:, :-1]
    near[:, :-1] |= obj[:, 1:]
    bg &= ~(near & (lum <= 40))
    return bg


def magenta_mask(rgb: np.ndarray) -> np.ndarray:
    r, g, b = (rgb[..., i].astype(int) for i in range(3))
    # 순수 마젠타뿐 아니라 가장자리의 분홍빛 섞인 픽셀까지
    candidate = (r > 140) & (b > 140) & (g < np.minimum(r, b) * 0.55)
    # 테두리에서 이어진 배경 + 그림 안에 갇힌 진한 마젠타 (날개 사이 빈틈 등)
    enclosed = (r > 190) & (b > 190) & (g < 90)
    return flood_from_border(candidate) | enclosed


def keep_big_parts(alpha: np.ndarray, min_ratio: float = 0.02) -> np.ndarray:
    """가장 큰 덩어리에 비해 너무 작은 조각(워터마크, 잡티)은 지운다."""
    h, w = alpha.shape
    seen = np.zeros_like(alpha, dtype=bool)
    parts = []
    for y0 in range(h):
        for x0 in range(w):
            if alpha[y0, x0] and not seen[y0, x0]:
                q = deque([(y0, x0)]); seen[y0, x0] = True; pix = []
                while q:
                    y, x = q.popleft(); pix.append((y, x))
                    for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                        if 0 <= ny < h and 0 <= nx < w and alpha[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True; q.append((ny, nx))
                parts.append(pix)
    if not parts:
        return alpha
    big = max(len(p) for p in parts)
    out = np.zeros_like(alpha)
    for p in parts:
        if len(p) >= big * min_ratio:
            ys, xs = zip(*p)
            out[list(ys), list(xs)] = 255
    return out


def white_mask(rgb: np.ndarray) -> np.ndarray:
    """흰 배경 (마젠타가 잘 안 나올 때 대안)."""
    r, g, b = (rgb[..., i].astype(int) for i in range(3))
    candidate = (r > 235) & (g > 235) & (b > 235)
    return flood_from_border(candidate)


def flood_from_border(candidate: np.ndarray) -> np.ndarray:
    h, w = candidate.shape
    bg = np.zeros_like(candidate)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if candidate[y, x] and not bg[y, x]:
                bg[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if candidate[y, x] and not bg[y, x]:
                bg[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < h and 0 <= nx < w and candidate[ny, nx] and not bg[ny, nx]:
                bg[ny, nx] = True
                q.append((ny, nx))
    return bg


def cut(src: str, box, mode: str, out: str, size=None):
    im = Image.open(RAW / src).convert("RGB").crop(box)
    rgb = np.array(im)
    if mode == "none":
        alpha = np.full(rgb.shape[:2], 255, np.uint8)
    else:
        bg = checker_mask(rgb) if mode == "checker" else white_mask(rgb) if mode == "white" else magenta_mask(rgb)
        alpha = np.where(bg, 0, 255).astype(np.uint8)
        if mode == "magenta":
            alpha = keep_big_parts(alpha)
    rgba = Image.fromarray(np.dstack([rgb, alpha]), "RGBA")
    if mode != "none":
        bbox = rgba.getbbox()
        if bbox:
            rgba = rgba.crop(bbox)
    if size:
        rgba = rgba.resize(size, Image.NEAREST)
    OUT.mkdir(parents=True, exist_ok=True)
    rgba.save(OUT / out)
    print(f"{out:28s} {rgba.size}")


# (원본, 자를 영역(left, top, right, bottom), 배경 처리, 저장 이름, 최종 크기)
CROPS = [
    # 수집 아이템 (아이템 시트는 약 102px 간격의 10x10 칸)
    ("items_sheet.png", (14, 330, 92, 410), "checker", "item_gem.png", (40, 40)),
    ("items_sheet.png", (14, 435, 92, 512), "checker", "item_star.png", (40, 40)),
    ("items_sheet.png", (418, 435, 500, 512), "checker", "item_star_rainbow.png", (48, 48)),
    ("items_sheet.png", (14, 14, 92, 92), "checker", "item_coin.png", (40, 40)),
    ("items_sheet.png", (660, 700, 745, 785), "checker", "item_coin_big.png", (64, 64)),
    ("items_sheet.png", (520, 230, 610, 305), "checker", "item_heart.png", (48, 44)),
    ("items_sheet.png", (790, 700, 870, 785), "checker", "item_orb.png", (56, 56)),
    # 장애물
    ("obstacles_sheet.png", (55, 140, 300, 270), "checker", "obs_log_hanging.png", None),
    ("obstacles_sheet.png", (125, 270, 225, 440), "checker", "obs_stone_pillar.png", None),
    ("obstacles_sheet.png", (465, 270, 555, 440), "checker", "obs_totem.png", None),
    ("obstacles_sheet.png", (800, 265, 885, 440), "checker", "obs_crystal_pillar.png", None),
    # 펫 4프레임
    ("pet_slime.png", (60, 345, 260, 540), "checker", "pet_0.png", None),
    ("pet_slime.png", (290, 385, 520, 565), "checker", "pet_1.png", None),
    ("pet_slime.png", (525, 515, 770, 650), "checker", "pet_2.png", None),
    ("pet_slime.png", (760, 345, 960, 540), "checker", "pet_3.png", None),
    # 새 지역 배경: 아래쪽(워터마크와 땅에 가려지는 부분)은 잘라 낸다
    ("bg_cave.png", (0, 0, 1024, 455), "none", "bg_cave.png", None),
    ("bg_volcano.png", (0, 0, 1024, 455), "none", "bg_volcano.png", None),
    ("bg_snow.png", (0, 0, 1024, 455), "none", "bg_snow.png", None),
    ("bg_sky.png", (0, 0, 1024, 455), "none", "bg_sky.png", None),
    # 새 지역 땅 (마젠타 위쪽 제거, 아래쪽 워터마크 줄은 잘라 냄)
    ("ground_cave.png", (0, 0, 1024, 185), "magenta", "ground_cave.png", None),
    ("ground_volcano.png", (0, 0, 1024, 185), "magenta", "ground_volcano.png", None),
    ("ground_snow.png", (0, 0, 1024, 185), "magenta", "ground_snow.png", None),
    ("ground_sky.png", (0, 0, 1024, 185), "magenta", "ground_sky.png", None),
    # 지역 보스 2프레임 (왼쪽, 오른쪽)
    ("boss_bat.png", (0, 0, 504, 572), "magenta", "boss_bat_0.png", None),
    ("boss_bat.png", (520, 0, 1024, 572), "magenta", "boss_bat_1.png", None),
    ("boss_crystal.png", (0, 0, 512, 572), "magenta", "boss_crystal_0.png", None),
    ("boss_crystal.png", (512, 0, 1024, 572), "magenta", "boss_crystal_1.png", None),
    ("boss_fire.png", (0, 0, 560, 572), "magenta", "boss_fire_0.png", None),
    ("boss_fire.png", (560, 0, 1024, 572), "magenta", "boss_fire_1.png", None),
    ("boss_frost.png", (0, 0, 540, 572), "magenta", "boss_frost_0.png", None),
    ("boss_frost.png", (540, 0, 1024, 572), "magenta", "boss_frost_1.png", None),
    ("boss_storm.png", (0, 0, 500, 572), "magenta", "boss_storm_0.png", None),
    ("boss_storm.png", (500, 0, 1024, 572), "magenta", "boss_storm_1.png", None),
    # 혼돈의 심판 드래곤 (검은 테두리 상자 안쪽만)
    ("boss_chaos.png", (23, 165, 502, 605), "magenta", "boss_chaos_0.png", None),
    ("boss_chaos.png", (522, 165, 1001, 605), "magenta", "boss_chaos_1.png", None),
    # 나팔 천사 컷씬 (가장자리 검은 선 제외)
    ("cut_angel.png", (6, 4, 508, 760), "magenta", "cut_angel_0.png", None),
    ("cut_angel.png", (516, 4, 1017, 760), "magenta", "cut_angel_1.png", None),
    # 배경 / 바닥 (불투명)
    ("bg_forest.png", (0, 0, 1024, 572), "none", "bg_forest.png", None),
    ("ground.png", (0, 0, 1024, 495), "checker", "ground.png", None),
]

if __name__ == "__main__":
    for c in CROPS:
        cut(*c)
