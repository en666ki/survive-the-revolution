'use strict';

/* ============================================================
   Движок: состояние, рендер, броски судьбы.
   Сценарий и все тексты — в scenario.js (NODES, BACKGROUNDS).
   ============================================================ */

const app = document.getElementById('app');

let S = null; // состояние игрока
let currentNode = null;
let choosing = false;

function newState(bgKey) {
  const bg = BACKGROUNDS[bgKey];
  return {
    bg: bgKey,
    money: bg.money,
    conn: bg.conn,
    red: bg.red,
    susp: bg.susp,
    loc: 'petrograd',
    flags: new Set(bg.flags || []),
    log: [],
    trail: [],
  };
}

// Хелперы, доступные сценарию
const has = f => S.flags.has(f);
const gain = f => S.flags.add(f);
const drop = f => S.flags.delete(f);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const val = (x) => (typeof x === 'function' ? x(S) : x);

function pushLog(t) { if (t) S.log.push(val(t)); }

/* ---------- рендер ---------- */

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function paras(text) {
  const html = text.split(/\n\n+/).map(p => `<p>${p.trim()}</p>`).join('');
  return (typeof annotate === 'function') ? annotate(html) : html;
}

const PLACES = {
  petrograd: 'Петроград',
  moscow: 'Москва',
  south: 'Юг России',
  kiev: 'Киев',
  odessa: 'Одесса',
  crimea: 'Крым',
  village: 'Деревня под Тамбовом',
};

const CHAPTER_TITLES = ['', 'Хлебные хвосты', 'На свободе', 'Лето обещаний', 'Новая власть', 'Первый мир', 'Куда податься', 'По разные стороны', 'Год без пощады', 'Последний берег', 'После войны', 'Остаться в живых'];

function lifeAside(withArt = false) {
  const money = S.money > 1 ? 'Есть сбережения' : S.money > 0 ? 'Денег в обрез' : 'Карманы пусты';
  const conn = S.conn > 0 ? 'Есть к кому обратиться' : 'Рассчитывать на себя';
  return `<aside class="scene-aside">${withArt ? `<div class="scene-art">${RR.illustration('life', true)}</div>` : ''}` +
    `<div class="resource-sheet"><div class="note-title">При себе</div><div class="resource-row"><span>Деньги</span><b>${S.money}</b></div><p>${money}</p>` +
    `<div class="resource-row"><span>Связи</span><b>${S.conn}</b></div><p>${conn}</p></div>` +
    (S.log.length ? RR.details('Записи о прожитом · ' + S.log.length, `<ol class="journey-log">${S.log.map(l => `<li>${l}</li>`).join('')}</ol>`) : '') + `</aside>`;
}

function show(id, resumed = false) {
  const node = NODES[id];
  if (!node) { app.innerHTML = `<div class="card"><p>Сцена «${esc(id)}» не найдена.</p></div>`; return; }
  if (node.redirect) { show(node.redirect(S)); return; }
  if (node.type) { showEnding(node, id); return; }
  if (node.enter && !resumed) node.enter(S);
  currentNode = id; choosing = false;
  if (!S.trail.includes(id)) S.trail.push(id);
  RR.save(1, {screen: 'scene', id, state: S, label: val(node.date) || 'ваша жизнь'});

  const text = val(node.text);
  const meta = [];
  if (node.ch) meta.push(`Глава ${node.ch} из ${TOTAL_CHAPTERS}`);
  if (node.date) meta.push(val(node.date));
  if (node.place || S.loc) meta.push(node.place || PLACES[S.loc]);

  let html = `<div class="card scene">`;
  html += `<header class="scene-header"><div class="meta">${meta.map(esc).join(' · ')}</div>`;
  html += `<h2>${esc(node.title ? val(node.title) : CHAPTER_TITLES[node.ch] || 'Жизнь продолжается')}</h2>`;
  html += `<div class="life-status">${esc(BACKGROUNDS[S.bg].name)}</div></header>`;
  html += `<div class="scene-layout"><div class="scene-main">`;
  if (RR.mastered(1, S.bg, id) && node.choices.some(c => c.roll)) html += `<p class="memory-note">Эта жизнь помнит развилку. При рискованном решении можно выбрать исход.</p>`;
  html += `<div class="body">${paras(text)}</div>`;
  html += `<div class="decision-label">Как поступить?</div><div class="choices">`;

  const choices = node.choices.filter(c => !c.when || c.when(S));
  choices.forEach((c, i) => {
    const locked = c.req && !c.req(S);
    if (locked) {
      html += `<div class="choice locked"><button disabled>${val(c.text)}</button>` +
              `<div class="locked-why">${val(c.locked) || 'Вам это недоступно.'}</div></div>`;
    } else {
      html += `<div class="choice"><button data-i="${i}">${val(c.text)}</button></div>`;
    }
  });
  html += `</div></div>${lifeAside(id === 'ch1')}</div></div>`;
  app.innerHTML = html;
  window.scrollTo(0, 0);
  RR.focusScene(app);

  app.querySelectorAll('button[data-i]').forEach(btn => {
    btn.addEventListener('click', () => pick(choices[+btn.dataset.i]));
  });
}

function pick(choice, outcome) {
  if (choosing) return;
  if (choice.roll && !outcome && RR.mastered(1, S.bg, currentNode)) {
    RR.fate({text: val(choice.text), ...choice.roll, nodes: NODES, onChoose: x => pick(choice, x)});
    return;
  }
  choosing = true;
  RR.lockChoices(app);
  if (choice.roll) {
    // эффекты и лог самого выбора — до броска; ветка добавит свои
    if (choice.fx) choice.fx(S);
    pushLog(choice.log);
    const chance = val(choice.roll.chance);
    if (outcome === 'success' || outcome === 'fail') { applyBranch(choice.roll[outcome]); return; }
    const branch = Math.random() < chance ? choice.roll.fail : choice.roll.success;
    applyBranch(branch, true);
  } else {
    applyBranch(choice); // fx и log применит applyBranch — ровно один раз
  }
}

function applyBranch(br, animate = false) {
  if (br.fx) br.fx(S);
  pushLog(br.log);
  const result = val(br.result);
  const next = () => result ? showResult(result, br.goto) : show(br.goto);
  if (animate) {
    RR.save(1, {screen: result ? 'result' : 'transition', text: result, nextId: br.goto, state: S, label: 'последствия решения'});
    rollDice(next);
  } else next();
}

function showResult(text, nextId) {
  RR.save(1, {screen: 'result', text, nextId, state: S, label: 'последствия решения'});
  const next = NODES[nextId];
  const isEnd = next && next.type;
  app.innerHTML =
    `<div class="card result"><div class="meta">Последствия решения</div><div class="body">${paras(text)}</div>` +
    `<div class="choices"><div class="choice"><button id="go">${isEnd ? 'Что же дальше?' : 'Дальше'}</button></div></div></div>`;
  window.scrollTo(0, 0);
  document.getElementById('go').addEventListener('click', () => show(nextId));
}

/* ---------- бросок судьбы ---------- */

const DIE = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

function rollDice(done) {
  const overlay = document.createElement('div');
  overlay.className = 'roll-overlay';
  overlay.innerHTML = `<div class="roll-box"><div class="die">⚀</div><div class="roll-label">Судьба бросает кости…</div></div>`;
  document.body.appendChild(overlay);
  const die = overlay.querySelector('.die');
  let n = 0;
  const t = setInterval(() => { die.textContent = DIE[n++ % 6]; }, 110);
  setTimeout(() => {
    clearInterval(t);
    overlay.remove();
    done();
  }, 1400);
}

/* ---------- концовки ---------- */

const ENDING_KINDS = {
  death: 'Вы погибли',
  emigration: 'Вы в эмиграции',
  survival: 'Вы выжили',
};

function showEnding(node, id) {
  RR.remember(1, S.bg, S.trail, id, node.type !== 'death');
  RR.clear(1);
  if (node.type !== 'death') {
    try {
      localStorage.setItem('rr_survived', '1');
      localStorage.setItem('rr_survived_' + S.bg, '1');
    } catch (e) { /* приватный режим — не страшно */ }
  }
  const text = val(node.text);
  let html = `<div class="card ending ${node.type}">`;
  html += `<div class="meta">${esc(ENDING_KINDS[node.type])}</div>`;
  html += `<h2>${esc(val(node.title))}</h2>`;
  html += `<div class="body">${paras(text)}</div>`;
  if (node.note) {
    html += RR.details('Историческая справка', paras(val(node.note)));
  }
  if (S.log.length) {
    html += RR.details('Ваш путь · ' + S.log.length + ' записей', `<ol class="journey-log">${S.log.map(l => `<li>${l}</li>`).join('')}</ol>`);
  }
  html += `<div class="choices"><div class="choice"><button id="again">Прожить ещё одну жизнь</button></div>` +
          `<div class="choice"><button id="tomenu">Вернуться в меню</button></div></div>`;
  html += `</div>`;
  app.innerHTML = html;
  window.scrollTo(0, 0);
  document.getElementById('again').addEventListener('click', showIntro);
  document.getElementById('tomenu').addEventListener('click', () => { location.href = 'index.html'; });
}

/* ---------- заставка и выбор персонажа ---------- */

function showIntro() {
  S = null;
  app.innerHTML = `
  <div class="card intro">
    <div class="meta">Интерактивный квест по истории России</div>
    <h1>Переживите обе революции</h1>
    <div class="intro-layout"><div class="intro-copy">
    <div class="body">
      <p>Февраль 1917 года — год 1922-й. Пять лет, за которые страна переменит три власти, две столицы и одну орфографию.</p>
      <p>Кому открыть дверь. На что выменять муку. С кем уехать, когда последнему пароходу уже дают ход. Большие события доберутся до вас через маленькие решения.</p>
      <p>Деньги, знакомства и прошлые поступки открывают разные выходы. Иногда придётся рискнуть. Доживите до конца — и в следующей жизни за этого же персонажа сможете выбирать исход знакомых случайностей.</p>
    </div>
    <div class="choices">${RR.resumeButton(1)}<div class="choice"><button id="play">Начать новую жизнь</button></div></div>
    ${RR.storageNote()}
    </div><aside class="intro-art">${RR.illustration('life')}<p class="art-caption">Петроград. История на уровне улицы.</p></aside></div>
    <div class="path" style="margin-top:28px"><a href="index.html" style="color:inherit">← Меню цикла</a></div>
  </div>`;
  document.getElementById('play').addEventListener('click', showPick);
  const resume = document.getElementById('resume');
  if (resume) resume.addEventListener('click', () => {
    const saved = RR.checkpoint(1);
    if (!saved || !BACKGROUNDS[saved.state.bg] || !NODES[saved.screen === 'scene' ? saved.id : saved.nextId]) return;
    S = saved.state; S.trail = S.trail || [];
    if (saved.screen === 'result') showResult(saved.text, saved.nextId);
    else if (saved.screen === 'transition') show(saved.nextId);
    else show(saved.id, true);
  });
}

function showPick() {
  let html = `<div class="card scene"><div class="meta">Пролог · февраль 1917 · Петроград</div>
  <h2>Кто вы?</h2>
  <div class="body"><p>Зима выдалась лютая, хлебные хвосты стоят с ночи, на заводах глухо ропщут. Империя доживает последние дни — но об этом пока никто не знает. А вы живёте свою жизнь. Какую?</p></div>
  <div class="choices role-picker">`;
  Object.entries(BACKGROUNDS).forEach(([key, bg]) => {
    const m = RR.memory(1, key);
    html += `<div class="choice bg-choice"><button data-bg="${key}"><span class="bg-name">${bg.name}</span><span class="bg-desc">${bg.desc}</span>${m.won ? '<span class="choice-sub">Вы уже выживали этой судьбой</span>' : ''}</button></div>`;
  });
  html += `</div></div>`;
  app.innerHTML = html;
  window.scrollTo(0, 0);
  app.querySelectorAll('button[data-bg]').forEach(btn => {
    btn.addEventListener('click', () => {
      S = newState(btn.dataset.bg);
      pushLog(BACKGROUNDS[btn.dataset.bg].logStart);
      show('ch1');
    });
  });
}

/* ---------- валидация графа (в консоль) ---------- */

function validate() {
  const missing = [];
  const seen = new Set();
  const check = (id, from) => {
    if (id && !NODES[id]) missing.push(`${from} → «${id}»`);
    else if (id) seen.add(id);
  };
  for (const [id, node] of Object.entries(NODES)) {
    if (node.routes) Object.values(node.routes).forEach(t => check(t, id));
    (node.choices || []).forEach(c => {
      check(c.goto, id);
      if (c.roll) { check(c.roll.success.goto, id); check(c.roll.fail.goto, id); }
    });
  }
  if (missing.length) console.warn('Битые переходы:', missing);
  else console.log(`Граф в порядке: ${Object.keys(NODES).length} сцен.`);
}

validate();
if (typeof initGloss === 'function') initGloss();
showIntro();
