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
  hitRadius: 5, // 플레이어 피격 판정 반지름 (작을수록 쉬움)
  lives: 3,
  bombs: 2,
  maxBombs: 5,
  maxPower: 4,
  respawnInvuln: 2.5,
  bombInvuln: 2.2,
  bombDamage: 60,
  extendEvery: 100000, // 이 점수마다 잔기 +1
};

// 아이템: P = 파워업, B = 폭탄, 나머지는 점수
RD.ITEMS = {
  power: { label: "P", color: "#ff5a5a", size: 30, score: 100 },
  bomb: { label: "B", color: "#4aa8ff", size: 30, score: 100 },
  coin: { img: "item_coin", size: 24, score: 100 },
  gem: { img: "item_gem", size: 26, score: 300 },
  star: { img: "item_star", size: 30, score: 1000 },
  life: { img: "item_heart", size: 34, score: 0, life: 1 },
};

// 캐릭터: 샷(파워 1~4)과 폭탄
// shot.lanes[파워-1] = 한 번에 나가는 탄 배치 [y 오프셋, 각도(도)]
RD.CHARACTERS = [
  {
    id: "fox",
    name: "여우 견습기사",
    type: "관통형",
    desc: "적을 뚫고 나가는 검기. 줄지어 오는 적에게 강하다",
    illust: "illust_fox",
    shot: {
      name: "검기", kind: "wave", cd: 0.16, dmg: 3, speed: 900, w: 26, h: 44, pierce: true, color: "#bfe4ff",
      lanes: [[[0, 0]], [[-14, 0], [14, 0]], [[-24, -4], [0, 0], [24, 4]], [[-36, -6], [-12, 0], [12, 0], [36, 6]]],
    },
    bomb: { name: "일섬", color: "#bfe4ff" },
  },
  {
    id: "cat",
    name: "고양이 마법사",
    type: "유도형",
    desc: "적을 따라가는 마법 구슬. 조준이 서툴러도 맞는다",
    illust: "illust_cat",
    shot: {
      name: "유도 마법 구슬", kind: "orb", cd: 0.2, dmg: 2.5, speed: 700, w: 20, h: 20, homing: true, color: "#c58aff",
      lanes: [[[0, 0]], [[-10, -10], [10, 10]], [[-14, -18], [0, 0], [14, 18]], [[-16, -26], [-6, -8], [6, 8], [16, 26]]],
    },
    bomb: { name: "별빛 마법진", color: "#c58aff" },
  },
  {
    id: "bear",
    name: "곰 대장장이",
    type: "강타형",
    desc: "느리지만 아주 센 쇠망치 탄. 보스에게 강하다",
    illust: "illust_bear",
    shot: {
      name: "쇠망치 탄", kind: "hammer", cd: 0.3, dmg: 7, speed: 760, w: 28, h: 28, color: "#ffb347",
      lanes: [[[0, 0]], [[-12, 0], [12, 0]], [[-20, -3], [0, 0], [20, 3]], [[-26, -5], [-9, 0], [9, 0], [26, 5]]],
    },
    bomb: { name: "대지 강타", color: "#ffb347" },
  },
  {
    id: "rabbit",
    name: "토끼 도적",
    type: "연사형",
    desc: "빠르게 쏟아지는 단검. 앞쪽 화력이 가장 세다",
    illust: "illust_rabbit",
    shot: {
      name: "단검 난사", kind: "dagger", cd: 0.07, dmg: 1.1, speed: 1150, w: 22, h: 10, color: "#e6ecf2",
      lanes: [[[0, 0]], [[-8, 0], [8, 0]], [[-14, 0], [0, 0], [14, 0]], [[-20, -2], [-7, 0], [7, 0], [20, 2]]],
    },
    bomb: { name: "그림자 단검 폭풍", color: "#9fffb0" },
  },
  {
    id: "owl",
    name: "부엉이 비행사",
    type: "확산형",
    desc: "부채꼴로 퍼지는 바람 깃털. 화면 넓게 잡는다",
    illust: "illust_owl",
    shot: {
      name: "바람 깃털", kind: "feather", cd: 0.15, dmg: 1.45, speed: 880, w: 22, h: 14, color: "#bff5d8",
      lanes: [[[0, -8], [0, 0], [0, 8]], [[0, -16], [0, -6], [0, 6], [0, 16]], [[0, -24], [0, -12], [0, 0], [0, 12], [0, 24]], [[0, -32], [0, -20], [0, -8], [0, 8], [0, 20], [0, 32]]],
    },
    bomb: { name: "회오리 바람", color: "#bff5d8" },
  },
];

// 적. hp 는 1주차 기준 (주차가 오를수록 늘어난다)
RD.ENEMIES = {
  bat: { sprite: "bat", hp: 3, w: 40, h: 26, score: 100, scale: 2 },
  wisp: { sprite: "wisp", hp: 18, w: 40, h: 40, score: 400, scale: 2 },
  slime: { sprite: "slime", hp: 6, w: 40, h: 30, score: 200, scale: 2, ground: true },
  mushroom: { sprite: "mushroom", hp: 10, w: 40, h: 46, score: 300, scale: 2, ground: true },
  golem: { sprite: "golem", hp: 500, w: 90, h: 100, score: 5000, scale: 3.6, ground: true, midboss: true },
  boss: { sprite: "batking", hp: 2400, w: 200, h: 150, score: 50000, scale: 6, boss: true },
};

// 적 탄
RD.BULLET = {
  speed: 230, // 기본 탄속 (주차마다 +12%)
  radius: 6,
};

RD.IMAGES = [
  "bg_forest", "ground",
  "item_gem", "item_star", "item_coin", "item_heart",
  "pet_0", "pet_1", "pet_2", "pet_3",
];
RD.ILLUSTS = ["illust_fox", "illust_cat", "illust_bear", "illust_rabbit", "illust_owl"];
