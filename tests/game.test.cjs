const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');

// A minimal rendering sink: tests exercise the real scripts and state machine.
// Real DOM interactions and layout are checked separately in the browser.
function game(mode, storage = new Map(), blocked = false) {
  const ids = new Map();
  function element() {
    return {innerHTML: '', style: {}, dataset: {}, events: {},
      setAttribute() {}, appendChild() {}, remove() {}, focus() {}, close() {}, showModal() {},
      querySelector: () => element(), querySelectorAll: () => [],
      addEventListener(type, fn) { this.events[type] = fn; },
    };
  }
  const app = element(); ids.set('app', app);
  const document = {body: element(), createElement: element, addEventListener() {},
    getElementById(id) {
      if (id !== 'app' && !app.innerHTML.includes('id="' + id + '"')) return null;
      if (!ids.has(id)) ids.set(id, element());
      return ids.get(id);
    },
  };
  const warnings = [];
  const context = vm.createContext({
    document, window: {scrollTo() {}, addEventListener() {}}, location: {search: '?skipgate'}, URLSearchParams,
    console: {log() {}, warn: (...x) => warnings.push(x)},
    localStorage: {getItem: k => {if (blocked) throw Error('blocked'); return storage.get(k) ?? null;}, setItem: (k, v) => {if (blocked) throw Error('blocked'); storage.set(k, String(v));}},
    setInterval: () => 1, clearInterval() {}, setTimeout: fn => {fn(); return 1;},
  });
  const run = code => vm.runInContext(code, context);
  const html = fs.readFileSync(path.join(root, `v${mode}.html`), 'utf8');
  for (const m of html.matchAll(/<script src="([^"?]+)/g)) {
    vm.runInContext(fs.readFileSync(path.join(root, m[1]), 'utf8'), context, {filename: m[1]});
  }
  const start = role => run(mode === 3 ? "CH.S = newChekState(); show3('ck_start')" :
    `S = newState('${role}'); ${mode === 2 ? 'W = newWorld();' : ''} show(${mode === 1 ? "'ch1'" : 'CAMPAIGNS[S.camp].start'})`);
  const click = id => document.getElementById(id).events.click();
  return {run, start, click, app, storage, warnings};
}

test('all three script stacks boot, all static edges and assets exist', () => {
  for (const mode of [1, 2, 3]) {
    const g = game(mode); assert.equal(g.warnings.length, 0);
    const name = mode === 1 ? 'NODES' : 'NODES' + mode;
    const nodes = g.run(name);
    for (const [id, n] of Object.entries(nodes)) {
      const targets = [...Object.values(n.routes || {})];
      for (const c of n.choices || []) {
        targets.push(c.goto);
        for (const branch of [c.roll, c.bif]) if (branch) targets.push(branch.success.goto, branch.fail.goto);
      }
      for (const target of targets.filter(Boolean)) assert.ok(nodes[target], `${id} -> ${target}`);
    }
    if (mode === 2) for (const target of Object.values(g.run('AFTERMATH_ENTRIES'))) assert.ok(nodes[target]);
    assert.ok(g.app.innerHTML.includes('<h1>'));
  }
  for (const file of ['small-life.jpg', 'turning-point.jpg', 'special-folder.jpg']) assert.ok(fs.statSync(path.join(root, 'images', file)).size > 10000);
});

test('memory is per character and requires a living completed path', () => {
  const g = game(2);
  assert.equal(g.run("RR.mastered(2, 'lenin', 'ln3')"), false);
  g.run("RR.remember(2, 'lenin', ['ln0','ln3'], 'death', false)");
  assert.equal(g.run("RR.mastered(2, 'lenin', 'ln3')"), false);
  g.run("RR.remember(2, 'lenin', ['ln0','ln3'], 'e_alt_lenin', true)");
  assert.equal(g.run("RR.mastered(2, 'lenin', 'ln3')"), true);
  assert.equal(g.run("RR.mastered(2, 'lenin', 'ln8')"), false);
  assert.equal(g.run("RR.mastered(2, 'tsar', 'ln3')"), false);
  const loaded = game(2, g.storage);
  assert.equal(loaded.run("RR.mastered(2, 'lenin', 'ln3')"), true);
});

test('old completion flags unlock original scenes, but not new aftermath', () => {
  const g = game(2, new Map([['rr_v2_alive_lenin', '1']]));
  assert.equal(g.run("RR.mastered(2, 'lenin', 'ln3')"), true);
  assert.equal(g.run("RR.mastered(2, 'lenin', 'al_food')"), false);
  assert.equal(g.run("RR.mastered(2, 'tsar', 'tz0')"), false);
});

test('reload during dice animation cannot reroll or apply effects twice', () => {
  for (const mode of [1, 2]) {
    const g = game(mode); g.start(mode === 1 ? 'worker' : 'lenin');
    g.run('setTimeout = () => 1; Math.random = () => 0');
    g.run(mode === 1 ? 'pick(NODES.ch1.choices[0])' : 'pick(NODES2.ln0.choices[1])');
    const saved = g.run(`RR.checkpoint(${mode})`);
    assert.notEqual(saved.screen, 'scene');
    const loaded = game(mode, g.storage); loaded.click('resume');
    if (mode === 1) assert.ok(loaded.app.innerHTML.includes('Вы погибли'));
    else assert.equal(loaded.run('S.vl'), saved.state.vl);
  }
});

test('forced outcomes preserve choice effects and influence costs exactly once', () => {
  for (const outcome of ['success', 'fail']) {
    const g = game(2); g.start('lenin');
    g.run("show('ln3'); S.vl = 6");
    g.run(`pick(NODES2.ln3.choices[1], '${outcome}')`);
    const saved = g.run('RR.checkpoint(2)');
    assert.equal(saved.state.vl, outcome === 'success' ? 4 : 1);
    assert.equal(saved.nextId, outcome === 'success' ? 'e_len_parliament' : 'e_len_bypassed');
    assert.equal(saved.state.log.length, 1);
  }
  const g = game(1); g.start('worker');
  g.run("pick(NODES.ch1.choices[0], 'fail')");
  assert.equal(g.run('RR.checkpoint(1)'), null);
  assert.ok(g.app.innerHTML.includes('Вы погибли'));
});

test('all successful political exits continue into their own playable aftermath', () => {
  const g = game(2);
  const entries = Object.entries(g.run('AFTERMATH_ENTRIES'));
  for (const [ending, entry] of entries) {
    const role = ending.startsWith('e_len') ? 'lenin' : ending.startsWith('e_tsar') ? 'tsar' : ending.startsWith('e_sav') ? 'savinkov' : ending.startsWith('e_kor') ? 'kornilov' : 'makhno';
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
      g.start(role); g.run(`S.vl = 10; show('${ending}')`);
      assert.equal(g.run('currentNode'), entry);
      g.run(`pick(NODES2[currentNode].choices[${a}])`);
      g.run('show(RR.checkpoint(2).nextId)');
      if (!g.run(`!NODES2[currentNode].choices[${b}].req || NODES2[currentNode].choices[${b}].req(S,W)`)) continue;
      g.run(`pick(NODES2[currentNode].choices[${b}])`);
      g.run('show(RR.checkpoint(2).nextId)');
      assert.equal(g.run('RR.checkpoint(2)'), null);
      assert.ok(!g.app.innerHTML.includes('undefined'));
      assert.ok(g.app.innerHTML.includes('Ваши решения изменили страну'));
      assert.equal(g.run('W.settlement'), role);
    }
  }
});

test('reloading a scene restores Set flags and does not repeat enter effects or quota', () => {
  const g = game(1); g.start('worker'); g.run("show('ch4_jail')");
  const before = g.run('JSON.stringify({money:S.money,conn:S.conn,red:S.red,susp:S.susp,log:S.log,flags:[...S.flags]})');
  const loaded = game(1, g.storage); loaded.click('resume');
  assert.equal(loaded.run('JSON.stringify({money:S.money,conn:S.conn,red:S.red,susp:S.susp,log:S.log,flags:[...S.flags]})'), before);
  const ck = game(3); ck.start(); ck.run("show3('ck_c1'); CH.S.marks.ck_c1 = [0, 2]; saveChekScene()");
  const quota = ck.run('CH.S.exp');
  const restored = game(3, ck.storage); restored.click('resume');
  assert.equal(restored.run('CH.S.exp'), quota);
  assert.equal(restored.run('CH.S.marks.ck_c1.join()'), '0,2');
});

test('reloading a result restores already applied effects', () => {
  for (const mode of [1, 2, 3]) {
    const g = game(mode); g.start(mode === 1 ? 'worker' : 'lenin');
    g.run(mode === 3 ? 'pick3(NODES3.ck_start.choices[0])' : mode === 2 ? 'pick(NODES2.ln0.choices[0])' : 'pick(NODES.ch1.choices[1])');
    const saved = g.run(`RR.checkpoint(${mode})`);
    assert.equal(saved.screen, 'result');
    const loaded = game(mode, g.storage); loaded.click('resume');
    assert.equal(loaded.run(`JSON.stringify(RR.checkpoint(${mode}).state)`), g.run(`JSON.stringify(RR.checkpoint(${mode}).state)`));
    assert.ok(loaded.app.innerHTML.includes('id="go"'));
  }
});

test('paper inventory follows actual gains and destruction; probes do not mutate state', () => {
  const g = game(3); g.start(); g.run("show3('ck_c1'); pick3(NODES3.ck_c1.choices[2])");
  assert.equal(g.run('CH.S.paperTrail.reduce((n,p)=>n+p.count,0)'), g.run('CH.S.ins'));
  g.run("show3('ck_p6'); pick3(NODES3.ck_p6.choices[1])");
  assert.equal(g.run('CH.S.paperTrail.reduce((n,p)=>n+p.count,0)'), g.run('CH.S.ins'));
  const before = g.run('JSON.stringify(CH.S)');
  g.run('probeDelta(NODES3.ck_c1.choices[2], CH.S)');
  assert.equal(g.run('JSON.stringify(CH.S)'), before);
  assert.equal(g.run('NODES3.e_ch_lager.type'), 'punishment');
});

test('storage failure remains playable; malformed checkpoints are ignored', () => {
  const g = game(2, new Map(), true); g.start('lenin'); g.run('pick(NODES2.ln0.choices[0])');
  assert.equal(g.run('RR.checkpoint(2).screen'), 'result');
  assert.ok(g.run('RR.storageNote()').includes('до закрытия'));
  const malformed = new Map([['rr_checkpoint_1', '{oops']]);
  assert.equal(game(1, malformed).run('RR.checkpoint(1)'), null);
});

test('seeded complete playthroughs never reach missing scenes, invalid values or locked dead ends', () => {
  let seed = 712;
  const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
  for (const mode of [1, 2, 3]) {
    const g = game(mode);
    const roles = mode === 1 ? ['worker','officer','intel','merchant'] : mode === 2 ? ['lenin','tsar','savinkov','kornilov','makhno'] : ['nkvd'];
    const endKinds = new Set();
    for (const role of roles) for (let run = 0; run < 30; run++) {
      g.start(role);
      let completed = false;
      for (let step = 0; step < 120; step++) {
        const cp = g.run(`RR.checkpoint(${mode})`);
        if (!cp) { completed = true; break; }
        if (cp.screen === 'result') { g.run(`${mode === 3 ? 'show3' : 'show'}(RR.checkpoint(${mode}).nextId)`); continue; }
        const node = mode === 3 ? 'NODES3[currentCase]' : mode === 2 ? 'NODES2[currentNode]' : 'NODES[currentNode]';
        const state = mode === 3 ? 'CH.S' : 'S';
        const opts = g.run(`(${node}.choices || []).map((c,i)=>({i,c})).filter(({c})=>!c.when||c.when(${state},${mode === 2 ? 'W' : 'null'})).filter(({c})=>(!c.req||c.req(${state},${mode === 2 ? 'W' : 'null'}))&&(!c.bif||S.vl>=(c.bif.cost||0))).map(x=>x.i)`);
        if (!opts.length && mode === 2) {
          const cheapest = g.run(`(${node}.choices||[]).map((c,i)=>({i,c})).filter(({c})=>(!c.when||c.when(S,W))&&(!c.req||c.req(S,W))&&c.bif).sort((a,b)=>(a.c.bif.cost||0)-(b.c.bif.cost||0))[0]?.i`);
          if (cheapest !== undefined) opts.push(cheapest);
        }
        assert.ok(opts.length, `No open choice: mode ${mode}, ${role}, ${cp.id}`);
        const selected = opts[Math.floor(random() * opts.length)];
        const chance = g.run(`(function(){const c=${node}.choices[${selected}], r=c.bif||c.roll; return r?{chance:typeof r.chance==='function'?r.chance(${state}):r.chance, success:!!c.bif}:null})()`);
        const outcome = chance ? (random() < chance.chance ? (chance.success ? 'success' : 'fail') : (chance.success ? 'fail' : 'success')) : '';
        g.run(`${mode === 3 ? 'pick3' : 'pick'}(${node}.choices[${selected}], '${outcome}')`);
        assert.ok(!g.app.innerHTML.includes('undefined'), `${mode}, ${cp.id}`);
        assert.ok(!g.app.innerHTML.includes('не найдена'), `${mode}, ${cp.id}`);
        assert.ok(g.run(`Object.values(${state}).filter(x=>typeof x==='number').every(Number.isFinite)`));
        if (mode === 3) assert.equal(g.run('CH.S.paperTrail.reduce((n,p)=>n+p.count,0)'), g.run('CH.S.ins'));
      }
      assert.ok(completed, `Did not finish: ${mode}, ${role}`);
    }
  }
});
