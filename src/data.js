// 게임 밸런스 값과 데이터. 숫자를 바꿔 가며 조정하면 된다.
// 장르: 텐가이 / 1945 같은 오락실 슈팅. 가로로 스크롤되는 숲 위를 날며 자동으로 쏜다.
window.RD = window.RD || {};

RD.CONFIG = {
  width: 960,
  height: 540,
  groundY: 470, // 땅 몬스터가 서 있는 높이
  scrollSpeed: 140, // 배경이 흘러가는 속도
  spriteScale: 2.4, // 플레이어 도트 확대 배율
  moveSpeed: 330, // 키보드 이동 속도
  focusSpeed: 160, // Shift 누르고 있을 때 (정밀 이동)
  touchSensitivity: 1.35, // 손가락 이동량 대비 캐릭터 이동량
  hitRadius: 6, // 플레이어 피격 판정 반지름 (작을수록 쉬움)
  maxHp: 100, // 체력. 0이 되면 잔기 하나를 잃는다
  bulletDamage: 18, // 적 탄 한 발 피해 (난이도 배율 적용)
  contactDamage: 28, // 적과 부딪혔을 때 피해
  hitInvuln: 0.9, // 맞은 뒤 무적 시간
  bombs: 2,
  maxBombs: 5,
  respawnInvuln: 2.5,
  bombInvuln: 2.2,
  bombDamage: 60,
  extendEvery: 150000, // 이 점수마다 잔기 +1
};

// 아이템: P = 경험치 덩어리, B = 폭탄, 하트 = 체력 회복, 나머지는 점수
RD.ITEMS = {
  power: { label: "P", color: "#ff5a5a", size: 30, score: 100, exp: 6 },
  bomb: { label: "B", color: "#4aa8ff", size: 30, score: 100 },
  heal: { img: "item_heart", size: 30, score: 100, heal: 30 },
  coin: { img: "item_coin", size: 24, score: 100 },
  gem: { img: "item_gem", size: 26, score: 300 },
  star: { img: "item_star", size: 30, score: 1000 },
  life: { label: "1UP", color: "#3fbf6a", size: 34, score: 0, life: 1 },
  candy: { candy: true, size: 26, score: 50, heal: 3, sugar: 1 }, // 달콤한 꿈: 꿈 게이지 회복, 슈가 러시 충전
};

// 난이도
RD.DIFFICULTY = {
  easy: { terrain: 0, name: "쉬움", color: "#7fe08a", enemyHp: 0.7, bulletSpeed: 0.8, fireRate: 0.7, damage: 0.6, lives: 5, score: 0.5, exp: 1.3 },
  normal: { terrain: 0.7, name: "보통", color: "#ffd34d", enemyHp: 1, bulletSpeed: 1, fireRate: 1, damage: 1, lives: 3, score: 1, exp: 1 },
  hard: { terrain: 1, name: "어려움", color: "#ff8a3d", enemyHp: 1.35, bulletSpeed: 1.2, fireRate: 1.35, damage: 1.4, lives: 3, score: 1.6, exp: 0.9 },
  hell: { terrain: 1.35, name: "지옥", color: "#ff4d5e", enemyHp: 1.8, bulletSpeed: 1.4, fireRate: 1.8, damage: 2, lives: 2, score: 2.5, exp: 0.8 },
};

// 게임 모드
RD.MODES = {
  story: { name: "스토리", desc: "5개 지역을 차례로 깨고 폭풍 군주를 쓰러뜨려라" },
  stageselect: { name: "스테이지 선택", desc: "스토리에서 도달한 지역을 골라 한 판만 한다" },
  endless: { name: "무한", desc: "보스를 잡을 때마다 지역이 바뀌며 끝없이 강해진다" },
  bossrush: { name: "보스 러시", desc: "강화 3개를 고르고 지역 보스만 연달아 상대한다" },
  timeattack: { name: "타임 어택", desc: "3분 동안 최대한 많은 점수를 모아라", time: 180 },
  hardcore: { name: "하드코어", desc: "스토리를 잔기 1개로. 회복 아이템 없음, 점수 x2", lives: 1, noHeal: true, scoreMul: 2 },
  chaos: { name: "혼돈", desc: "30초마다 지역과 지형 효과가 무작위로 바뀐다. 점수 x1.5", scoreMul: 1.5, shiftEvery: 30 },
  // 특별 모드
  dream: { name: "달콤한 꿈", special: "dream", lives: 1, desc: "사탕 나라의 꿈. 사탕을 모아 슈가 러시! 꿈 게이지가 바닥나면 잠에서 깬다" },
  adventure: { name: "어드벤처 런", special: "adventure", desc: "쿠키런처럼 자동으로 달린다! 점프(오른쪽/Space)와 슬라이드(왼쪽/↓)로 장애물을 피하고 젤리를 모아라" },
  raid: { name: "레이드", special: "raid", time: 180, desc: "브롤스타즈식 조작! 직접 조준해서 쏘고(탄환), 맞히면 궁극기가 찬다. 보스 하나에 3분" },
  trumpets: { name: "일곱 나팔", special: "judgment", scoreMul: 2, desc: "일곱 나팔이 차례로 울리며 재앙이 내린다. 마지막엔 큰 붉은 용. 점수 x2" },
};

// 지역(스테이지). 배경 이미지(bg, ground)가 없으면 코드로 그린 임시 배경을 쓴다
// variant: 그 지역 몬스터의 색 / effect: 지형 효과
RD.STAGES = [
  {
    id: "forest", mobs: ["fairy", "bomber"], bossTrait: "흡혈: 박쥐 왕의 탄에 맞으면 박쥐 왕이 회복한다. 체력이 낮아지면 더 빨라진다", name: "속삭이는 숲", bg: "bg_forest", ground: "ground", variant: null,
    effect: "bless", effectName: "숲의 축복", effectDesc: "하트가 2배로 자주 나온다",
    boss: "boss_bat", bossName: "박쥐 왕", midName: "돌 골렘", transpose: 0,
    sky: ["#1b2348", "#3d4f6e"], far: "#2a3a55", mid: "#1f3b2c", groundCol: ["#4f8a3a", "#5a3a22"], shape: "trees",
  },
  {
    id: "cave", mobs: ["eye", "beetle"], bossTrait: "수정 갑옷: 주위를 도는 수정이 있는 동안 피해가 크게 줄어든다. 수정을 먼저 깨라", name: "수정 동굴", bg: "bg_cave", ground: "ground_cave", variant: "crystal",
    effect: "dark", effectName: "어둠", effectDesc: "내 주변만 보인다. 적 탄은 빛나서 보인다",
    boss: "boss_crystal", bossName: "수정 거인", midName: "수정 골렘", transpose: -3,
    sky: ["#0b0a1a", "#1c1636"], far: "#231d40", mid: "#3a2d6a", groundCol: ["#4b3f7a", "#241c3a"], shape: "crystals",
  },
  {
    id: "volcano", mobs: ["bomber", "beetle"], bossTrait: "분열과 용암 자국: 착지한 자리에 용암이 남고, 체력이 줄면 새끼 슬라임을 낳는다", name: "불타는 화산", bg: "bg_volcano", ground: "ground_volcano", variant: "fire",
    effect: "lava", effectName: "용암 분출", effectDesc: "예고된 자리에서 용암 기둥이 솟고 불똥이 떨어진다",
    boss: "boss_fire", bossName: "마그마 슬라임 왕", midName: "용암 골렘", transpose: 2,
    sky: ["#2a0a0a", "#6a1e12"], far: "#3a1410", mid: "#24100c", groundCol: ["#3a2420", "#ff6a1a"], shape: "volcano",
  },
  {
    id: "snow", mobs: ["beetle", "fairy", "eye"], bossTrait: "빙결: 서리 여왕의 탄에 맞으면 잠깐 느려진다", name: "얼어붙은 설원", bg: "bg_snow", ground: "ground_snow", variant: "ice",
    effect: "ice", effectName: "빙판과 눈보라", effectDesc: "미끄러지듯 움직이고, 가끔 강풍이 옆으로 민다",
    boss: "boss_frost", bossName: "서리 여왕", midName: "얼음 골렘", transpose: -5,
    sky: ["#6a86b0", "#c8d8ec"], far: "#9ab0cc", mid: "#5a7a9a", groundCol: ["#eef4fa", "#8aa4c0"], shape: "pines",
  },
  {
    id: "sky", mobs: ["eye", "bomber", "fairy"], bossTrait: "순간이동: 체력이 줄면 여기저기로 순간이동하며 공격한다", name: "폭풍의 하늘", bg: "bg_sky", ground: "ground_sky", variant: "storm",
    effect: "storm", effectName: "낙뢰", effectDesc: "예고선이 뜬 자리에 번개가 떨어진다",
    boss: "boss_storm", bossName: "폭풍 군주", midName: "구름 골렘", transpose: 5,
    sky: ["#14142a", "#3a3a5c"], far: "#2a2a48", mid: "#4a4a6a", groundCol: ["#8a8aa8", "#4a4a6a"], shape: "clouds",
  },
  // ---------- 특별 모드 전용 지역 (special) ----------
  {
    id: "dream", special: true, name: "달콤한 꿈", bg: "bg_dream", ground: "ground_dream", variant: "candy",
    mobs: ["fairy", "bomber"], bossTrait: "악몽: 사탕 탄이 검게 변해 덮쳐 오고, 마지막엔 조작을 뒤집는다",
    effect: "sweet", effectName: "단꿈", effectDesc: "사탕 30개를 모으면 슈가 러시 (무적, 연사 2배, 적 탄이 사탕으로)",
    boss: "boss_nightmare", bossName: "악몽", midName: "젤리 골렘", transpose: 0, music: "dream",
    sky: ["#ffd6ec", "#c8b8ff"], far: "#f4b8dc", mid: "#ffffff", groundCol: ["#ffb8d8", "#c890e0"], shape: "candy",
  },
  {
    id: "judgment", special: true, name: "일곱 나팔 소리의 심판", bg: "bg_judgment", ground: "ground_judgment", variant: "judgment",
    mobs: ["eye", "bomber", "beetle"], bossTrait: "일곱 머리와 열 뿔: 일곱 곳에서 탄을 쏘고, 꼬리로 하늘의 별을 끌어내린다",
    effect: "trumpet", effectName: "나팔 소리", effectDesc: "나팔이 울릴 때마다 새로운 재앙이 내린다",
    boss: "boss_dragon", bossName: "큰 붉은 용", midName: "심판의 골렘", transpose: -2, music: "judgment",
    sky: ["#1a0508", "#5a1410"], far: "#2a0a0a", mid: "#160707", groundCol: ["#3a1a14", "#1a0a08"], shape: "ruins",
  },
];
RD.STORY_COUNT = RD.STAGES.filter((s) => !s.special).length; // 일반 지역 수

// 일곱 나팔: 요한계시록 8~11장의 재앙을 바탕으로
RD.TRUMPETS = [
  { name: "첫째 나팔", line: "피 섞인 우박과 불이 땅에 쏟아진다", tint: "rgba(255,60,20,0.12)" },
  { name: "둘째 나팔", line: "불붙은 큰 산이 바다에 던져지고, 바다가 피가 된다", tint: "rgba(160,0,20,0.22)" },
  { name: "셋째 나팔", line: "횃불 같은 큰 별 '쓴 쑥'이 떨어져 물이 쓰게 된다", tint: "rgba(80,160,40,0.12)" },
  { name: "넷째 나팔", line: "해와 달과 별의 삼분의 일이 어두워진다", tint: "rgba(0,0,0,0.2)" },
  { name: "다섯째 나팔", line: "무저갱이 열리고 연기 속에서 황충이 나온다 (첫째 화)", tint: "rgba(90,60,20,0.3)" },
  { name: "여섯째 나팔", line: "유브라데에 결박된 네 천사가 풀리고 마병대가 몰려온다 (둘째 화)", tint: "rgba(255,120,0,0.12)" },
  { name: "일곱째 나팔", line: "번개와 음성과 우레와 지진과 큰 우박, 그리고 하늘의 큰 이적", tint: "rgba(255,255,255,0.06)" },
];

// 일곱째 나팔의 일곱 천사 (요한계시록 15~16장의 일곱 대접 재앙을 바탕으로)
RD.ANGELS = [
  { name: "나팔의 천사", weapon: "금 나팔", color: "#ffd34d", trait: "나팔을 불면 빈틈 있는 음파 고리와 음파 광선이 퍼진다",
    lines: ["나팔 소리가 하늘을 찢는다. 첫째 천사가 금 대접을 들고 내려온다.", "\"가서 하나님의 진노의 일곱 대접을 땅에 쏟으라.\""] },
  { name: "채찍의 천사", weapon: "불의 채찍", color: "#9fff6a", trait: "채찍을 휘두르고, 맞으면 독한 종기(지속 피해)가 생긴다",
    lines: ["첫째 대접이 땅에 쏟아지니, 짐승의 표를 받은 자들에게 악하고 독한 종기가 났다.", "천사가 불의 채찍을 휘두른다."] },
  { name: "바다의 천사", weapon: "핏빛 대접", color: "#ff3048", trait: "피바다의 물결이 아래에서 솟구치고 옆에서 넘실댄다",
    lines: ["둘째 대접이 바다에 쏟아지니, 바다가 죽은 자의 피같이 되었다.", "바다 가운데 모든 생물이 죽었다."] },
  { name: "강의 천사", weapon: "물의 대접", color: "#4aa8ff", trait: "강과 물샘이 피가 되어 하늘에서 줄기로 쏟아진다",
    lines: ["셋째 대접이 강과 물 근원에 쏟아지니, 피가 되었다.", "물을 차지한 천사가 말한다. \"주의 심판은 의롭고 참되시도다.\""] },
  { name: "해의 천사", weapon: "태양의 대접", color: "#ff8a1a", trait: "해가 불로 태운다. 하늘에서 휩쓰는 햇빛 광선",
    lines: ["넷째 대접이 해에 쏟아지니, 해가 권세를 받아 불로 사람들을 태웠다.", "크게 태움에 태워져도, 그들은 회개하지 않았다."] },
  { name: "어둠의 천사", weapon: "어둠의 대접", color: "#a070ff", trait: "짐승의 왕좌에 쏟아진 어둠. 화면이 캄캄해지고 그림자 탄이 덮쳐 온다",
    lines: ["다섯째 대접이 짐승의 왕좌에 쏟아지니, 그 나라가 곧 어두워졌다.", "사람들이 아파서 자기 혀를 깨물었다."] },
  { name: "진노의 마지막 천사", weapon: "일곱째 대접", color: "#ffffff", trait: "큰 우박과 번개, 큰 지진. 모든 재앙이 한꺼번에 내린다",
    lines: ["일곱째 대접이 공중에 쏟아지니, 성전 보좌로부터 큰 음성이 났다.", "\"되었다.\"", "번개와 음성과 우레가 있고, 사람이 땅에 있어 온 이래로 없던 큰 지진이 있었다.", "무게가 한 달란트나 되는 큰 우박이 하늘에서 내린다."] },
];

// 나팔 컷씬 대사 (요한계시록 8~12장 내용을 풀어 쓴 것)
// who: 말하는 이, blow: 이 줄에서 천사가 나팔을 분다
RD.TRUMPET_SCENES = {
  intro: [
    { who: "", text: "어린 양이 일곱째 인을 떼실 때에, 하늘이 약 반 시간쯤 고요하였다." },
    { who: "", text: "하나님 앞에 선 일곱 천사가 일곱 나팔을 받았다." },
    { who: "", text: "또 다른 천사가 금 향로에 제단의 불을 담아 땅에 쏟으니, 우레와 음성과 번개와 지진이 일어났다." },
    { who: "", text: "일곱 나팔을 가진 일곱 천사가 나팔 불기를 준비한다." },
  ],
  0: [
    { who: "첫째 천사", text: "첫째 천사가 나팔을 분다!", blow: true },
    { who: "", text: "피 섞인 우박과 불이 땅에 쏟아져, 땅과 수목의 삼분의 일이 타고, 푸른 풀이 다 타 버렸다." },
  ],
  1: [
    { who: "둘째 천사", text: "둘째 천사가 나팔을 분다!", blow: true },
    { who: "", text: "불붙은 큰 산 같은 것이 바다에 던져지니, 바다의 삼분의 일이 피가 되었다." },
    { who: "", text: "바다 가운데 생명 가진 것들의 삼분의 일이 죽고, 배들의 삼분의 일이 깨졌다." },
    { who: "", text: "피바다 깊은 곳에서… 혼돈의 심판 드래곤이 눈을 뜬다." },
  ],
  2: [
    { who: "셋째 천사", text: "셋째 천사가 나팔을 분다!", blow: true },
    { who: "", text: "횃불같이 타는 큰 별이 하늘에서 떨어져, 강들과 물샘의 삼분의 일에 떨어졌다." },
    { who: "", text: "그 별의 이름은 '쓴 쑥'. 물의 삼분의 일이 쓴 쑥이 되어, 그 물을 마신 많은 사람이 죽었다." },
  ],
  3: [
    { who: "넷째 천사", text: "넷째 천사가 나팔을 분다!", blow: true },
    { who: "", text: "해 삼분의 일과 달 삼분의 일과 별들의 삼분의 일이 타격을 받아 어두워졌다." },
    { who: "", text: "남은 달은 온통 피같이 붉게 물들고… 깨어 있는지 꿈속인지 알 수 없는 악몽이 스며든다." },
  ],
  4: [
    { who: "독수리", text: "땅에 사는 자들에게 화, 화, 화가 있으리라! 아직 세 천사가 불 나팔 소리가 남았도다!" },
    { who: "다섯째 천사", text: "다섯째 천사가 나팔을 분다!", blow: true },
    { who: "", text: "하늘에서 땅에 떨어진 별 하나가 무저갱의 열쇠를 받았다." },
    { who: "", text: "무저갱이 열리자 큰 화덕의 연기 같은 연기가 올라와, 해와 공기가 어두워졌다." },
    { who: "", text: "연기 속에서 황충이 땅 위로 나왔다. 그들의 왕은 무저갱의 사자, 아바돈이라 한다." },
  ],
  5: [
    { who: "여섯째 천사", text: "여섯째 천사가 나팔을 분다!", blow: true },
    { who: "음성", text: "큰 강 유브라데에 결박된 네 천사를 놓아 주라." },
    { who: "", text: "마병대의 수는 이만만. 말의 머리는 사자 머리 같고, 그 입에서 불과 연기와 유황이 나온다." },
  ],
  6: [
    { who: "일곱째 천사", text: "일곱째 천사가 나팔을 분다!", blow: true },
    { who: "하늘의 큰 음성들", text: "세상 나라가 우리 주와 그의 그리스도의 나라가 되어, 그가 세세토록 왕 노릇 하시리로다." },
    { who: "", text: "하늘의 성전이 열리고, 번개와 음성과 우레와 지진과 큰 우박이 있었다." },
    { who: "", text: "하늘에 또 큰 이적이 보이니, 머리가 일곱이요 뿔이 열인 한 큰 붉은 용이라." },
  ],
};

// 몬스터 색 바꾸기 (색상 회전, 채도, 밝기)
// hueTo: 끌어당길 색상(0~360), mix: 얼마나 끌어당길지(0~1)
RD.VARIANTS = {
  ally: { hueTo: 135, mix: 0.8, sat: 1.15, light: 0.06 }, // 판다의 아군 정령
  crystal: { hueTo: 265, mix: 0.75, sat: 1.2, light: 0.04 },
  fire: { hueTo: 18, mix: 0.85, sat: 1.5, light: 0 },
  ice: { hueTo: 200, mix: 0.85, sat: 0.7, light: 0.16 },
  storm: { hueTo: 52, mix: 0.7, sat: 1.2, light: 0.06 },
  candy: { hueTo: 320, mix: 0.7, sat: 1.1, light: 0.14 },
  nightmare: { hueTo: 275, mix: 0.9, sat: 0.8, light: -0.12 },
  locust: { hueTo: 48, mix: 0.85, sat: 1.0, light: 0 },
  holy: { hueTo: 48, mix: 0.9, sat: 0.6, light: 0.25 },
  crimson: { hueTo: 0, mix: 0.92, sat: 1.4, light: -0.02 },
  judgment: { hueTo: 8, mix: 0.6, sat: 0.9, light: -0.05 },
  chaos: { hueTo: 300, mix: 0.85, sat: 1.3, light: -0.08 },
};

// 부엉이 회오리: 하나가 지울 수 있는 적 탄 수
RD.OWL_ABSORB = 5;

// 캐릭터 등급 (뽑기)
RD.GRADES = {
  C: { name: "일반", color: "#cfd8e6" },
  R: { name: "희귀", color: "#5fb8ff" },
  SR: { name: "영웅", color: "#c58aff" },
  SSR: { name: "전설", color: "#ffd34d" },
  MY: { name: "신화", color: "#ff5ad8" },
};

// 캐릭터: 공격 방식이 모두 다르다. starter 는 처음부터 가진 캐릭터
// shot.multi[파워-1] 은 탄 추가 단계별 값 (캐릭터마다 의미가 다름)
RD.CHARACTERS = [
  {
    id: "fox",
    name: "여우 견습기사",
    grade: "C",
    starter: true,
    type: "근접형",
    desc: "가까이 붙어서 벤다. 베기 게이지가 있으면 적 탄도 벤다",
    passive: "베기 게이지: 탄을 하나 벨 때마다 1칸 사용 (최대 4칸, 1.6초마다 1칸 회복)",
    illust: "illust_fox",
    shot: {
      name: "검 베기", kind: "slash", cd: 0.24, dmg: 4.5, range: 140, color: "#bfe4ff", pierceAll: true,
      multi: [1, 1.18, 1.36, 1.55], // 베기 범위 배율
      multiDesc: (lv) => `베기 범위 +18%${lv === 2 ? ", 위아래 두 번 베기" : ""}`,
    },
    sig: { name: "검기 날리기", desc: "벨 때마다 앞으로 날아가는 검기가 나간다" },
    bomb: { name: "일섬", desc: "화면 끝까지 돌진한 뒤 지나간 가로줄을 통째로 벤다", color: "#bfe4ff" },
  },
  {
    id: "rabbit",
    name: "토끼 도적",
    grade: "C",
    starter: true,
    type: "부메랑형",
    desc: "단검이 날아갔다가 돌아온다. 갈 때와 올 때 두 번 맞힌다",
    illust: "illust_rabbit",
    shot: {
      name: "부메랑 단검", kind: "boomerang", cd: 0.42, dmg: 3.6, speed: 1300, color: "#e6ecf2", pierceAll: true,
      multi: [1, 2, 3, 4], // 한 번에 던지는 단검 수
      multiDesc: (lv) => `한 번에 던지는 단검 ${lv + 1}개 → ${lv + 2}개`,
    },
    sig: { name: "급소 찌르기", desc: "단검이 15% 확률로 3배 피해" },
    bomb: { name: "그림자 단검 폭풍", desc: "그림자 분신 4명이 3초 동안 단검을 쏟아붓는다", color: "#9fffb0" },
  },
  {
    id: "bear",
    name: "곰 대장장이",
    grade: "R",
    type: "폭격형",
    desc: "망치를 포물선으로 던진다. 떨어진 자리에서 크게 폭발한다",
    illust: "illust_bear",
    shot: {
      name: "망치 투척", kind: "lob", cd: 0.6, dmg: 8, radius: 70, color: "#ffb347", pierceAll: true,
      multi: [1, 2, 3, 4], // 한 번에 던지는 망치 수
      multiDesc: (lv) => `한 번에 던지는 망치 ${lv + 1}개 → ${lv + 2}개`,
    },
    sig: { name: "대폭발", desc: "폭발 범위 +30%, 폭발 위력 +20%" },
    bomb: { name: "대지 강타", desc: "바위 기둥이 앞으로 차례차례 솟는다. 땅의 적에게 특히 강하다", color: "#ffb347" },
  },
  {
    id: "owl",
    name: "부엉이 비행사",
    grade: "SR",
    type: "설치형",
    desc: "천천히 나아가는 회오리. 닿은 적을 계속 때리고 적 탄을 날려 버린다 (회오리 하나당 5발, 보스 탄은 못 막음)",
    illust: "illust_owl",
    shot: {
      name: "회오리", kind: "tornado", cd: 0.7, dmg: 2.8, speed: 250, w: 54, h: 96, life: 2.4, color: "#bff5d8", pierceAll: true,
      multi: [1, 2, 3, 4], // 한 번에 만드는 회오리 수
      multiDesc: (lv) => `한 번에 만드는 회오리 ${lv + 1}개 → ${lv + 2}개`,
    },
    sig: { name: "폭풍", desc: "회오리가 25% 커지고 더 오래 간다" },
    bomb: { name: "회오리 바람", desc: "거대한 회오리가 적과 탄을 빨아들인다", color: "#bff5d8" },
  },
  {
    id: "cat",
    name: "고양이 마법사",
    grade: "SSR",
    type: "유도형",
    desc: "적을 따라가는 마법 구슬. 조준이 서툴러도 맞는다",
    passive: "마력 보호막: 8초마다 피해를 한 번 막는 보호막이 생긴다",
    illust: "illust_cat",
    shot: {
      name: "유도 마법 구슬", kind: "orb", cd: 0.18, dmg: 3.4, speed: 700, w: 20, h: 20, homing: true, color: "#c58aff",
      lanes: [[[0, 0]], [[-10, -10], [10, 10]], [[-14, -18], [0, 0], [14, 18]], [[-16, -26], [-6, -8], [6, 8], [16, 26]]],
      multiDesc: (lv) => `한 번에 나가는 구슬 ${lv + 1}개 → ${lv + 2}개`,
    },
    sig: { name: "분열 구슬", desc: "구슬이 맞으면 작은 구슬로 갈라진다" },
    bomb: { name: "별빛 마법진", desc: "적 탄을 코인으로 바꾸고 별똥별을 떨어뜨린다", color: "#c58aff" },
  },
  {
    id: "panda",
    name: "판다 정령술사",
    grade: "SR",
    type: "소환형",
    desc: "숲의 정령 몬스터를 아군으로 불러 함께 싸운다. 요정·슬라임·도깨비불·풍뎅이·버섯이 저마다 다르게 싸운다",
    passive: "정령의 가호: 아군 정령이 몸으로 적 탄을 막는다. 쓰러지면 잠시 뒤 다시 소환",
    illust: "illust_panda",
    shot: {
      name: "잎사귀 다트", kind: "leaf", cd: 0.28, dmg: 3.0, speed: 820, color: "#9fff8a", pierceAll: true,
      multi: [1, 2, 3, 4], // 소환하는 정령 수
      multiDesc: (lv) => `아군 정령 ${lv + 1}마리 → ${lv + 2}마리 (${["숲 요정", "정령 슬라임", "도깨비불", "풍뎅이 기사", "포자 버섯"][lv + 1]} 합류)`,
    },
    sig: { name: "정령 강화", desc: "아군 정령의 공격 속도 +25%, 위력 +20%, 체력 +25%" },
    bomb: { name: "정령왕 강림", desc: "거대한 정령왕이 6초 동안 함께 싸우며 탄을 막는다", color: "#9fffb0" },
  },
  {
    id: "mech",
    name: "다람쥐 메카닉",
    grade: "SSR",
    type: "메카형",
    desc: "메카에 타고 개틀링과 로켓을 쏜다. 테크트리로 메카를 진화시키고, 궁극기로 거대 메카에 탑승한다",
    passive: "메카 조종: 메카 체력이 먼저 닳고, 파괴되면 다시 조립 · 레벨업마다 테크트리 해금",
    illust: "illust_mech",
    shot: {
      name: "개틀링 + 로켓", kind: "gatling", cd: 0.09, dmg: 0.9, speed: 1000, color: "#ffd34d",
      multi: [1, 2, 3, 4], // 총열 수
      multiDesc: (lv) => `개틀링 총열 ${lv + 1}개 → ${lv + 2}개`,
    },
    sig: { name: "로켓 포드", desc: "로켓이 더 자주, 한 번에 1발 더 나간다" },
    bomb: { name: "메카 탑승", desc: "거대 메카에 7초 동안 탑승. 무적, 주포와 미사일 난사, 몸으로 들이받는다", color: "#ffb347" },
  },
  {
    id: "frog",
    name: "개구리 광대",
    grade: "MY",
    type: "곡예형",
    desc: "통통 튀는 저글링 공을 던진다. 공은 바닥과 벽에 튕기며 여러 번 때린다",
    passive: "익살꾼의 운: 25% 확률로 공격이 빗나간다 · 마지막 목숨이 되면 메가 프로그로 변신",
    illust: "illust_frog",
    shot: {
      name: "저글링 공", kind: "juggle", cd: 0.3, dmg: 4.2, speed: 560, color: "#ff5ad8", pierceAll: true,
      multi: [1, 2, 3, 4], // 던지는 공 수
      multiDesc: (lv) => `한 번에 던지는 공 ${lv + 1}개 → ${lv + 2}개`,
    },
    sig: { name: "폭죽 공", desc: "공이 마지막으로 튕길 때 폭죽처럼 터진다" },
    bomb: { name: "광대 쇼타임", desc: "5초 동안 카드가 소용돌이치며 날아가고, 주변 적 탄이 색종이로 변한다", color: "#ff5ad8" },
  },
];

// 캐릭터 능력치 (캐릭터 화면의 막대, 10점 만점): 공격, 사거리, 생존, 난이도
RD.STATS = {
  fox: [8, 3, 6, 4], rabbit: [6, 6, 5, 5], bear: [9, 6, 6, 4], owl: [6, 7, 7, 5],
  cat: [7, 9, 7, 2], panda: [6, 7, 8, 3], mech: [8, 6, 10, 5], frog: [8, 7, 7, 6],
};

// 여우: 탄을 베는 데 쓰는 베기 게이지
RD.FOX_PARRY = { max: 4, regen: 1.6 }; // 최대 4번, 1.6초마다 1칸 회복

// 고양이 패시브: 마력 보호막
RD.CAT_SHIELD = { every: 8 }; // 8초마다 피해를 한 번 막는 보호막

// 캐릭터 뽑기
RD.GACHA = {
  cost1: 150, // 1회 코인
  cost10: 1350, // 10회 코인 (희귀 이상 1개 보장)
  startCoins: 600, // 처음 시작할 때 주는 코인
  pity: 50, // 이 횟수 안에 전설이 안 나오면 다음에 전설 확정
  rates: { MY: 0.006, SSR: 0.025, SR: 0.08, R: 0.22 }, // 나머지는 일반
  maxStars: 6, // 같은 캐릭터가 또 나오면 각성 (별 +1)
  starDmg: 0.06, // 별 하나당 위력 +6%
  starHp: 6, // 별 하나당 최대 체력 +6
};

// 코인: 아이템을 먹거나 보스를 잡으면 모인다 (뽑기에 쓴다)
RD.COIN_VALUE = { coin: 1, gem: 2, star: 8, golem: 25, boss: 60 };

// 적. hp 는 1주차 기준 (주차가 오를수록 늘어난다)
RD.ENEMIES = {
  bat: { sprite: "bat", exp: 1, hp: 3, w: 40, h: 26, score: 100, scale: 2 },
  wisp: { sprite: "wisp", exp: 5, hp: 18, w: 40, h: 40, score: 400, scale: 2 },
  slime: { sprite: "slime", exp: 2, hp: 6, w: 40, h: 30, score: 200, scale: 2, ground: true },
  mushroom: { sprite: "mushroom", exp: 3, hp: 10, w: 40, h: 46, score: 300, scale: 2, ground: true },
  // 특성이 있는 몬스터
  eye: { img: ["mon_eye_0", "mon_eye_1"], drawH: 54, fps: 3, sprite: "eye", exp: 3, hp: 8, w: 36, h: 36, score: 400, scale: 2, desc: "저격: 조준선을 띄운 뒤 빠른 탄을 쏜다" },
  beetle: { img: ["mon_beetle_0", "mon_beetle_1", "mon_beetle_2", "mon_beetle_3"], drawH: 42, fps: 10, sprite: "beetle", exp: 4, hp: 14, w: 46, h: 32, score: 500, scale: 2.2, armor: 0.35, desc: "갑옷: 받는 피해 65% 감소. 돌진하는 동안은 배가 드러나 갑옷이 없다" },
  fairy: { img: ["mon_fairy_0", "mon_fairy_1"], drawH: 52, fps: 6, sprite: "fairy", exp: 3, hp: 7, w: 34, h: 34, score: 600, scale: 2, desc: "치유: 주변 몬스터의 체력을 채운다. 먼저 잡자" },
  bomber: { img: ["mon_bomber_0", "mon_bomber_1"], drawH: 48, fps: 4, sprite: "bomber", exp: 2, hp: 3, w: 34, h: 34, score: 300, scale: 1.8, desc: "자폭: 쫓아와서 터지고, 죽으면 탄을 흩뿌린다" },
  slimelet: { sprite: "slime", exp: 1, hp: 2, w: 22, h: 16, score: 80, scale: 1.1, ground: true, desc: "슬라임이 죽으면 둘로 갈라진다" },
  shard: { sprite: "shard", exp: 2, hp: 60, w: 26, h: 40, score: 800, scale: 1.6, desc: "수정 갑옷: 살아 있는 동안 수정 거인이 받는 피해 65% 감소" },
  golem: { flip: true, img: ["mon_golem_0", "mon_golem_1"], drawH: 124, fps: 2, sprite: "golem", exp: 25, hp: 360, w: 90, h: 100, score: 5000, scale: 3.6, ground: true, midboss: true },
  // 지역 보스 (지역마다 공격 패턴이 다르다)
  // 특별 모드 적
  locust: { sprite: "bat", variant: "locust", exp: 1, hp: 2, w: 28, h: 20, score: 60, scale: 1.5, desc: "황충: 떼로 빠르게 날아온다" },
  horseman: { sprite: "beetle", variant: "fire", exp: 4, hp: 18, w: 46, h: 32, score: 600, scale: 2.4, armor: 0.5, desc: "마병대: 돌진하며 불과 연기와 유황을 뿜는다" },
  angel: { sprite: "wisp", variant: "holy", exp: 15, hp: 420, w: 60, h: 60, score: 8000, scale: 3, elite: true, desc: "결박에서 풀린 천사" },
  boss_nightmare: { sprite: "wisp", variant: "nightmare", exp: 80, hp: 3200, w: 170, h: 170, score: 80000, scale: 7, boss: true, style: "nightmare" },
  boss_abaddon: { sprite: "batking", variant: "locust", exp: 90, hp: 2600, w: 210, h: 160, score: 100000, scale: 6.5, boss: true, style: "abaddon" },
  boss_chaos: { img: ["boss_chaos_0", "boss_chaos_1"], drawH: 270, sprite: "batking", variant: "chaos", exp: 120, hp: 4200, w: 230, h: 170, score: 200000, scale: 7.2, boss: true, style: "chaos" },
  boss_dragon: { sprite: "batking", variant: "crimson", exp: 150, hp: 5600, w: 240, h: 180, score: 300000, scale: 7.5, boss: true, style: "dragon" },
  // 일곱째 나팔의 보스: 일곱 대접을 가진 일곱 천사 (요한계시록 15~16장)
  boss_angel: { img: ["cut_angel_0", "cut_angel_1"], drawH: 230, sprite: "wisp", variant: "holy", exp: 40, hp: 5000, w: 90, h: 190, score: 60000, scale: 5, boss: true, style: "angel" },
  boss_bat: { img: ["boss_bat_0", "boss_bat_1"], drawH: 250, sprite: "batking", exp: 60, hp: 1700, w: 200, h: 150, score: 50000, scale: 6, boss: true, style: "bat" },
  boss_crystal: { flip: true, img: ["boss_crystal_0", "boss_crystal_1"], drawH: 270, sprite: "golem", variant: "crystal", exp: 70, hp: 2000, w: 150, h: 160, score: 60000, scale: 5.6, boss: true, ground: true, style: "crystal" },
  boss_fire: { img: ["boss_fire_0", "boss_fire_1"], drawH: 210, sprite: "slime", variant: "fire", exp: 80, hp: 2100, w: 200, h: 130, score: 70000, scale: 7, boss: true, ground: true, style: "fire" },
  boss_frost: { img: ["boss_frost_0", "boss_frost_1"], drawH: 250, sprite: "batking", variant: "ice", exp: 90, hp: 2300, w: 200, h: 150, score: 80000, scale: 6, boss: true, style: "frost" },
  boss_storm: { img: ["boss_storm_0", "boss_storm_1"], drawH: 250, sprite: "wisp", variant: "storm", exp: 100, hp: 2600, w: 170, h: 170, score: 100000, scale: 6.5, boss: true, style: "storm" },
};

// 적 탄
RD.BULLET = {
  speed: 230, // 기본 탄속 (주차마다 +12%)
  radius: 6,
};

// 레벨업 강화. 레벨이 오르면 3개 중 하나를 고른다.
// cat: 분류(주무기/보조무기/능력), max: 최대 단계
RD.UPGRADES = [
  { id: "multi", cat: "주무기", name: "탄 추가", max: 3, color: "#ff5a5a", desc: (lv) => `한 번에 나가는 탄 ${lv + 1}줄 → ${lv + 2}줄` }, // 이름과 설명은 캐릭터마다 바뀐다
  { id: "dmg", cat: "주무기", name: "위력 강화", max: 5, color: "#ff5a5a", desc: () => "주무기 위력 +20%" },
  { id: "rate", cat: "주무기", name: "연사 속도", max: 5, color: "#ff5a5a", desc: () => "주무기 발사 간격 -12%" },
  { id: "pierce", cat: "주무기", name: "관통", max: 2, color: "#ff5a5a", desc: () => "탄이 적을 하나 더 뚫고 지나간다", only: (ch) => ch.id === "cat" },
  { id: "sig", cat: "전용", name: "", max: 3, color: "#ffd34d", desc: () => "" }, // 캐릭터 전용 (이름과 설명은 캐릭터 데이터)
  { id: "missile", cat: "보조무기", name: "유도 미사일", max: 5, color: "#7fe6ff", desc: (lv) => lv ? "미사일 +1발, 위력 증가" : "주기적으로 적을 쫓는 미사일 발사" },
  { id: "laser", cat: "보조무기", name: "레이저", max: 5, color: "#7fe6ff", desc: (lv) => lv ? "레이저 굵기와 위력 증가" : "주기적으로 앞으로 굵은 레이저 발사" },
  { id: "orbit", cat: "보조무기", name: "수호 구슬", max: 4, color: "#7fe6ff", desc: (lv) => lv ? "구슬 +1개" : "주위를 도는 구슬. 적에게 피해를 주고 탄을 막는다" },
  { id: "rear", cat: "보조무기", name: "후방 사격", max: 4, color: "#7fe6ff", desc: (lv) => lv ? "뒤쪽 탄 +1갈래" : "뒤와 위아래 대각선으로도 쏜다" },
  { id: "lightning", cat: "보조무기", name: "번개", max: 5, color: "#7fe6ff", desc: (lv) => lv ? "번개 +1줄기, 위력 증가" : "주기적으로 화면의 적에게 번개가 떨어진다" },
  { id: "pet", cat: "보조무기", name: "펫 강화", max: 4, color: "#7fe6ff", desc: (lv) => lv ? "펫 탄 +1, 위력 증가" : "펫 슬라임이 같이 쏜다" },
  { id: "hp", cat: "능력", name: "최대 체력", max: 5, color: "#9fffb0", desc: () => "최대 체력 +25, 체력 모두 회복" },
  { id: "regen", cat: "능력", name: "자연 회복", max: 3, color: "#9fffb0", desc: () => "초당 체력 +1 회복" },
  { id: "armor", cat: "능력", name: "갑옷", max: 3, color: "#9fffb0", desc: () => "받는 피해 -15%" },
  { id: "speed", cat: "능력", name: "날개", max: 3, color: "#9fffb0", desc: () => "이동 속도 +12%" },
  { id: "magnet", cat: "능력", name: "자석", max: 3, color: "#9fffb0", desc: () => "아이템을 끌어오는 범위 +60%" },
  { id: "bomb", cat: "능력", name: "폭탄 상자", max: 3, color: "#9fffb0", desc: () => "폭탄 +2, 폭탄 위력 +30%" },
  { id: "luck", cat: "능력", name: "행운", max: 3, color: "#9fffb0", desc: () => "하트가 더 자주 나오고 점수 +15%" },
];

// 레이드 보스: [보스 종류, 지역 id, 이름]
RD.RAID_BOSSES = [
  ["boss_bat", "forest", "박쥐 왕"],
  ["boss_crystal", "cave", "수정 거인"],
  ["boss_fire", "volcano", "마그마 슬라임 왕"],
  ["boss_frost", "snow", "서리 여왕"],
  ["boss_storm", "sky", "폭풍 군주"],
  ["boss_nightmare", "dream", "악몽"],
  ["boss_abaddon", "judgment", "무저갱의 사자 아바돈"],
  ["boss_chaos", "judgment", "혼돈의 심판 드래곤"],
];
// 다람쥐 메카 (메카 체력은 다람쥐 체력과 따로)
RD.MECH = {
  names: ["Mk.I 정찰 메카", "Mk.II 강습 메카", "Mk.III 요새 메카"],
  hp: [70, 100, 140], // 진화 단계별 메카 최대 체력
  armor: 0.8, // 메카 장갑: 메카가 받는 피해 -20% (진화할 때마다 10% 더 단단)
  rebuildParts: 18, // 파괴된 뒤 부품 18개면 다시 조립
  rebuildTime: 35, // 부품을 못 모아도 35초면 저절로 조립
  rebuildHp: 0.4, // 다시 조립하면 체력 40%로 돌아온다
  colors: [["#5a7a9a", "#8ab0d0", "#3a4a5a"], ["#c8702a", "#ffb347", "#6a3a1a"], ["#c8a030", "#ffe27a", "#6a5010"]],
};
// 판다 아군 정령 (진짜 몬스터처럼 돌아다니며 싸우는 아군). 순서대로 합류
RD.ALLIES = [
  { id: "fairy", sprite: "fairy", name: "숲 요정", hp: 55, speed: 190, role: "shoot", range: 300, cd: 0.5, dmg: 1.0, scale: 1.8 },
  { id: "slime", sprite: "slime", name: "정령 슬라임", hp: 130, speed: 150, role: "melee", dps: 7, scale: 2.0 },
  { id: "wisp", sprite: "wisp", name: "도깨비불", hp: 50, speed: 170, role: "shoot", range: 360, cd: 0.85, dmg: 1.9, homing: true, scale: 1.7 },
  { id: "beetle", sprite: "beetle", name: "풍뎅이 기사", hp: 90, speed: 300, role: "melee", dps: 11, scale: 1.9 },
  { id: "mushroom", sprite: "mushroom", name: "포자 버섯", hp: 80, speed: 120, role: "spore", radius: 130, cd: 1.3, dmg: 2.4, scale: 1.9 },
];
RD.ALLY_RESPAWN = 5; // 쓰러지면 5초 뒤 다시 소환

// 메카 테크트리: 레벨이 오를 때마다 테크 포인트 1점 (모두 찍으려면 28점) (전투 중 테크트리 버튼으로 해금)
RD.MECH_TECH_COLS = [["진화", "#ffb347"], ["방어", "#7fe6ff"], ["정비", "#9fffb0"]];
RD.MECH_TECH = [
  { id: "mk2", col: 0, row: 0, cost: 3, icon: "up", name: "Mk.II 강습 메카", desc: "메카 진화: 총열 +1 · 위력 +15% · 메카 체력 100" },
  { id: "mk3", col: 0, row: 1, cost: 5, req: "mk2", icon: "star", name: "Mk.III 요새 메카", desc: "최종 진화: 총열 +2 · 위력 +30% · 로켓 연사 · 메카 체력 140" },
  { id: "cannon", col: 0, row: 2, cost: 4, req: "mk3", icon: "target", name: "주포 탑재", desc: "1.2초마다 가장 가까운 적에게 강력한 주포를 쏜다" },
  { id: "plate", col: 1, row: 0, cost: 2, icon: "shield", name: "강화 장갑", desc: "메카 최대 체력 +30%" },
  { id: "repair", col: 1, row: 1, cost: 3, req: "plate", icon: "heart", name: "자동 수리", desc: "메카가 1초마다 체력 1을 회복한다" },
  { id: "barrier", col: 1, row: 2, cost: 4, req: "repair", icon: "shield", name: "방어막 발생기", desc: "12초마다 적 공격 1번을 막는 방어막이 생긴다" },
  { id: "quick", col: 2, row: 0, cost: 2, icon: "gear", name: "빠른 재조립", desc: "다시 조립하는 데 필요한 부품과 시간 -25%" },
  { id: "eject", col: 2, row: 1, cost: 2, req: "quick", icon: "skull", name: "비상 탈출", desc: "메카가 부서질 때 크게 폭발해 주변 탄을 지우고 적에게 피해" },
  { id: "call", col: 2, row: 2, cost: 3, req: "eject", icon: "bolt", name: "긴급 호출", desc: "궁극기 +1 · 거대 메카 탑승 시간 +2초" },
];

// 캐릭터마다 다른 기본 체력
RD.CHAR_HP = { fox: 110, rabbit: 85, bear: 140, owl: 90, cat: 80, panda: 100, mech: 70, frog: 95 };

// 개구리 광대: 마지막 목숨이 되면 메가 프로그로 변신
RD.MEGA_FROG = {
  hpMul: 1.3, // 최대 체력 +30%
  roarCd: 0.75, roarR: 240, roarLife: 0.38, roarDmg: 5.5, // 포효: 넓게 퍼지며 적을 때리고 탄을 되돌린다
  healPerBullet: 0, healPerHit: 0.3, // 탄을 되돌릴 때는 회복하지 않는다 (적을 맞혔을 때만)
  hunger: 25, hungerMax: 30, // 배고픔 게이지(초): 계속 줄고, 바닥나면 원래 개구리로 돌아간다
  feedSmall: 2, feedBig: 10, // 삼키면 채워지는 양 (일반 몹 / 중간 보스)
  feedKill: 0.3, // 적을 쓰러뜨릴 때마다 조금 찬다
  feedBossHit: 0.6, // 포효로 보스를 맞히면 찬다 (가까이 붙어야 한다)
  gulpR: 430, gulpLife: 2.2, // 꿀꺽: 이 거리 안의 적(보스 제외)을 삼킨다
  shieldCap: 2, // 보호막 최대 = 최대 체력 x2
  powSmall: 0.04, powBig: 0.25, powMax: 1, // 삼킬 때마다 공격력 증가 (최대 +100%)
};
RD.RAID = { baseHp: 6500, lvHp: 0.45, rageEvery: 40, reward: 120, lvReward: 60 };

// ---------- 레이드 전용: 브롤스타즈식 조작 ----------
// 일반 공격은 직접 조준해서 쏘고 탄환(ammo)을 쓴다. 탄환은 시간이 지나면 다시 찬다.
// 일반 공격을 적에게 맞히면 궁극기 게이지가 찬다. (charge = 한 번 맞힐 때 차는 양, 1이면 가득)
RD.BRAWL = {
  fox: { name: "검 베기", ammo: 3, reload: 1.1, charge: 0.11, dmg: 23, range: 150, arc: 0.65 },
  rabbit: { name: "부메랑 단검 3개", ammo: 3, reload: 1.2, charge: 0.05, dmg: 7, count: 3, speed: 1100 },
  bear: { name: "망치 투척", ammo: 3, reload: 1.5, charge: 0.14, dmg: 50, radius: 80, dist: 380 },
  owl: { name: "회오리", ammo: 3, reload: 1.35, charge: 0.028, dmg: 10, size: 1, life: 1.8, speed: 300 },
  frog: { name: "저글링 공 3개", ammo: 3, reload: 1.05, charge: 0.07, dmg: 13, count: 3 },
  panda: { name: "잎사귀 다트 + 정령", ammo: 3, reload: 1.1, charge: 0.08, dmg: 17, count: 2 },
  mech: { name: "개틀링 연사", ammo: 3, reload: 1.3, charge: 0.025, dmg: 7.5, count: 6 },
  cat: { name: "유도 구슬 3개", ammo: 3, reload: 1.1, charge: 0.05, dmg: 21, count: 3 },
};

// 레벨업 강화 (캐릭터마다 다르다). fx: 단계마다 더해지는 효과
//   dmg 위력, reload 재장전 단축, ammo 탄환 수, charge 궁극기 충전, spow 궁극기 위력, sdur 궁극기 지속/규모,
//   count 발사 수, range 사거리/범위, size 크기, life 지속, crit 급소 확률, wave 검기, split 분열, refill 궁극기 뒤 탄환 충전
const BC = { atk: ["일반 공격", "#ff5a5a"], sup: ["궁극기", "#ffd34d"], com: ["공통", "#9fffb0"] };
const bu = (id, c, name, max, fx, desc) => ({ id, cat: BC[c][0], color: BC[c][1], name, max, fx, desc: () => desc, brawl: true });
const BRAWL_COMMON = [
  bu("hp", "com", "최대 체력", 4, {}, "최대 체력 +25, 체력 모두 회복"),
  bu("speed", "com", "날개", 3, {}, "이동 속도 +12%"),
  bu("ammo_up", "com", "탄창 확장", 2, { ammo: 1 }, "탄환 칸 +1"),
];
RD.BRAWL_UPS = {
  fox: [
    bu("f_wide", "atk", "넓은 베기", 3, { range: 0.2 }, "베기 범위 +20%"),
    bu("f_sharp", "atk", "날카로운 검", 4, { dmg: 0.2 }, "베기 위력 +20%"),
    bu("f_wave", "atk", "검기 날리기", 2, { wave: 1 }, "벨 때마다 앞으로 검기가 날아간다"),
    bu("f_quick", "atk", "재빠른 손놀림", 3, { reload: 0.15 }, "재장전 -15%"),
    bu("f_flash", "sup", "일섬 강화", 3, { spow: 0.35 }, "일섬 위력 +35%"),
    bu("f_spirit", "sup", "투지", 3, { charge: 0.25 }, "궁극기 충전 +25%"),
    bu("f_after", "sup", "잔상", 1, { refill: 1 }, "일섬을 쓰면 탄환이 모두 찬다"),
    ...BRAWL_COMMON,
  ],
  rabbit: [
    bu("r_more", "atk", "단검 추가", 3, { count: 1 }, "한 번에 던지는 단검 +1"),
    bu("r_crit", "atk", "급소 찌르기", 3, { crit: 0.12 }, "단검이 12% 확률로 3배 피해"),
    bu("r_far", "atk", "먼 투척", 2, { range: 0.15 }, "단검 속도와 사거리 +15%"),
    bu("r_quick", "atk", "빠른 손", 3, { reload: 0.15 }, "재장전 -15%"),
    bu("r_shadow", "sup", "그림자 강화", 3, { spow: 0.35 }, "그림자 단검 위력 +35%"),
    bu("r_stay", "sup", "분신 유지", 2, { sdur: 1 }, "분신이 1초 더 남는다"),
    bu("r_absorb", "sup", "그림자 흡수", 3, { charge: 0.25 }, "궁극기 충전 +25%"),
    ...BRAWL_COMMON,
  ],
  bear: [
    bu("b_big", "atk", "큰 망치", 3, { size: 0.25 }, "폭발 범위 +25%"),
    bu("b_twin", "atk", "쌍망치", 2, { count: 1 }, "한 번에 던지는 망치 +1"),
    bu("b_arm", "atk", "단련된 팔", 4, { dmg: 0.2 }, "망치 위력 +20%"),
    bu("b_rhythm", "atk", "대장장이의 리듬", 3, { reload: 0.15 }, "재장전 -15%"),
    bu("b_slam", "sup", "대지 강타 강화", 3, { spow: 0.35 }, "대지 강타 위력 +35%"),
    bu("b_after", "sup", "여진", 2, { sdur: 1 }, "바위 기둥 +3개"),
    bu("b_rage", "sup", "분노의 망치질", 3, { charge: 0.25 }, "궁극기 충전 +25%"),
    ...BRAWL_COMMON,
  ],
  owl: [
    bu("o_big", "atk", "큰 회오리", 3, { size: 0.25 }, "회오리 크기 +25%"),
    bu("o_long", "atk", "긴 회오리", 3, { life: 0.3 }, "회오리 지속 +30%"),
    bu("o_twin", "atk", "쌍둥이 회오리", 2, { count: 1 }, "한 번에 만드는 회오리 +1"),
    bu("o_breath", "atk", "바람 숨결", 3, { reload: 0.15 }, "재장전 -15%"),
    bu("o_storm", "sup", "회오리 바람 강화", 3, { spow: 0.35 }, "회오리 바람 위력 +35%"),
    bu("o_eye", "sup", "태풍의 눈", 2, { sdur: 1 }, "회오리 바람이 1초 더 분다"),
    bu("o_gather", "sup", "바람 모으기", 3, { charge: 0.25 }, "궁극기 충전 +25%"),
    ...BRAWL_COMMON,
  ],
  frog: [
    bu("g_more", "atk", "공 추가", 3, { count: 1 }, "한 번에 던지는 공 +1"),
    bu("g_bounce", "atk", "고무공", 3, { life: 1 }, "공이 1번 더 튕긴다"),
    bu("g_boom", "atk", "폭죽 공", 2, { split: 1 }, "공이 마지막에 폭죽처럼 터진다"),
    bu("g_quick", "atk", "빠른 저글링", 3, { reload: 0.15 }, "재장전 -15%"),
    bu("g_show", "sup", "앙코르", 3, { spow: 0.35 }, "쇼타임 위력 +35%"),
    bu("g_long", "sup", "커튼콜", 2, { sdur: 1 }, "쇼타임 1초 연장"),
    bu("g_clap", "sup", "박수갈채", 3, { charge: 0.25 }, "궁극기 충전 +25%"),
    ...BRAWL_COMMON,
  ],
  panda: [
    bu("p_more", "atk", "정령 추가", 3, { count: 1 }, "함께 싸우는 정령 +1"),
    bu("p_fast", "atk", "정령의 속삭임", 3, { reload: 0.15 }, "재장전 -15%, 정령 공격 속도 증가"),
    bu("p_leaf", "atk", "날카로운 잎", 4, { dmg: 0.2 }, "잎사귀와 정령 위력 +20%"),
    bu("p_guard", "atk", "수호 정령", 2, { size: 0.5 }, "정령이 막는 범위 +50%"),
    bu("p_king", "sup", "정령왕 강화", 3, { spow: 0.35 }, "정령왕 위력 +35%"),
    bu("p_stay", "sup", "오래 머무는 정령왕", 2, { sdur: 1 }, "정령왕이 1초 더 머문다"),
    bu("p_bond", "sup", "교감", 3, { charge: 0.25 }, "궁극기 충전 +25%"),
    ...BRAWL_COMMON,
  ],
  mech: [
    bu("m_barrel", "atk", "총열 추가", 3, { count: 2 }, "한 번에 쏘는 탄 +2"),
    bu("m_rocket", "atk", "로켓 포드", 3, { wave: 1 }, "연사할 때마다 로켓 +1발"),
    bu("m_cal", "atk", "대구경 탄", 4, { dmg: 0.2 }, "탄 위력 +20%"),
    bu("m_loader", "atk", "자동 장전기", 3, { reload: 0.15 }, "재장전 -15%"),
    bu("m_cannon", "sup", "주포 강화", 3, { spow: 0.35 }, "메카 주포 위력 +35%"),
    bu("m_fuel", "sup", "연료 증설", 2, { sdur: 1 }, "메카 탑승 시간 +1초"),
    bu("m_overdrive", "sup", "오버드라이브", 3, { charge: 0.25 }, "궁극기 충전 +25%"),
    ...BRAWL_COMMON,
  ],
  cat: [
    bu("c_more", "atk", "구슬 추가", 3, { count: 1 }, "한 번에 쏘는 구슬 +1"),
    bu("c_split", "atk", "분열 구슬", 2, { split: 1 }, "구슬이 맞으면 작은 구슬로 갈라진다"),
    bu("c_amp", "atk", "마력 증폭", 4, { dmg: 0.2 }, "구슬 위력 +20%"),
    bu("c_chant", "atk", "빠른 영창", 3, { reload: 0.15 }, "재장전 -15%"),
    bu("c_star", "sup", "별빛 강화", 3, { spow: 0.35 }, "별똥별 위력 +35%"),
    bu("c_rain", "sup", "유성우", 2, { sdur: 1 }, "별똥별이 1초 더 떨어진다"),
    bu("c_cycle", "sup", "마력 순환", 3, { charge: 0.25 }, "궁극기 충전 +25%"),
    ...BRAWL_COMMON,
  ],
};

// 어드벤처 런 (쿠키런 오븐브레이크 방식) 설정
RD.ADV = {
  CONFIG: {
    width: 960, height: 540,
    groundY: 440, // 캐릭터 발이 닿는 높이
    playerScreenX: 200,
    gravity: 2600, jumpVelocity: 900, doubleJumpVelocity: 820,
    startSpeed: 360, maxSpeed: 680, speedGain: 5,
    maxHp: 100, hpDrain: 2.2, hpDrainGain: 0.012, // 체력이 계속 줄어든다
    hitDamage: 25, hitInvuln: 1.2,
    skillCharge: 12, skillDuration: 5,
    spriteScale: 3,
  },
  ITEMS: {
    gem: { img: "item_gem", size: 30, score: 10 },
    star: { img: "item_star", size: 34, score: 30 },
    coin: { img: "item_coin", size: 30, score: 5, coins: 1 },
    bigcoin: { img: "item_coin_big", size: 52, score: 50, coins: 10 },
    heart: { img: "item_heart", size: 44, score: 0, heal: 30 },
    boost: { img: "item_star_rainbow", size: 46, score: 100, effect: "boost" },
    magnet: { img: "item_orb", size: 46, score: 50, effect: "magnet" },
  },
  OBSTACLES: {
    stone: { img: "obs_stone_pillar", kind: "ground", h: 92 },
    totem: { img: "obs_totem", kind: "ground", h: 104 },
    crystal: { img: "obs_crystal_pillar", kind: "ground", h: 112 },
    log: { img: "obs_log_hanging", kind: "hanging", w: 210 },
  },
  // 캐릭터별 스킬 (게이지가 차면 자동 발동)
  SKILLS: { fox: "돌진", cat: "자석 마법", bear: "거대화", rabbit: "3단 점프", owl: "비행", panda: "정령 자석", mech: "메카 탑승", frog: "개구리 점프" },
  SKILL_AS: { panda: "cat", mech: "bear", frog: "rabbit" }, // 새 캐릭터의 스킬은 기존 스킬 방식을 빌려 쓴다
};

RD.IMAGES = [
  "item_coin_big", "item_star_rainbow", "item_orb", "obs_stone_pillar", "obs_totem", "obs_crystal_pillar", "obs_log_hanging",
  "bg_forest", "ground",
  // 새 지역 이미지 (없으면 코드로 그린 배경을 쓴다)
  "bg_cave", "ground_cave", "bg_volcano", "ground_volcano", "bg_snow", "ground_snow", "bg_sky", "ground_sky",
  // 지역 보스 이미지 (2프레임)
  "boss_bat_0", "boss_bat_1", "boss_crystal_0", "boss_crystal_1", "boss_fire_0", "boss_fire_1",
  "boss_frost_0", "boss_frost_1", "boss_storm_0", "boss_storm_1",
  "boss_chaos_0", "boss_chaos_1", "cut_angel_0", "cut_angel_1",
  "mon_golem_0", "mon_golem_1", "mon_eye_0", "mon_eye_1", "mon_fairy_0", "mon_fairy_1", "mon_bomber_0", "mon_bomber_1",
  "mon_beetle_0", "mon_beetle_1", "mon_beetle_2", "mon_beetle_3",
  "item_gem", "item_star", "item_coin", "item_heart",
  "pet_0", "pet_1", "pet_2", "pet_3",
  // 플레이 캐릭터 그림 (4프레임: 날기 2, 공격, 피격). 없으면 코드로 그린 도트를 쓴다
  ...["fox", "rabbit", "bear", "owl", "cat", "panda", "mech", "frog"].flatMap((id) => [0, 1, 2, 3].map((f) => `player_${id}_${f}`)),
];
RD.ILLUSTS = ["illust_fox", "illust_cat", "illust_bear", "illust_rabbit", "illust_owl", "illust_panda", "illust_mech", "illust_frog", "illust_megafrog"];
