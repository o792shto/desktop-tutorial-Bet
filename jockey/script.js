'use strict';

/* =========================================================================
 * 定数・マスタデータ
 * ========================================================================= */

const SAVE_KEY = 'jockeyLifeSave_v1';
const WEEKS_PER_SEASON = 24;

const STYLE_BONUS = {
  technique: { technique: 10 },
  stamina: { stamina: 10 },
  weight: { weight: 10 },
  connections: { connections: 10 },
};

// 週番号 -> 目玉レース(実在の中央競馬体系をモチーフにした架空カレンダー)
const FEATURED_RACES = {
  2: { name: '中山記念', grade: 'G2', distance: 1800, surface: '芝' },
  4: { name: '大阪杯', grade: 'G1', distance: 2000, surface: '芝' },
  5: { name: '天皇賞(春)', grade: 'G1', distance: 3200, surface: '芝' },
  6: { name: '皐月賞', grade: 'G1', distance: 2000, surface: '芝', classic: 1 },
  7: { name: 'NHKマイルカップ', grade: 'G1', distance: 1600, surface: '芝' },
  8: { name: '日本ダービー', grade: 'G1', distance: 2400, surface: '芝', classic: 2 },
  9: { name: '安田記念', grade: 'G1', distance: 1600, surface: '芝' },
  10: { name: '宝塚記念', grade: 'G1', distance: 2200, surface: '芝' },
  13: { name: 'スプリンターズステークス', grade: 'G1', distance: 1200, surface: '芝' },
  14: { name: 'セントライト記念', grade: 'G2', distance: 2200, surface: '芝' },
  15: { name: '菊花賞', grade: 'G1', distance: 3000, surface: '芝', classic: 3 },
  16: { name: '天皇賞(秋)', grade: 'G1', distance: 2000, surface: '芝' },
  17: { name: 'エリザベス女王杯', grade: 'G1', distance: 2200, surface: '芝' },
  18: { name: 'マイルチャンピオンシップ', grade: 'G1', distance: 1600, surface: '芝' },
  19: { name: 'ジャパンカップ', grade: 'G1', distance: 2400, surface: '芝' },
  21: { name: '阪神ジュベナイルフィリーズ', grade: 'G1', distance: 1600, surface: '芝' },
  22: { name: '朝日杯フューチュリティステークス', grade: 'G1', distance: 1600, surface: '芝' },
  24: { name: '有馬記念', grade: 'G1', distance: 2500, surface: '芝' },
};

const FILLER_NAMES_CLEAN = ['未勝利戦', '1勝クラス', '2勝クラス', '3勝クラス', 'オープン特別'];
const FILLER_GRADES = ['平場', '平場', '平場', 'OP', 'G3'];

const BLOODLINES = ['sprinter', 'miler', 'middle', 'stayer'];
const BLOODLINE_LABEL = { sprinter: '短距離型', miler: 'マイル型', middle: '中距離型', stayer: 'ステイヤー型' };
const LEG_STYLES = ['逃げ', '先行', '差し', '追込'];

const HORSE_NAME_PREFIX = ['トウカイ', 'メイショウ', 'サクラ', 'タイキ', 'ゴールド', 'エア', 'シルバー', 'キング', 'ブラック', 'レインボー', 'スカイ', 'ノーブル', 'フェザー', 'ダイヤ', 'レッド', 'ホワイト', 'ジェット', 'カムイ', 'マツリダ', 'ハル'];
const HORSE_NAME_SUFFIX = ['テンマ', 'ブレイズ', 'フウジン', 'シャイニー', 'インパクト', 'フォルテ', 'クレスト', 'ヴァルク', 'タイフーン', 'ソニック', 'ダッシュ', 'ストーム', 'ウィンド', 'ロア', 'フェニックス', 'キャニオン', 'ストリーム', 'ヴェール', 'オー', 'ウララ'];

const RIVAL_SURNAME = ['武内', '福永', '川島', '和田', '横山', '田中', '北村', '松山', '藤田', '菅原', '西村', '岩田', '柴田', '池添', '津村'];
const RIVAL_GIVEN = ['翔', '大和', '健太', '海斗', '亮', '悠人', '直樹', '拓也', '将也', '陸'];

/* =========================================================================
 * ユーティリティ
 * ========================================================================= */

function rand(min, max) { return Math.random() * (max - min) + min; }
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
function pick(arr) { return arr[randInt(0, arr.length - 1)]; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function weighted(pairs) {
  // pairs: [[value, weight], ...]
  const total = pairs.reduce((s, p) => s + p[1], 0);
  let r = rand(0, total);
  for (const [v, w] of pairs) {
    if (r < w) return v;
    r -= w;
  }
  return pairs[pairs.length - 1][0];
}

function distanceCategory(distance) {
  if (distance <= 1400) return 'sprinter';
  if (distance <= 1800) return 'miler';
  if (distance <= 2200) return 'middle';
  return 'stayer';
}

function aptitudeMultiplier(bloodline, category) {
  if (bloodline === category) return 1.15;
  const order = ['sprinter', 'miler', 'middle', 'stayer'];
  const diff = Math.abs(order.indexOf(bloodline) - order.indexOf(category));
  if (diff === 1) return 1.0;
  if (diff === 2) return 0.9;
  return 0.85;
}

function formMultiplier(form) {
  return { 絶好調: 1.15, 好調: 1.07, 普通: 1.0, 不調: 0.9, 絶不調: 0.8 }[form] || 1.0;
}

function conditionMultiplier(cond) {
  return { 絶好調: 1.12, 好調: 1.06, 普通: 1.0, 不調: 0.92, 絶不調: 0.82 }[cond] || 1.0;
}

function fmtMan(n) { return n.toLocaleString('ja-JP') + '万円'; }

/* =========================================================================
 * 生成系
 * ========================================================================= */

function generateHorseName() {
  return pick(HORSE_NAME_PREFIX) + pick(HORSE_NAME_SUFFIX);
}

function generateRivalName() {
  return pick(RIVAL_SURNAME) + ' ' + pick(RIVAL_GIVEN);
}

function gradeLevelValue(grade) {
  return { G1: 4, G2: 3, G3: 2, OP: 1.4, 平場: 1 }[grade] || 1;
}

function generateHorse(grade) {
  const level = gradeLevelValue(grade);
  const base = 40 + level * 8;
  const spread = 18;
  const bloodline = pick(BLOODLINES);
  const form = weighted([
    ['絶好調', 1], ['好調', 3], ['普通', 5], ['不調', 3], ['絶不調', 1],
  ]);
  return {
    name: generateHorseName(),
    bloodline,
    legStyle: pick(LEG_STYLES),
    form,
    speed: clamp(Math.round(base + rand(-spread, spread)), 20, 99),
    stamina: clamp(Math.round(base + rand(-spread, spread)), 20, 99),
    guts: clamp(Math.round(base + rand(-spread, spread)), 20, 99),
  };
}

function generateRaceForWeek(week) {
  const featured = FEATURED_RACES[week];
  if (featured) {
    return {
      name: featured.name,
      grade: featured.grade,
      distance: featured.distance,
      surface: featured.surface,
      classic: featured.classic || null,
      featured: true,
      prize: gradeLevelValue(featured.grade) * 2500,
    };
  }
  return null;
}

function generateFillerRace() {
  const idx = randInt(0, FILLER_NAMES_CLEAN.length - 1);
  const grade = FILLER_GRADES[idx];
  const distance = pick([1200, 1400, 1600, 1800, 2000, 2200, 2400]);
  return {
    name: FILLER_NAMES_CLEAN[idx],
    grade,
    distance,
    surface: pick(['芝', 'ダート']),
    classic: null,
    featured: false,
    prize: Math.round(gradeLevelValue(grade) * (300 + rand(-50, 150))),
  };
}

/* =========================================================================
 * ゲーム状態
 * ========================================================================= */

let state = null;

function newJockey(name, styleKey) {
  const base = { technique: 35, weight: 35, stamina: 35, connections: 35 };
  const bonus = STYLE_BONUS[styleKey] || {};
  for (const k in bonus) base[k] += bonus[k];
  return {
    name: name || '無名の騎手',
    age: 16,
    license: '見習い',
    stats: base,
    condition: '普通',
    fatigue: 15,
    injuryWeeks: 0,
    slumpWeeks: 0,
    career: { mounts: 0, wins: 0, g1Wins: 0, earnings: 0, seasons: [] },
  };
}

function newGameState(name, styleKey) {
  return {
    jockey: newJockey(name, styleKey),
    week: 1,
    year: 1,
    offers: [],
    log: [],
    seasonRecord: { mounts: 0, wins: 0, g1Wins: 0, earnings: 0 },
    phase: 'week', // week | ended
  };
}

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}
function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
}

function addLog(text, cls) {
  state.log.unshift({ text, cls: cls || '' });
  if (state.log.length > 60) state.log.length = 60;
}

/* =========================================================================
 * 週次オファー生成
 * ========================================================================= */

function recalcCondition() {
  const j = state.jockey;
  const fatigueFactor = j.fatigue; // 0-100
  const pool = [
    ['絶好調', clamp(10 - fatigueFactor / 10, 1, 20)],
    ['好調', 25],
    ['普通', 35],
    ['不調', 20 + fatigueFactor / 6],
    ['絶不調', clamp(fatigueFactor / 8 - 5, 1, 25)],
  ];
  j.condition = weighted(pool);
}

function generateWeekOffers() {
  const week = state.week;
  const j = state.jockey;
  const offers = [];

  const featured = generateRaceForWeek(week);
  if (featured) {
    const inviteChance = clamp(
      0.12 + j.stats.connections / 220 + j.stats.technique / 300 + j.career.g1Wins * 0.02,
      0.05, 0.85
    );
    if (Math.random() < inviteChance) {
      offers.push({ id: 'race_' + week + '_featured', race: featured, horse: generateHorse(featured.grade) });
    } else {
      addLog(`${featured.name}は他の騎手が乗り、あなたには声がかからなかった。`, '');
    }
  }

  const fillerCount = randInt(2, 4);
  for (let i = 0; i < fillerCount; i++) {
    const race = generateFillerRace();
    offers.push({ id: 'race_' + week + '_' + i, race, horse: generateHorse(race.grade) });
  }

  state.offers = offers;
}

function compatibilityScore(jockey, horse) {
  let score = 0;
  score += (jockey.stats.technique - 50) / 10;
  if (horse.form === '絶好調' || horse.form === '好調') score += 2;
  if (horse.form === '不調' || horse.form === '絶不調') score -= 2;
  return score;
}

function compatLabel(score) {
  if (score >= 3) return { label: '相性◎', cls: 'high' };
  if (score >= 0) return { label: '相性○', cls: 'mid' };
  return { label: '相性△', cls: 'low' };
}

/* =========================================================================
 * レースシミュレーション
 * ========================================================================= */

const TACTICS = {
  front: { label: '先行押し切り', desc: '早めに先頭集団へ取り付き、そのまま押し切る。' },
  stalk: { label: '中団から差す', desc: '道中は脚を溜め、直線で勝負に出る安定策。' },
  inside: { label: '内をロスなく回る', desc: '内ラチ沿いでロスを消す。技術が問われるが上手くいけば大きい。' },
  outside: { label: '外から捲る', desc: '大外から一気に交わしにいく。距離のロスはあるが安全策。' },
};

function tacticBonus(tacticKey, horse, jockey) {
  let bonus = 0;
  let note = '';
  switch (tacticKey) {
    case 'front':
      if (horse.legStyle === '逃げ' || horse.legStyle === '先行') { bonus += 8; note = `${horse.name}の脚質に合った積極策がハマった。`; }
      else { bonus -= 6; note = `${horse.name}には少し強引な仕掛けだった。`; }
      if (horse.bloodline === 'sprinter' || horse.bloodline === 'miler') bonus += 4;
      else if (horse.bloodline === 'stayer') bonus -= 4;
      break;
    case 'stalk':
      bonus += 2;
      note = '道中は落ち着いたペースで脚を溜めた。';
      break;
    case 'inside':
      bonus += (jockey.stats.technique - 50) / 5;
      if (Math.random() < 0.15) { bonus -= 12; note = '内で進路を塞がれ、詰まる場面があった。'; }
      else { note = '内ラチ沿いをロスなく立ち回った。'; }
      break;
    case 'outside':
      if (horse.guts >= 65) bonus += 6;
      bonus -= 3;
      note = '大外から距離をものともせず追い上げた。';
      break;
  }
  return { bonus, note };
}

function performanceScore(horse, race, opts) {
  const cat = distanceCategory(race.distance);
  let base = horse.speed * 0.4 + horse.stamina * 0.35 + horse.guts * 0.25;
  base *= aptitudeMultiplier(horse.bloodline, cat);
  base *= formMultiplier(horse.form);
  if (opts && opts.isPlayer) {
    const j = opts.jockey;
    let technique = j.stats.technique;
    if (j.slumpWeeks > 0) technique = clamp(technique - 10, 5, 100);
    base *= (0.85 + technique / 100 * 0.30);
    base *= conditionMultiplier(j.condition);
    base -= j.fatigue * 0.05;
    base += opts.tacticBonus || 0;
    base += opts.compat || 0;
  } else {
    const skill = opts && opts.rivalSkill != null ? opts.rivalSkill : rand(35, 85);
    base *= (0.85 + skill / 100 * 0.30);
  }
  base += rand(-9, 9);
  return base;
}

function fieldSizeForGrade(grade) {
  return { G1: randInt(14, 18), G2: randInt(12, 16), G3: randInt(10, 14), OP: randInt(10, 12), 平場: randInt(8, 12) }[grade] || 10;
}

function simulateRace(offer, tacticKey) {
  const race = offer.race;
  const horse = offer.horse;
  const j = state.jockey;
  const compat = compatibilityScore(j, horse);
  const { bonus: tBonus, note: tNote } = tacticBonus(tacticKey, horse, j);

  const myScore = performanceScore(horse, race, { isPlayer: true, jockey: j, tacticBonus: tBonus, compat });

  const fieldSize = fieldSizeForGrade(race.grade);
  const rivalGradeSkillBase = gradeLevelValue(race.grade) * 12 + 25;
  const rivals = [];
  for (let i = 0; i < fieldSize - 1; i++) {
    const rHorse = generateHorse(race.grade);
    const rSkill = clamp(rivalGradeSkillBase + rand(-15, 15), 20, 95);
    const score = performanceScore(rHorse, race, { isPlayer: false, rivalSkill: rSkill });
    rivals.push({ name: generateRivalName(), horseName: rHorse.name, score });
  }

  const all = [{ name: j.name, horseName: horse.name, score: myScore, isPlayer: true }, ...rivals];
  all.sort((a, b) => b.score - a.score);
  const place = all.findIndex(e => e.isPlayer) + 1;

  return { place, fieldSize, all, tacticNote: tNote, compat };
}

/* =========================================================================
 * ナラティブ生成
 * ========================================================================= */

function raceNarrative(offer, result) {
  const { place, fieldSize, tacticNote } = result;
  const horseName = offer.horse.name;
  let headline, body;
  if (place === 1) {
    headline = offer.race.grade === 'G1' ? `【${offer.race.name}制覇】${horseName}が先頭でゴール!` : `${horseName}が1着!`;
    body = `${tacticNote}\n直線で抜け出した${horseName}がそのまま押し切り、${fieldSize}頭立てを制した。スタンドから歓声が沸き起こる。`;
  } else if (place <= 3) {
    headline = `${horseName}は${place}着`;
    body = `${tacticNote}\n最後まで粘ったが、僅かに及ばず${place}着。悔しさの残る一戦となった。`;
  } else if (place <= Math.ceil(fieldSize / 2)) {
    headline = `${horseName}は${place}着`;
    body = `${tacticNote}\n中団を確保したものの、上位争いには絡めず${place}着に終わった。`;
  } else {
    headline = `${horseName}は${place}着`;
    body = `${tacticNote}\n流れに乗れず、${fieldSize}頭中${place}着という結果に終わった。反省の残るレースだった。`;
  }
  return { headline, body };
}

/* =========================================================================
 * レース後処理
 * ========================================================================= */

function applyRaceResult(offer, result) {
  const j = state.jockey;
  j.career.mounts++;
  state.seasonRecord.mounts++;

  const won = result.place === 1;
  const isG1 = offer.race.grade === 'G1';
  if (won) {
    j.career.wins++;
    state.seasonRecord.wins++;
    if (isG1) { j.career.g1Wins++; state.seasonRecord.g1Wins++; }
    const prize = offer.race.prize;
    j.career.earnings += prize;
    state.seasonRecord.earnings += prize;
    addLog(`${offer.race.name}で${offer.horse.name}に騎乗し優勝(${fmtMan(prize)})`, isG1 ? 'g1' : 'win');
  } else {
    addLog(`${offer.race.name}で${offer.horse.name}に騎乗し${result.place}着/${result.fieldSize}頭`, result.place <= 3 ? '' : '');
  }

  const fatigueGain = 6 + gradeLevelValue(offer.race.grade) * 2;
  j.fatigue = clamp(j.fatigue + fatigueGain, 0, 100);

  if (j.stats.technique < 95 && Math.random() < 0.35) {
    j.stats.technique = clamp(j.stats.technique + 1, 0, 100);
  }

  if (j.slumpWeeks > 0) j.slumpWeeks--;
}

function applySkipWeek() {
  const j = state.jockey;
  j.fatigue = clamp(j.fatigue - 15, 0, 100);
  if (j.slumpWeeks > 0) j.slumpWeeks--;
  addLog('今週は騎乗を見送り、コンディションを整えた。', '');
}

/* =========================================================================
 * シーズン終了・加齢
 * ========================================================================= */

function estimateLeadingRank() {
  const my = state.seasonRecord.earnings;
  let rank = 1;
  for (let i = 0; i < 80; i++) {
    const rivalEarn = rand(0, 15000) * (1 + Math.random());
    if (rivalEarn > my) rank++;
  }
  return rank;
}

function ageJockey() {
  const j = state.jockey;
  j.age++;
  if (j.age >= 20 && j.age < 32) {
    j.stats.technique = clamp(j.stats.technique + randInt(0, 3), 0, 100);
    j.stats.stamina = clamp(j.stats.stamina + randInt(0, 2), 0, 100);
  } else if (j.age >= 32 && j.age < 40) {
    j.stats.stamina = clamp(j.stats.stamina - randInt(0, 2), 0, 100);
  } else if (j.age >= 40) {
    j.stats.stamina = clamp(j.stats.stamina - randInt(1, 4), 0, 100);
    j.stats.technique = clamp(j.stats.technique - randInt(0, 2), 0, 100);
    j.stats.weight = clamp(j.stats.weight - randInt(0, 2), 0, 100);
  }

  if (j.career.g1Wins >= 1 && j.license === '見習い') j.license = '一人前';
  if ((j.age >= 35 || j.career.wins >= 50) && j.license !== 'ベテラン') j.license = 'ベテラン';
}

function forcedRetirementCheck() {
  const j = state.jockey;
  if (j.age >= 50) return '年齢による引退勧告';
  if (j.age >= 40 && j.stats.stamina <= 15) return '体力の限界';
  return null;
}

/* =========================================================================
 * ランダムイベント
 * ========================================================================= */

const EVENT_TRIGGER_CHANCE = 0.16;

const EVENTS = [
  {
    id: 'injury',
    title: '落馬事故発生',
    text: '調教中に馬が急に躓き、あなたは振り落とされてしまった。医師の診断を待つ間、今後の対応を決めなければならない。',
    choices: [
      {
        label: '痛みを押して早期復帰を目指す(療養2週・稀に悪化)',
        apply(st) {
          let weeks = 2;
          let note = '幸い軽傷で済み、最小限の療養で済んだ。';
          if (Math.random() < 0.25) {
            weeks = 5;
            st.jockey.stats.stamina = clamp(st.jockey.stats.stamina - 5, 0, 100);
            note = '無理をした影響で症状が悪化し、思ったより長引いてしまった。';
          }
          st.jockey.injuryWeeks = Math.max(st.jockey.injuryWeeks, weeks);
          return `${note}(療養${weeks}週)`;
        },
      },
      {
        label: 'しっかり療養する(療養5週・回復後スタミナ+3)',
        apply(st) {
          st.jockey.injuryWeeks = Math.max(st.jockey.injuryWeeks, 5);
          st.jockey.stats.stamina = clamp(st.jockey.stats.stamina + 3, 0, 100);
          return '焦らず治療に専念し、万全の状態に体を整えた。';
        },
      },
    ],
  },
  {
    id: 'mount_offer',
    title: '乗り替わり打診',
    text: '有力厩舎の調教師から「うちの馬に乗ってみないか」と声がかかった。',
    choices: [
      {
        label: '誘いに応じて関係を深める(人脈+4・疲労+3)',
        apply(st) {
          st.jockey.stats.connections = clamp(st.jockey.stats.connections + 4, 0, 100);
          st.jockey.fatigue = clamp(st.jockey.fatigue + 3, 0, 100);
          return '食事の誘いに応じ、厩舎との関係を深めることができた。';
        },
      },
      {
        label: '今の関係を大事にして断る(技術+2)',
        apply(st) {
          st.jockey.stats.technique = clamp(st.jockey.stats.technique + 2, 0, 100);
          return '誘いを丁重に断り、自分の技術を磨くことに集中した。';
        },
      },
    ],
  },
  {
    id: 'local_transfer',
    title: '地方転厩の誘い',
    text: '中央での勝ち星に伸び悩む中、知人の調教師から地方競馬への遠征を勧められた。',
    choices: [
      {
        label: '地方でリフレッシュする(疲労-25・賞金+300万円)',
        apply(st) {
          st.jockey.fatigue = clamp(st.jockey.fatigue - 25, 0, 100);
          st.jockey.career.earnings += 300;
          st.seasonRecord.earnings += 300;
          return '地方の重賞で息抜きに勝利し、心身ともにリフレッシュできた。';
        },
      },
      {
        label: '中央に残り勝負を続ける(人脈+3)',
        apply(st) {
          st.jockey.stats.connections = clamp(st.jockey.stats.connections + 3, 0, 100);
          return '誘いを断り、中央での勝負にこだわり続けた。';
        },
      },
    ],
  },
  {
    id: 'slump',
    title: 'スランプ',
    text: '思うように結果が出ない日々が続き、気づけばスランプに陥っていた。',
    choices: [
      {
        label: '猛特訓で乗り越える(疲労+15・スランプ2週で解消)',
        apply(st) {
          st.jockey.fatigue = clamp(st.jockey.fatigue + 15, 0, 100);
          st.jockey.slumpWeeks = 2;
          return '猛特訓の末、少しずつ勘を取り戻し始めた。';
        },
      },
      {
        label: '自然体で待つ(疲労-5・スランプ5週で解消)',
        apply(st) {
          st.jockey.fatigue = clamp(st.jockey.fatigue - 5, 0, 100);
          st.jockey.slumpWeeks = 5;
          return '焦らず自然に調子が戻るのを待つことにした。';
        },
      },
    ],
  },
  {
    id: 'party',
    title: '馬主のパーティー',
    text: '有力馬主が主催するパーティーに招待された。',
    choices: [
      {
        label: '参加して人脈を広げる(人脈+6・疲労+5)',
        apply(st) {
          st.jockey.stats.connections = clamp(st.jockey.stats.connections + 6, 0, 100);
          st.jockey.fatigue = clamp(st.jockey.fatigue + 5, 0, 100);
          return '多くの関係者と言葉を交わし、人脈を広げることができた。';
        },
      },
      {
        label: '欠席して体を休める(疲労-10)',
        apply(st) {
          st.jockey.fatigue = clamp(st.jockey.fatigue - 10, 0, 100);
          return '疲れを癒すため、パーティーは欠席してゆっくり休んだ。';
        },
      },
    ],
  },
  {
    id: 'weight',
    title: '体重超過の指摘',
    text: '減量が思うように進まず、担当医から体重管理について指摘を受けた。',
    choices: [
      {
        label: '本格的に減量する(体重管理+5・疲労+10・スタミナ-2)',
        apply(st) {
          st.jockey.stats.weight = clamp(st.jockey.stats.weight + 5, 0, 100);
          st.jockey.fatigue = clamp(st.jockey.fatigue + 10, 0, 100);
          st.jockey.stats.stamina = clamp(st.jockey.stats.stamina - 2, 0, 100);
          return '厳しい減量に取り組み、なんとか体を絞り込んだ。';
        },
      },
      {
        label: '無理せず現状を維持する(体重管理-4)',
        apply(st) {
          st.jockey.stats.weight = clamp(st.jockey.stats.weight - 4, 0, 100);
          return '無理な減量は避け、体調を優先することにした。';
        },
      },
    ],
  },
];

function openEventModal(evt, afterFn) {
  el.eventTitle.textContent = evt.title;
  el.eventText.textContent = evt.text;
  el.eventChoices.innerHTML = '';
  evt.choices.forEach((choice) => {
    const btn = document.createElement('button');
    btn.className = 'btn btn-choice';
    btn.textContent = choice.label;
    btn.addEventListener('click', () => {
      const resultText = choice.apply(state);
      addLog(resultText, '');
      el.modalEvent.classList.add('hidden');
      renderGame();
      afterFn();
    });
    el.eventChoices.appendChild(btn);
  });
  el.modalEvent.classList.remove('hidden');
}

function triggerEventOrProceed(afterFn) {
  if (state.jockey.injuryWeeks > 0) { afterFn(); return; }
  if (Math.random() < EVENT_TRIGGER_CHANCE) {
    openEventModal(pick(EVENTS), afterFn);
  } else {
    afterFn();
  }
}

/* =========================================================================
 * DOM参照
 * ========================================================================= */

const $ = (id) => document.getElementById(id);

const el = {
  screenStart: $('screen-start'),
  screenGame: $('screen-game'),
  screenEnding: $('screen-ending'),
  continueBox: $('continue-box'),
  newGameBox: $('new-game-box'),
  btnContinue: $('btn-continue'),
  btnNewFromContinue: $('btn-new-from-continue'),
  inputName: $('input-name'),
  styleChoice: $('style-choice'),
  btnStart: $('btn-start'),

  hdrName: $('hdr-name'),
  hdrAge: $('hdr-age'),
  hdrLicense: $('hdr-license'),
  hdrYear: $('hdr-year'),
  hdrWeek: $('hdr-week'),
  headerStats: $('header-stats'),

  injuryBanner: $('injury-banner'),
  offersList: $('offers-list'),
  btnSkipWeek: $('btn-skip-week'),
  seasonStats: $('season-stats'),
  logList: $('log-list'),
  btnRetire: $('btn-retire'),

  modalRace: $('modal-race'),
  racePre: $('race-pre'),
  raceTitle: $('race-title'),
  raceSub: $('race-sub'),
  raceHorseCard: $('race-horse-card'),
  btnRaceGo: $('btn-race-go'),
  raceChoice: $('race-choice'),
  raceChoiceDesc: $('race-choice-desc'),
  btnChoiceA: $('btn-choice-a'),
  btnChoiceB: $('btn-choice-b'),
  btnChoiceC: $('btn-choice-c'),
  btnChoiceD: $('btn-choice-d'),
  raceResult: $('race-result'),
  resultHeadline: $('result-headline'),
  resultNarrative: $('result-narrative'),
  resultBoard: $('result-board'),
  btnRaceClose: $('btn-race-close'),

  modalEvent: $('modal-event'),
  eventTitle: $('event-title'),
  eventText: $('event-text'),
  eventChoices: $('event-choices'),

  modalSeason: $('modal-season'),
  seasonTitle: $('season-title'),
  seasonSummary: $('season-summary'),
  btnSeasonNext: $('btn-season-next'),

  modalRetireConfirm: $('modal-retire-confirm'),
  retireConfirmText: $('retire-confirm-text'),
  btnRetireCancel: $('btn-retire-cancel'),
  btnRetireConfirm: $('btn-retire-confirm'),

  endingTitle: $('ending-title'),
  endingCareerSummary: $('ending-career-summary'),
  endingCareerChoice: $('ending-career-choice'),
  careerChoice: $('career-choice'),
  endingFinal: $('ending-final'),
  endingText: $('ending-text'),
  btnRestart: $('btn-restart'),
};

let selectedStyle = 'technique';
let pendingOffer = null;
let pendingResult = null;
let forcedRetireReason = null;

/* =========================================================================
 * 描画
 * ========================================================================= */

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
}

function statBarHtml(label, value, cls) {
  return `<div class="stat-item">${label} ${Math.round(value)}
    <div class="stat-bar-bg"><div class="stat-bar-fill ${cls || ''}" style="width:${clamp(value, 0, 100)}%"></div></div>
  </div>`;
}

function renderHeader() {
  const j = state.jockey;
  el.hdrName.textContent = j.name;
  el.hdrAge.textContent = `満${j.age}歳`;
  el.hdrLicense.textContent = j.license;
  el.hdrYear.textContent = `${state.year}年目`;
  el.hdrWeek.textContent = `第${state.week}週 / ${WEEKS_PER_SEASON}`;

  el.headerStats.innerHTML =
    statBarHtml('技術', j.stats.technique) +
    statBarHtml('体重管理', j.stats.weight) +
    statBarHtml('スタミナ', j.stats.stamina) +
    statBarHtml('人脈', j.stats.connections) +
    statBarHtml('疲労', j.fatigue, 'fatigue') +
    `<div class="stat-item">調子: <b style="color:var(--text)">${j.condition}</b></div>`;
}

function renderOffers() {
  if (state.jockey.injuryWeeks > 0) {
    el.injuryBanner.classList.remove('hidden');
    el.injuryBanner.textContent = `負傷療養中(あと${state.jockey.injuryWeeks}週)。今週は騎乗できません。`;
    el.offersList.innerHTML = '';
    el.btnSkipWeek.textContent = '療養を続ける(週を進める)';
    return;
  }
  el.injuryBanner.classList.add('hidden');
  el.btnSkipWeek.textContent = '今週は騎乗を見送る';

  if (state.offers.length === 0) {
    el.offersList.innerHTML = '<p style="color:var(--text-dim);font-size:13px;">今週はオファーがありませんでした。</p>';
    return;
  }

  el.offersList.innerHTML = state.offers.map(offer => {
    const compat = compatLabel(compatibilityScore(state.jockey, offer.horse));
    const cat = BLOODLINE_LABEL[offer.horse.bloodline];
    return `<div class="offer-card">
      <div class="offer-head">
        <span class="offer-race-name">${offer.race.name}<span class="grade-badge grade-${offer.race.grade}">${offer.race.grade}</span></span>
      </div>
      <div class="offer-meta">${offer.race.distance}m ${offer.race.surface} ・ 1着賞金 ${fmtMan(offer.race.prize)}</div>
      <div class="offer-horse">
        <span><b>${offer.horse.name}</b><span class="horse-tag">${cat}</span><span class="horse-tag">${offer.horse.legStyle}</span><span class="horse-tag">${offer.horse.form}</span></span>
      </div>
      <div class="offer-foot">
        <span class="compat ${compat.cls}">${compat.label}</span>
        <button class="btn btn-primary" data-offer="${offer.id}">この馬に乗る</button>
      </div>
    </div>`;
  }).join('');

  el.offersList.querySelectorAll('button[data-offer]').forEach(btn => {
    btn.addEventListener('click', () => openRaceModal(btn.getAttribute('data-offer')));
  });
}

function renderSeasonStats() {
  const s = state.seasonRecord;
  const j = state.jockey;
  el.seasonStats.innerHTML = `
    騎乗数: <b>${s.mounts}</b>戦 <b>${s.wins}</b>勝(うちGI <b>${s.g1Wins}</b>勝)<br>
    シーズン獲得賞金: <b>${fmtMan(s.earnings)}</b><br>
    通算: <b>${j.career.mounts}</b>戦 <b>${j.career.wins}</b>勝(GI <b>${j.career.g1Wins}</b>勝) / 通算賞金 <b>${fmtMan(j.career.earnings)}</b>
  `;
}

function renderLog() {
  el.logList.innerHTML = state.log.slice(0, 20).map(e => `<li class="${e.cls}">${e.text}</li>`).join('');
}

function renderGame() {
  recalcCondition();
  renderHeader();
  renderOffers();
  renderSeasonStats();
  renderLog();
  el.btnRetire.disabled = state.jockey.age < 28;
  save();
}

/* =========================================================================
 * レースモーダル制御
 * ========================================================================= */

function openRaceModal(offerId) {
  pendingOffer = state.offers.find(o => o.id === offerId);
  if (!pendingOffer) return;
  el.raceTitle.textContent = pendingOffer.race.name;
  el.raceSub.textContent = `${pendingOffer.race.distance}m ${pendingOffer.race.surface} ・ ${pendingOffer.race.grade}`;
  const h = pendingOffer.horse;
  el.raceHorseCard.innerHTML = `
    <div class="hc-row"><span>騎乗馬</span><b>${h.name}</b></div>
    <div class="hc-row"><span>血統タイプ</span><b>${BLOODLINE_LABEL[h.bloodline]}</b></div>
    <div class="hc-row"><span>脚質</span><b>${h.legStyle}</b></div>
    <div class="hc-row"><span>調子</span><b>${h.form}</b></div>
  `;
  el.racePre.classList.remove('hidden');
  el.raceChoice.classList.add('hidden');
  el.raceResult.classList.add('hidden');
  el.modalRace.classList.remove('hidden');
}

function openTacticChoice() {
  el.racePre.classList.add('hidden');
  el.raceChoice.classList.remove('hidden');
  el.raceChoiceDesc.textContent = '仕掛けどころを選んでください。';
  el.btnChoiceA.innerHTML = `<b>${TACTICS.front.label}</b><br><small>${TACTICS.front.desc}</small>`;
  el.btnChoiceB.innerHTML = `<b>${TACTICS.stalk.label}</b><br><small>${TACTICS.stalk.desc}</small>`;
  el.btnChoiceC.innerHTML = `<b>${TACTICS.inside.label}</b><br><small>${TACTICS.inside.desc}</small>`;
  el.btnChoiceD.innerHTML = `<b>${TACTICS.outside.label}</b><br><small>${TACTICS.outside.desc}</small>`;
}

function chooseTactic(tacticKey) {
  const result = simulateRace(pendingOffer, tacticKey);
  pendingResult = result;
  applyRaceResult(pendingOffer, result);

  const { headline, body } = raceNarrative(pendingOffer, result);
  el.resultHeadline.textContent = headline;
  el.resultNarrative.textContent = body;

  const top5 = result.all.slice(0, 5);
  let boardHtml = top5.map((e, i) => `<div class="result-row ${e.isPlayer ? 'me' : ''}">${i + 1}着 ${e.horseName}(${e.name})</div>`).join('');
  if (result.place > 5) {
    boardHtml += `<div class="result-row me">${result.place}着 ${pendingOffer.horse.name}(${state.jockey.name})</div>`;
  }
  el.resultBoard.innerHTML = boardHtml;

  el.raceChoice.classList.add('hidden');
  el.raceResult.classList.remove('hidden');
}

function closeRaceModal() {
  el.modalRace.classList.add('hidden');
  pendingOffer = null;
  pendingResult = null;
  triggerEventOrProceed(advanceWeek);
}

/* =========================================================================
 * 週送り・シーズン制御
 * ========================================================================= */

function advanceWeek() {
  const j = state.jockey;
  if (j.injuryWeeks > 0) {
    j.injuryWeeks--;
  }
  state.week++;
  if (state.week > WEEKS_PER_SEASON) {
    openSeasonSummary();
  } else {
    generateWeekOffers();
    renderGame();
  }
}

function openSeasonSummary() {
  const rank = estimateLeadingRank();
  const s = state.seasonRecord;
  el.seasonTitle.textContent = `${state.year}年目 シーズン終了`;
  el.seasonSummary.innerHTML = `
    <span class="headline">リーディング ${rank}位相当</span>
    騎乗数 <b>${s.mounts}</b>戦 / 勝利数 <b>${s.wins}</b>勝(GI <b>${s.g1Wins}</b>勝)<br>
    シーズン獲得賞金 <b>${fmtMan(s.earnings)}</b><br>
    通算成績: <b>${state.jockey.career.mounts}</b>戦 <b>${state.jockey.career.wins}</b>勝 / GI通算 <b>${state.jockey.career.g1Wins}</b>勝
  `;
  state.jockey.career.seasons.push({ year: state.year, rank, ...s });
  el.modalSeason.classList.remove('hidden');
}

function closeSeasonSummary() {
  el.modalSeason.classList.add('hidden');
  ageJockey();
  state.seasonRecord = { mounts: 0, wins: 0, g1Wins: 0, earnings: 0 };

  forcedRetireReason = forcedRetirementCheck();
  if (forcedRetireReason) {
    startEnding(forcedRetireReason);
    return;
  }

  state.year++;
  state.week = 1;
  generateWeekOffers();
  renderGame();
}

/* =========================================================================
 * 引退・エンディング
 * ========================================================================= */

function openRetireConfirm() {
  el.retireConfirmText.textContent = `${state.jockey.name}(${state.jockey.age}歳)は現役を退きます。通算${state.jockey.career.wins}勝(GI${state.jockey.career.g1Wins}勝)。よろしいですか?`;
  el.modalRetireConfirm.classList.remove('hidden');
}

function startEnding(forcedReason) {
  el.modalRetireConfirm.classList.add('hidden');
  const j = state.jockey;
  let title;
  if (j.career.g1Wins >= 10) title = '伝説の騎手、引退。';
  else if (j.career.g1Wins >= 5) title = '名手、現役を退く。';
  else if (j.career.g1Wins >= 1) title = '重賞ジョッキー、ラストラン。';
  else if (j.career.wins >= 20) title = '堅実な職人、鞍を置く。';
  else title = '一人の騎手、静かに引退。';

  el.endingTitle.textContent = forcedReason ? `${forcedReason} - ${title}` : title;
  el.endingCareerSummary.innerHTML = `
    現役年数 <b>${state.year}</b>年 / 最終年齢 <b>${j.age}</b>歳<br>
    通算騎乗 <b>${j.career.mounts}</b>戦 <b>${j.career.wins}</b>勝(GI <b>${j.career.g1Wins}</b>勝)<br>
    通算獲得賞金 <b>${fmtMan(j.career.earnings)}</b>
  `;
  el.endingCareerChoice.classList.remove('hidden');
  el.endingFinal.classList.add('hidden');
  showScreen('screen-ending');
  clearSave();
}

const CAREER_ENDINGS = {
  trainer: (j) => `引退後は調教師免許を取得し、厩舎を構えた。技術${j.stats.technique}の眼力で若駒を見出し、かつての自分のような騎手を育てることに情熱を注いでいる。`,
  commentator: (j) => `培った人脈を活かし、テレビの競馬解説者に転身した。GI${j.career.g1Wins}勝の実績を語る言葉には説得力があり、今も競馬場に顔を出しては後輩たちに声をかけている。`,
  breeder: (j) => `故郷に小さな牧場を構え、生産者としての第二の人生を歩み始めた。通算${j.career.wins}勝の経験を糧に、いつか自分の牧場から重賞馬を送り出す日を夢見ている。`,
  retire: (j) => `派手な第二のキャリアは選ばず、家族とともに静かな余生を送ることにした。通算${j.career.mounts}戦の記憶は、時折思い出しては笑う昔話になった。`,
};

function finalizeEnding(careerKey) {
  const j = state.jockey;
  el.endingCareerChoice.classList.add('hidden');
  el.endingText.textContent = CAREER_ENDINGS[careerKey](j);
  el.endingFinal.classList.remove('hidden');
}

/* =========================================================================
 * イベント初期化
 * ========================================================================= */

function initStartScreen() {
  const hasSave = !!loadSave();
  if (hasSave) {
    el.continueBox.classList.remove('hidden');
  } else {
    el.continueBox.classList.add('hidden');
  }

  el.styleChoice.querySelectorAll('.style-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      el.styleChoice.querySelectorAll('.style-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedStyle = btn.getAttribute('data-style');
    });
  });
  el.styleChoice.querySelector('.style-btn').classList.add('selected');

  el.btnContinue.addEventListener('click', () => {
    state = loadSave();
    if (!state) return;
    showScreen('screen-game');
    renderGame();
  });

  el.btnNewFromContinue.addEventListener('click', () => {
    clearSave();
    el.continueBox.classList.add('hidden');
  });

  el.btnStart.addEventListener('click', () => {
    const name = el.inputName.value.trim() || '無名の騎手';
    state = newGameState(name, selectedStyle);
    generateWeekOffers();
    showScreen('screen-game');
    renderGame();
  });
}

function initGameScreen() {
  el.btnSkipWeek.addEventListener('click', () => {
    if (state.jockey.injuryWeeks > 0) {
      advanceWeek();
      return;
    }
    applySkipWeek();
    triggerEventOrProceed(advanceWeek);
  });

  el.btnRaceGo.addEventListener('click', openTacticChoice);
  el.btnChoiceA.addEventListener('click', () => chooseTactic('front'));
  el.btnChoiceB.addEventListener('click', () => chooseTactic('stalk'));
  el.btnChoiceC.addEventListener('click', () => chooseTactic('inside'));
  el.btnChoiceD.addEventListener('click', () => chooseTactic('outside'));
  el.btnRaceClose.addEventListener('click', closeRaceModal);

  el.btnSeasonNext.addEventListener('click', closeSeasonSummary);

  el.btnRetire.addEventListener('click', openRetireConfirm);
  el.btnRetireCancel.addEventListener('click', () => el.modalRetireConfirm.classList.add('hidden'));
  el.btnRetireConfirm.addEventListener('click', () => startEnding(null));
}

function initEndingScreen() {
  el.careerChoice.querySelectorAll('.style-btn').forEach(btn => {
    btn.addEventListener('click', () => finalizeEnding(btn.getAttribute('data-career')));
  });
  el.btnRestart.addEventListener('click', () => {
    clearSave();
    location.reload();
  });
}

function init() {
  initStartScreen();
  initGameScreen();
  initEndingScreen();
  showScreen('screen-start');
}

document.addEventListener('DOMContentLoaded', init);
