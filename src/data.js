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
  },
  {
    id: "cat",
    name: "고양이 마법사",
    skill: "자석 마법",
    desc: "화면의 아이템을 모두 끌어당긴다",
    illust: "illust_cat",
  },
  {
    id: "bear",
    name: "곰 대장장이",
    skill: "거대화",
    desc: "몸이 커져서 장애물을 부순다",
    illust: "illust_bear",
  },
  {
    id: "rabbit",
    name: "토끼 도적",
    skill: "3단 점프",
    desc: "점프를 세 번까지 할 수 있고 점수가 2배",
    illust: "illust_rabbit",
  },
  {
    id: "owl",
    name: "부엉이 비행사",
    skill: "비행",
    desc: "점프를 누르고 있으면 하늘을 난다",
    illust: "illust_owl",
  },
];

RD.IMAGES = [
  "bg_forest", "ground",
  "item_gem", "item_star", "item_star_rainbow", "item_coin", "item_coin_big", "item_heart", "item_orb",
  "obs_log_hanging", "obs_stone_pillar", "obs_totem", "obs_crystal_pillar",
  "pet_0", "pet_1", "pet_2", "pet_3",
];
RD.ILLUSTS = ["illust_fox", "illust_cat", "illust_bear", "illust_rabbit", "illust_owl"];
