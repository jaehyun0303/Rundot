// 온라인 기능 (claude.ai 아티팩트의 공유 저장소 db, 실시간 방 room, 사용자 user)
// - 클라우드 저장: 진행 상황을 내 계정의 비공개 공간(data/users/<id>/save)에 저장, 다른 기기에서 이어 하기
// - 랭킹: scores/<id>  (모두 읽고, 각자 자기 것만 씀)
// - 월드보스: world/boss (시즌·보스 체력) + wbdmg/<id> (각자 준 피해)
// - 거래소: trades/<자동 id>  (코인으로 장비·캐릭터를 사고팜. 사는 사람은 lease 로 먼저 잡는다)
// - 1대1 대전·파티: room 의 presence 로 매칭하고, 이름 붙은 방에서 위치·공격을 주고받는다
// 로그인하지 않았거나 권한이 없으면 모든 기능이 조용히 꺼지고 게임은 혼자 하기로 돌아간다.
(function () {
  const O = (RD.online = {
    ready: false, db: null, user: null, room: null, me: null, canWrite: false, status: "연결 중...",
    names: {}, // id → 이름 (화면 표시용, 저장하지 않음)
  });
  const PREFIX = "rundot_";
  const now = () => Date.now();

  async function init() {
    if (!window.claude || !claude.use) { O.status = "오프라인 (claude.ai 밖)"; return; }
    try {
      const [db, user, room] = await Promise.all([claude.use("db"), claude.use("user"), claude.use("room")]);
      O.db = db; O.user = user; O.room = room;
      if (user) O.me = await user.id();
      if (!db || !O.me) { O.status = "로그인하면 온라인 기능을 쓸 수 있어요"; O.ready = !!room; return; }
      const cw = await user.can("data.write");
      O.canWrite = cw !== false;
      O.status = O.canWrite ? "온라인" : "읽기 전용 (참여 권한 필요)";
      O.ready = true;
      await cloudLoad();
      if (room) setupLobby();
    } catch (e) { O.status = "온라인 연결 실패"; }
  }

  // ---------- 이름 ----------
  O.nameOf = function (id) { return O.names[id] || (id === O.me ? "나" : "플레이어"); };
  O.resolveNames = async function (ids) {
    if (!O.user || !ids.length) return;
    try { const ps = await O.user.profiles(ids); for (const id of ids) O.names[id] = (ps[id] && ps[id].name) || (id === O.me ? "나" : "플레이어"); } catch (e) { /* 이름 없이 진행 */ }
  };

  // ---------- 클라우드 저장 ----------
  function localDump() {
    const out = {};
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(PREFIX) && k !== PREFIX + "testMode") out[k.slice(PREFIX.length)] = localStorage.getItem(k); }
    return out;
  }
  const saveRef = () => O.db.doc(`data/users/${O.me}/save`);
  async function cloudLoad() {
    let localT = 0;
    try { localT = Number(localStorage.getItem(PREFIX + "savedAt") || 0); } catch (e) { /* */ }
    const snap = await saveRef().get();
    const d = snap.exists ? snap.data() : null;
    if (d && d.t > localT + 2000 && d.keys && !sessionStorage.getItem("rundot_cloudRestored")) {
      // 다른 기기에서 더 최근에 저장했다 → 받아서 다시 시작
      for (const [k, v] of Object.entries(d.keys)) localStorage.setItem(PREFIX + k, v);
      localStorage.setItem(PREFIX + "savedAt", String(d.t));
      sessionStorage.setItem("rundot_cloudRestored", "1");
      location.reload();
      return;
    }
    if (!d || localT > d.t) pushSoon(0);
  }
  let pushT = null, pushing = false;
  function pushSoon(ms = 4000) {
    if (!O.db || !O.me || !O.canWrite) return;
    clearTimeout(pushT);
    pushT = setTimeout(async () => {
      if (pushing) return pushSoon(2000);
      pushing = true;
      try { await saveRef().set({ t: Number(localStorage.getItem(PREFIX + "savedAt") || now()), keys: localDump() }); O.lastCloud = now(); } catch (e) { /* 다음에 다시 */ }
      pushing = false;
    }, ms);
  }
  RD.onSave = function () { try { localStorage.setItem(PREFIX + "savedAt", String(now())); } catch (e) { /* */ } pushSoon(); };

  // ---------- 랭킹 ----------
  // 필드: s_<모드> 최고 점수, trophy 결투 트로피, wb 월드보스 누적 피해
  O.submitScore = async function (fields) {
    if (!O.db || !O.me || !O.canWrite) return;
    try {
      const ref = O.db.doc(`scores/${O.me}`), snap = await ref.get(), cur = snap.exists ? { ...snap.data() } : {};
      let changed = !snap.exists;
      for (const [k, v] of Object.entries(fields)) if (k === "trophy" || !(cur[k] >= v)) { if (cur[k] !== v) { cur[k] = v; changed = true; } }
      if (changed) await ref.set(cur);
    } catch (e) { /* */ }
  };
  O.board = { field: null, rows: [], loading: false };
  O.loadBoard = async function (field) {
    if (!O.db) return;
    O.board = { field, rows: O.board.field === field ? O.board.rows : [], loading: true };
    try {
      const snap = await O.db.collection("scores").orderBy(field, "desc").limit(20).get();
      const rows = snap.docs.filter((d) => typeof d.data()[field] === "number").map((d) => ({ id: d.id, v: d.data()[field] }));
      await O.resolveNames(rows.map((r) => r.id));
      O.board = { field, rows, loading: false };
    } catch (e) { O.board.loading = false; }
  };

  // ---------- 월드보스 ----------
  const WB_TYPES = ["boss_bat", "boss_crystal", "boss_fire", "boss_frost", "boss_storm"];
  O.wb = { season: 0, type: "boss_bat", maxHp: 150000, dmg: 0, mine: 0, top: [], loaded: false };
  let wbUnsub = null, wbDmgUnsub = null;
  O.watchWorldBoss = function () {
    if (!O.db || wbUnsub) return;
    wbUnsub = O.db.doc("world/boss").onSnapshot((snap) => {
      const d = snap.exists ? snap.data() : null;
      if (!d) { if (O.canWrite) O.newSeason(0); return; }
      const changed = d.season !== O.wb.season;
      Object.assign(O.wb, { season: d.season, type: d.type, maxHp: d.maxHp, loaded: true });
      if (changed) watchDmg();
    }, () => { /* 읽기 실패 */ });
  };
  function watchDmg() {
    if (wbDmgUnsub) wbDmgUnsub();
    const S = O.wb.season;
    wbDmgUnsub = O.db.collection("wbdmg").where("season", "==", S).onSnapshot(async (snap) => {
      let sum = 0, mine = 0; const rows = [];
      for (const d of snap.docs) { const v = d.data().dmg || 0; sum += v; if (d.id === O.me) mine = v; rows.push({ id: d.id, v }); }
      rows.sort((a, b) => b.v - a.v);
      O.wb.dmg = sum; O.wb.mine = mine; O.wb.top = rows.slice(0, 10); O.wb.players = rows.length;
      await O.resolveNames(O.wb.top.map((r) => r.id));
      if (sum >= O.wb.maxHp && O.canWrite) O.newSeason(S); // 쓰러졌다 → 다음 시즌 (먼저 잡은 사람이 연다)
    }, () => { /* */ });
  }
  O.newSeason = async function (fromSeason) {
    const ref = O.db.doc("world/boss");
    try {
      const L = await ref.acquire({ holder: O.me, ttlMs: 5000 });
      if (!L.acquired) return;
      const snap = await ref.get(), d = snap.exists ? snap.data() : null;
      if (d && d.season !== fromSeason) return; // 이미 누가 열었다
      const season = (d ? d.season : 0) + 1;
      await ref.set({ season, type: WB_TYPES[(season - 1) % WB_TYPES.length], maxHp: 150000 + 30000 * Math.min(10, (O.wb.players || 1) - 1), startedAt: new Date().toISOString(), prev: d ? { season: d.season, type: d.type } : null });
    } catch (e) { /* */ }
  };
  O.addWorldBossDamage = async function (season, dmg) {
    if (!O.db || !O.me || !O.canWrite || !(dmg > 0)) return;
    try {
      const ref = O.db.doc(`wbdmg/${O.me}`), snap = await ref.get(), d = snap.exists ? snap.data() : null;
      const total = (d && d.season === season ? d.dmg : 0) + Math.round(dmg);
      await ref.set({ season, dmg: total, past: { ...((d && d.past) || {}), ...(d && d.season !== season ? { [d.season]: d.dmg } : {}) } });
    } catch (e) { /* */ }
  };
  // 지난 시즌에 참가했는데 보상을 안 받았으면 true
  O.wbRewardFor = async function () {
    if (!O.db || !O.me) return [];
    try {
      const snap = await O.db.doc(`wbdmg/${O.me}`).get(); const d = snap.exists ? snap.data() : null; if (!d) return [];
      const seasons = Object.keys(d.past || {}).map(Number);
      if (d.season < O.wb.season) seasons.push(d.season);
      return seasons;
    } catch (e) { return []; }
  };

  // ---------- 거래소 ----------
  O.market = { rows: [], mine: [], loaded: false };
  let mUnsub = null, mineUnsub = null;
  O.watchMarket = function (onSold) {
    if (!O.db || mUnsub) return;
    mUnsub = O.db.collection("trades").where("status", "==", "open").limit(60).onSnapshot(async (snap) => {
      O.market.rows = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => b.t - a.t);
      O.market.loaded = true;
      await O.resolveNames([...new Set(O.market.rows.map((r) => r.seller))]);
    }, () => { O.market.loaded = true; });
    if (O.me) mineUnsub = O.db.collection("trades").where("seller", "==", O.me).limit(100).onSnapshot((snap) => {
      O.market.mine = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // 팔린 물건: 코인을 받고 정산 표시
      for (const r of O.market.mine) if (r.status === "sold" && !r.paid) onSold(r);
    }, () => { /* */ });
  };
  O.postTrade = async function (give, price) {
    if (!O.db || !O.canWrite) return null;
    try { const ref = await O.db.collection("trades").add({ seller: O.me, give, price, status: "open", t: now() }); return ref.id; } catch (e) { return null; }
  };
  // 사기: lease 로 먼저 잡고, 아직 팔리지 않았으면 내 것으로
  O.buyTrade = async function (id) {
    const ref = O.db.doc(`trades/${id}`);
    try {
      const L = await ref.acquire({ holder: O.me, ttlMs: 6000 });
      if (!L.acquired) return { ok: false, why: "다른 사람이 사는 중" };
      const snap = await ref.get(), d = snap.exists ? snap.data() : null;
      if (!d || d.status !== "open") return { ok: false, why: "이미 팔렸어요" };
      if (d.seller === O.me) return { ok: false, why: "내 물건이에요" };
      await ref.update({ status: "sold", buyer: O.me, soldAt: now() });
      return { ok: true, trade: d };
    } catch (e) { return { ok: false, why: "연결 실패" }; }
  };
  O.cancelTrade = async function (id) {
    const ref = O.db.doc(`trades/${id}`);
    try {
      const L = await ref.acquire({ holder: O.me, ttlMs: 6000 });
      if (!L.acquired) return null;
      const snap = await ref.get(), d = snap.exists ? snap.data() : null;
      if (!d || d.status !== "open" || d.seller !== O.me) return null;
      await ref.update({ status: "cancelled" });
      return d;
    } catch (e) { return null; }
  };
  O.markPaid = async function (id) { try { await O.db.doc(`trades/${id}`).update({ paid: true }); } catch (e) { /* */ } };

  // ---------- 로비 (지금 접속한 사람들) ----------
  O.peers = [];
  function setupLobby() {
    O.room.onPeers((c) => { O.peers = c.peers; }, () => { O.peers = []; });
  }
  O.setLobby = function (patch) { if (O.room) O.room.presence(patch).catch(() => {}); };
  O.onlineCount = () => O.peers.filter((p) => p.kind === "viewer").length;

  // ---------- 1대1 대전 매칭 ----------
  // 찾는 사람들은 로비 presence 에 duel:{q:1}. peer 이름 순서로 둘씩 짝짓는다 (양쪽이 같은 계산 → 같은 짝)
  O.duelSearch = function (info) { O.setLobby({ duel: { q: 1, ...info, since: now() } }); };
  O.duelStop = function () { O.setLobby({ duel: null }); };
  O.findDuelPartner = function () {
    const me = O.peers.find((p) => p.sameTab);
    if (!me) return null;
    const qs = O.peers.filter((p) => p.presence && p.presence.duel && p.presence.duel.q).sort((a, b) => (a.peer < b.peer ? -1 : 1));
    const i = qs.findIndex((p) => p.sameTab);
    if (i < 0) return null;
    const j = i % 2 === 0 ? i + 1 : i - 1;
    if (!qs[j] || qs[j].isMe && qs[j].sameTab) return null;
    const other = qs[j];
    const a = me.peer < other.peer ? me.peer : other.peer, b = me.peer < other.peer ? other.peer : me.peer;
    return { peer: other.peer, by: other.by, info: other.presence.duel, host: me.peer === a, room: `d-${a.slice(0, 20)}-${b.slice(0, 20)}`.toLowerCase().replace(/[^a-z0-9_.-]/g, "") };
  };

  // 이름 붙은 방: 대전/파티 공용. presence 로 상태를 계속 보낸다
  O.joinRoom = async function (name) {
    if (!O.room) return null;
    try {
      const r = await O.room.join(name);
      const st = { room: r, peers: [] };
      r.onPeers((c) => { st.peers = c.peers; }, () => { st.dead = true; });
      return st;
    } catch (e) { return null; }
  };

  // ---------- 파티 ----------
  // 파티장은 로비 presence 에 party:{code, mode, diff, n} 를 걸어 둔다. 다른 사람은 목록에서 골라 들어간다
  O.openParties = function () {
    return O.peers.filter((p) => !p.sameTab && p.presence && p.presence.party && p.presence.party.host).map((p) => ({ peer: p.peer, by: p.by, ...p.presence.party }));
  };

  init();
})();
