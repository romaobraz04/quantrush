import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as core from '../training-core.mjs';

const { structuredProblem, simulationPlan, simulationSummary, reviewQuestions, calculateReadiness, SKILLS, BLUEPRINT } = core;
function seeded(seed) { return () => ((seed = (Math.imul(1664525, seed) + 1013904223) >>> 0) / 2 ** 32); }
const number = token => token.includes('/') ? token.split('/').map(Number).reduce((a, b) => a / b) : Number(token);
const evaluate = (a, operator, b) => operator === '+' ? a + b : operator === '−' ? a - b : operator === '×' ? a * b : a / b;

test('structured identities are exact across 18,000 generated expressions', () => {
  const random = seeded(98217), families = new Set();
  let negative = 0, unreduced = 0, tiny = 0, leftUnknown = 0, rightUnknown = 0;
  for (const op of ['decimals', 'fractions', 'missing']) for (const diff of ['easy', 'medium', 'hard']) for (let i = 0; i < 2000; i++) {
    const p = structuredProblem(op, diff, { random, signed: random() < .2 });
    const [expression, expected] = p.prompt.split(' = '), [left, operator, right] = expression.split(' ');
    const a = left === '?' ? p.ans : number(left), b = right === '?' ? p.ans : number(right);
    const result = evaluate(a, operator, b), answer = expected === undefined ? p.ans : number(expected);
    assert.ok(Number.isFinite(p.ans) && Number.isFinite(result), p.prompt);
    assert.ok(Math.abs(result - answer) < 1e-8, `${p.prompt}: ${result} != ${answer}`);
    assert.equal(p.ans, p.exactAnswer.n / p.exactAnswer.d);
    assert.ok(p.distractors.every(Number.isFinite)); families.add(p.family);
    negative += p.prompt.includes('-'); tiny += Math.abs(p.ans) > 0 && Math.abs(p.ans) < .01;
    leftUnknown += left === '?'; rightUnknown += right === '?';
    for (const match of p.prompt.matchAll(/(\d+)\/(\d+)/g)) unreduced += Number(match[1]) % 2 === 0 && Number(match[2]) % 2 === 0;
  }
  assert.ok(families.size >= 12 && negative > 1000 && unreduced > 1000 && tiny > 100);
  assert.ok(leftUnknown > 2000 && rightUnknown > 2000);
});

test('simulation plans vary, remain 80 questions, and cover every skill', () => {
  const random = seeded(349), mixes = new Set();
  for (let i = 0; i < 500; i++) {
    const plan = simulationPlan(random), counts = {};
    assert.equal(plan.length, 80);
    plan.forEach(p => counts[p.op] = (counts[p.op] || 0) + 1);
    assert.deepEqual(Object.keys(counts).sort(), [...SKILLS].sort());
    assert.ok(Object.values(counts).every(n => n >= 6));
    assert.ok(plan.filter(p => p.diff === 'hard').length >= 26);
    assert.ok(plan.filter(p => p.signed).length >= 12);
    mixes.add(JSON.stringify(counts));
  }
  assert.ok(mixes.size > 100);
});

function session(index, options = {}) {
  const { difficulty = 'hard', mode = 'practice', count = 80, incorrect = 0, repeat = false, blueprint = BLUEPRINT } = options;
  return { id: String(index), mode, startedAt: new Date(1700000000000 + index * 86400000).toISOString(), config: { diff: difficulty, blueprint }, attempts: Array.from({ length: count }, (_, n) => ({ op: SKILLS[n % 8], difficulty, prompt: repeat ? '2 + 2' : `${index * 100 + n} + 3`, correct: n >= incorrect, firstTry: n >= incorrect, ms: 3000 })) };
}
test('confidence grows slowly without moving the baseline', () => {
  const sparse = calculateReadiness([session(0, { count: 39, difficulty: 'easy' })]);
  assert.ok(sparse.score < 5);
  const twoSims = [session(0, { mode: '80in8' }), session(1, { mode: '80in8' })];
  assert.equal(calculateReadiness(twoSims).rated, true);
  assert.ok(calculateReadiness(twoSims).score < 30);
  const sixSets = Array.from({ length: 6 }, (_, i) => session(i, { count: 40, difficulty: 'medium' }));
  assert.equal(calculateReadiness(sixSets).rated, true);
  const curve = [1, 3, 6, 12, 30].map(n => calculateReadiness(Array.from({ length: n }, (_, i) => session(i))).score);
  assert.ok(curve.every((v, i) => i === 0 || v > curve[i - 1]));
  assert.ok(curve[1] < 30 && curve[2] < 45);
  const repeated = calculateReadiness(Array.from({ length: 12 }, (_, i) => session(i, { repeat: true })));
  assert.ok(repeated.score < curve[3]);
});
test('simulation performance and the earlier easier mix affect readiness', () => {
  const make = (incorrect, blueprint) => Array.from({ length: 8 }, (_, i) => session(i, { mode: '80in8', incorrect, blueprint }));
  assert.ok(calculateReadiness(make(0, BLUEPRINT)).score > calculateReadiness(make(30, BLUEPRINT)).score);
  assert.ok(calculateReadiness(make(0, BLUEPRINT)).score > calculateReadiness(make(0, 'controlled-v4')).score);
});
test('score and review distinguish wrong, skipped and unreached questions', () => {
  const run = { config: { questions: Array.from({ length: 80 }, (_, i) => ({ prompt: `${i}+1`, answer: i + 1 })) }, attempts: [{ correct: true }, { correct: false }, { correct: null, skipped: true }] };
  assert.deepEqual(simulationSummary(run), { correct: 1, wrong: 1, skipped: 1, unreached: 77, answered: 2, score: 0 });
  assert.equal(simulationSummary({ attempts: [{ correct: false }] }).score, -1);
  const restored = JSON.parse(JSON.stringify(run)), review = reviewQuestions(restored);
  assert.equal(review.length, 80);
  assert.deepEqual(review.slice(0, 4).map(q => q.status), ['correct', 'wrong', 'skipped', 'unreached']);
  assert.equal(reviewQuestions({ attempts: run.attempts }).length, 3);
});

function appHarness() {
  const elements = new Map(), storage = new Map();
  const get = id => {
    if (!elements.has(id)) elements.set(id, { value: '', textContent: '', innerHTML: '', disabled: false, classList: { add() {}, remove() {}, toggle() {}, contains() { return true; } }, style: { setProperty() {} }, querySelector() { return get('child'); }, querySelectorAll() { return []; }, focus() {}, setAttribute() {}, reportValidity() { return true; } });
    return elements.get(id);
  };
  const context = vm.createContext({ ...core, document: { getElementById: get, querySelectorAll: () => [] }, localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, v) => storage.set(key, v), removeItem: key => storage.delete(key) }, console, setTimeout: () => 0, clearInterval() {}, setInterval: () => 0, crypto: { randomUUID: () => 'test-run' }, confirm: () => true, Intl, location: { protocol: 'http:', origin: 'http://localhost', pathname: '/index.html' } });
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const script = html.split('<script type="module">')[1].split('</script>')[0];
  const code = script.slice(script.indexOf('const SUPABASE_URL'), script.indexOf("\nqsa('.navbtn')")).split('\n').filter(line => !line.startsWith('try{const mod=await import(')).join('\n');
  vm.runInContext(code, context);
  const run = code => vm.runInContext(code, context);
  run('renderAll=()=>{};renderAuth=()=>{};renderAdmin=()=>{};renderProblem=()=>{};renderGameStats=()=>{};renderRunDetail=()=>{};');
  return { run, context, get, storage };
}
test('all generated choices are unique and contain one exact answer', () => {
  const { run } = appHarness();
  run(`for(let n=0;n<6000;n++){const p=n%2?genFor(cats[n%8],['easy','medium','hard'][n%3]):genFor(cats[n%8],'hard',{simulation:true,signed:n%5===0});const options=makeChoices(p);if(options.length!==4||options.filter(o=>correct(o.label,p)).length!==1||options.some(o=>!Number.isFinite(parseAnswer(o.label))))throw Error(JSON.stringify({p,options}));}`);
  assert.equal(run("correct('2/4',{ans:.5})"), true);
  assert.equal(run("correct('1/2/3',{ans:.5})"), false);
  assert.equal(run("correct('0.000001',{ans:.000002})"), false);
});
test('running simulation uses its pre-generated deck, then persists all 80 questions', () => {
  const { run } = appHarness();
  run("state.sim=true;state.simAllowSkip=true;state.running=true;state.started=Date.now();state.qStarted=Date.now();state.simProblems=Array.from({length:80},(_,i)=>({op:'add',diff:'hard',prompt:i+' + 1',ans:i+1,format:'number'}));state.problem=state.simProblems[0];record(true,'1');record(false,'99');record(null,null)");
  assert.equal(run('state.problem.prompt'), '3 + 1');
  assert.equal(run('simulationScore()'), 0);
  run('finish()');
  assert.equal(run('sessions[0].config.questions.length'), 80);
  assert.equal(run('sessions[0].attempts.length'), 3);
  assert.equal(run('sessions[0].config.allowSkip'), true);
  assert.equal(run('reviewQuestions(sessions[0])[79].status'), 'unreached');
});
test('skipping is off by default and blank typed answers do not advance or lose points', () => {
  const { run, get } = appHarness();
  assert.equal(run('state.simAllowSkip'), false);
  run('startSimulation();skipSimulation();record(null,null)');
  get('child').value = '';
  run('submitTyped(true)');
  get('child').value = '   ';
  run('submitTyped(true)');
  assert.equal(run('state.attempts.length'), 0);
  assert.equal(run('simulationScore()'), 0);
  run('finish()');
  assert.equal(run('sessions[0].config.allowSkip'), false);
  assert.equal(run('simulationSummary(sessions[0]).unreached'), 80);
});
test('enabled skipping scores zero, persists on restart, and is locked during a run', () => {
  const { run, get } = appHarness();
  run('setSimAllowSkip(true);startSimulation();skipSimulation()');
  assert.equal(run('state.attempts.length'), 1);
  assert.equal(run('state.attempts[0].correct'), null);
  assert.equal(run('simulationScore()'), 0);
  get('child').value = '';
  run('submitTyped(true)');
  assert.equal(run('state.attempts.length'), 2);
  run('setSimAllowSkip(false)');
  assert.equal(run('state.simAllowSkip'), true);
  run('restartSession(true)');
  assert.equal(run('state.simAllowSkip'), true);
  assert.equal(run('state.attempts.length'), 0);
  run('quitSession(true);setSimAllowSkip(false);startSimulation();skipSimulation()');
  assert.equal(run('state.attempts.length'), 0);
});
test('quitting and restarting discard unfinished progress', () => {
  const { run } = appHarness();
  run('startSimulation();record(true,state.problem.ans);quitSession(true)');
  assert.equal(run('sessions.length'), 0);
  run('startSimulation();record(true,state.problem.ans);restartSession(true)');
  assert.equal(run('sessions.length'), 0);assert.equal(run('state.attempts.length'), 0);
});
test('sign-out is device-local and errors restore an actionable button', async () => {
  const { run, context, get } = appHarness();
  let scope;
  context.mockAuth = { signOut: async options => { scope = options.scope; return { error: null }; } };
  run("supabase={auth:mockAuth};currentUser={id:'player',email:'test@example.invalid'};authReady=true");
  await run('signOutAccount()');
  assert.equal(scope, 'local');assert.equal(run('currentUser'), null);assert.equal(get('signOut').disabled, false);
  context.mockAuth.signOut = async () => ({ error: { message: 'Offline' } });
  run("currentUser={id:'player'}");await run('signOutAccount()');
  assert.match(get('accountMsg').textContent, /Offline/);assert.equal(get('signOut').disabled, false);assert.ok(run('currentUser'));
});
test('auth callback is synchronous and legacy guest history does not reappear', () => {
  const { run, storage } = appHarness();
  storage.set('quanttempo_sessions_v4', JSON.stringify([{ id: 'legacy' }]));
  storage.delete('quanttempo_guest_sessions_v5');
  assert.equal(run('loadGuestSessions().length'), 1);
  run("writeSessions(GUEST_STORE,[])");
  assert.equal(run('loadGuestSessions().length'), 0);
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /onAuthStateChange\(async/);
});

test('cloud history restores complete question sets and uploads guest history once', async () => {
  const { run, context, storage } = appHarness();
  const cloudRun = { id: 'cloud-run', user_id: 'player', started_at: '2026-09-04T09:00:00Z', mode: '80in8', score: 0, duration_sec: 480, config: { questions: Array.from({ length: 80 }, (_, i) => ({ prompt: `${i} + 1`, answer: i + 1 })) }, attempts: [] };
  const uploaded = [];
  context.fakeCloud = { from: table => {
    const query = { select() { return this; }, eq() { return this; }, order() { return this; }, range: async () => ({ data: [cloudRun] }), upsert(rows) { if (table === 'training_sessions') { uploaded.push(...rows); return Promise.resolve({}); } return this; }, single: async () => ({ data: { display_name: 'player' } }) };
    return query;
  } };
  storage.set('quanttempo_guest_sessions_v5', JSON.stringify([{ id: 'guest-run', mode: 'practice', startedAt: '2026-09-04T08:00:00Z', attempts: [] }]));
  run("supabase=fakeCloud;currentUser={id:'player',email:'player@example.invalid'};sessions=[]");
  await run('syncAll()');
  assert.equal(uploaded.length, 1);assert.equal(uploaded[0].user_id, 'player');
  assert.equal(run("sessions.find(s=>s.id==='cloud-run').config.questions.length"), 80);
  assert.equal(run('loadGuestSessions().length'), 0);
  assert.equal(JSON.parse(storage.get('quanttempo_user_sessions_v5_player')).length, 2);
});

test('late cloud responses cannot leak a previous account into the next account', async () => {
  const { run, context, storage } = appHarness();
  let resolveRead;
  const delayed = new Promise(resolve => { resolveRead = resolve; });
  context.fakeCloud = { from: () => ({ select() { return this; }, eq() { return this; }, order() { return this; }, range: () => delayed }) };
  storage.set('quanttempo_user_sessions_v5_b', JSON.stringify([{ id: 'b-history', attempts: [] }]));
  run("supabase=fakeCloud;currentUser={id:'a'};sessions=[];authReady=true");
  const pending = run('syncAll()');
  run("applyAuthUser({id:'b',email:'b@example.invalid'})");
  resolveRead({ data: [{ id: 'private-a-history', config: {}, attempts: [] }] });
  await pending;
  assert.equal(run('currentUser.id'), 'b');
  assert.equal(run('sessions.length'), 1);assert.equal(run('sessions[0].id'), 'b-history');
  assert.equal(JSON.parse(storage.get('quanttempo_user_sessions_v5_b'))[0].id, 'b-history');
});

test('background progress sync does not overwrite a username changed on another device', async () => {
  const { run, context } = appHarness();
  let written;
  context.fakeCloud = { from: () => ({ upsert(data) { written = data; return this; }, select() { return this; }, single: async () => ({ data: { display_name: 'UpdatedElsewhere' } }) }) };
  run("supabase=fakeCloud;currentUser={id:'player',email:'player@example.invalid'};currentProfile={display_name:'OldName'}");
  await run('upsertProfile()');
  assert.equal(Object.hasOwn(written, 'display_name'), false);
  assert.equal(run('visibleUsername()'), 'UpdatedElsewhere');
});
