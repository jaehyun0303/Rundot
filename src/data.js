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
};

// 난이도
RD.DIFFICULTY = {
  easy: { name: "쉬움", color: "#7fe08a", enemyHp: 0.7, bulletSpeed: 0.8, fireRate: 0.7, damage: 0.6, lives: 5, score: 0.5, exp: 1.3 },
  normal: { name: "보통", color: "#ffd34d", enemyHp: 1, bulletSpeed: 1, fireRate: 1, damage: 1, lives: 3, score: 1, exp: 1 },
  hard: { name: "어려움", color: "#ff8a3d", enemyHp: 1.35, bulletSpeed: 1.2, fireRate: 1.35, damage: 1.4, lives: 3, score: 1.6, exp: 0.9 },
  hell: { name: "지옥", color: "#ff4d5e", enemyHp: 1.8, bulletSpeed: 1.4, fireRate: 1.8, damage: 2, lives: 2, score: 2.5, exp: 0.8 },
};

// 게임 모드
RD.MODES = {
  story: { name: "스테이지", desc: "3개 스테이지를 깨고 박쥐 왕을 쓰러뜨려라" },
  endless: { name: "무한", desc: "끝없이 몰려오는 적. 얼마나 버틸 수 있을까" },
  bossrush: { name: "보스 러시", desc: "강화 3개를 고르고 보스만 연달아 상대한다" },
  timeattack: { name: "타임 어택", desc: "3분 동안 최대한 많은 점수를 모아라", time: 180 },
};

// 캐릭터 등급 (뽑기)
RD.GRADES = {
  C: { name: "일반", color: "#cfd8e6" },
  R: { name: "희귀", color: "#5fb8ff" },
  SR: { name: "영웅", color: "#c58aff" },
  SSR: { name: "전설", color: "#ffd34d" },
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
    desc: "가까이 붙어서 벤다. 베기는 적 탄도 베어 없앤다",
    illust: "illust_fox",
    shot: {
      name: "검 베기", kind: "slash", cd: 0.24, dmg: 4.5, range: 125, color: "#bfe4ff", pierceAll: true,
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
      name: "부메랑 단검", kind: "boomerang", cd: 0.42, dmg: 3.2, speed: 1150, color: "#e6ecf2", pierceAll: true,
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
    desc: "천천히 나아가는 회오리. 닿은 적을 계속 때리고 적 탄을 날려 버린다",
    illust: "illust_owl",
    shot: {
      name: "회오리", kind: "tornado", cd: 0.85, dmg: 2.4, speed: 250, w: 54, h: 96, life: 2.4, color: "#bff5d8", pierceAll: true,
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
    illust: "illust_cat",
    shot: {
      name: "유도 마법 구슬", kind: "orb", cd: 0.2, dmg: 3, speed: 700, w: 20, h: 20, homing: true, color: "#c58aff",
      lanes: [[[0, 0]], [[-10, -10], [10, 10]], [[-14, -18], [0, 0], [14, 18]], [[-16, -26], [-6, -8], [6, 8], [16, 26]]],
      multiDesc: (lv) => `한 번에 나가는 구슬 ${lv + 1}개 → ${lv + 2}개`,
    },
    sig: { name: "분열 구슬", desc: "구슬이 맞으면 작은 구슬로 갈라진다" },
    bomb: { name: "별빛 마법진", desc: "적 탄을 코인으로 바꾸고 별똥별을 떨어뜨린다", color: "#c58aff" },
  },
];

// 캐릭터 뽑기
RD.GACHA = {
  cost1: 150, // 1회 코인
  cost10: 1350, // 10회 코인 (희귀 이상 1개 보장)
  startCoins: 600, // 처음 시작할 때 주는 코인
  pity: 50, // 이 횟수 안에 전설이 안 나오면 다음에 전설 확정
  rates: { SSR: 0.025, SR: 0.08, R: 0.22 }, // 나머지는 일반
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
  golem: { sprite: "golem", exp: 25, hp: 360, w: 90, h: 100, score: 5000, scale: 3.6, ground: true, midboss: true },
  boss: { sprite: "batking", exp: 60, hp: 1700, w: 200, h: 150, score: 50000, scale: 6, boss: true },
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
  { id: "pierce", cat: "주무기", name: "관통", max: 2, color: "#ff5a5a", desc: () => "탄이 적을 하나 더 뚫고 지나간다", only: (ch) => !ch.shot.pierceAll },
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

RD.IMAGES = [
  "bg_forest", "ground",
  "item_gem", "item_star", "item_coin", "item_heart",
  "pet_0", "pet_1", "pet_2", "pet_3",
];
RD.ILLUSTS = ["illust_fox", "illust_cat", "illust_bear", "illust_rabbit", "illust_owl"];
