// 게임 밸런스 값과 캐릭터 데이터. 숫자를 바꿔 가며 조정하면 된다.
window.RD = window.RD || {};

RD.CONFIG = {
  width: 960,
  height: 540,
  groundY: 440, // 캐릭터 발이 닿는 높이
  playerScreenX: 200, // 화면에서 캐릭터가 서 있는 x 위치
  gravity: 2600,
  jumpVelocity: 900,
  doubleJumpVelocity: 820,
  startSpeed: 360,
  maxSpeed: 680,
  speedGain: 5, // 초당 속도 증가량
  maxHp: 100,
  hpDrain: 2.2, // 초당 체력 감소
  hpDrainGain: 0.012, // 시간이 지날수록 감소량이 늘어남
  hitDamage: 25,
  hitInvuln: 1.2,
  skillCharge: 12, // 스킬이 차는 데 걸리는 시간(초)
  skillDuration: 5,
  spriteScale: 3,
};

// 수집 아이템: 점수, 코인, 효과
RD.ITEMS = {
  gem: { img: "item_gem", size: 30, score: 10 },
  star: { img: "item_star", size: 34, score: 30 },
  coin: { img: "item_coin", size: 30, score: 5, coins: 1 },
  bigcoin: { img: "item_coin_big", size: 52, score: 50, coins: 10 },
  heart: { img: "item_heart", size: 44, score: 0, heal: 30 },
  boost: { img: "item_star_rainbow", size: 46, score: 100, effect: "boost" },
  magnet: { img: "item_orb", size: 46, score: 50, effect: "magnet" },
};

// 장애물: kind 가 ground 면 점프로, hanging 이면 슬라이드로 피한다.
RD.OBSTACLES = {
  stone: { img: "obs_stone_pillar", kind: "ground", h: 92 },
  totem: { img: "obs_totem", kind: "ground", h: 104 },
  crystal: { img: "obs_crystal_pillar", kind: "ground", h: 112 },
  log: { img: "obs_log_hanging", kind: "hanging", w: 210 },
};

// 캐릭터: 스킬 종류와 선택 화면 일러스트
RD.CHARACTERS = [
  {
    id: "fox",
    name: "여우 견습기사",
    skill: "돌진",
    desc: "빠르게 돌진하며 장애물을 부순다",
    illust: "illust_fox",
    attack: { name: "검기", kind: "wave", cd: 0.5, dmg: 2, speed: 780, life: 0.7, w: 34, h: 70, pierce: true, color: "#bfe4ff" },
  },
  {
    id: "cat",
    name: "고양이 마법사",
    skill: "자석 마법",
    desc: "화면의 아이템을 모두 끌어당긴다",
    illust: "illust_cat",
    attack: { name: "유도 마법 구슬", kind: "orb", cd: 0.45, dmg: 2, speed: 700, life: 1.4, w: 30, h: 30, homing: true, color: "#c58aff" },
  },
  {
    id: "bear",
    name: "곰 대장장이",
    skill: "거대화",
    desc: "몸이 커져서 장애물을 부순다",
    illust: "illust_bear",
    attack: { name: "땅울림 충격파", kind: "quake", cd: 0.7, dmg: 4, speed: 620, life: 0.8, w: 60, h: 110, pierce: true, ground: true, color: "#ffb347" },
  },
  {
    id: "rabbit",
    name: "토끼 도적",
    skill: "3단 점프",
    desc: "점프를 세 번까지 할 수 있고 점수가 2배",
    illust: "illust_rabbit",
    attack: { name: "단검 난사", kind: "dagger", cd: 0.2, dmg: 1.2, speed: 1000, life: 0.7, w: 30, h: 22, color: "#e6ecf2" },
  },
  {
    id: "owl",
    name: "부엉이 비행사",
    skill: "비행",
    desc: "점프를 누르고 있으면 하늘을 난다",
    illust: "illust_owl",
    attack: { name: "바람 깃털", kind: "feather", cd: 0.38, dmg: 1.4, speed: 900, life: 0.75, w: 30, h: 24, spread: 3, color: "#bff5d8" },
  },
];

// 몬스터: 부딪히면 체력이 깎이고, 공격하거나 위에서 밟으면 쓰러뜨린다.
RD.MONSTERS = {
  slime: { hp: 2, w: 44, h: 34, score: 30, coins: 1, exp: 1, speed: 40, from: 0 }, // 통통 뛰면서 다가온다
  mushroom: { hp: 3, w: 44, h: 52, score: 50, coins: 1, exp: 2, speed: 90, from: 0 }, // 걸어온다
  bat: { hp: 2, w: 46, h: 30, score: 40, coins: 1, exp: 1, speed: 120, fly: true, from: 8 }, // 날아온다 (높이가 여러 가지)
  golem: { hp: 14, w: 70, h: 84, score: 250, coins: 6, exp: 8, speed: 40, from: 30 }, // 단단하고 크다
};

// 몬스터 떼 (시간이 지날수록 자주, 많이, 단단하게)
RD.HORDE = {
  firstAt: 2.5, // 첫 무리가 나오는 시간(초)
  interval: [1.6, 0.45], // 무리 사이 간격: 시작 → 최소
  rampTime: 120, // 이 시간 동안 점점 어려워진다
  packSize: [2, 7], // 한 무리 마릿수: 시작 → 최대
  hpGrowth: 1 / 50, // 초당 몬스터 체력 증가 비율
  contactDamage: 12,
};

// 레벨업: 처치 경험치가 차면 공격이 강해진다
RD.LEVELS = {
  expBase: 6, // 1레벨 → 2레벨에 필요한 경험치
  expGrowth: 1.35,
  dmgPerLevel: 0.2, // 레벨당 위력 +20%
  cdPerLevel: 0.93, // 레벨당 공격 간격 x0.93
  extraShotEvery: 3, // 3레벨마다 발사 수 +1
};

RD.IMAGES = [
  "bg_forest", "ground",
  "item_gem", "item_star", "item_star_rainbow", "item_coin", "item_coin_big", "item_heart", "item_orb",
  "obs_log_hanging", "obs_stone_pillar", "obs_totem", "obs_crystal_pillar",
  "pet_0", "pet_1", "pet_2", "pet_3",
];
RD.ILLUSTS = ["illust_fox", "illust_cat", "illust_bear", "illust_rabbit", "illust_owl"];
