'use strict';

/* ============================================================
   Движок v2: персонаж-личность, влияние как ресурс,
   переломные моменты (⚖) с открытыми шансами,
   мировое состояние и эпилог «Ваша Россия, 1922».
   ============================================================ */

const app = document.getElementById('app');

let S = null; // {camp, vl, fame, flags, log}
let W = null; // состояние мира
let currentNode = null;
let choosing = false;

function newState(campKey) {
  const c = CAMPAIGNS[campKey];
  return { camp: campKey, vl: c.vl, fame: c.fame, flags: new Set(), log: [], trail: [], dispatches: [], commitments: {} };
}

const has = f => S.flags.has(f);
const gain = f => S.flags.add(f);
const drop = f => S.flags.delete(f);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const val = x => (typeof x === 'function' ? x(S) : x);
const vl = n => { S.vl = clamp(S.vl + n, 0, 10); };
function pushLog(t) { if (t) S.log.push(val(t)); }

/* ---------- рендер ---------- */

function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function paras(t) {
  const html = t.split(/\n\n+/).map(p => `<p>${p.trim()}</p>`).join('');
  return (typeof annotate === 'function') ? annotate(html) : html;
}

const VL_WORDS = ['ничтожное', 'ничтожное', 'скромное', 'скромное', 'заметное', 'заметное', 'весомое', 'весомое', 'огромное', 'огромное', 'огромное'];
const FAME_WORDS = ['в тени', 'в узких кругах', 'на слуху', 'на первых полосах'];

function statsHtml(node) {
  return `<div class="resource-sheet"><div class="note-title">${esc(CAMPAIGNS[S.camp].name)}</div>` +
    `<div class="resource-row"><span>Влияние</span><b>${S.vl}<small> / 10</small></b></div>` +
    `<div class="influence-meter" role="meter" aria-label="Влияние" aria-valuemin="0" aria-valuemax="10" aria-valuenow="${S.vl}">${Array.from({length: 10}, (_, i) => `<i class="${i < S.vl ? 'filled' : ''}"></i>`).join('')}</div>` +
    `<p>${VL_WORDS[S.vl]} · тратится в переломные моменты</p><div class="resource-row"><span>Известность</span></div><p>${FAME_WORDS[S.fame]}</p></div>`;
}

function historyAside(node) {
  return `<aside class="scene-aside">${node.art ? `<div class="scene-art">${RR.illustration(node.art, true)}</div>` : ''}${statsHtml(node)}` +
    (S.dispatches.length ? RR.details('Сводка перемен · ' + S.dispatches.length, `<ul class="dispatches">${S.dispatches.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`) : '') +
    (S.log.length ? RR.details('Хроника решений · ' + S.log.length, `<ol class="journey-log">${S.log.map(l => `<li>${l}</li>`).join('')}</ol>`) : '') + `</aside>`;
}

function show(id, resumed = false) {
  const node = NODES2[id];
  if (!node) { app.innerHTML = `<div class="card"><p>Сцена «${esc(id)}» не найдена.</p></div>`; return; }
  if (AFTERMATH_ENTRIES[id]) { S.victoryEnding = id; show(AFTERMATH_ENTRIES[id]); return; }
  if (node.redirect) { show(node.redirect(S, W)); return; }
  if (node.type) { showEnding(node, id); return; }
  if (node.enter && !resumed) node.enter(S, W);
  currentNode = id; choosing = false;
  if (!S.trail.includes(id)) S.trail.push(id);
  RR.save(2, {screen: 'scene', id, state: S, world: W, label: CAMPAIGNS[S.camp].name});

  const text = val(node.text);
  const meta = [];
  if (node.date) meta.push(val(node.date));
  if (node.place) meta.push(val(node.place));

  let html = `<div class="card scene">`;
  html += `<header class="scene-header"><div class="meta">${meta.map(esc).join(' · ')}</div>`;
  if (node.title) html += `<h2>${esc(val(node.title))}</h2>`;
  if (node.alt) html += `<div class="alt-label">Ваша ветвь истории · ${esc(node.alt)}</div>`;
  html += `</header><div class="scene-layout"><div class="scene-main">`;
  html += `<div class="body">${paras(text)}</div>`;
  if (node.stakes) html += `<div class="stakes">${esc(val(node.stakes))}</div>`;
  if (RR.mastered(2, S.camp, id) && node.choices.some(c => c.roll || c.bif)) html += `<p class="memory-note">Знакомая развилка: можно выбрать исход или оставить бросок судьбе.</p>`;
  html += `<div class="decision-label">Ваше решение</div><div class="choices">`;

  const choices = node.choices.filter(c => !c.when || c.when(S, W));
  // аварийный клапан: если ВСЕ варианты заперты (не хватает влияния),
  // самый дешёвый переломный открывается за всё оставшееся — история не должна вставать колом
  const anyOpen = choices.some(c => !((c.req && !c.req(S, W)) || (c.bif && S.vl < (c.bif.cost || 0))));
  let emergencyIdx = -1;
  if (!anyOpen) {
    let best = Infinity;
    choices.forEach((c, i) => {
      if (c.bif && !(c.req && !c.req(S, W)) && (c.bif.cost || 0) < best) { best = c.bif.cost || 0; emergencyIdx = i; }
    });
  }
  choices.forEach((c, i) => {
    const cost = c.bif ? (c.bif.cost || 0) : 0;
    const poor = c.bif && S.vl < cost && i !== emergencyIdx;
    const locked = (c.req && !c.req(S, W)) || poor;
    const influenceDelta = c.fx && typeof c.fx.influence === 'number' ? clamp(S.vl + c.fx.influence, 0, 10) - S.vl : 0;
    const effectHint = influenceDelta ? `<div class="choice-hint">Влияние: ${influenceDelta > 0 ? '+' : '−'}${Math.abs(influenceDelta)}</div>` : '';
    const bifMeta = c.bif
      ? `<div class="bif-meta">⚖ Переломный момент · шанс ~${Math.round(val(c.bif.chance) * 100)}%` +
        (i === emergencyIdx && S.vl < cost ? ' · цена: всё оставшееся влияние' : (cost ? ` · цена: ${cost} влияния` : '')) + `</div>`
      : '';
    if (locked) {
      const why = poor ? `Не хватает влияния (нужно ${cost}). Историю не переспоришь с пустыми руками.` : (val(c.locked) || 'Вам это недоступно.');
      html += `<div class="choice locked ${c.bif ? 'bif' : ''}"><button disabled>${val(c.text)}</button>${bifMeta}` +
              `<div class="locked-why">${why}</div></div>`;
    } else {
      html += `<div class="choice ${c.bif ? 'bif' : ''}"><button data-i="${i}">${val(c.text)}</button>${bifMeta}${effectHint}</div>`;
    }
  });
  html += `</div></div>${historyAside(node)}</div></div>`;
  app.innerHTML = html;
  window.scrollTo(0, 0);
  RR.focusScene(app);

  app.querySelectorAll('button[data-i]').forEach(btn => {
    btn.addEventListener('click', () => pick(choices[+btn.dataset.i]));
  });
}

function pick(choice, outcome) {
  if (choosing) return;
  const random = choice.bif || choice.roll;
  if (random && !outcome && RR.mastered(2, S.camp, currentNode)) {
    RR.fate({text: val(choice.text), ...random, nodes: NODES2, onChoose: x => pick(choice, x)});
    return;
  }
  choosing = true;
  RR.lockChoices(app);
  if (choice.bif || choice.roll) {
    const before = {...W};
    if (choice.fx) choice.fx(S, W);
    recordWorldChanges(before);
    pushLog(choice.log);
  }
  if (choice.bif) {
    // переломный момент: chance = шанс УСПЕХА против инерции истории
    S.vl = clamp(S.vl - (choice.bif.cost || 0), 0, 10);
    const chance = val(choice.bif.chance);
    if (outcome === 'success' || outcome === 'fail') { applyBranch(choice.bif[outcome]); return; }
    const branch = Math.random() < chance ? choice.bif.success : choice.bif.fail;
    applyBranch(branch, 'История сопротивляется…');
  } else if (choice.roll) {
    // обычный бросок: chance = шанс беды
    const chance = val(choice.roll.chance);
    if (outcome === 'success' || outcome === 'fail') { applyBranch(choice.roll[outcome]); return; }
    const branch = Math.random() < chance ? choice.roll.fail : choice.roll.success;
    applyBranch(branch, 'Судьба бросает кости…');
  } else {
    applyBranch(choice);
  }
}

function applyBranch(br, animationLabel) {
  const before = {...W};
  if (br.fx) br.fx(S, W);
  recordWorldChanges(before);
  pushLog(br.log);
  const result = val(br.result);
  const next = () => result ? showResult(result, br.goto) : show(br.goto);
  if (animationLabel) {
    RR.save(2, {screen: result ? 'result' : 'transition', text: result, nextId: br.goto, state: S, world: W, label: CAMPAIGNS[S.camp].name});
    rollDice(next, animationLabel);
  } else next();
}

function showResult(text, nextId) {
  RR.save(2, {screen: 'result', text, nextId, state: S, world: W, label: CAMPAIGNS[S.camp].name});
  const next = NODES2[nextId];
  const isEnd = next && next.type;
  app.innerHTML =
    `<div class="card result"><div class="meta">Последствия решения</div><div class="body">${paras(text)}</div>` +
    `<div class="choices"><div class="choice"><button id="go">${isEnd ? 'Что же дальше?' : 'Дальше'}</button></div></div></div>`;
  window.scrollTo(0, 0);
  document.getElementById('go').addEventListener('click', () => show(nextId));
}

/* ---------- бросок ---------- */

const DIE = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

function rollDice(done, label) {
  const overlay = document.createElement('div');
  overlay.className = 'roll-overlay';
  overlay.innerHTML = `<div class="roll-box"><div class="die">⚀</div><div class="roll-label">${label}</div></div>`;
  document.body.appendChild(overlay);
  const die = overlay.querySelector('.die');
  let n = 0;
  const t = setInterval(() => { die.textContent = DIE[n++ % 6]; }, 110);
  setTimeout(() => { clearInterval(t); overlay.remove(); done(); }, 1400);
}

/* ---------- концовки ---------- */

const ENDING_KINDS = { death: 'Вы погибли', emigration: 'Вы в эмиграции', survival: 'Вы дожили' };

function showEnding(node, id) {
  RR.remember(2, S.camp, S.trail, id, node.type !== 'death');
  RR.clear(2);
  // третья часть открывается тем, кто провёл всех пятерых без гибели
  if (node.type !== 'death') {
    try {
      localStorage.setItem('rr_v2_done', '1');
      localStorage.setItem('rr_v2_alive_' + S.camp, '1');
    } catch (e) { /* приватный режим — не страшно */ }
  }
  const text = val(node.text);
  const ep = worldEpilogue(W);
  let html = `<div class="card ending ${node.type}">`;
  html += `<div class="meta">${esc(ENDING_KINDS[node.type])}</div>`;
  html += `<h2>${esc(val(node.title))}</h2>`;
  html += `<div class="body">${paras(text)}</div>`;
  html += `<div class="world"><div class="note-title">Ваша Россия, 1922</div>${paras(ep.text)}</div>`;
  if (S.dispatches.length) html += RR.details('Ваши решения изменили страну', `<ul class="dispatches">${S.dispatches.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`, true);
  html += RR.details('Итоги Великой войны', paras(warSummary(W)));
  if (ep.real) {
    html += RR.details('Как было на самом деле', paras(ep.real));
  }
  if (node.note) {
    html += RR.details('Историческая справка', paras(val(node.note)));
  }
  if (S.log.length) {
    html += RR.details('Ваш путь · ' + S.log.length + ' записей', `<ol class="journey-log">${S.log.map(l => `<li>${l}</li>`).join('')}</ol>`);
  }
  html += `<div class="choices"><div class="choice"><button id="again">Переиграть историю ещё раз</button></div>` +
          `<div class="choice"><button id="tomenu">Вернуться в меню</button></div></div>`;
  html += `</div>`;
  app.innerHTML = html;
  window.scrollTo(0, 0);
  document.getElementById('again').addEventListener('click', showIntro);
  document.getElementById('tomenu').addEventListener('click', () => { location.href = 'index.html'; });
}

/* ---------- заставка и выбор персонажа ---------- */

function gateOk() {
  try {
    if (new URLSearchParams(location.search).has('skipgate')) return true;
    return localStorage.getItem('rr_survived') === '1';
  } catch (e) { return true; }
}

function showGate() {
  app.innerHTML = `
  <div class="card intro">
    <div class="meta">Часть вторая · вход для выживших</div>
    <h1>Заперто</h1>
    <div class="body">
      <p>К рычагам истории не подпускают с улицы. «Действующие лица» открываются тем, кто хотя бы раз дожил до 1922 года в первой части — любым из четырёх персонажей.</p>
      <p>Сумеете уцелеть между двумя революциями, террором и тифом — возвращайтесь: Ленин, Николай II, Савинков, Корнилов и Махно будут ждать.</p>
    </div>
    <div class="choices">
      <div class="choice"><button id="tomenu">Вернуться в меню</button></div>
    </div>
  </div>`;
  document.getElementById('tomenu').addEventListener('click', () => { location.href = 'index.html'; });
}

function showIntro() {
  S = null; W = null;
  if (!gateOk()) { showGate(); return; }
  app.innerHTML = `
  <div class="card intro">
    <div class="meta">Альтернативная история · 1917–1922</div>
    <h1>Действующие лица</h1>
    <div class="intro-layout"><div class="intro-copy">
    <div class="body">
      <p>Вы выиграли голосование. Взяли столицу. Сохранили корону. У двери уже ждут те, кому вы что-то обещали.</p>
      <p>Пять кампаний о власти и её цене. В переломных моментах ⚖ вы тратите влияние и рискуете. За удавшейся альтернативой следуют собственные задачи: хлеб для коалиции, земля для победителей, суд над своим командиром.</p>
      <p>Дойдите до живой концовки — и при следующем прохождении за этого человека сможете выбирать оба исхода знакомых случайных развилок. Новую историю придётся освоить самому.</p>
    </div>
    <div class="choices">${RR.resumeButton(2)}<div class="choice"><button id="play">Выбрать действующее лицо</button></div></div>
    ${RR.storageNote()}
    </div><aside class="intro-art">${RR.illustration('history')}<p class="art-caption">Одна страна. Пять направлений истории.</p></aside></div>
    <div class="path" style="margin-top:28px"><a href="index.html" style="color:inherit">← Меню цикла</a></div>
  </div>`;
  document.getElementById('play').addEventListener('click', showPick);
  const resume = document.getElementById('resume');
  if (resume) resume.addEventListener('click', () => {
    const saved = RR.checkpoint(2);
    if (!saved || !saved.world || !CAMPAIGNS[saved.state.camp] || !NODES2[saved.screen === 'scene' ? saved.id : saved.nextId]) return;
    S = saved.state; W = saved.world;
    S.trail = S.trail || []; S.dispatches = S.dispatches || []; S.commitments = S.commitments || {};
    if (saved.screen === 'result') showResult(saved.text, saved.nextId);
    else if (saved.screen === 'transition') show(saved.nextId);
    else show(saved.id, true);
  });
}

function showPick() {
  let html = `<div class="card scene"><div class="meta">Пролог · выбор роли</div>
  <h2>Кем вы вошли в историю?</h2>
  <div class="body"><p>Пять человек, пять точек приложения силы. У каждого — своё окно возможностей и своя цена ошибки.</p></div>
  <div class="choices role-picker">`;
  Object.entries(CAMPAIGNS).forEach(([key, c]) => {
    const m = RR.memory(2, key);
    html += `<div class="choice bg-choice"><button data-c="${key}">` +
            `<span class="who-name">${c.name}</span>` +
            `<span class="who-sub">${c.sub}</span>` +
            `<span class="who-desc">${c.desc}</span>` +
            (m.won ? `<span class="choice-sub">${m.legacy ? 'Старое прохождение сохранено · исходные развилки открыты' : 'Живая концовка достигнута · знакомых сцен: ' + m.seen.length}</span>` : '') + `</button></div>`;
  });
  html += `</div></div>`;
  app.innerHTML = html;
  window.scrollTo(0, 0);
  app.querySelectorAll('button[data-c]').forEach(btn => {
    btn.addEventListener('click', () => {
      S = newState(btn.dataset.c);
      W = newWorld();
      pushLog(CAMPAIGNS[btn.dataset.c].logStart);
      show(CAMPAIGNS[btn.dataset.c].start);
    });
  });
}

/* ---------- валидация ---------- */

function validate() {
  const missing = [];
  const check = (id, from) => { if (id && !NODES2[id]) missing.push(`${from} → «${id}»`); };
  for (const [id, node] of Object.entries(NODES2)) {
    if (node.routes) Object.values(node.routes).forEach(t => check(t, id));
    (node.choices || []).forEach(c => {
      check(c.goto, id);
      if (c.roll) { check(c.roll.success.goto, id); check(c.roll.fail.goto, id); }
      if (c.bif) { check(c.bif.success.goto, id); check(c.bif.fail.goto, id); }
    });
  }
  Object.values(CAMPAIGNS).forEach(c => check(c.start, 'CAMPAIGNS'));
  if (missing.length) console.warn('Битые переходы:', missing);
  else console.log(`v2: граф в порядке, ${Object.keys(NODES2).length} сцен, ${Object.keys(CAMPAIGNS).length} кампаний.`);
}

validate();
if (typeof initGloss === 'function') initGloss();
showIntro();
