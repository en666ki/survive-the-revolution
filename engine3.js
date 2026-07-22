'use strict';

/* ============================================================
   Движок v3 «Особая папка»: дела вместо развилок,
   карточка подследственного, три счётчика и один приговор — вам.
   ============================================================ */

const app3 = document.getElementById('app');

function newChekState() {
  return { plan: 0, exp: 0, exc: 0, susp: 0, ins: 0, flags: new Set(), log: [], fates: [] };
}

function esc3(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function paras3(t) {
  const html = String(t).split(/\n\n+/).map(p => `<p>${p.trim()}</p>`).join('');
  return (typeof annotate === 'function') ? annotate(html) : html;
}

/* ---------- статусная строка ---------- */

function chStats() {
  const s = CH.S;
  const pace = s.plan - s.exp;
  const bits = [
    `План: <b>${CHEK_WORDS.pace(pace)}</b>`,
    `Нарушения: <b>${CHEK_WORDS.exc(s.exc)}</b>`,
    `Ваше личное дело: <b>${CHEK_WORDS.susp(s.susp)}</b>`,
  ];
  if (s.ins > 0) bits.push(`Папка: <b>${s.ins} док.</b>`);
  return `<div class="stats">${bits.join('<span>·</span>')}</div>`;
}

/* ---------- карточка дела ---------- */

// в карточке дела жаргона больше, чем в прозе, — сноски нужны и здесь
function gloss3(s) {
  const e = esc3(s);
  return (typeof annotate === 'function') ? annotate(e) : e;
}

function fileHtml(f) {
  const rows = [];
  const add = (k, v) => { if (v) rows.push(`<div class="f-row"><span class="f-key">${esc3(k)}</span><span class="f-val">${gloss3(chVal(v))}</span></div>`); };
  add('Фамилия, имя, отчество', f.name);
  add('Год и место рождения', f.born);
  add('Социальное происхождение', f.origin);
  add('Занятие ко дню ареста', f.job);
  add('Источник материала', f.source);
  add('Квалификация (предварительно)', f.article);
  // «№ 4711» → «Следственное дело № 4711»; «справка на тройку № 1147» — как есть
  const no = f.no || '№ —';
  const head = /^№/.test(no) ? 'Следственное дело ' + no : no;
  let html = `<div class="dossier"><div class="d-head">${esc3(head)}</div>${rows.join('')}`;
  if (f.evidence && f.evidence.length) {
    html += `<div class="f-row f-block"><span class="f-key">В деле имеется</span><span class="f-val"><ul>` +
      f.evidence.map(e => `<li>${gloss3(chVal(e))}</li>`).join('') + `</ul></span></div>`;
  }
  html += `</div>`;
  return html;
}

/* ---------- рендер узла ---------- */

const MARKS = { shoot: 'm-shoot', camp: 'm-camp', free: 'm-free', fab: 'm-fab' };

function show3(id) {
  const node = NODES3[id];
  if (!node) { app3.innerHTML = `<div class="card"><p>Сцена «${esc3(id)}» не найдена.</p></div>`; return; }
  if (node.check) { const to = node.check(CH.S); if (to) { show3(to); return; } }
  if (node.redirect) { show3(node.redirect(CH.S)); return; }
  if (node.type) { showChekEnding(node); return; }
  if (node.enter) node.enter(CH.S);
  if (node.quota) CH.S.exp += node.quota;

  const meta = [];
  if (node.date) meta.push(chVal(node.date));
  if (node.place) meta.push(chVal(node.place));

  let html = `<div class="card scene${node.file ? ' case' : ''}">`;
  html += `<div class="meta">${meta.map(esc3).join(' · ')}</div>`;
  html += chStats();
  if (node.title) html += `<h2>${esc3(chVal(node.title))}</h2>`;
  if (node.file) html += fileHtml(node.file);
  html += `<div class="body">${paras3(chVal(node.text))}</div>`;
  if (node.ask) html += `<div class="ask">${esc3(chVal(node.ask))}</div>`;
  html += `<div class="choices">`;

  const choices = (node.choices || []).filter(c => !c.when || c.when(CH.S));
  choices.forEach((c, i) => {
    const locked = c.req && !c.req(CH.S);
    const mark = c.mark ? ` ${MARKS[c.mark]}` : '';
    if (locked) {
      html += `<div class="choice locked${mark}"><button disabled>${chVal(c.text)}</button>` +
              `<div class="locked-why">${chVal(c.locked) || 'Вам это недоступно.'}</div></div>`;
    } else {
      html += `<div class="choice${mark}"><button data-i="${i}">${chVal(c.text)}</button>` +
              (c.hint ? `<div class="choice-hint">${chVal(c.hint)}</div>` : '') + `</div>`;
    }
  });
  html += `</div></div>`;
  app3.innerHTML = html;
  window.scrollTo(0, 0);
  app3.querySelectorAll('button[data-i]').forEach(btn => {
    btn.addEventListener('click', () => pick3(choices[+btn.dataset.i]));
  });
}

function pick3(c) {
  if (c.fx) c.fx(CH.S);
  if (c.log) CH.S.log.push(chVal(c.log));
  if (c.fate) CH.S.fates.push(chVal(c.fate));
  const result = chVal(c.result);
  if (result) showResult3(result, c.note, c.goto);
  else show3(c.goto);
}

function showResult3(text, note, nextId) {
  const next = NODES3[nextId];
  const isEnd = next && next.type;
  let html = `<div class="card result"><div class="body">${paras3(text)}</div>`;
  if (note) html += `<div class="note"><div class="note-title">Историческая справка</div>${paras3(chVal(note))}</div>`;
  html += `<div class="choices"><div class="choice"><button id="go">${isEnd ? 'Что же дальше?' : 'Дальше'}</button></div></div></div>`;
  app3.innerHTML = html;
  window.scrollTo(0, 0);
  document.getElementById('go').addEventListener('click', () => show3(nextId));
}

/* ---------- концовка ---------- */

const CHEK_KINDS = { death: 'Дело окончено', survival: 'Вы уцелели' };

function showChekEnding(node) {
  const s = CH.S;
  let html = `<div class="card ending ${node.type}">`;
  html += `<div class="meta">${esc3(CHEK_KINDS[node.type])}</div>`;
  html += `<h2>${esc3(chVal(node.title))}</h2>`;
  html += `<div class="body">${paras3(chVal(node.text))}</div>`;
  html += `<div class="world"><div class="note-title">Ваш итог по управлению</div>` +
    paras3(chekSummary(s, node.type === 'survival')) + `</div>`;
  if (node.note) html += `<div class="realhist"><div class="note-title">Как было на самом деле</div>${paras3(chVal(node.note))}</div>`;
  if (s.fates.length) {
    html += `<div class="path"><div class="note-title">Прошли через ваши руки</div><ul>` +
      s.fates.map(f => `<li>${f}</li>`).join('') + `</ul></div>`;
  }
  if (s.log.length) {
    html += `<div class="path"><div class="note-title">Ваш путь</div><ul>` +
      s.log.map(l => `<li>${l}</li>`).join('') + `</ul></div>`;
  }
  html += `<div class="choices"><div class="choice"><button id="again">Начать службу заново</button></div>` +
          `<div class="choice"><button id="tomenu">Вернуться в меню</button></div></div></div>`;
  app3.innerHTML = html;
  window.scrollTo(0, 0);
  try { localStorage.setItem('rr_v3_done', '1'); } catch (e) {}
  document.getElementById('again').addEventListener('click', showChekIntro);
  document.getElementById('tomenu').addEventListener('click', () => { location.href = 'index.html'; });
}

function chekSummary(s, alive) {
  const pace = s.plan - s.exp;
  const out = [];
  // счёт идёт на сотни: 19 сцен — это те дела, что вы помните поимённо,
  // а не весь поток, прошедший через участок за два года
  const n = s.fates.length;
  let t = 'За два года через ваш стол прошли сотни дел: справки на тройку, альбомные справки, протоколы, подшивки. ' +
    (n ? (n === 1 ? 'Одно' : n) + ' из них вы будете помнить поимённо. ' : '');
  if (pace >= 8) t += 'По «выходу» вы шли в передовиках управления: реализация стабильно превышала ожидаемую, и это отмечалось на оперативных совещаниях.';
  else if (pace >= 2) t += 'По «выходу» вы держались чуть выше нормы — достаточно, чтобы вас не трогали, и недостаточно, чтобы ставить в пример.';
  else if (pace >= -3) t += 'По «выходу» вы держались ровно посередине: не в передовиках, но и не в отстающих. В тридцать восьмом это было самое безопасное место в стране.';
  else t += 'По «выходу» вы были ниже, чем любой в отделе, и это заметили раньше, чем вы думали.';
  out.push(t);

  let e = '';
  if (s.exc <= 2) e = 'Дел, слепленных лично вами из воздуха, за вами не числится: там, где не было материала, вы не выдумывали организаций.';
  else if (s.exc <= 6) e = 'За вами есть несколько дел, которые не выдержали бы никакой проверки, — и вы это знали, когда их подписывали.';
  else if (s.exc <= 11) e = 'Сфабрикованных вами эпизодов набралось на отдельный том: организации, которых не существовало, показания, которых никто не давал.';
  else e = 'Вы стали автором целой контрреволюционной вселенной: филиалы, центры, явки, — и всё это существовало только в ваших протоколах.';
  out.push(e);

  let p = '';
  if (s.susp <= 1) p = 'В отношении вас самого не было заведено ничего: вы не спорили вслух, не заступались открыто и не дружили не с теми.';
  else if (s.susp <= 4) p = 'В вашем формуляре к тридцать девятому году лежало несколько отметок — разговоры, знакомства, отказы. Немного, но лежало.';
  else if (s.susp <= 8) p = 'На вас завели формуляр: слишком часто вы оказывались рядом с теми, кого потом брали, и слишком часто говорили лишнее.';
  else p = 'К концу тридцать восьмого вас разрабатывали свои же — и это было вопросом не «если», а «когда».';
  out.push(p);

  if (s.ins >= 5 && alive) out.push('Ваша папка — вторые экземпляры рапортов с входящими номерами, копии постановлений о прекращении, справки о недостаточности материалов — оказалась единственным, что говорило в вашу пользу. Бумага, в конце концов, победила бумагу.');
  else if (s.ins >= 5) out.push('Ваша папка была собрана правильно и в срок — вторые экземпляры, входящие номера, даты. Её просто не хватило: против такого счёта подписей не помогает никакая опись.');
  else if (s.ins > 0) out.push('Кое-какие бумаги вы всё же откладывали, но их не хватило, чтобы составить историю в свою защиту.');
  else out.push('Вы не оставили в свою защиту ни одной бумаги. В этой системе это означало, что вас не существовало отдельно от того, что вы подписали.');

  return out.join('\n\n');
}

/* ---------- заставка ---------- */

const V3_BGS = [['worker', 'Рабочий'], ['officer', 'Поручик'], ['intel', 'Курсистка'], ['merchant', 'Фабрикант']];
const V3_CAMPS = [['lenin', 'Ленин'], ['tsar', 'Николай II'], ['savinkov', 'Савинков'], ['kornilov', 'Корнилов'], ['makhno', 'Махно']];

function v3Progress() {
  const get = k => { try { return localStorage.getItem(k) === '1'; } catch (e) { return false; } };
  return {
    bgs: V3_BGS.map(b => [b[1], get('rr_survived_' + b[0])]),
    camps: V3_CAMPS.map(c => [c[1], get('rr_v2_alive_' + c[0])]),
  };
}

function gate3Ok() {
  try {
    if (new URLSearchParams(location.search).has('skipgate')) return true;
  } catch (e) { return true; }
  const p = v3Progress();
  return p.bgs.every(x => x[1]) && p.camps.every(x => x[1]);
}

function showChekGate() {
  const p = v3Progress();
  const chips = list => list.map(x => x[1] ? `<b>${x[0]} ✓</b>` : `${x[0]} —`).join(' · ');
  app3.innerHTML = `
  <div class="card intro">
    <div class="meta">Часть третья · допуск</div>
    <h1>Допуск не оформлен</h1>
    <div class="body">
      <p>За этот стол не садятся с улицы. Прежде чем решать чужие судьбы по бумаге, надо узнать обе стороны стола: сначала побывать теми, кого мнёт история, потом теми, кто её мнёт.</p>
      <p>Допуск оформляется, когда выполнены оба условия: в первой части вы дожили до 1922 года <b>всеми четырьмя</b> персонажами, во второй — провели <b>всех пятерых</b> действующих лиц до конца живыми (любая концовка, кроме гибели).</p>
    </div>
    <div class="menu-progress">Дожили до 1922-го: ${chips(p.bgs)}</div>
    <div class="menu-progress">Уцелели в «Действующих лицах»: ${chips(p.camps)}</div>
    <div class="choices" style="margin-top:26px"><div class="choice"><button id="tomenu">Вернуться в меню</button></div></div>
  </div>`;
  document.getElementById('tomenu').addEventListener('click', () => { location.href = 'index.html'; });
}

function showChekIntro() {
  CH.S = null;
  if (!gate3Ok()) { showChekGate(); return; }
  app3.innerHTML = `
  <div class="card intro">
    <div class="meta">Часть третья · 1936–1938</div>
    <h1>Особая папка</h1>
    <div class="body">
      <p>Вы — Николай Степанович Гриднев, лейтенант государственной безопасности, оперуполномоченный секретно-политического отдела областного управления НКВД. Вам тридцать два года, у вас жена, сын семи лет, комната в ведомственном доме и сейф с делами.</p>
      <p>Через ваш стол пойдут люди: секретари райкомов и комбриги, инженеры и попы, крестьяне, вернувшиеся из ссылки, поляки-железнодорожники, старые большевики и семнадцатилетние школьники. По каждому нужно решить одно: пустить дело дальше — или убрать.</p>
      <p>Наверху ждут цифр, и цифры вы дадите. Внизу остаются бумаги, и бумаги никуда не денутся. Рано или поздно кто-нибудь сядет разбирать и то и другое — и разбирать будет по вашей подписи.</p>
      <p>Вам ничего не скажут прямо, но в каждом деле есть подсказки. Кто прислал материал. Кто им интересуется. Чем оно прошито: показаниями из Москвы — или заявлением соседа, которому нужна комната. Слушайте не обвинение. Слушайте бумагу.</p>
      <p>И откладывайте вторые экземпляры. Больше вас спасти нечему.</p>
    </div>
    <div class="choices"><div class="choice"><button id="play">Принять дела</button></div></div>
    <div class="path" style="margin-top:28px"><a href="index.html" style="color:inherit">← Меню цикла</a></div>
  </div>`;
  document.getElementById('play').addEventListener('click', () => {
    CH.S = newChekState();
    show3('ck_start');
  });
}

/* ---------- валидация ---------- */

function validate3() {
  const missing = [];
  const check = (id, from) => { if (id && !NODES3[id]) missing.push(`${from} → «${id}»`); };
  for (const [id, node] of Object.entries(NODES3)) {
    (node.choices || []).forEach(c => check(c.goto, id));
  }
  check('ck_start', 'СТАРТ');
  if (missing.length) console.warn('v3: битые переходы:', missing);
  else console.log(`v3: граф в порядке, ${Object.keys(NODES3).length} сцен.`);
}

validate3();
if (typeof initGloss === 'function') initGloss();
showChekIntro();
