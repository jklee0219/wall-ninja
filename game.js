// 벽타는 닌자 (Wall Ninja) — 우성오락실
// 좌우 두 벽 사이를 타고 오른다. 오르기 = 같은 벽 한 칸 위, 점프 = 반대편 벽으로 건너며 한 칸 위.
// 바로 위 칸에 장애물(가시·불꽃·톱날)이 있는 벽으로 가면 떨어진다. 장애물 없는 칸은 둘 다 된다.
// YouTube Playables 요건: SDK 먼저, firstFrameReady/gameReady, onPause/onResume 로만 정지,
// 유튜브 음소거 따름, saveData/loadData, 모든 화면비, 터치·마우스·키보드.
"use strict";

// ───────────── 유튜브 SDK (밖에서는 localStorage) ─────────────
const YT = (typeof ytgame !== "undefined") ? ytgame : null;
const IN_YT = !!(YT && YT.IN_PLAYABLES_ENV);
const SAVE_KEY = "woosung-wall-ninja-v1";
const sdk = {
  firstFrameReady() { try { YT && YT.game.firstFrameReady(); } catch (e) {} },
  gameReady() { try { YT && YT.game.gameReady(); } catch (e) {} },
  async load() {
    if (IN_YT) { try { return await YT.game.loadData(); } catch (e) { return ""; } }
    try { return localStorage.getItem(SAVE_KEY) || ""; } catch (e) { return ""; }
  },
  async save(str) {
    if (IN_YT) { try { await YT.game.saveData(str); } catch (e) {} return; }
    try { localStorage.setItem(SAVE_KEY, str); } catch (e) {}
  },
  score(v) { if (IN_YT) { try { YT.engagement.sendScore({ value: Math.floor(v) }); } catch (e) {} } },
  audioOn() { if (IN_YT) { try { return YT.system.isAudioEnabled(); } catch (e) {} } return true; },
  async lang() { if (IN_YT) { try { return await YT.system.getLanguage(); } catch (e) {} } return navigator.language || "ko"; },
  interstitial() { if (IN_YT) { try { return YT.ads.requestInterstitialAd(); } catch (e) {} } return Promise.resolve(); },
};

const TEXT = {
  ko: { title: "벽타는 닌자", start: "출발!", jump: "점프", climb: "오르기", best: "최고",
        overs: ["미션 실패!", "게임 오버!", "아깝다!", "추락!", "재도전?"],
        again: "다시 오르기", change: "캐릭터 바꾸기", unit: "m", how: "위에 장애물이 있으면 반대편 벽으로 점프!",
        zones: [] },
  en: { title: "Wall Ninja", start: "GO!", jump: "JUMP", climb: "CLIMB", best: "BEST",
        overs: ["MISSION FAILED", "GAME OVER", "SO CLOSE!", "WIPEOUT!", "TRY AGAIN?"],
        again: "Climb again", change: "Change character", unit: "m", how: "Obstacle above? Jump to the other wall!",
        zones: [] },
};
let T = TEXT.ko;

// ───────────── 세계 ─────────────
const LS = 36 / 14;               // 저해상도 픽셀 / 세계 단위 (닌자 키 36px ≈ 14 단위)
const ROW = 12;                   // 한 칸 높이
const GAP = 36;                   // 두 벽 사이 통로 너비 (세계 단위)
const WALL_X = GAP / 2;           // 벽 안쪽 면의 x (±)
const C = { pink: "#ff40a0", cyan: "#3ce6ff", yellow: "#ffd640", night: "#0e0a22" };

// 50레벨: 10개 세계 × 세계마다 5단계(아침→낮→노을→저녁→밤, 천상은 갈수록 더 밝게). 100m마다 레벨 업.
const LEVEL_M = 100, MAX_LEVEL = 50;
const WORLDS = [
  { ko: "낡은 판자벽",   en: "Shabby Shack",    sky: [[200, 190, 170], [235, 225, 200]], obs: ["nail"],    edge: "#a08060" },
  { ko: "흙벽 골목",     en: "Mud Alley",       sky: [[210, 200, 160], [245, 230, 190]], obs: ["bramble"], edge: "#d8b878" },
  { ko: "대나무 숲",     en: "Bamboo Forest",   sky: [[150, 220, 160], [220, 250, 200]], obs: ["bamboo"],  edge: "#b8f05a" },
  { ko: "벚꽃 정원",     en: "Sakura Garden",   sky: [[255, 200, 220], [255, 235, 240]], obs: ["sakura"],  edge: "#ff8ac0" },
  { ko: "성벽",          en: "Castle Wall",     sky: [[255, 170, 130], [255, 215, 160]], obs: ["spear"],   edge: "#ffd27a" },
  { ko: "붉은 탑",       en: "Red Pagoda",      sky: [[255, 140, 110], [255, 200, 140]], obs: ["dragon"],  edge: "#ffcf40" },
  { ko: "얼음 봉우리",   en: "Ice Peak",        sky: [[170, 220, 255], [225, 245, 255]], obs: ["ice"],     edge: "#c8f4ff" },
  { ko: "네온 도시",     en: "Neon City",       sky: [[30, 24, 80],    [90, 40, 130]],   obs: ["shock"],   edge: C.cyan },
  { ko: "우주 정거장",   en: "Space Station",   sky: [[10, 6, 30],     [50, 16, 80]],    obs: ["laser"],   edge: C.pink },
  { ko: "천상의 궁전",   en: "Heavenly Palace", sky: [[110, 150, 255], [255, 240, 200]], obs: ["holy"],    edge: "#ffe27a" },
];
// 단계별 하늘 색 보정 (벽 그림의 색감과 맞춤)
const TOD = [[1.05, 1.02, 0.95, 1.08], [1, 1, 1, 1], [1.12, 0.92, 0.8, 0.95], [0.9, 0.8, 1.1, 0.75], [0.7, 0.75, 1.1, 0.55]];
const HEAVEN = [[1, 1, 1, 1], [1.02, 1.02, 1, 1.05], [1.04, 1.03, 1, 1.1], [1.05, 1.04, 1, 1.14], [1.06, 1.05, 1, 1.18]];
const ZONES = Array.from({ length: MAX_LEVEL }, (_, i) => {
  const w = WORLDS[Math.floor(i / 5)], k = (Math.floor(i / 5) === 9 ? HEAVEN : TOD)[i % 5];
  const tint = c => c.map((v, j) => Math.min(255, Math.round(v * k[j] * k[3])));
  return { at: i * LEVEL_M, level: i + 1, world: Math.floor(i / 5), stage: i % 5, sky: [tint(w.sky[0]), tint(w.sky[1])], wall: `lv${String(i + 1).padStart(2, "0")}`, obs: w.obs, edge: w.edge };
});
function zoneAt(n) { return Math.max(0, Math.min(MAX_LEVEL - 1, Math.floor(n / LEVEL_M))); }
function lerp(a, b, k) { return a + (b - a) * k; }

// ───────────── 상태 ─────────────
const st = {
  mode: "title", ready: false, paused: false,
  rows: [], idx: 0, side: -1, time: 1, steps: 0, best: 0, plays: 0, coins: 0,
  anim: 0, animKind: "", fromSide: -1, fall: null, cam: { y: 0 }, t: 0,
  banner: null, bannerT: 0, pops: [], pressFx: { jump: 0, climb: 0 }, char: 0, prog: {}, charChosen: true,
};

// 난이도: 손 속도보다 판단력. 장애물은 높이에 따라 촘촘해지고(50%→92%, 2500m에서 최대),
// 높은 곳에선 좌우로 번갈아 나오는 '지그재그 구간'이 섞여 연속 점프 판단을 요구한다.
const DIFF_M = 2500;
function genRows(n) {
  const r = st.rows;
  while (r.length < n) {
    const k = r.length, d = Math.min(1, k / DIFF_M);
    let obs = 0, kind = "", coin = 0;
    const kinds = ZONES[zoneAt(k)].obs, pick = () => kinds[Math.floor(Math.random() * kinds.length)];
    if (k > 3 && st.zig > 0) {                                // 지그재그 구간 진행 중
      obs = -st.zigSide; st.zigSide = obs; st.zig--; kind = pick();
    } else if (k > 3) {
      if (k > 300 && Math.random() < 0.02 + d * 0.06) {       // 지그재그 시작 (길이 3~3+6d)
        st.zig = 3 + Math.floor(Math.random() * (1 + d * 6)); st.zigSide = Math.random() < 0.5 ? -1 : 1;
        obs = st.zigSide; kind = pick();
      } else if (Math.random() < 0.5 + d * 0.42) { obs = Math.random() < 0.5 ? -1 : 1; kind = pick(); }
      if (Math.random() < 0.12) coin = obs ? -obs : (Math.random() < 0.5 ? -1 : 1);
    }
    r.push({ obs, kind, coin });
  }
}

// 체크포인트: 떨어진 높이에서 30m 아래부터 다시 시작한다.
function newRun(from = 0) {
  st.zig = 0; st.zigSide = 1; st.rows = []; genRows(from + 40);
  for (let i = Math.max(0, from - 3); i <= from + 3; i++) {     // 시작 자리와 바로 위·아래는 깨끗하게 (장애물에 겹쳐 시작하지 않게)
    st.rows[i].obs = 0;
    if (i <= from) st.rows[i].coin = 0;                          // 지나간 줄의 코인은 먹을 수 없으니 치움
  }
  st.idx = from; st.side = -1; st.time = 1; st.steps = from; st.coins = 0; st.anim = 0; st.fall = null; st.crash = null; st.pops = [];
  st.runFrom = from;
  st.armor = 1; st.revive = 1; st.flash = 0;
  st.sparks = []; st.trail = []; st.trailT = 0; st.spawnAcc = 0; st.tierLv = tierOf(st.best);
  st.cam.y = -from * ROW;
}

// ───────────── 저장 ─────────────
// 캐릭터마다 최고 기록·체크포인트·엔딩을 따로 저장한다 (prog[id])
function storeChar() { st.prog[CHARS[st.char].id] = { best: st.best, cp: st.checkpoint || 0, cleared: !!st.cleared }; }
function loadChar(i) {
  st.char = i; const p = st.prog[CHARS[i].id] || {};
  st.best = p.best || 0; st.checkpoint = p.cp || 0; st.cleared = !!p.cleared; st.tierLv = tierOf(st.best);
}
function save() { if (!st.ready) return; storeChar(); sdk.save(JSON.stringify({ v: 2, prog: st.prog, plays: st.plays, char: CHARS[st.char].id })); }
async function loadSave() {
  const raw = await sdk.load(); if (!raw) return;
  try {
    const d = JSON.parse(raw); st.plays = d.plays || 0;
    const ci = Math.max(0, CHARS.findIndex(c => c.id === d.char));
    if (d.prog) st.prog = d.prog;                                    // v2: 캐릭터별
    else st.prog[CHARS[ci].id] = { best: d.best || 0, cp: d.cp || 0, cleared: !!d.cleared };   // v1 → 지금 캐릭터 기록으로 옮김
    loadChar(ci); st.charChosen = true;
  } catch (e) {}
}

// ───────────── 소리 ─────────────
let actx = null, master = null, audioEnabled = true;
function ensureAudio() {
  if (actx) { if (actx.state === "suspended" && audioEnabled && !st.paused) actx.resume(); return; }
  try {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    master = actx.createGain(); master.gain.value = audioEnabled ? 0.3 : 0; master.connect(actx.destination);
  } catch (e) { actx = null; }
}
function setAudio(on) { audioEnabled = on; if (master) master.gain.value = on ? 0.3 : 0; }
function tone(f, dur, type = "square", vol = 0.25, slide = 0) {
  if (!actx || !audioEnabled || st.paused) return;
  const t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
const sfx = {
  climb() { tone(440 + (st.steps % 6) * 30, 0.04, "square", 0.1); },
  jump() { tone(300, 0.1, "square", 0.14, 2.4); },
  coin() { tone(988, 0.05, "square", 0.15); setTimeout(() => tone(1319, 0.12, "square", 0.15), 50); },
  hit() { tone(160, 0.15, "sawtooth", 0.3, 0.5); setTimeout(() => tone(700, 0.6, "triangle", 0.2, 0.2), 120); },
  mile() { [784, 988, 1175, 1568].forEach((f, i) => setTimeout(() => tone(f, 0.1, "square", 0.18), i * 80)); },
};

// ───────────── 조작 ─────────────
function act(jump) {
  ensureAudio();
  if (!st.ready) return;
  if (st.mode !== "play" || st.fall || st.crash || st.anim > 0.35) return;
  st.pressFx[jump ? "jump" : "climb"] = 1;
  const target = jump ? -st.side : st.side;
  const next = st.rows[st.idx + 1];
  st.fromSide = st.side; st.side = target;
  if (next.obs === target && skill() === "armor" && st.armor > 0) {   // 강철 장갑: 부수고 통과
    st.armor--; next.obs = 0; st.flash = 1; sfx.hit();
  }
  if (next.obs === target) {                                  // 장애물로 돌진: 반대 벽까지 날아가서 부딪힌 뒤 떨어진다
    st.crash = { t: 0, dur: jump ? 0.16 : 0.1, jump, from: st.fromSide, target };
    jump ? sfx.jump() : sfx.climb();
    return;
  }
  st.idx++; st.steps++; st.anim = 1; st.animKind = jump ? "jump" : "climb";
  st.time = Math.min(1, st.time + 0.07 + (jump && skill() === "jumpT" ? 0.05 : 0));
  if (skill() === "armor" && st.steps % 100 === 0 && st.armor < 1) { st.armor = 1; banner("ARMOR!", C.cyan); }
  genRows(st.idx + 40);
  jump ? sfx.jump() : sfx.climb();
  const row = st.rows[st.idx];
  if (row.coin && row.coin === target) { row.coin = 0; st.coins++; st.time = Math.min(1, st.time + (skill() === "coin2" ? 0.16 : 0.08)); sfx.coin(); st.pops.push({ i: st.idx, s: target, life: 1 }); }
  const tl = tierNow();
  if (tl > st.tierLv) { st.tierLv = tl; banner(`${T === TEXT.ko ? "등급 업" : "RANK UP"}: ${T === TEXT.ko ? COSTUMES[tl].ko : COSTUMES[tl].en}!`, COSTUMES[tl].col); sfx.mile(); st.flash = 1; }
  else if (st.steps % 100 === 0) { banner(`${st.steps}${T.unit}!`, C.yellow); sfx.mile(); }
  const z = zoneAt(st.steps);
  if (z > 0 && ZONES[z].at === st.steps) {                   // 레벨 업 (5레벨마다 새 세계)
    const Z = ZONES[z], wname = T === TEXT.ko ? WORLDS[Z.world].ko : WORLDS[Z.world].en;
    banner(Z.stage === 0 ? `LEVEL ${Z.level} · ${wname}` : `LEVEL ${Z.level}`, Z.stage === 0 ? C.yellow : C.cyan);
    st.levelFx = 1; sfx.mile();
  }
  if (st.steps === 2500) { banner(T === TEXT.ko ? "절반 돌파!" : "HALFWAY!", C.yellow); sfx.mile(); st.flash = 1; }   // 이정표 문구가 우선
  if (st.steps === MAX_LEVEL * LEVEL_M) ending();
}

function pickChar(d) { storeChar(); loadChar((st.char + d + CHARS.length) % CHARS.length); sfx.climb(); save(); }
function begin() {
  ensureAudio(); if (!st.ready) return;
  if (!st.charChosen) { st.charChosen = true; save(); }             // 처음 고른 캐릭터로 계속 키운다
  st.mode = "play"; newRun(st.checkpoint || 0); sfx.jump();
}

// 엔딩: Lv.50 을 다 오르면(5000m) 금빛 연출 + '전설' 기록. 이후는 무한 모드로 계속.
function ending() {
  st.cleared = true; st.endFx = 4; st.flash = 1; save();
  banner(T === TEXT.ko ? "천상 도달! 전설의 닌자" : "HEAVEN REACHED! LEGEND", "#ffe27a");
  [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => setTimeout(() => tone(f, 0.18, "square", 0.2), i * 120));
  setTimeout(() => { if (st.mode === "play") banner(T === TEXT.ko ? "새 세계는 여기까지! 이제 무한 도전" : "No more new worlds. Endless mode!", C.cyan); }, 3200);
}

function gameOver() {
  st.mode = "over"; st.plays++;
  st.overMsg = Math.floor(Math.random() * 5);                  // 문구는 매번 무작위
  if (st.steps > st.best) st.best = st.steps;
  st.checkpoint = Math.max(0, st.steps - 30);                 // 떨어진 곳에서 30m 아래부터 다시
  sdk.score(st.best); save();
  if (window.WSA_LB) window.WSA_LB.submit(st.steps, { char: CHARS[st.char].id, tier: tierOf(st.best) });   // 웹판 명예의 전당 (있을 때만)
}

async function restart(fromZero) {
  if (st.plays > 0 && st.plays % 4 === 0) {                 // 네 판마다 전면 광고 (유튜브 안에서만)
    st.paused = true; try { await sdk.interstitial(); } catch (e) {} st.paused = false; startLoop();
  }
  st.mode = "play"; newRun(fromZero ? 0 : (st.checkpoint || 0));
}

function banner(text, col) { st.banner = { text, col }; st.bannerT = 1.6; }

// ───────────── 갱신 ─────────────
function update(dt) {
  st.t += dt;
  if (st.bannerT > 0) st.bannerT -= dt;
  for (const k of ["jump", "climb"]) st.pressFx[k] = Math.max(0, st.pressFx[k] - dt * 6);
  if (st.anim > 0) st.anim = Math.max(0, st.anim - dt * (st.animKind === "jump" ? 8 : 12));
  for (const p of st.pops) p.life -= dt * 2; st.pops = st.pops.filter(p => p.life > 0);
  if (st.flash > 0) st.flash = Math.max(0, st.flash - dt * 3);
  if (st.levelFx > 0) st.levelFx = Math.max(0, st.levelFx - dt * 2.5);
  if (st.endFx > 0) {                                          // 엔딩 금빛 반짝이 비
    st.endFx -= dt;
    if (st.sparks) for (let i = 0; i < 3; i++) st.sparks.push({ x: (Math.random() - 0.5) * 60, y: charPos().y - 40 - Math.random() * 40, vx: 0, vy: 18 + Math.random() * 10, life: 1.5, lv: 3, seed: Math.random() });
  }
  updateAura(dt);
  if (st.crash) {
    const c = st.crash; c.t += dt;
    if (c.t >= c.dur) {                                        // 장애물에 쾅
      st.crash = null; sfx.hit();
      st.fall = { x: c.target * (WALL_X - 4), y: -(st.idx + 0.6) * ROW, vx: -c.target * 14, vy: -20, rot: 0, t: 0 };
    }
  }
  if (st.mode === "play" && !st.fall && !st.crash) {
    const drain = (0.14 + 0.24 * Math.min(1, st.steps / 3000)) * (skill() === "slow" ? 0.75 : 1);   // 최대 0.38/초 = 1초 5.4칸
    st.time -= drain * dt;
    if (st.time <= 0) st.fall = { x: st.side * (WALL_X - 4), y: -st.idx * ROW, vx: -st.side * 10, vy: -10, rot: 0, t: 0 };
  }
  if (st.fall) {
    const f = st.fall; f.t += dt; f.vy += 160 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.rot += dt * 9;
    if (Math.abs(f.x) > WALL_X - 4) { f.x = Math.sign(f.x) * (WALL_X - 4); f.vx = -f.vx * 0.5; }
    if (f.t > 1.1 && st.mode === "play") {
      if (skill() === "revive" && st.revive > 0) {            // 목숨 아홉: 제자리에서 부활, 바로 위 장애물은 치운다
        st.revive--; st.fall = null; st.time = Math.max(st.time, 0.6); st.anim = 0;
        st.rows[st.idx + 1].obs = 0; st.flash = 1; banner(T === TEXT.ko ? "냥! 부활!" : "Meow! Revived!", C.yellow); sfx.mile();
      } else gameOver();
    }
  }
  const ty = st.fall ? st.cam.y : charPos().y;
  st.cam.y += (ty - st.cam.y) * Math.min(1, dt * 8);
}

function updateAura(dt) {
  if (!st.sparks) return;
  const lv = legendGlow() ? 5 : 0, a = { rate: lv ? 28 : 0 }, p = charPos();   // 다이아 등급만 몸에서 빛이 난다
  st.spawnAcc += a.rate * dt;
  while (st.spawnAcc >= 1) {
    st.spawnAcc -= 1;
    const ang = Math.random() * Math.PI * 2, sp = 6 + Math.random() * (6 + lv * 4);
    st.sparks.push({ x: p.x + (Math.random() - 0.5) * 8, y: p.y - 6 + (Math.random() - 0.5) * 12,
      vx: Math.cos(ang) * sp * 0.5, vy: -Math.abs(Math.sin(ang)) * sp - 4, life: 1, lv, seed: Math.random() });
  }
  for (const k of st.sparks) { k.x += k.vx * dt; k.y += k.vy * dt; k.life -= dt * 1.6; }
  st.sparks = st.sparks.filter(k => k.life > 0);
  st.trailT += dt;
  if (lv >= 3 && st.trailT > 0.035) { st.trailT = 0; st.trail.unshift({ ...p }); st.trail.length = Math.min(st.trail.length, 5); }
  if (lv < 3) st.trail.length = 0;
}

function charPos() {
  if (st.fall) return { x: st.fall.x, y: st.fall.y };
  if (st.crash) {                                              // 잘못 뛴 순간: 장애물 쪽으로 이동 중
    const c = st.crash, k = Math.min(1, c.t / c.dur), y0 = -st.idx * ROW, y1 = -(st.idx + 0.6) * ROW;
    const x0 = c.from * (WALL_X - 4), x1 = c.target * (WALL_X - 4);
    return c.jump ? { x: lerp(x0, x1, k), y: lerp(y0, y1, k) - Math.sin(k * Math.PI) * 5 } : { x: x1, y: lerp(y0, y1, k) };
  }
  const x1 = st.side * (WALL_X - 4), y1 = -st.idx * ROW;
  if (st.anim > 0) {
    const k = 1 - st.anim, x0 = st.fromSide * (WALL_X - 4), y0 = y1 + ROW;
    if (st.animKind === "jump") return { x: lerp(x0, x1, k), y: lerp(y0, y1, k) - Math.sin(k * Math.PI) * 5 };
    return { x: x1, y: lerp(y0, y1, k) };
  }
  return { x: x1, y: y1 };
}

// ───────────── 화면 (저해상도 → 정수 배율 = 또렷한 픽셀) ─────────────
const cv = document.getElementById("c");
const cx = cv.getContext("2d");
const low = document.createElement("canvas");
const lx = low.getContext("2d");
const view = { w: 0, h: 0, dpr: 1, k: 1, lw: 0, lh: 0 };
function layout() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const w = cv.clientWidth || innerWidth, h = cv.clientHeight || innerHeight;
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  view.dpr = dpr; view.w = w; view.h = h;
  view.k = Math.max(1, Math.round(Math.min(cv.width / 230, cv.height / 400)));
  view.lw = Math.ceil(cv.width / view.k); view.lh = Math.ceil(cv.height / view.k);
  low.width = view.lw; low.height = view.lh;
}
window.addEventListener("resize", layout);
const R = Math.round;
function wx(x) { return R(view.lw / 2 + x * LS); }
function wy(y) { return R(view.lh * 0.62 + (y - st.cam.y) * LS); }

function img(n) { const im = new Image(); im.src = `img/${n}.png`; return im; }
// 캐릭터: 시작 화면에서 고른다. 그림은 img/<id>_<자세>.png (자세: cling·climb·jump·fall)
// 능력: coin2 동전 회복 2배 · slow 시간 25% 천천히 · jumpT 점프 회복 추가 · revive 한 번 부활 · armor 장애물 부수기(100m마다 충전)
const CHARS = [
  { id: "ninja",   ko: "닌자",     en: "Ninja",       skill: "coin2",  sko: "동전 달인: 동전 시간 회복 2배",      sen: "Coin master: coins refill 2x time" },
  { id: "grandpa", ko: "할아버지", en: "Grandpa",     skill: "slow",   sko: "느긋함: 시간이 25% 천천히 줄어요",   sen: "Easygoing: timer drains 25% slower" },
  { id: "girl",    ko: "쿠노이치", en: "Kunoichi",    skill: "jumpT",  sko: "날렵함: 점프할 때 시간 더 회복",     sen: "Agile: jumps refill extra time" },
  { id: "cat",     ko: "고양이",   en: "Kitty",       skill: "revive", sko: "목숨 아홉: 한 번 떨어져도 부활",     sen: "Nine lives: survive one fall" },
  { id: "robot",   ko: "슈퍼로봇", en: "Super Robot", skill: "armor",  sko: "강철 장갑: 장애물을 부수고 지나가요", sen: "Steel armor: smash one obstacle" },
];
function skill() { return CHARS[st.char].skill; }

// 오라: 최고 기록이 높을수록 몸에서 나오는 빛이 강해진다 (게임 중 기록을 넘으면 바로 올라감)
const AURAS = [
  { at: 0,    ko: "",         en: "",        col: null,      rate: 0 },
  { at: 100,  ko: "브론즈",   en: "Bronze",  col: "#ffa860", rate: 4 },
  { at: 250,  ko: "실버",     en: "Silver",  col: "#bff4ff", rate: 9 },
  { at: 500,  ko: "골드",     en: "Gold",     col: "#ffd640",  rate: 18 },
  { at: 800,  ko: "플래티넘", en: "Platinum", col: "platinum", rate: 26 },
  { at: 1200, ko: "다이아",   en: "Diamond",  col: "diamond",  rate: 40 },
];
// 복장 단계: 최고 기록이 오를수록 옷이 멋져진다 (게임 중 기록을 넘으면 바로 갈아입음)
const COSTUMES = [                                            // 등급 = 복장 단계
  { at: 0,    ko: "브론즈",   en: "Bronze",   col: "#e0a070" },
  { at: 500,  ko: "실버",     en: "Silver",   col: "#d8e4ef" },
  { at: 1500, ko: "골드",     en: "Gold",     col: "#ffd640" },
  { at: 3000, ko: "플래티넘", en: "Platinum", col: "#bfefff" },
  { at: 5000, ko: "다이아",   en: "Diamond",  col: "#8ff4ff" },
];
function tierOf(n) { let t = 0; for (let i = 0; i < COSTUMES.length; i++) if (n >= COSTUMES[i].at) t = i; return t; }
function tierNow() { return tierOf(Math.max(st.best, st.steps)); }

function auraLevel(n) { let l = 0; for (let i = 0; i < AURAS.length; i++) if (n >= AURAS[i].at) l = i; return l; }
function auraNow() { return auraLevel(Math.max(st.best, st.steps)); }
function auraColor(l, t) {
  const c = AURAS[l].col;
  if (c === "platinum") return `hsl(220,${25 + Math.round(15 * Math.sin(t * 3))}%,88%)`;            // 은백색 일렁임
  if (c === "diamond") return `hsl(${185 + Math.round(25 * Math.sin(t * 5))},100%,${78 + Math.round(12 * Math.sin(t * 9))}%)`;   // 얼음빛 반짝임
  return c;
}
const POSES = ["cling", "climb", "jump", "fall"];
const TIERS = COSTUMES.length;
const SPR = Object.fromEntries(CHARS.map(c => [c.id, Array.from({ length: TIERS }, (_, t) =>
  Object.fromEntries(POSES.map(p => [p, img(t ? `${c.id}_t${t}_${p}` : `${c.id}_${p}`)])))]));
const STAND = Object.fromEntries(CHARS.map(c => [c.id, Array.from({ length: TIERS }, (_, t) => img(t ? `${c.id}_t${t}_stand` : `stand_${c.id}`))]));
// 지금 단계 그림 (아직 안 불러왔으면 한 단계씩 낮춰서)
function NINJA_() {
  const set = SPR[CHARS[st.char].id];
  for (let t = tierNow(); t > 0; t--) if (imgOk(set[t].cling)) return set[t];
  return set[0];
}
function standImg(id, tier) { for (let t = tier; t > 0; t--) if (imgOk(STAND[id][t])) return STAND[id][t]; return STAND[id][0]; }
const OBS = {};                                                 // 세계마다 전용 장애물 하나씩
for (const n of ["nail", "bramble", "bamboo", "sakura", "spear", "dragon", "ice", "shock", "laser", "holy"]) OBS[n] = img("obs_" + n);
const COIN = img("coin");
function imgOk(im) { return im && im.complete && im.naturalWidth > 0; }

const PIX_FONT = '"Galmuri11", "Apple SD Gothic Neo", "Noto Sans KR", monospace';
try {
  const ff = new FontFace("Galmuri11", "url(fonts/Galmuri11-Bold.woff2)");
  ff.load().then(f => document.fonts.add(f)).catch(() => {});
} catch (e) {}

function text(str, x, y, size, color, align = "center", shadow = true, maxW = 0) {
  cx.save();
  cx.font = `${Math.round(size)}px ${PIX_FONT}`;
  if (maxW) {                                                    // 버튼 안에 다 들어가도록 글씨를 줄임
    const tw = cx.measureText(str).width;
    if (tw > maxW) { size = Math.floor(size * maxW / tw); cx.font = `${size}px ${PIX_FONT}`; }
  }
  cx.textAlign = align; cx.textBaseline = "middle";
  if (shadow) { cx.fillStyle = "#1a1030"; const o = Math.max(2, Math.round(size / 11)); cx.fillText(str, x + o, y + o); }
  cx.fillStyle = color; cx.fillText(str, x, y); cx.restore();
}

const STARS = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random() * 2000, b: Math.random() }));

function zoneMix() {
  const n = st.steps, z = zoneAt(n), Z = ZONES[z], N = ZONES[z + 1];
  const k = N ? Math.min(1, Math.max(0, (n - Z.at) / (N.at - Z.at) - 0.6) / 0.4) : 0;
  return { z, k, top: N ? Z.sky[0].map((v, i) => lerp(v, N.sky[0][i], k)) : Z.sky[0], bot: N ? Z.sky[1].map((v, i) => lerp(v, N.sky[1][i], k)) : Z.sky[1] };
}

function drawShaft() {
  const W = view.lw, H = view.lh, { top, bot } = zoneMix(), bands = 10;
  for (let i = 0; i < bands; i++) {                           // 통로 너머 하늘 (띠)
    const k = i / (bands - 1);
    lx.fillStyle = `rgb(${top.map((v, j) => R(lerp(v, bot[j], k))).join(",")})`;
    lx.fillRect(0, R(H * i / bands), W, R(H / bands) + 1);
  }
  const Zs = ZONES[zoneAt(st.steps)];
  if (Zs.stage >= 3 || (Zs.world >= 7 && Zs.world <= 8)) {
    const a = Zs.stage >= 4 || Zs.world >= 7 ? 1 : 0.5;
    for (const s of STARS) {
      if (s.b > a) continue;
      const y = R(((s.y - st.cam.y * LS * 0.2) % H + H) % H);
      lx.fillStyle = Math.sin(st.t * 3 + s.x * 40) > -0.3 ? "#fff" : "#9aa0ff";
      lx.fillRect(R(s.x * W), y, 1, 1);
    }
  }
}

// 벽: 구간별 픽셀 벽 그림(Codex)을 세계 좌표에 고정해 이어 붙인다.
// 이음매가 안 보이게 한 장씩 위아래를 뒤집고, 오른쪽 벽은 좌우를 뒤집어 밝은 테두리가 통로를 향하게.
const WALL_IMG = Object.fromEntries(ZONES.map(z => [z.wall, img(`walls/${z.wall}`)]));
function drawWall(side) {
  const H = view.lh, inner = wx(side * WALL_X);
  const ref = WALL_IMG.lv01;
  if (!imgOk(ref)) { lx.fillStyle = "#2f7d3a"; side < 0 ? lx.fillRect(0, 0, inner, H) : lx.fillRect(inner, 0, view.lw - inner, H); return; }
  const tw = ref.naturalWidth, th = ref.naturalHeight, base = wy(0);   // 세계 높이 0 이 있는 화면 y
  const k0 = Math.floor((base - H) / th) - 1, k1 = Math.ceil(base / th) + 1;
  for (let k = k0; k <= k1; k++) {
    const top = base - (k + 1) * th;                          // k 번째 판: base 위로 쌓아 올림
    if (top > H || top + th < 0) continue;
    const midRow = Math.max(0, ((k + 0.5) * th) / (ROW * LS));
    const style = ZONES[zoneAt(midRow)].wall, im = WALL_IMG[style];
    if (!imgOk(im)) continue;
    const flipV = (k & 1) === 1;
    for (let n = 0; ; n++) {                                  // 넓은 화면이면 바깥쪽으로 한 장 더
      const x = side < 0 ? inner - (n + 1) * tw : inner + n * tw;
      if (side < 0 ? x + tw <= 0 : x >= view.lw) break;
      lx.save();
      lx.translate(x + (side > 0 ? tw : 0), top + (flipV ? th : 0));
      lx.scale(side > 0 ? -1 : 1, flipV ? -1 : 1);
      lx.drawImage(im, 0, 0, tw, th);                          // 그림마다 높이가 달라도 칸을 꽉 채움 (빈틈 방지)
      lx.restore();
      if (n > 6) break;
    }
  }
  // 통로 쪽 그림자 + 구간 색 테두리
  const edge = ZONES[zoneMix().z].edge;
  lx.fillStyle = "rgba(10,6,24,.55)"; lx.fillRect(side < 0 ? inner : inner - 3, 0, 3, H);
  lx.fillStyle = edge; lx.fillRect(side < 0 ? inner - 1 : inner, 0, 1, H);
}

function drawRows() {
  const from = Math.max(0, st.idx - 12), to = Math.min(st.rows.length - 1, st.idx + 22);
  for (let i = from; i <= to; i++) {
    const r = st.rows[i], Y = wy(-i * ROW);
    if (r.obs) {
      const im = OBS[r.kind], X = wx(r.obs * WALL_X);
      if (imgOk(im)) {
        lx.save(); lx.translate(X, Y - 6);
        if (r.kind === "shock" || r.kind === "laser") lx.globalAlpha = 0.75 + 0.25 * Math.sin(st.t * 20 + i);   // 전기·레이저는 지직지직
        if (r.obs > 0) lx.scale(-1, 1);                        // 오른쪽 벽이면 좌우 반전 (가시가 통로를 향하게)
        const w = im.naturalWidth, h = im.naturalHeight;
        lx.drawImage(im, 0, R(-h / 2));                        // 벽에 붙여서 통로 쪽으로
        lx.restore();
      } else { lx.fillStyle = "#ff4d6d"; lx.fillRect(X - (r.obs > 0 ? 10 : 0), Y - 10, 10, 8); }
      if (i === st.idx + 1 && st.mode === "play" && !st.fall && Math.floor(st.t * 6) % 2 === 0) {   // 바로 위 장애물 경고
        lx.fillStyle = "#ff4d6d"; lx.fillRect(X - (r.obs > 0 ? 3 : 0), Y - 16, 3, 3);
      }
    }
    if (r.coin && imgOk(COIN)) {
      const X = wx(r.coin * (WALL_X - 8)), bob = R(Math.sin(st.t * 4 + i) * 2);
      lx.drawImage(COIN, X - (COIN.naturalWidth >> 1), Y - 14 - (COIN.naturalHeight >> 1) + bob);
    }
  }
  for (const p of st.pops) {
    const X = wx(p.s * (WALL_X - 8)), Y = wy(-p.i * ROW) - 26 - R((1 - p.life) * 14);
    lx.globalAlpha = p.life; lx.fillStyle = C.yellow;
    lx.fillRect(X - 1, Y - 3, 2, 6); lx.fillRect(X - 3, Y - 1, 6, 2); lx.globalAlpha = 1;
  }
}

const sweepCv = document.createElement("canvas"), sweepCx = sweepCv.getContext("2d");
// g: 그릴 캔버스, im: 그림, x,y: 왼쪽 위, w,h: 크기, u: 화면 배율(저해상도=1, 선택 화면=확대 배율)
function legendFx(g, im, x, y, w, h, u, flip, rays) {
  const t = st.t, cxp = x + w / 2, cyp = y + h / 2;
  if (rays) {                                                     // 뒤에서 천천히 도는 금빛 광선
    g.save(); g.translate(cxp, cyp); g.rotate(t * 0.35); g.globalCompositeOperation = "lighter";
    for (let i = 0; i < 10; i++) {
      g.rotate(Math.PI / 5);
      const len = h * (0.95 + 0.12 * Math.sin(t * 2 + i)), gr = g.createLinearGradient(0, 0, len, 0);
      gr.addColorStop(0, "rgba(255,240,180,.55)"); gr.addColorStop(1, "rgba(255,240,180,0)");
      g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.lineTo(len, -h * 0.06); g.lineTo(len, h * 0.06); g.closePath(); g.fill();
    }
    g.restore();
  }
  const drawIm = () => { g.save(); if (flip) { g.translate(x + w, y); g.scale(-1, 1); g.drawImage(im, 0, 0, w, h); } else g.drawImage(im, x, y, w, h); g.restore(); };
  // 몸 윤곽을 따라 번지는 빛 (두 겹)
  g.save(); g.shadowColor = `hsla(${190 + 15 * Math.sin(t * 3)},100%,78%,.95)`; g.shadowBlur = (6 + 2 * Math.sin(t * 5)) * u;
  drawIm(); drawIm(); g.restore();
  drawIm();
  // 대각선 광택 스윕 (1.5초마다 몸을 훑고 지나감)
  const k = (t % 1.5) / 1.5;
  if (k < 0.45) {
    sweepCv.width = Math.ceil(w); sweepCv.height = Math.ceil(h);
    sweepCx.imageSmoothingEnabled = false; sweepCx.clearRect(0, 0, w, h);
    if (flip) { sweepCx.save(); sweepCx.translate(w, 0); sweepCx.scale(-1, 1); sweepCx.drawImage(im, 0, 0, w, h); sweepCx.restore(); } else sweepCx.drawImage(im, 0, 0, w, h);
    sweepCx.globalCompositeOperation = "source-atop";
    const p = -w + (k / 0.45) * (w * 3), gr = sweepCx.createLinearGradient(p, 0, p + w * 0.6, h);
    gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.5, "rgba(255,255,255,.95)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    sweepCx.fillStyle = gr; sweepCx.fillRect(0, 0, w, h); sweepCx.globalCompositeOperation = "source-over";
    g.save(); g.globalCompositeOperation = "lighter"; g.drawImage(sweepCv, x, y); g.restore();
  }
  // 반짝이 별: 몸 주위 6곳에서 번갈아 반짝
  for (let i = 0; i < 6; i++) {
    const ph = (t * 1.3 + i * 0.37) % 1, a = Math.sin(ph * Math.PI);
    if (a < 0.15) continue;
    const ang = i * 1.05 + Math.floor(t * 1.3 + i * 0.37) * 2.1, rr = 0.55 + 0.15 * ((i * 7) % 3);
    const sx = cxp + Math.cos(ang) * w * rr, sy = cyp + Math.sin(ang) * h * 0.5 * rr, sz = (1.5 + 2.5 * a) * u;
    g.save(); g.globalAlpha = a; g.fillStyle = "#ffffff";
    g.fillRect(R(sx - sz), R(sy - u * 0.5), R(sz * 2), Math.max(1, R(u)));
    g.fillRect(R(sx - u * 0.5), R(sy - sz), Math.max(1, R(u)), R(sz * 2));
    g.fillStyle = "#bff8ff"; g.fillRect(R(sx - u), R(sy - u), Math.max(1, R(u * 2)), Math.max(1, R(u * 2)));
    g.restore();
  }
}

function legendGlow() { return st.mode === "play" && !st.fall && tierNow() === COSTUMES.length - 1; }
function drawAuraBack() {
  if (!st.sparks || !legendGlow()) return;
  const lv = 5;
  if (lv >= 3) {                                              // 잔상
    const im = NINJA_().climb;
    st.trail.forEach((q, i) => {
      if (!imgOk(im) || i === 0) return;
      lx.globalAlpha = 0.28 - i * 0.05;
      lx.save(); lx.translate(wx(q.x), wy(q.y) - 4); if (st.side > 0) lx.scale(-1, 1);
      lx.drawImage(im, R(-im.naturalWidth / 2 + 3), R(-im.naturalHeight / 2)); lx.restore();
    });
    lx.globalAlpha = 1;
  }
}
function drawAuraFront() {
  if (!st.sparks) return;
  for (const k of st.sparks) {                                // 반짝이 (작은 십자 픽셀)
    const X = wx(k.x), Y = wy(k.y), col = auraColor(k.lv, st.t + k.seed);
    lx.globalAlpha = Math.min(1, k.life * 1.4); lx.fillStyle = col;
    lx.fillRect(X, Y, 1, 1);
    if (k.life > 0.5 && k.lv >= 2) { lx.fillRect(X - 1, Y, 3, 1); lx.fillRect(X, Y - 1, 1, 3); }
  }
  lx.globalAlpha = 1;
}

function drawNinja() {
  const p = charPos(), X = wx(p.x), Y = wy(p.y) - 4;
  const NINJA = NINJA_();
  let im = NINJA.cling, rot = 0;
  const crashJump = st.crash && st.crash.jump;
  if (st.fall) { im = NINJA.fall; rot = Math.floor(st.fall.rot / (Math.PI / 4)) * Math.PI / 4; }
  else if (crashJump) { im = NINJA.jump; rot = Math.floor(Math.min(1, st.crash.t / st.crash.dur) * 4) * Math.PI / 2 * -st.side; }
  else if (st.crash) im = NINJA.climb;
  else if (st.anim > 0 && st.animKind === "jump") { im = NINJA.jump; rot = Math.floor((1 - st.anim) * 4) * Math.PI / 2 * -st.side; }
  else if (st.anim > 0 || Math.floor(st.t * 2.5) % 2) im = st.anim > 0 ? NINJA.climb : NINJA.cling;
  lx.save(); lx.translate(X, Y); if (rot) lx.rotate(rot);
  if (!st.fall && !crashJump && !(st.anim > 0 && st.animKind === "jump") && st.side > 0) lx.scale(-1, 1);   // 그림은 왼쪽 벽 기준 — 오른쪽 벽이면 반전
  if (imgOk(im)) {
    const w = im.naturalWidth, h = im.naturalHeight;
    const ox = st.fall || crashJump || (st.anim > 0 && st.animKind === "jump") ? -w / 2 : -w / 2 + 3;
    if (legendGlow()) legendFx(lx, im, R(ox), R(-h / 2), w, h, 1, false, false);   // 다이아: 윤곽 빛 + 광택 스윕 + 반짝이
    else lx.drawImage(im, R(ox), R(-h / 2));
  } else { lx.fillStyle = "#1a1a48"; lx.fillRect(-7, -14, 14, 28); }
  lx.restore();
}

// 픽셀 버튼: 계단식으로 깎은 모서리 + 진한 외곽선 + 3단 음영 + 반짝임 + 바닥 그림자. 누르면 쏙 들어간다.
function shade(hex, k) {                                       // k>0 밝게, k<0 어둡게
  const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255];
  return `rgb(${c.map(v => Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k))).join(",")})`;
}
function stepRect(g, x, y, w, h, p) {                         // 모서리를 p 픽셀씩 두 번 깎은 사각형
  g.fillRect(x + 2 * p, y, w - 4 * p, h);
  g.fillRect(x + p, y + p, w - 2 * p, h - 2 * p);
  g.fillRect(x, y + 2 * p, w, h - 4 * p);
}
function pixelBox(x, y, w, h, fill, edge, press) {
  x = R(x); y = R(y); w = R(w); h = R(h);
  const p = Math.max(2, Math.round(h / 24)), o = Math.round(press * p * 2);
  cx.fillStyle = "#120a26"; stepRect(cx, x, y + 3 * p, w, h, p);                 // 바닥 그림자
  cx.fillStyle = shade(edge, -0.45); stepRect(cx, x, y + o, w, h, p);            // 외곽선
  const ix = x + p, iy = y + o + p, iw = w - 2 * p, ih = h - 2 * p;
  cx.fillStyle = shade(fill, -0.28); stepRect(cx, ix, iy, iw, ih, p);            // 아래쪽 어두운 면
  cx.fillStyle = fill; stepRect(cx, ix, iy, iw, ih - 2 * p, p);                  // 본색
  cx.fillStyle = shade(fill, 0.35); cx.fillRect(ix + 2 * p, iy + p, iw - 4 * p, Math.max(p, Math.round(ih * 0.18)));   // 위쪽 밝은 띠
  cx.fillStyle = "rgba(255,255,255,.9)"; cx.fillRect(ix + 2 * p, iy + p, 2 * p, p); cx.fillRect(ix + p, iy + 2 * p, p, p);   // 반짝임
  return o;
}

// 픽셀 아이콘 (문자 기호 대신 직접 그린 7×7 그림)
const ICONS = {
  up:    ["...#...", "..###..", ".#####.", "#######", "..###..", "..###..", "..###.."],
  swap:  ["..#....", ".######", "..#....", ".......", "....#..", "######.", "....#.."],
  left:  ["...#...", "..##...", ".######", "#######", ".######", "..##...", "...#..."],
  right: ["...#...", "...##..", "######.", "#######", "######.", "...##..", "...#..."],
};
function pixelIcon(name, cxp, cyp, size, color) {
  const m = ICONS[name], u = Math.max(1, Math.round(size / 7)), x0 = R(cxp - 3.5 * u), y0 = R(cyp - 3.5 * u);
  cx.fillStyle = color;
  m.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === "#") cx.fillRect(x0 + i * u, y0 + j * u, u, u); }));
}

function drawHud() {
  if (st.mode === "title") return;                             // 시작 화면에선 점수·버튼 숨김
  const w = view.w, h = view.h, u = Math.min(w, h * 0.62) / 100;
  const big = Math.max(22, Math.round(11 * u / 11) * 11);
  text(`${st.steps}${T.unit}`, w / 2, h * 0.08, big * 1.4, "#ffffff");
  { const z = zoneAt(st.steps), lv = ZONES[z].level, max = lv >= MAX_LEVEL;
    const lw = Math.min(w * 0.24, 110), lx0 = 12, ly0 = h * 0.08 + big * 0.9;
    const pop = 1 + (st.levelFx || 0) * 0.35;
    text(max ? "Lv.MAX" : `Lv.${lv}`, lx0, h * 0.08 + big * 0.2, Math.round(big * 0.62 * pop), max ? "#ffe27a" : "#3ce6ff", "left");
    const k = max ? 1 : (st.steps - ZONES[z].at) / LEVEL_M;
    cx.fillStyle = "rgba(26,16,48,.6)"; cx.fillRect(lx0, ly0, lw, 6);
    cx.fillStyle = max ? "#ffe27a" : "#3ce6ff"; cx.fillRect(lx0, ly0, Math.round(lw * k), 6);
    const g = COSTUMES[tierNow()];                               // 지금 등급
    text(T === TEXT.ko ? g.ko : g.en, lx0, ly0 + Math.round(big * 0.55), Math.round(big * 0.42), g.col, "left"); }
  text(`${T.best} ${Math.max(st.best, st.steps)}${T.unit}`, w / 2, h * 0.08 + big * 1.0, Math.round(big * 0.5), "#ffd640");
  if (st.coins) text(`● ${st.coins}`, w - 12, h * 0.08, Math.round(big * 0.55), "#ffd640", "right");
  const sk = skill();                                          // 능력 남은 횟수
  if (sk === "armor") text(st.armor ? "🛡" : "·", w - 12, h * 0.08 + big * 0.9, Math.round(big * 0.6), "#3ce6ff", "right");
  if (sk === "revive") text(st.revive ? "♥" : "♡", w - 12, h * 0.08 + big * 0.9, Math.round(big * 0.6), "#ff40a0", "right");
  if (st.mode === "play") {
    const cells = 20, bw = Math.min(w * 0.72, 300), cw = bw / cells, bx = (w - bw) / 2, by = h * 0.08 + big * 1.6;
    const on = Math.ceil(Math.max(0, st.time) * cells);
    for (let i = 0; i < cells; i++) {
      cx.fillStyle = i < on ? (st.time < 0.3 ? "#ff4d6d" : st.time < 0.6 ? "#ffd640" : "#5cff8a") : "rgba(26,16,48,.5)";
      cx.fillRect(R(bx + i * cw + 1), R(by), R(cw - 2), 10);
    }
  }
  const bh = Math.round(Math.min(h * 0.12, 90)), pad = 14, y = h - bh - pad - 8, bw = (w - pad * 3) / 2;
  if (st.mode !== "play") return;                               // 게임 오버 화면에선 조작 버튼 숨김
  const o1 = pixelBox(pad, y, bw, bh, "#3ce6ff", "#1a6f8a", st.pressFx.jump);
  pixelIcon("swap", pad + bw * 0.27, y + o1 + bh / 2, Math.round(bh * 0.34), "#0e1a3a");
  text(T.jump, pad + bw * 0.58, y + o1 + bh / 2, Math.round(bh * 0.3), "#0e1a3a", "center", false, bw * 0.56);
  const o2 = pixelBox(pad * 2 + bw, y, bw, bh, "#ff40a0", "#8a1a55", st.pressFx.climb);
  pixelIcon("up", pad * 2 + bw + bw * 0.27, y + o2 + bh / 2, Math.round(bh * 0.34), "#ffffff");
  text(T.climb, pad * 2 + bw + bw * 0.6, y + o2 + bh / 2, Math.round(bh * 0.3), "#ffffff", "center", false, bw * 0.56);
  if (st.banner && st.bannerT > 0) { cx.fillStyle = "rgba(14,10,34,.6)"; cx.fillRect(0, R(h * 0.3 - big * 0.85), w, R(big * 1.7)); }   // 어떤 배경에서도 읽히게
  if (st.banner && st.bannerT > 0 && Math.floor(st.bannerT * 8) % 2 === 0) text(st.banner.text, w / 2, h * 0.3, Math.min(big, w / (st.banner.text.length * (/[가-힣]/.test(st.banner.text) ? 1 : 0.62) + 1.5)), st.banner.col);
}

let againBtn = null, selBtns = null;

// 캐릭터 고르기: 가운데 큰 미리보기, 양옆 ◀ ▶, 아래 이름과 출발 버튼
function drawCharSelect(w, h, big) {
  const c = CHARS[st.char], tier = tierOf(st.best), im = standImg(c.id, tier), cy = h * 0.4;
  const size = Math.min(w * 0.38, h * 0.22);
  {                                                                // 이 캐릭터의 등급과 최고 기록
    text(`${T === TEXT.ko ? "등급" : "RANK"} · ${T === TEXT.ko ? COSTUMES[tier].ko : COSTUMES[tier].en}`, w / 2, cy - size * 0.7, Math.round(big * 0.55), COSTUMES[tier].col);
    if (st.best) text(`${T.best} ${st.best}${T.unit}`, w / 2, cy - size * 0.7 + big * 0.62, Math.round(big * 0.4), "#ffffff");
  }
  cx.save(); cx.imageSmoothingEnabled = false;
  if (imgOk(im)) {
    const k = Math.max(1, Math.floor(size / im.naturalHeight)), dw = im.naturalWidth * k, dh = im.naturalHeight * k;
    const bob = Math.floor(st.t * 2.5) % 2 ? -k : 0;
    if (tier === COSTUMES.length - 1) legendFx(cx, im, R(w / 2 - dw / 2), R(cy - dh / 2 + bob), dw, dh, k, false, true);
    else cx.drawImage(im, R(w / 2 - dw / 2), R(cy - dh / 2 + bob), dw, dh);
  }
  cx.restore();
  const ab = Math.round(big * 1.8), ay = cy - ab / 2;
  const left = { x: Math.max(8, R(w / 2 - size * 0.9 - ab)), y: R(ay), w: ab, h: ab };
  const right = { x: Math.min(R(w - ab - 8), R(w / 2 + size * 0.9)), y: R(ay), w: ab, h: ab };   // 좁은 화면에서도 안쪽에
  {
  pixelBox(left.x, left.y, ab, ab, "#3ce6ff", "#1a6f8a", 0); pixelIcon("left", left.x + ab / 2, left.y + ab / 2 - 2, Math.round(ab * 0.42), "#0e1a3a");
  pixelBox(right.x, right.y, ab, ab, "#3ce6ff", "#1a6f8a", 0); pixelIcon("right", right.x + ab / 2, right.y + ab / 2 - 2, Math.round(ab * 0.42), "#0e1a3a");
  }
  text(T === TEXT.ko ? c.ko : c.en, w / 2, cy + size * 0.68, Math.round(big * 0.8), "#ffd640");
  const desc = T === TEXT.ko ? c.sko : c.sen;
  text(desc, w / 2, cy + size * 0.68 + big * 1.45, Math.min(Math.round(big * 0.42), w / (desc.length * 0.62 + 2)), "#3ce6ff");
  for (let i = 0; i < CHARS.length; i++) {   // 몇 번째 캐릭터인지 점으로
    cx.fillStyle = i === st.char ? "#ff40a0" : "rgba(255,255,255,.35)";
    cx.fillRect(R(w / 2 + (i - (CHARS.length - 1) / 2) * 14 - 4), R(cy + size * 0.68 + big * 0.75), 8, 8);
  }
  const bw = Math.min(w * 0.6, 260), bh = Math.round(big * 1.6), bx = (w - bw) / 2, by = R(cy + size * 0.68 + big * 2.2);
  pixelBox(bx, by, bw, bh, "#ff40a0", "#8a1a55", Math.floor(st.t * 2) % 2 ? 0 : 0.3);
  text(st.charChosen && st.checkpoint ? (T === TEXT.ko ? `출발! (${st.checkpoint}${T.unit}부터)` : `GO! (from ${st.checkpoint}${T.unit})`) : T.start, w / 2, by + bh / 2, Math.round(big * (st.checkpoint ? 0.5 : 0.6)), "#ffffff", "center", false, bw - 28);
  if (!st.charChosen) text(T.how, w / 2, Math.min(by + bh + big * 0.9, h - big * 0.8), Math.round(big * 0.42), "#ffffff");   // 처음 고를 때만 안내
  selBtns = { left, right, go: { x: bx, y: by, w: bw, h: bh } };
}
function inBox(b, x, y) { return b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h; }
function drawOverlay() {
  const w = view.w, h = view.h, u = Math.min(w, h * 0.62) / 100;
  const big = Math.max(22, Math.round(11 * u / 11) * 11);
  if (st.mode === "title") {
    cx.fillStyle = "rgba(14,10,34,.55)"; cx.fillRect(0, 0, w, h);
    text(T.title, w / 2, h * 0.15, Math.min(big * 1.6, w / (T.title.length + 1.5)), "#ffffff");   // 화면 폭에 맞춤
    drawCharSelect(w, h, big);
  }
  if (st.mode === "over") {
    cx.fillStyle = "rgba(14,10,34,.72)"; cx.fillRect(0, 0, w, h);
    const om = T.overs[st.overMsg || 0];
    text(om, w / 2, h * 0.28, Math.min(big * 1.3, w / (om.length * (T === TEXT.ko ? 1 : 0.62) + 1.5)), "#ff40a0");
    text(`${st.steps}${T.unit}`, w / 2, h * 0.28 + big * 1.6, big, "#ffffff");
    text(`${T.best} ${st.best}${T.unit}`, w / 2, h * 0.28 + big * 2.6, Math.round(big * 0.55), "#ffd640");
    const bw = Math.min(w * 0.6, 260), bh = Math.round(big * 1.6), x = (w - bw) / 2, y = h * 0.28 + big * 3.4;
    againBtn = { x, y, w: bw, h: bh };
    pixelBox(x, y, bw, bh, "#ff40a0", "#8a1a55", 0);
    const cp = st.checkpoint || 0;
    text(cp ? (T === TEXT.ko ? `${cp}${T.unit}부터 다시` : `Retry from ${cp}${T.unit}`) : T.again, w / 2, y + bh / 2, Math.round(big * 0.6), "#ffffff", "center", false, bw - 28);
    const tier = tierOf(st.best), next = COSTUMES[tier + 1];      // 다음 복장까지 남은 높이
    const hy = y + bh + 18, hw = Math.min(w * 0.6, 260), hh = Math.round(bh * 0.7), hx = (w - hw) / 2;
    pixelBox(hx, hy + big * 1.4, hw, hh, "#8a8aa8", "#3a3a58", 0);
    text(T === TEXT.ko ? "다른 캐릭터로" : "Change character", w / 2, hy + big * 1.4 + hh / 2, Math.round(hh * 0.36), "#ffffff", "center", false, hw - 24);
    selBtns = { home: { x: hx, y: hy + big * 1.4, w: hw, h: hh } };
    if (next) text(T === TEXT.ko ? `${next.ko} 등급까지 ${next.at - st.best}${T.unit}` : `${next.en} rank: ${next.at - st.best}${T.unit} to go`, w / 2, y + bh + big * 0.9, Math.round(big * 0.45), "#3ce6ff");
  }
}

function draw() {
  lx.imageSmoothingEnabled = false;
  drawShaft(); drawWall(-1); drawWall(1); drawRows(); drawAuraBack(); drawNinja(); drawAuraFront();
  if (st.flash > 0 && Math.floor(st.flash * 10) % 2) { lx.fillStyle = "rgba(255,255,255,.5)"; lx.fillRect(0, 0, view.lw, view.lh); }
  cx.setTransform(1, 0, 0, 1, 0, 0);
  cx.imageSmoothingEnabled = false;
  cx.drawImage(low, 0, 0, view.lw * view.k, view.lh * view.k);
  cx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  drawHud(); drawOverlay();
}

// ───────────── 입력 ─────────────
cv.addEventListener("pointerdown", e => {
  const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  if (st.mode === "title") {
    ensureAudio();
    if (selBtns && inBox(selBtns.left, x, y)) pickChar(-1);
    else if (selBtns && inBox(selBtns.right, x, y)) pickChar(1);
    else if (selBtns && inBox(selBtns.go, x, y)) begin();
    return;
  }
  if (st.mode === "over") {
    ensureAudio();
    if (inBox(againBtn, x, y)) restart();
    else if (selBtns && inBox(selBtns.home, x, y)) st.mode = "title";
    else if (selBtns && inBox(selBtns.change, x, y)) { st.mode = "title"; }
    return;
  }
  act(x < view.w / 2);                                       // 왼쪽 절반 = 점프, 오른쪽 절반 = 오르기
});
window.addEventListener("keydown", e => {
  if (e.repeat) return;
  if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "BUTTON")) return;
  const k = e.key;
  if (st.mode === "over" && (k === "Enter" || k === " ")) { restart(); e.preventDefault(); return; }
  if (st.mode === "title") {
    if (k === "ArrowLeft" || k === "a") pickChar(-1);
    else if (k === "ArrowRight" || k === "d") pickChar(1);
    else if (k === "Enter" || k === " ") { begin(); e.preventDefault(); }
    return;
  }
  if (k === "ArrowLeft" || k === "a" || k === "z") act(true);
  else if (k === "ArrowRight" || k === "d" || k === "x" || k === " " || k === "ArrowUp") { act(false); e.preventDefault(); }
});

// ───────────── 루프 ─────────────
let last = 0, rafId = 0, firstFrame = false;
function frame(now) {
  rafId = 0;
  if (st.paused) return;
  { const d = Math.min(window.devicePixelRatio || 1, 2.5); if (Math.abs(cv.width - Math.round((cv.clientWidth || innerWidth) * d)) > 2) layout(); }
  const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
  update(dt); draw();
  if (!firstFrame) { firstFrame = true; sdk.firstFrameReady(); }
  rafId = requestAnimationFrame(frame);
}
function startLoop() { if (!rafId) { last = 0; rafId = requestAnimationFrame(frame); } }

(async function boot() {
  layout(); newRun(); startLoop();
  const lang = (await sdk.lang() || "").toLowerCase();
  T = lang.startsWith("ko") ? TEXT.ko : TEXT.en;
  document.title = T.title;
  window.WSA_LB_UNIT = T.unit;
  window.WSA_LB_IMG = r => {                                     // 순위표에 보여줄 캐릭터 사진 (그 기록을 낸 캐릭터·등급)
    if (!r.char || !STAND[r.char]) return "";
    const im = standImg(r.char, Math.max(0, Math.min(COSTUMES.length - 1, r.tier | 0)));
    return im ? im.src : "";
  };
  audioEnabled = sdk.audioOn();
  await loadSave();
  st.ready = true;
  sdk.gameReady();
  if (IN_YT) {
    YT.system.onPause(() => { st.paused = true; if (actx) actx.suspend(); save(); });
    YT.system.onResume(() => { st.paused = false; if (actx && audioEnabled) actx.resume(); startLoop(); });
    YT.system.onAudioEnabledChange(on => setAudio(on));
  }
})();
