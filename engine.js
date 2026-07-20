'use strict';

/* ============================================================
   Движок: состояние, рендер, броски судьбы.
   Сценарий и все тексты — в scenario.js (NODES, BACKGROUNDS).
   ============================================================ */

const app = document.getElementById('app');

let S = null; // состояние игрока

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
  return text.split(/\n\n+/).map(p => `<p>${p.trim()}</p>`).join('');
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

function show(id) {
  const node = NODES[id];
  if (!node) { app.innerHTML = `<div class="card"><p>Сцена «${esc(id)}» не найдена.</p></div>`; return; }
  if (node.redirect) { show(node.redirect(S)); return; }
  if (node.type) { showEnding(node); return; }
  if (node.enter) node.enter(S);

  const text = val(node.text);
  const meta = [];
  if (node.ch) meta.push(`Глава ${node.ch} из ${TOTAL_CHAPTERS}`);
  if (node.date) meta.push(val(node.date));
  if (node.place || S.loc) meta.push(node.place || PLACES[S.loc]);

  let html = `<div class="card scene">`;
  html += `<div class="meta">${meta.map(esc).join(' · ')}</div>`;
  if (node.title) html += `<h2>${esc(val(node.title))}</h2>`;
  html += `<div class="body">${paras(text)}</div>`;
  html += `<div class="choices">`;

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
  html += `</div></div>`;
  app.innerHTML = html;
  window.scrollTo(0, 0);

  app.querySelectorAll('button[data-i]').forEach(btn => {
    btn.addEventListener('click', () => pick(choices[+btn.dataset.i]));
  });
}

function pick(choice) {
  if (choice.roll) {
    // эффекты и лог самого выбора — до броска; ветка добавит свои
    if (choice.fx) choice.fx(S);
    pushLog(choice.log);
    const chance = val(choice.roll.chance);
    rollDice(() => {
      const branch = Math.random() < chance ? choice.roll.fail : choice.roll.success;
      applyBranch(branch);
    });
  } else {
    applyBranch(choice); // fx и log применит applyBranch — ровно один раз
  }
}

function applyBranch(br) {
  if (br.fx) br.fx(S);
  pushLog(br.log);
  const result = val(br.result);
  if (result) showResult(result, br.goto);
  else show(br.goto);
}

function showResult(text, nextId) {
  const next = NODES[nextId];
  const isEnd = next && next.type;
  app.innerHTML =
    `<div class="card result"><div class="body">${paras(text)}</div>` +
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

function showEnding(node) {
  const text = val(node.text);
  let html = `<div class="card ending ${node.type}">`;
  html += `<div class="meta">${esc(ENDING_KINDS[node.type])}</div>`;
  html += `<h2>${esc(val(node.title))}</h2>`;
  html += `<div class="body">${paras(text)}</div>`;
  if (node.note) {
    html += `<div class="note"><div class="note-title">Историческая справка</div>${paras(val(node.note))}</div>`;
  }
  if (S.log.length) {
    html += `<div class="path"><div class="note-title">Ваш путь</div><ul>` +
            S.log.map(l => `<li>${l}</li>`).join('') + `</ul></div>`;
  }
  html += `<div class="choices"><div class="choice"><button id="again">Прожить ещё одну жизнь</button></div></div>`;
  html += `</div>`;
  app.innerHTML = html;
  window.scrollTo(0, 0);
  document.getElementById('again').addEventListener('click', showIntro);
}

/* ---------- заставка и выбор персонажа ---------- */

function showIntro() {
  S = null;
  app.innerHTML = `
  <div class="card intro">
    <div class="meta">Интерактивный квест по истории России</div>
    <h1>Переживите обе революции</h1>
    <div class="body">
      <p>Февраль 1917 года — год 1922-й. Пять лет, за которые страна переменит три власти, две столицы и одну орфографию.</p>
      <p>Вам предлагается набор ситуаций, в каждой из которых можно сделать выбор. От выбора зависит ваша дальнейшая судьба — но не только от него: у судьбы есть свои кости, и она охотно их бросает.</p>
      <p>Прошлое имеет значение. Кем вы были до революции — определяет, что вам позволено после неё. С деньгами и связями можно уехать; без них придётся выживать на месте.</p>
      <p>Делайте что должно, и будь что будет. Это революция!</p>
    </div>
    <div class="choices"><div class="choice"><button id="play">Играть</button></div></div>
    <div class="path" style="margin-top:28px"><a href="v2.html" style="color:inherit">Вторая часть: «Действующие лица» — сыграйте за Ленина, Николая II, Савинкова, Корнилова или Махно и сверните историю с рельсов →</a></div>
  </div>`;
  document.getElementById('play').addEventListener('click', showPick);
}

function showPick() {
  let html = `<div class="card scene"><div class="meta">Пролог · февраль 1917 · Петроград</div>
  <h2>Кто вы?</h2>
  <div class="body"><p>Зима выдалась лютая, хлебные хвосты стоят с ночи, на заводах глухо ропщут. Империя доживает последние дни — но об этом пока никто не знает. А вы живёте свою жизнь. Какую?</p></div>
  <div class="choices">`;
  Object.entries(BACKGROUNDS).forEach(([key, bg]) => {
    html += `<div class="choice bg-choice"><button data-bg="${key}"><span class="bg-name">${bg.name}</span><span class="bg-desc">${bg.desc}</span></button></div>`;
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
showIntro();
