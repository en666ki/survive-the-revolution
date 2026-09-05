'use strict';

// Device-local progress, checkpoints and the reader shared by all three games.
const RR = (() => {
  const cache = new Map();
  let volatile = false;
  const escape = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function read(key) {
    if (cache.has(key)) return cache.get(key);
    try { return localStorage.getItem(key); } catch (_) { volatile = true; return null; }
  }
  function write(key, value) {
    cache.set(key, value);
    try { localStorage.setItem(key, value); } catch (_) { volatile = true; }
  }
  function json(key, fallback) {
    try { return JSON.parse(read(key)) || fallback; } catch (_) { return fallback; }
  }
  const memoryKey = (mode, role) => `rr_memory_${mode}_${role}`;
  const legacyKey = (mode, role) => mode === 1 ? 'rr_survived_' + role : 'rr_v2_alive_' + role;
  function memory(mode, role) {
    const m = json(memoryKey(mode, role), {});
    return {
      won: m.won === true || read(legacyKey(mode, role)) === '1',
      legacy: m.legacy === true || (!Array.isArray(m.seen) && read(legacyKey(mode, role)) === '1'),
      seen: Array.isArray(m.seen) ? m.seen.filter(x => typeof x === 'string') : [],
      endings: Array.isArray(m.endings) ? m.endings.filter(x => typeof x === 'string') : [],
    };
  }
  function mastered(mode, role, scene) {
    const m = memory(mode, role);
    // Old versions kept completion flags but no route. Honour that completion
    // for original scenes, never for newly added aftermath scenes.
    const original = mode === 1 ? /^ch\d+(?:_|$)/.test(scene) : /^(ln|tz|sv|kr|mk)/.test(scene);
    return m.won && (m.seen.includes(scene) || (m.legacy && original));
  }
  function remember(mode, role, trail, ending, alive) {
    const m = memory(mode, role);
    m.endings = [...new Set([...m.endings, ending])];
    // Only a completed, living path unlocks control over its scenes.
    if (alive) { m.won = true; m.seen = [...new Set([...m.seen, ...trail])]; }
    write(memoryKey(mode, role), JSON.stringify(m));
  }
  function save(mode, snapshot) {
    write('rr_checkpoint_' + mode, JSON.stringify({version: 1, ...snapshot}, (_, v) => v instanceof Set ? {rrSet: [...v]} : v));
  }
  function checkpoint(mode) {
    try {
      const s = JSON.parse(read('rr_checkpoint_' + mode), (_, v) => v && Array.isArray(v.rrSet) ? new Set(v.rrSet) : v);
      return s && s.version === 1 && s.state && s.state.flags instanceof Set ? s : null;
    } catch (_) { return null; }
  }
  function clear(mode) { write('rr_checkpoint_' + mode, 'null'); }
  const art = {
    life: ['small-life.jpg', 'Очередь у лавки в рабочем предместье. Живописный этюд.'],
    history: ['turning-point.jpg', 'Провинциальная станция и расходящиеся пути. Живописный этюд.'],
    folder: ['special-folder.jpg', 'Папка, карандаш и пустой стул. Зарисовка рабочего стола.'],
  };
  function illustration(key, small = false) {
    const a = art[key];
    return a ? `<figure class="illustration${small ? ' illustration-small' : ''}"><img src="images/${a[0]}" alt="${a[1]}" width="1536" height="1024" decoding="async"></figure>` : '';
  }
  function details(title, content, open = false) {
    return `<details class="reading-note"${open ? ' open' : ''}><summary>${escape(title)}</summary><div>${content}</div></details>`;
  }
  function resumeButton(mode) {
    const s = checkpoint(mode);
    return s ? `<div class="choice"><button id="resume">Продолжить · ${escape(s.label || 'прерванная история')}</button></div>` : '';
  }
  function storageNote() {
    return `<p class="save-note">${volatile ? 'Сохранение доступно только до закрытия страницы: браузер не разрешает записать прогресс.' : 'Прогресс сохраняется в этом браузере. Можно остановиться и продолжить позже.'}</p>`;
  }
  function branchName(branch, nodes) {
    if (branch.label) return branch.label;
    const n = nodes[branch.goto];
    return n && typeof n.title === 'string' ? n.title : 'Другая версия событий';
  }
  function fate({text, success, fail, nodes, onChoose}) {
    const dialog = document.createElement('dialog');
    dialog.className = 'fate-dialog';
    dialog.setAttribute('aria-labelledby', 'fate-title');
    dialog.innerHTML = `<div class="meta">Память пройденной жизни</div><h2 id="fate-title">Здесь вы уже были</h2>` +
      `<p>${escape(text.replace(/^⚖\s*/, ''))}</p><p class="fate-explain">Вы дошли до живой концовки через эту сцену. Теперь исход можно выбрать. Цена решения остаётся прежней.</p>` +
      `<div class="choices"><div class="choice"><button data-fate="success">Замысел удаётся<span class="choice-sub">Гарантированный успех · ${escape(branchName(success, nodes))}</span></button></div>` +
      `<div class="choice"><button data-fate="fail">События идут против вас<span class="choice-sub">Гарантированная неудача · ${escape(branchName(fail, nodes))}</span></button></div>` +
      `<div class="choice"><button data-fate="random">Довериться судьбе · обычный бросок</button></div></div><button class="text-button" data-cancel>Вернуться к решению</button>`;
    let done = false;
    const close = () => { dialog.close(); dialog.remove(); };
    dialog.addEventListener('cancel', e => { e.preventDefault(); close(); });
    dialog.querySelector('[data-cancel]').addEventListener('click', close);
    dialog.querySelectorAll('[data-fate]').forEach(b => b.addEventListener('click', () => {
      if (done) return; done = true;
      const outcome = b.dataset.fate; close(); onChoose(outcome);
    }));
    document.body.appendChild(dialog);
    dialog.showModal();
  }
  function lockChoices(root) { root.querySelectorAll('.choices button').forEach(b => { b.disabled = true; }); }
  function focusScene(root) {
    const heading = root.querySelector('h1, h2');
    if (heading) { heading.tabIndex = -1; heading.focus({preventScroll: true}); }
  }
  return {escape, read, write, memory, mastered, remember, save, checkpoint, clear, illustration, details, resumeButton, storageNote, fate, lockChoices, focusScene};
})();
