'use strict';

/* ============================================================
   Движок v2: персонаж-личность, влияние как ресурс,
   переломные моменты (⚖) с открытыми шансами,
   мировое состояние и эпилог «Ваша Россия, 1922».
   ============================================================ */

const app = document.getElementById('app');

let S = null; // {camp, vl, fame, flags, log}
let W = null; // состояние мира

function newState(campKey) {
  const c = CAMPAIGNS[campKey];
  return { camp: campKey, vl: c.vl, fame: c.fame, flags: new Set(), log: [] };
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
function paras(t) { return t.split(/\n\n+/).map(p => `<p>${p.trim()}</p>`).join(''); }

const VL_WORDS = ['ничтожное', 'ничтожное', 'скромное', 'скромное', 'заметное', 'заметное', 'весомое', 'весомое', 'огромное', 'огромное', 'огромное'];
const FAME_WORDS = ['в тени', 'в узких кругах', 'на слуху', 'на первых полосах'];

function statsHtml(node) {
  const bits = [];
  bits.push(`Влияние: <b>${VL_WORDS[S.vl]} (${S.vl})</b>`);
  bits.push(`Известность: <b>${FAME_WORDS[S.fame]}</b>`);
  return `<div class="stats">${bits.join('<span>·</span>')}</div>`;
}

function show(id) {
  const node = NODES2[id];
  if (!node) { app.innerHTML = `<div class="card"><p>Сцена «${esc(id)}» не найдена.</p></div>`; return; }
  if (node.redirect) { show(node.redirect(S, W)); return; }
  if (node.type) { showEnding(node); return; }
  if (node.enter) node.enter(S, W);

  const text = val(node.text);
  const meta = [];
  if (node.date) meta.push(val(node.date));
  if (node.place) meta.push(val(node.place));

  let html = `<div class="card scene">`;
  html += `<div class="meta">${meta.map(esc).join(' · ')}</div>`;
  html += statsHtml(node);
  if (node.title) html += `<h2>${esc(val(node.title))}</h2>`;
  html += `<div class="body">${paras(text)}</div>`;
  html += `<div class="choices">`;

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
    const bifMeta = c.bif
      ? `<div class="bif-meta">⚖ Переломный момент · шанс ~${Math.round(val(c.bif.chance) * 100)}%` +
        (i === emergencyIdx && S.vl < cost ? ' · цена: всё оставшееся влияние' : (cost ? ` · цена: ${cost} влияния` : '')) + `</div>`
      : '';
    if (locked) {
      const why = poor ? `Не хватает влияния (нужно ${cost}). Историю не переспоришь с пустыми руками.` : (val(c.locked) || 'Вам это недоступно.');
      html += `<div class="choice locked ${c.bif ? 'bif' : ''}"><button disabled>${val(c.text)}</button>${bifMeta}` +
              `<div class="locked-why">${why}</div></div>`;
    } else {
      html += `<div class="choice ${c.bif ? 'bif' : ''}"><button data-i="${i}">${val(c.text)}</button>${bifMeta}</div>`;
    }
  });
  html += `</div></div>`;
  app.innerHTML = html;
  window.scrollTo(0, 0);

  app.querySelectorAll('button[data-i]').forEach(btn => {
    btn.addEventListener('click', () => pick(choices[+btn.dataset.i]));
  });
}

function pick(choice) {
  if (choice.bif || choice.roll) {
    if (choice.fx) choice.fx(S, W);
    pushLog(choice.log);
  }
  if (choice.bif) {
    // переломный момент: chance = шанс УСПЕХА против инерции истории
    S.vl = clamp(S.vl - (choice.bif.cost || 0), 0, 10);
    const chance = val(choice.bif.chance);
    rollDice(() => {
      const branch = Math.random() < chance ? choice.bif.success : choice.bif.fail;
      applyBranch(branch);
    }, 'История сопротивляется…');
  } else if (choice.roll) {
    // обычный бросок: chance = шанс беды
    const chance = val(choice.roll.chance);
    rollDice(() => {
      const branch = Math.random() < chance ? choice.roll.fail : choice.roll.success;
      applyBranch(branch);
    }, 'Судьба бросает кости…');
  } else {
    applyBranch(choice);
  }
}

function applyBranch(br) {
  if (br.fx) br.fx(S, W);
  pushLog(br.log);
  const result = val(br.result);
  if (result) showResult(result, br.goto);
  else show(br.goto);
}

function showResult(text, nextId) {
  const next = NODES2[nextId];
  const isEnd = next && next.type;
  app.innerHTML =
    `<div class="card result"><div class="body">${paras(text)}</div>` +
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

function showEnding(node) {
  const text = val(node.text);
  const ep = worldEpilogue(W);
  let html = `<div class="card ending ${node.type}">`;
  html += `<div class="meta">${esc(ENDING_KINDS[node.type])}</div>`;
  html += `<h2>${esc(val(node.title))}</h2>`;
  html += `<div class="body">${paras(text)}</div>`;
  html += `<div class="world"><div class="note-title">Ваша Россия, 1922</div>${paras(ep.text)}</div>`;
  html += `<div class="world"><div class="note-title">Итоги Великой войны</div>${paras(warSummary(W))}</div>`;
  if (ep.real) {
    html += `<div class="realhist"><div class="note-title">Как было на самом деле</div>${paras(ep.real)}</div>`;
  }
  if (node.note) {
    html += `<div class="note"><div class="note-title">Историческая справка</div>${paras(val(node.note))}</div>`;
  }
  if (S.log.length) {
    html += `<div class="path"><div class="note-title">Ваш путь</div><ul>` +
            S.log.map(l => `<li>${l}</li>`).join('') + `</ul></div>`;
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
    <div class="body">
      <p>В первой игре вы выживали. Теперь вы — один из тех, кто решает.</p>
      <p>Реальная история — это рельсы: события катятся по ним сами. Свернуть можно только в переломные моменты, отмеченные знаком ⚖. Игра честно показывает шанс успеха и цену попытки — влияние, которое копится в обычных решениях и тратится в судьбоносных.</p>
      <p>История сопротивляется. Но иногда — поддаётся.</p>
      <p>В конце вы увидите, какой стала ваша Россия к 1922 году — и как всё было на самом деле.</p>
    </div>
    <div class="choices"><div class="choice"><button id="play">Играть</button></div></div>
    <div class="path" style="margin-top:28px"><a href="index.html" style="color:inherit">← Меню цикла</a></div>
  </div>`;
  document.getElementById('play').addEventListener('click', showPick);
}

function showPick() {
  let html = `<div class="card scene"><div class="meta">Пролог · выбор роли</div>
  <h2>Кем вы вошли в историю?</h2>
  <div class="body"><p>Пять человек, пять точек приложения силы. У каждого — своё окно возможностей и своя цена ошибки.</p></div>
  <div class="choices">`;
  Object.entries(CAMPAIGNS).forEach(([key, c]) => {
    html += `<div class="choice bg-choice"><button data-c="${key}">` +
            `<span class="who-name">${c.name}</span>` +
            `<span class="who-sub">${c.sub}</span>` +
            `<span class="who-desc">${c.desc}</span></button></div>`;
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
showIntro();
