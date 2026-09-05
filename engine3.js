'use strict';

/* ============================================================
   Движок v3 «Особая папка»: дела вместо развилок,
   карточка подследственного, три счётчика и один приговор — вам.
   ============================================================ */

const app3 = document.getElementById('app');
let currentCase = null;
let choosing3 = false;

function newChekState() {
  return { plan: 0, exp: 0, exc: 0, susp: 0, ins: 0, fab: 0, flags: new Set(), log: [], fates: [], deeds: [], marks: {}, paperTrail: [] };
}

// прогон fx варианта на «пустышке» — чтобы узнать, что он меняет, не трогая реальное состояние
function probeDelta(c, base) {
  const tmp = {...base, flags: new Set(base.flags), log: [...base.log], fates: [...base.fates], deeds: [...base.deeds]};
  const save = CH.S; CH.S = tmp;
  try { if (c.fx) c.fx(tmp); }
  finally { CH.S = save; }
  return {plan: tmp.plan - base.plan, exc: tmp.exc - base.exc, susp: tmp.susp - base.susp};
}

function saveChekScene() {
  const node = NODES3[currentCase];
  RR.save(3, {screen: 'scene', id: currentCase, state: CH.S, label: chVal(node.title) || chVal(node.date)});
}

function folderHtml() {
  const papers = CH.S.paperTrail || [];
  const content = papers.length
    ? `<ul class="paper-trail">${papers.map(p => `<li>${esc3(p.label)} <span>· ${p.count} док.</span></li>`).join('')}</ul>`
    : '<p>Здесь будут вторые экземпляры и рапорты, которые вы решите сохранить.</p>';
  return RR.details('Ваша папка · ' + CH.S.ins + ' док.', content);
}

function trackPapers(before, c) {
  const s = CH.S, diff = s.ins - before;
  if (diff > 0) s.paperTrail.push({label: (chVal(c.log) || chVal(c.text)).replace(/^\d{4}\s*[—–-]\s*/, ''), count: diff});
  let remove = -diff;
  while (remove > 0 && s.paperTrail.length) {
    const last = s.paperTrail[s.paperTrail.length - 1];
    const n = Math.min(remove, last.count); last.count -= n; remove -= n;
    if (!last.count) s.paperTrail.pop();
  }
}

// человекочитаемый ярлык поступка из log: «1937 — Дудкин: создали организацию» → «создали организацию»
function cleanLog(log) {
  if (!log) return '';
  let t = String(chVal(log)).replace(/^\d{4}\s*[—–-]\s*/, '');
  const m = t.match(/^[^:]{1,24}:\s*/);
  if (m && t.length - m[0].length > 12) t = t.slice(m[0].length);
  return t;
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

// The photograph belongs to the file, including cases with several people.
const DOSSIER_PHOTOS = {
  ck_c1: ['zemtsov', 'Земцов'], ck_c2: ['lanskoy', 'Ланской'],
  ck_c3: ['samoylov', 'Самойлов'], ck_c4: ['verhovtsev', 'Инженер Верховцев'],
  ck_c5: ['dudkin', 'Дудкин'], ck_c6: ['yurasov', 'Юрасов'],
  ck_c7: ['sviridov', 'Свиридов'], ck_c8: ['ternovskaya', 'Терновская'],
  ck_c9: ['erofeev', 'Ерофеев'], ck_c10: ['pokrovsky', 'Покровский'],
  ck_c11: ['schoolboys', 'Школьники'], ck_c12: ['tyukavin', 'Тюкавин'],
  ck_c13: ['kovalsky', 'Ковальский'], ck_c14: ['shults', 'Шульц'],
  ck_c15: ['polozov', 'Полозов'], ck_c16: ['berzinya', 'Берзиня'],
  ck_c17: ['galushko', 'Галушко'], ck_c18: ['tarasevich', 'Тарасевич'],
  ck_c19: ['tishchenko', 'Тищенко'], ck_c21: ['drobys-kustov', 'Дробыш и Кустов'],
};

function dossierPhoto(id, compact = false) {
  const photo = DOSSIER_PHOTOS[id];
  if (!photo) return '';
  const src = `images/dossiers/${id.replace('_', '-')}-${photo[0]}.jpg`;
  return `<figure class="dossier-photo${compact ? ' compact' : ''}"><a href="${src}" data-photo aria-label="Рассмотреть фотокарточку: ${photo[1]}"><img src="${src}" alt="Фотокарточка из дела: ${photo[1]}" width="1536" height="1024"></a><figcaption><span>${photo[1]}</span><span>Рассмотреть ↗</span></figcaption></figure>`;
}

function bindDossierPhotos() {
  app3.querySelectorAll('[data-photo]').forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    const dialog = document.createElement('dialog');
    dialog.className = 'photo-viewer';
    dialog.setAttribute('aria-label', link.getAttribute('aria-label'));
    dialog.innerHTML = `<form method="dialog"><button aria-label="Закрыть фотокарточку">Закрыть ×</button></form><img src="${link.getAttribute('href')}" alt="${RR.escape(link.querySelector('img').alt)}"><p>Фотографическое приложение к делу</p>`;
    document.body.appendChild(dialog);
    dialog.addEventListener('close', () => { dialog.remove(); link.focus(); });
    dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
    dialog.showModal();
  }));
}

function fileHtml(f) {
  const rows = [];
  // прочерк «—» в карточке — это «графа неприменима», а не значение: не показываем
  const add = (k, v) => { const val = chVal(v); if (val && val !== '—') rows.push(`<div class="f-row"><span class="f-key">${esc3(k)}</span><span class="f-val">${gloss3(val)}</span></div>`); };
  // дела «по факту» (авария, происшествие) заводятся без ФИО — тогда своя подпись строки
  add(f.nameLabel || 'Фамилия, имя, отчество', f.name);
  add('Год и место рождения', f.born);
  add('Социальное происхождение', f.origin);
  add(f.jobLabel || 'Занятие ко дню ареста', f.job);
  add('Источник материала', f.source);
  add('Квалификация (предварительно)', f.article);
  // «№ 4711» → «Следственное дело № 4711»; «справка на тройку № 1147» — как есть
  const no = f.no || '№ —';
  const head = /^№/.test(no) ? 'Следственное дело ' + no : no;
  let html = `<section class="dossier" aria-label="Материалы дела"><div class="d-head"><span>${esc3(head)}</span><span class="d-stamp">Секретно</span></div><div class="dossier-identity"><div class="dossier-fields">${rows.join('')}</div>${dossierPhoto(currentCase)}</div>`;
  if (f.evidence && f.evidence.length) {
    html += `<div class="f-row f-block"><span class="f-key">В деле имеется</span><span class="f-val"><ul>` +
      f.evidence.map((e, i) => {
        const marked = (CH.S.marks[currentCase] || []).includes(i);
        return `<li class="evidence${marked ? ' marked' : ''}"><button class="pencil-mark" data-evidence="${i}" aria-pressed="${marked}" aria-label="Пометить карандашом: ${RR.escape(chVal(e))}">${marked ? '✓' : '○'}</button><span>${gloss3(chVal(e))}</span></li>`;
      }).join('') + `</ul><p class="dossier-help">Кружок у строки — ваша пометка карандашом. Она не меняет решение по делу.</p></span></div>`;
  }
  html += `</section>`;
  return html;
}

/* ---------- рендер узла ---------- */

const MARKS = { shoot: 'm-shoot', camp: 'm-camp', free: 'm-free', fab: 'm-fab' };

function show3(id, resumed = false) {
  const node = NODES3[id];
  if (!node) { app3.innerHTML = `<div class="card"><p>Сцена «${esc3(id)}» не найдена.</p></div>`; return; }
  if (node.check) { const to = node.check(CH.S); if (to) { show3(to); return; } }
  if (node.redirect) { show3(node.redirect(CH.S)); return; }
  if (node.type) { showChekEnding(node); return; }
  if (node.enter && !resumed) node.enter(CH.S);
  if (node.quota && !resumed) CH.S.exp += node.quota;
  currentCase = id; choosing3 = false;
  saveChekScene();

  const meta = [];
  if (node.date) meta.push(chVal(node.date));
  if (node.place) meta.push(chVal(node.place));

  let html = `<div class="card scene${node.file ? ' case' : ''}">`;
  html += `<div class="meta">${meta.map(esc3).join(' · ')}</div>`;
  html += chStats();
  if (node.title) html += `<h2>${esc3(chVal(node.title))}</h2>`;
  if (node.file) html += fileHtml(node.file);
  html += `<div class="case-reading"><div class="body">${paras3(chVal(node.text))}</div>`;
  html += folderHtml();
  if (node.ask) html += `<div class="ask">${esc3(chVal(node.ask))}</div>`;
  html += `<div class="choices">`;

  const choices = (node.choices || []).filter(c => !c.when || c.when(CH.S));
  CH.curChoices = choices;
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
  html += `</div></div></div>`;
  app3.innerHTML = html;
  bindDossierPhotos();
  window.scrollTo(0, 0);
  RR.focusScene(app3);
  app3.querySelectorAll('[data-evidence]').forEach(btn => btn.addEventListener('click', () => {
    const i = +btn.dataset.evidence;
    const marks = new Set(CH.S.marks[id] || []);
    if (marks.has(i)) marks.delete(i); else marks.add(i);
    CH.S.marks[id] = [...marks];
    btn.setAttribute('aria-pressed', String(marks.has(i)));
    btn.textContent = marks.has(i) ? '✓' : '○';
    btn.closest('li').classList.toggle('marked', marks.has(i));
    saveChekScene();
  }));
  app3.querySelectorAll('button[data-i]').forEach(btn => {
    btn.addEventListener('click', () => pick3(choices[+btn.dataset.i]));
  });
}

function pick3(c) {
  if (choosing3) return;
  choosing3 = true; RR.lockChoices(app3);
  const b = {...CH.S, flags: new Set(CH.S.flags)};
  const available = (CH.curChoices || []).filter(sib => !sib.req || sib.req(CH.S));
  let maxPlan = 0;
  available.forEach(sib => { const sd = probeDelta(sib, b); maxPlan = Math.max(maxPlan, sd.plan); });
  if (c.fx) c.fx(CH.S);
  trackPapers(b.ins, c);
  if (c.mark === 'fab') CH.S.fab = (CH.S.fab || 0) + 1;
  // вклад решения: нарушения, подозрение и «сдержанность» (насколько недобрали
  // плана против самого результативного варианта в этом же деле)
  const dExc = CH.S.exc - b.exc, dSusp = CH.S.susp - b.susp, dPlan = CH.S.plan - b.plan;
  maxPlan = Math.max(maxPlan, dPlan);
  const restraint = maxPlan - dPlan;
  if (dExc > 0 || dSusp > 0 || restraint > 0) {
    CH.S.deeds.push({ label: chVal(c.recall) || cleanLog(c.log) || chVal(c.text), exc: dExc, susp: dSusp, restraint: restraint });
  }
  if (c.log) CH.S.log.push(chVal(c.log));
  if (c.fate) CH.S.fates.push(chVal(c.fate));
  const result = chVal(c.result);
  if (result) showResult3(result, c.note, c.goto);
  else show3(c.goto);
}

function showResult3(text, note, nextId) {
  RR.save(3, {screen: 'result', text, note: chVal(note), nextId, state: CH.S, label: 'последствия решения'});
  const next = NODES3[nextId];
  const isEnd = next && next.type;
  let html = `<div class="card result"><div class="body">${paras3(text)}</div>`;
  if (note) html += RR.details('Историческая справка', paras3(chVal(note)));
  html += `<div class="choices"><div class="choice"><button id="go">${isEnd ? 'Что же дальше?' : 'Дальше'}</button></div></div></div>`;
  app3.innerHTML = html;
  window.scrollTo(0, 0);
  document.getElementById('go').addEventListener('click', () => show3(nextId));
}

/* ---------- концовка ---------- */

const CHEK_KINDS = { death: 'Дело окончено', survival: 'Вы уцелели', punishment: 'Вы осуждены' };

function showChekEnding(node) {
  RR.clear(3);
  const s = CH.S;
  let html = `<div class="card ending ${node.type}">`;
  html += `<div class="meta">${esc3(CHEK_KINDS[node.type])}</div>`;
  html += `<h2>${esc3(chVal(node.title))}</h2>`;
  html += `<div class="body">${paras3(chVal(node.text))}</div>`;
  html += `<div class="world"><div class="note-title">Ваш итог по управлению</div>` +
    paras3(chekSummary(s, node.type === 'survival', !!node.rescued)) + `</div>`;
  html += chekRecall(s, node);
  html += folderHtml();
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

// самый весомый поступок по счётчику key (можно исключить уже названный)
function topDeed(deeds, key, skip) {
  let best = null;
  (deeds || []).forEach(d => {
    if (d === skip) return;
    if (d[key] > 0 && (!best || d[key] > best[key])) best = d;
  });
  return best;
}

// блок «Что вам припомнили / Что зачлось»: реальные решения игрока,
// поднятые тем счётчиком, который его и погубил (или спас)
function chekRecall(s, node) {
  const kind = node.recallKind;
  if (!kind) return '';
  const d = s.deeds || [];
  const P = [];
  let title = 'Что вам припомнили';

  if (kind === 'exc') {
    const a = topDeed(d, 'exc'), b = topDeed(d, 'exc', a);
    if (a) {
      let t = 'Обвинительное заключение открывалось тем, как вы ' + a.label + '.';
      if (b) t += ' Следующим эпизодом шло, как вы ' + b.label + '.';
      t += ' Оба протокола были составлены вашей рукой — это в тридцать девятом и подшили.';
      P.push(t);
    } else P.push('Отдельных эпизодов искать не стали: под приговор хватило общего счёта ваших подписей.');
  } else if (kind === 'susp_restraint') {
    const a = topDeed(d, 'susp'), r = topDeed(d, 'restraint');
    let t = '';
    if (a) t += 'Тяжелее всего в вашем формуляре легло, как вы ' + a.label + '.';
    if (r) t += (t ? ' ' : '') + 'А рядом подшили, как вы ' + r.label + ', — назвали это развалом дел и выгораживанием изобличённых.';
    P.push(t || 'Вам не предъявили ничего конкретного: «врагу в органах» конкретика не полагалась.');
  } else if (kind === 'restraint') {
    const a = topDeed(d, 'restraint'), b = topDeed(d, 'restraint', a);
    if (a) {
      let t = 'Вам поставили в вину прежде всего, как вы ' + a.label;
      if (b) t += ', и как вы ' + b.label;
      t += '. Там, где полагалось дать «выход», вы придерживали, — и это сочли не осторожностью, а умыслом.';
      P.push(t);
    } else P.push('Вам вменили общую мягкость, не разбирая по эпизодам.');
  } else if (kind === 'exc_light') {
    const a = topDeed(d, 'exc'), b = topDeed(d, 'exc', a);
    if (a) {
      let t = 'На разборе вам предъявили, как вы ' + a.label;
      if (b) t += ', и как вы ' + b.label;
      t += '.';
      P.push(t);
    } else P.push('Тяжёлых эпизодов за вами не нашли — оттого и обошлось этим.');
  } else if (kind === 'alive') {
    title = 'Что зачлось';
    const r = topDeed(d, 'restraint'), r2 = topDeed(d, 'restraint', r);
    if (r) {
      let t = 'Когда вас вызвали в комиссию, вспомнили и то, как вы ' + r.label;
      if (r2) t += ', как вы ' + r2.label;
      t += '. В тридцать девятом это впервые оказалось не виной, а заслугой.';
      P.push(t);
    } else return '';
  }

  if (!P.length) return '';
  return `<div class="world"><div class="note-title">${title}</div>${paras3(P.join('\n\n'))}</div>`;
}

function chekSummary(s, survived, rescued) {
  const pace = s.plan - s.exp;
  const out = [];
  // Счёт идёт на сотни: показанные дела — те, что вы помните поимённо,
  // а не весь поток, прошедший через участок за два года
  const n = s.fates.length;
  let t = 'Через ваш стол прошли сотни дел: справки на тройку, альбомные справки, протоколы, подшивки. ' +
    (n ? (n === 1 ? 'Одно' : n) + ' из них вы будете помнить поимённо. ' : '');
  if (pace >= 8) t += 'По «выходу» вы шли в передовиках управления: реализация стабильно превышала ожидаемую, и это отмечалось на оперативных совещаниях.';
  else if (pace >= 2) t += 'По «выходу» вы держались чуть выше нормы — достаточно, чтобы вас не трогали, и недостаточно, чтобы ставить в пример.';
  else if (pace >= -3) t += 'По «выходу» вы держались ровно посередине: не в передовиках, но и не в отстающих. В тридцать восьмом это было самое безопасное место в стране.';
  else t += 'По «выходу» вы были ниже, чем любой в отделе, и это заметили раньше, чем вы думали.';
  out.push(t);

  let e = '';
  if (!s.fab) {
    // ни одного сфабрикованного дела — весь «выход» шёл по приказу и материалу
    if (s.exc <= 6) e = 'Организаций вы не выдумывали; отдельных нарушений за вами сравнительно мало. Это не отменяет подписанных вами решений и не делает приказ сверху доказательством чьей-либо вины.';
    else if (s.exc <= 16) e = 'Сетей и организаций вы не сочиняли — но под необоснованными расстрелами и сроками стоит ваша подпись. Эти эпизоды можно поднять по номерам дел.';
    else e = 'Вы не придумали ни одной организации, ни одной явки — и всё же накопили тяжёлый счёт необоснованных решений. На проверке будут читать не только ваши объяснения о приказах, но и протоколы, которые вы подписали.';
  } else {
    if (s.exc <= 16) e = 'За вами есть дела, слепленные из воздуха, — и вы это знали, когда их подписывали.';
    else if (s.exc <= 28) e = 'Нарушений набралось на отдельный том. Среди них — дела, в которых вы сами создавали обвинение вместо того, чтобы проверять его.';
    else e = 'Подписанных нарушений хватит на приговор вам самому. В этом счёте есть и сфабрикованные вами дела; объяснение «так требовали» не уберёт вашей подписи.';
  }
  out.push(e);

  let p = '';
  if (s.susp <= 5) p = 'В отношении вас самого накопилось мало подозрений. По ведомственной оценке вы оставались вне разработки.';
  else if (s.susp <= 14) p = 'В вашем формуляре лежало несколько отметок — разговоры, знакомства, отказы. Немного, но лежало.';
  else if (s.susp <= 26) p = 'На вас завели формуляр: знакомства, отказы и заступничества складывались в отдельное дело.';
  else p = 'К концу тридцать восьмого вас разрабатывали свои же — и это было вопросом не «если», а «когда».';
  out.push(p);

  if (s.ins >= 5 && rescued) out.push('Ваша папка — вторые экземпляры рапортов с входящими номерами, копии постановлений о прекращении, справки о недостаточности материалов — оказалась единственным, что говорило в вашу пользу. Бумага, в конце концов, победила бумагу.');
  else if (s.ins >= 5 && survived) out.push('Ваша папка не вернула вам ни звания, ни комнаты. Но, судя по тому, что дело кончилось выговором и высылкой, а не приговором, именно вторые экземпляры с входящими номерами удержали вас от худшего.');
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
  <div class="card intro archive-intro">
    <div class="archive-cover"><div class="meta">Часть третья · 1936–1938</div>
    <h1>Особая папка</h1><p class="archive-subtitle">Хранить лично.<br>Решать по существу.</p><span class="archive-seal" aria-hidden="true">Лично</span></div>
    <div class="archive-intro-content">
    <div class="archive-contact-sheet">${dossierPhoto('ck_c1', true)}${dossierPhoto('ck_c8', true)}</div>
    <div class="body">
      <p>Вы — Николай Степанович Гриднев, лейтенант государственной безопасности, оперуполномоченный секретно-политического отдела областного управления НКВД. Вам тридцать два года, у вас жена, сын семи лет, комната в ведомственном доме и сейф с делами.</p>
      <p>Через ваш стол пойдут люди: секретари райкомов и комбриги, инженеры и попы, крестьяне, вернувшиеся из ссылки, поляки-железнодорожники, старые большевики и семнадцатилетние школьники. По каждому нужно решить одно: пустить дело дальше — или убрать.</p>
      <p>Наверху ждут цифр, и цифры вы дадите. Внизу остаются бумаги, и бумаги никуда не денутся. Рано или поздно кто-нибудь сядет разбирать и то и другое — и разбирать будет по вашей подписи.</p>
      <p>Вам ничего не скажут прямо, но в каждом деле есть подсказки. Кто прислал материал. Кто им интересуется. Чем оно прошито: показаниями из Москвы — или заявлением соседа, которому нужна комната. Слушайте не обвинение. Слушайте бумагу.</p>
      <p>Помечайте карандашом строки, которые не сходятся. И откладывайте вторые экземпляры: собранные документы можно раскрыть в вашей папке под каждым делом.</p>
    </div>
    <div class="choices">${RR.resumeButton(3)}<div class="choice"><button id="play">Начать службу</button></div></div>
    ${RR.storageNote()}
    <div class="path" style="margin-top:28px"><a href="index.html" style="color:inherit">← Меню цикла</a></div>
  </div></div>`;
  bindDossierPhotos();
  document.getElementById('play').addEventListener('click', () => {
    CH.S = newChekState();
    show3('ck_start');
  });
  const resume = document.getElementById('resume');
  if (resume) resume.addEventListener('click', () => {
    const saved = RR.checkpoint(3);
    if (!saved || !NODES3[saved.screen === 'result' ? saved.nextId : saved.id]) return;
    CH.S = saved.state; CH.S.marks = CH.S.marks || {}; CH.S.paperTrail = CH.S.paperTrail || [];
    if (saved.screen === 'result') showResult3(saved.text, saved.note, saved.nextId);
    else show3(saved.id, true);
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
