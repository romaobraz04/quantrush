export const BLUEPRINT = 'structured-v5';
export const SKILLS = ['add', 'sub', 'mul', 'div', 'decimals', 'fractions', 'percent', 'missing'];
const gcd = (a, b) => b ? gcd(b, a % b) : Math.abs(a);
const rational = (n, d = 1) => {
  const factor = gcd(n, d), sign = d < 0 ? -1 : 1;
  return { n: n / factor * sign, d: Math.abs(d / factor) };
};
const value = x => x.n / x.d;
const calculate = (a, b, operator) => {
  if (operator === '+') return rational(a.n * b.d + b.n * a.d, a.d * b.d);
  if (operator === '−') return rational(a.n * b.d - b.n * a.d, a.d * b.d);
  if (operator === '×') return rational(a.n * b.n, a.d * b.d);
  return rational(a.n * b.d, a.d * b.n);
};
const decimalLabel = x => String(Number(value(x).toFixed(6)));

// Build valid identities first, then choose how to display their operands.
export function structuredProblem(op, diff = 'medium', options = {}) {
  const random = options.random || Math.random;
  const integer = (a, b) => Math.floor(random() * (b - a + 1)) + a;
  const pick = list => list[integer(0, list.length - 1)];
  const fractionText = x => {
    if (x.d === 1 && random() < .7) return String(x.n);
    const scale = random() < .5 ? pick([2, 3]) : 1;
    return `${x.n * scale}/${x.d * scale}`;
  };
  const decimal = (small = false) => {
    const places = pick(diff === 'hard' ? [1, 2, 2, 3] : diff === 'easy' ? [1, 2] : [1, 2, 2, 3]);
    const scale = 10 ** places;
    return rational(integer(1, small || random() < .6 ? scale - 1 : (diff === 'hard' ? 99 : diff === 'easy' ? 20 : 30) * scale - 1), scale);
  };
  let a, b, operator, family, display, domain = op;
  if (op === 'missing') domain = pick(diff === 'easy' ? ['integer', 'integer', 'decimals', 'fractions'] : ['integer', 'decimals', 'decimals', 'fractions', 'fractions']);
  if (domain === 'decimals') {
    display = decimalLabel;
    operator = pick(diff === 'easy' ? ['+', '−', '×'] : ['+', '−', '×', '÷']);
    if (operator === '+' || operator === '−') {
      a = decimal(); b = decimal(true); family = 'decimal-place-alignment';
    } else if (operator === '×') {
      a = decimal();
      b = diff === 'easy' ? pick([rational(1, 2), rational(1, 5), rational(2), rational(4)]) : random() < .3 ? rational(integer(1, 9), 1000) : pick([rational(1, 4), rational(1, 8), rational(2, 5), rational(3, 5), rational(5, 4), rational(3, 100), rational(4)]);
      family = 'decimal-scaling';
    } else {
      const quotient = decimal(random() < .5);
      b = pick([rational(2, 100), rational(4, 100), rational(3, 10), rational(4, 10), rational(3, 4), rational(12, 10), rational(24, 10), rational(5)]);
      a = calculate(quotient, b, '×'); family = 'decimal-exact-division';
    }
    if (random() < .22) {
      b = pick([rational(1, 2), rational(3, 4), rational(1, 8), rational(3, 8), rational(2, 5), rational(3, 20)]);
      // Terminating fractions keep mixed-notation answers exact in typed mode.
      if (operator === '÷') a = calculate(decimal(true), b, '×');
      family = 'fraction-decimal';
    }
  } else if (domain === 'fractions') {
    display = fractionText;
    const denominators = pick(diff === 'easy' ? [[2, 4, 8], [3, 6], [5, 10]] : [[2, 4, 8, 16], [3, 6, 9, 18, 27], [5, 10, 20, 25], [6, 8, 12, 24]]);
    const d1 = pick(denominators), d2 = pick(denominators);
    a = rational(integer(1, d1 - 1), d1); b = rational(integer(1, d2 - 1), d2);
    operator = pick(diff === 'easy' ? ['+', '−', '+', '×'] : ['+', '−', '×', '÷']);
    family = operator === '+' || operator === '−' ? 'fraction-common-denominator' : 'fraction-cancellation';
    if (random() < .25) { a = rational(integer(2, diff === 'hard' ? 48 : 25)); family = 'whole-fraction'; }
  } else {
    display = decimalLabel;
    operator = pick(diff === 'easy' ? ['+', '−', '×'] : ['+', '−', '×', '÷']);
    a = rational(integer(2, diff === 'hard' ? 499 : diff === 'easy' ? 30 : 199));
    b = rational(integer(2, diff === 'hard' ? 39 : diff === 'easy' ? 12 : 20));
    if (operator === '×') a = rational(integer(3, diff === 'hard' ? 39 : diff === 'easy' ? 12 : 20));
    if (operator === '÷') a = calculate(rational(integer(3, 24)), b, '×');
    family = 'integer-inverse';
  }
  if (diff === 'easy' && operator === '−' && value(a) < value(b)) [a, b] = [b, a];
  if (options.signed) a = rational(-a.n, a.d);
  const result = calculate(a, b, operator);
  const left = display(a), right = family === 'fraction-decimal' ? fractionText(b) : display(b);
  const unknownFirst = random() < .5;
  const answer = op === 'missing' ? (unknownFirst ? a : b) : result;
  const prompt = op === 'missing'
    ? `${unknownFirst ? '?' : left} ${operator} ${unknownFirst ? right : '?'} = ${display(result)}`
    : `${left} ${operator} ${right}`;
  const ans = value(answer), step = domain === 'fractions' ? 1 / answer.d : Math.abs(ans) < 1 ? .01 : 1;
  const candidates = domain === 'fractions'
    ? [ans + step, ans - step, value(calculate(a, b, operator === '+' ? '−' : '+')), ans * 2, ans / 2]
    : [ans + step, ans - step, ans * 10, ans / 10, value(calculate(a, b, operator === '+' ? '−' : '+'))];
  return {
    op, diff, prompt, ans, format: domain === 'fractions' ? 'fraction' : 'number',
    family: `${op === 'missing' ? 'missing-' : ''}${family}`,
    fractionForm: prompt.includes('/') ? 'mixed' : null,
    fractionChoiceStep: domain === 'fractions' ? step : null,
    distractors: candidates.filter(x => Number.isFinite(x) && Math.abs(x - ans) > 1e-9),
    exactAnswer: { ...answer }
  };
}

export function simulationPlan(random = Math.random) {
  const integer = (a, b) => Math.floor(random() * (b - a + 1)) + a;
  const shuffle = list => {
    for (let i = list.length - 1; i > 0; i--) { const j = integer(0, i); [list[i], list[j]] = [list[j], list[i]]; }
    return list;
  };
  const counts = { add: 7, sub: 7, mul: 10, div: 10, decimals: 12, fractions: 10, missing: 12, percent: 6 };
  const extra = ['add', 'sub', 'decimals', 'fractions', 'missing'];
  for (let i = 0; i < 6; i++) counts[extra[integer(0, extra.length - 1)]]++;
  const easy = integer(6, 10), hard = integer(26, 32);
  const levels = shuffle([...Array(easy).fill('easy'), ...Array(hard).fill('hard'), ...Array(80 - easy - hard).fill('medium')]);
  const plan = shuffle(Object.entries(counts).flatMap(([op, count]) => Array.from({ length: count }, () => ({ op }))));
  const signed = new Set(shuffle(plan.map((_, i) => i).filter(i => plan[i].op !== 'percent')).slice(0, integer(12, 18)));
  return plan.map((item, i) => ({ ...item, diff: levels[i], signed: signed.has(i) }));
}

export function simulationSummary(session) {
  const attempts = session.attempts || [];
  const correct = attempts.filter(a => a.correct === true).length;
  const wrong = attempts.filter(a => a.correct === false).length;
  const skipped = attempts.filter(a => a.skipped || a.correct === null).length;
  return { correct, wrong, skipped, unreached: Math.max(0, 80 - attempts.length), answered: correct + wrong, score: correct - wrong };
}

export function reviewQuestions(session) {
  const attempts = session.attempts || [], questions = session.config?.questions;
  return (Array.isArray(questions) ? questions : attempts).map((question, index) => {
    const attempt = attempts[index];
    return { ...question, ...attempt, index, status: !attempt ? 'unreached' : attempt.correct === true ? 'correct' : attempt.correct === false ? 'wrong' : 'skipped' };
  });
}

export function calculateReadiness(sessions, customCap = () => 65) {
  const caps = { easy: 20, medium: 65, hard: 100, custom: 65 };
  const skills = SKILLS.map(c => {
    const rows = [], sessionIds = new Set(), repeated = new Map(), levels = {};
    let effective = 0;
    for (const [index, session] of sessions.entries()) {
      const attempts = (session.attempts || []).filter(a => a.op === c && typeof a.correct === 'boolean');
      if (!attempts.length) continue;
      sessionIds.add(session.id || index);
      let contribution = 0;
      for (const attempt of attempts) {
        const requestedLevel = attempt.difficulty || session.config?.diff || 'medium';
        const level = Object.hasOwn(caps, requestedLevel) ? requestedLevel : 'medium';
        const cap = level === 'custom' ? customCap(session.config, c) : caps[level] || 65;
        const repetitions = (repeated.get(attempt.prompt) || 0) + 1;
        repeated.set(attempt.prompt, repetitions);
        contribution += (cap / 100) / Math.sqrt(repetitions);
        rows.push({ ...attempt, cap }); levels[level] = (levels[level] || 0) + 1;
      }
      effective += Math.min(40, contribution);
    }
    const n = rows.length, mediumHard = rows.filter(a => a.cap >= 65).length;
    const clean = rows.filter(a => a.correct && a.firstTry).length / Math.max(1, n);
    const times = rows.filter(a => a.correct && a.firstTry).map(a => Number(a.ms) || 0).sort((a, b) => a - b);
    const median = times.length ? times[Math.floor(times.length / 2)] : 0;
    const target = { add: 3200, sub: 3500, mul: 3800, div: 4000, decimals: 5200, fractions: 6500, percent: 5000, missing: 4300 }[c];
    const speed = times.length ? Math.min(1, target / Math.max(800, median)) : 0;
    const performance = clean * (40 + 60 * speed);
    const cap = rows.reduce((sum, a) => sum + a.cap, 0) / Math.max(1, n);
    // Continuous diminishing returns replace the old four-session saturation.
    const evidence = .7 * (1 - Math.exp(-effective / 110)) + .3 * (1 - Math.exp(-sessionIds.size / 12));
    const level = Object.keys(levels).sort((a, b) => levels[b] - levels[a])[0];
    return { c, n, median, sessionCount: sessionIds.size, mediumHard, score: Math.round(Math.min(performance, cap) * evidence), performance: Math.round(performance), evidence: Math.round(100 * evidence), provisional: n < 24 || sessionIds.size < 3 || mediumHard < 12, proofLabel: level ? level[0].toUpperCase() + level.slice(1) : 'Untested' };
  });
  const totalAnswers = skills.reduce((sum, s) => sum + s.n, 0);
  const mediumAnswers = skills.reduce((sum, s) => sum + s.mediumHard, 0);
  const simulations = sessions.filter(s => s.mode === '80in8').sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
  const fullSimulations = simulations.filter(s => {
    const answered = (s.attempts || []).filter(a => typeof a.correct === 'boolean');
    return answered.length >= 60 && new Set(answered.map(a => a.op)).size === 8;
  }).length;
  const simulationBaseline = fullSimulations >= 2 && totalAnswers >= 160 && skills.every(s => s.n >= 12);
  const practiceBaseline = sessions.length >= 6 && totalAnswers >= 240 && skills.every(s => s.n >= 16 && s.sessionCount >= 2) && mediumAnswers >= 120;
  const skillScore = skills.reduce((sum, s) => sum + s.score, 0) / 8;
  let simWeight = 0, simPerformance = 0, exposure = 0;
  for (const [i, sim] of simulations.slice(0, 12).entries()) {
    const weight = Math.exp(-i / 6) * (sim.config?.blueprint === BLUEPRINT ? 1 : .55);
    simWeight += weight; exposure += sim.config?.blueprint === BLUEPRINT ? 1 : .55;
    simPerformance += Math.max(0, simulationSummary(sim).score) / 80 * 100 * weight;
  }
  const simulationPerformance = simWeight ? simPerformance / simWeight : 0;
  const simulationSignal = simulationPerformance * (1 - Math.exp(-exposure / 6));
  const score = Math.round(simulations.length ? .65 * skillScore + .35 * simulationSignal : skillScore);
  const skillEvidence = skills.reduce((sum, s) => sum + Math.min(1, s.n / 16), 0) / 8;
  const baselinePct = Math.round(100 * (.25 * Math.min(1, totalAnswers / 240) + .25 * skillEvidence + .2 * Math.min(1, sessions.length / 6) + .15 * Math.min(1, mediumAnswers / 120) + .15 * Math.min(1, fullSimulations / 2)));
  return { score, skills, rated: simulationBaseline || practiceBaseline, totalAnswers, mediumAnswers, fullSimulations, covered: skills.filter(s => s.n).length, sessionCount: sessions.length, baselinePct, skillScore: Math.round(skillScore), simulationPerformance: Math.round(simulationPerformance), simulationSignal: Math.round(simulationSignal), simulationCount: simulations.length };
}
