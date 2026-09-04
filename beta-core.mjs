export const BACKUP_VERSION = 1;
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;
const skills = ['add', 'sub', 'mul', 'div', 'decimals', 'fractions', 'percent', 'missing'];
const levels = ['easy', 'medium', 'hard', 'custom', 'sim'];
const fail = message => { throw new Error(message); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const text = (value, max = 500) => typeof value === 'string' && value.length <= max;
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));

function question(value, attempt = false) {
  if (!object(value) || !skills.includes(value.op) || !text(value.prompt) || !value.prompt.trim()) fail('A question in this backup is invalid.');
  if (value.answer === undefined && value.ans === undefined) fail('A saved question is missing its answer.');
  const out = { op: value.op, prompt: value.prompt };
  for (const key of ['answer', 'ans']) if (value[key] !== undefined) {
    if (!finite(value[key], -1e15, 1e15)) fail('A saved answer is invalid.');
    out[key] = value[key];
  }
  if (value.difficulty !== undefined) {
    if (!levels.includes(value.difficulty)) fail('A saved difficulty is invalid.');
    out.difficulty = value.difficulty;
  }
  for (const key of ['family', 'fractionForm']) if (value[key] != null) {
    if (!text(value[key], 100)) fail('Question details are invalid.');
    out[key] = value[key];
  }
  for (const [key, allowed] of [['format', ['fraction', 'number']], ['answerMode', ['typed', 'choice']]]) if (value[key] !== undefined) {
    if (!allowed.includes(value[key])) fail('A saved answer format is invalid.');
    out[key] = value[key];
  }
  if (value.choices !== undefined) {
    if (!Array.isArray(value.choices) || ![0, 4].includes(value.choices.length)) fail('Saved choices are invalid.');
    out.choices = value.choices.map(option => {
      if (!object(option) || !text(option.label, 100) || !finite(option.value, -1e15, 1e15)) fail('A saved choice is invalid.');
      return { label: option.label, value: option.value };
    });
  }
  if (attempt) {
    if (![true, false, null].includes(value.correct) || !finite(value.ms, 0, 604800000)) fail('A saved attempt is invalid.');
    if (value.input != null && !text(value.input, 1000) && !finite(value.input, -1e15, 1e15)) fail('A submitted answer is invalid.');
    out.correct = value.correct;
    out.skipped = value.correct === null;
    out.firstTry = value.correct === true && value.firstTry === true;
    out.input = value.input ?? null;
    out.ms = value.ms;
  }
  return out;
}

function session(value) {
  if (!object(value) || !text(value.id, 128) || !/^[A-Za-z0-9_-]+$/.test(value.id)) fail('A session identifier is invalid.');
  if (!['practice', '80in8'].includes(value.mode) || !date(value.startedAt) || !date(value.endedAt)) fail('A session date or mode is invalid.');
  if (Date.parse(value.endedAt) < Date.parse(value.startedAt) || !finite(value.durationSec, 0, 604800) || !finite(value.score, -80, 20000)) fail('A session result is invalid.');
  if (!Array.isArray(value.attempts) || value.attempts.length > (value.mode === '80in8' ? 80 : 20000)) fail('A session has too many attempts.');
  const config = {}, source = value.config ?? {};
  if (!object(source)) fail('A session configuration is invalid.');
  for (const [key, allowed] of [['answerMode', ['typed', 'choice']], ['diff', levels], ['op', [...skills, 'mixed', 'full']], ['mode', ['timed', 'untimed', '80in8']], ['endReason', ['time', 'complete']]]) if (source[key] !== undefined) {
    if (!allowed.includes(source[key])) fail('A session setting is invalid.');
    config[key] = source[key];
  }
  for (const key of ['blueprint', 'generator', 'scoring', 'release']) if (source[key] !== undefined) {
    if (!text(source[key], 150)) fail('A session version is invalid.');
    config[key] = source[key];
  }
  for (const key of ['hideLiveScore', 'allowSkip']) if (source[key] !== undefined) {
    if (typeof source[key] !== 'boolean') fail('A session toggle is invalid.');
    config[key] = source[key];
  }
  if (source.duration !== undefined) {
    if (!finite(source.duration, 0, 604800)) fail('A practice duration is invalid.');
    config.duration = source.duration;
  }
  if (source.range !== undefined) {
    if (!object(source.range)) fail('Custom ranges are invalid.');
    config.range = {};
    for (const key of ['aMin', 'aMax', 'bMin', 'bMax']) {
      if (!finite(source.range[key], -1e9, 1e9)) fail('Custom ranges are invalid.');
      config.range[key] = source.range[key];
    }
  }
  if (source.questions !== undefined) {
    if (value.mode !== '80in8' || !Array.isArray(source.questions) || source.questions.length !== 80) fail('A Hardcore review must contain all 80 questions.');
    config.questions = source.questions.map(q => question(q));
  }
  const attempts = value.attempts.map((a, index) => ({ ...question(a, true), index }));
  if (config.questions && attempts.some((a, i) => a.prompt !== config.questions[i].prompt || a.op !== config.questions[i].op)) fail('The questions and attempts do not match.');
  return { id: value.id, mode: value.mode, startedAt: value.startedAt, endedAt: value.endedAt, durationSec: value.durationSec, score: value.score, config, attempts };
}

export function createBackup(sessions, accountId = null, now = new Date()) {
  if (!Array.isArray(sessions) || sessions.length > 5000) fail('A backup can contain up to 5,000 sessions.');
  return { app: 'QuantRush', version: BACKUP_VERSION, exportedAt: now.toISOString(), accountId, sessions: sessions.map(session) };
}

export function parseBackup(raw, accountId = null) {
  if (typeof raw !== 'string' || new TextEncoder().encode(raw).byteLength > MAX_BACKUP_BYTES) fail('Choose a QuantRush backup smaller than 20 MB.');
  let data;
  try { data = JSON.parse(raw); } catch { fail('This file is not valid JSON. Choose a QuantRush progress backup.'); }
  if (!object(data) || data.app !== 'QuantRush' || data.version !== BACKUP_VERSION || !date(data.exportedAt)) fail('This backup format is not supported.');
  if (data.accountId != null && (!text(data.accountId, 128) || data.accountId !== accountId)) fail('Sign in to the account that exported this backup before importing it.');
  if (!Array.isArray(data.sessions) || data.sessions.length > 5000) fail('A backup can contain up to 5,000 sessions.');
  const clean = data.sessions.map(session), seen = new Set();
  return clean.filter(s => !seen.has(s.id) && seen.add(s.id));
}

export function mergeProgress(existing, incoming) {
  const byId = new Map(existing.map(s => [s.id, s]));
  for (const item of incoming) if (!byId.has(item.id)) byId.set(item.id, item);
  return [...byId.values()].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
}

export function runSettings(session) {
  const config = session.config || {};
  const format = ['typed', 'choice'].includes(config.answerMode) ? config.answerMode : 'unknown';
  // Before this toggle existed, skipping was available. Do not label legacy runs "off".
  const skipping = typeof config.allowSkip === 'boolean' ? (config.allowSkip ? 'on' : 'off') : 'unknown';
  const blueprint = config.blueprint || 'legacy';
  return { format, skipping, blueprint, key: JSON.stringify([format, skipping, blueprint]) };
}

export function cohortStats(sessions) {
  const groups = new Map();
  for (const run of [...sessions].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))) {
    const settings = runSettings(run);
    if (!groups.has(settings.key)) groups.set(settings.key, { ...settings, runs: [] });
    groups.get(settings.key).runs.push(run);
  }
  return [...groups.values()].map(group => {
    const scores = group.runs.map(run => (run.attempts || []).reduce((n, a) => n + (a.correct === true ? 1 : a.correct === false ? -1 : 0), 0));
    return { ...group, count: scores.length, best: Math.max(...scores), lastFive: Math.round(scores.slice(0, 5).reduce((sum, score) => sum + score, 0) / Math.min(5, scores.length)) };
  });
}

export function feedbackUrl(config) {
  try {
    const url = new URL(config.feedbackUrl);
    if (url.protocol !== 'https:' || url.username || url.password) return '';
    return (url.hostname === 'forms.gle' || url.hostname === 'docs.google.com' && url.pathname.startsWith('/forms/')) ? url.href : '';
  } catch { return ''; }
}

export function releaseBlockers(config) {
  const blockers = [];
  try { const url = new URL(config.productionUrl); if (url.protocol !== 'https:' || !url.hostname.endsWith('.pages.dev')) throw Error(); } catch { blockers.push('Cloudflare production address is not configured.'); }
  if (!feedbackUrl(config) || !config.feedbackPrivacyVerified) blockers.push('The private-response feedback form is not verified.');
  if (!config.turnstileSiteKey || /^1x|^2x|^3x/.test(config.turnstileSiteKey)) blockers.push('A production Turnstile site key is required.');
  if (!config.emailDeliveryVerified) blockers.push('Public confirmation and recovery email delivery is not verified.');
  if (!config.realAccountChecksPassed) blockers.push('Real account and cross-device checks are pending.');
  if (!config.deviceChecksPassed) blockers.push('Samsung and iPad device checks are pending.');
  return blockers;
}

export function authCallbackInfo(href) {
  const url = new URL(href), hash = new URLSearchParams(url.hash.slice(1));
  const error = hash.get('error_code') || url.searchParams.get('error_code') || hash.get('error') || url.searchParams.get('error');
  return { recovery: hash.get('type') === 'recovery' || url.searchParams.get('auth') === 'recovery', callback: hash.has('access_token') || url.searchParams.has('code') || !!error, error: error ? 'This email link has expired, was already used, or is invalid. Request a new link below.' : '' };
}

export function authErrorMessage(error) {
  if (error?.status === 429 || /rate.limit|too many|after \d+ seconds/i.test(error?.message || '')) return 'Too many requests. Please wait a minute before trying again.';
  if (/email.*not.*authorized|smtp|sending.*email|email.*send/i.test(error?.message || '')) return 'Account email delivery is unavailable. Please try again later. Your saved progress is unchanged.';
  if (error?.code === 'email_not_confirmed') return 'Confirm your email first, or request a new confirmation link.';
  if (/invalid.login|invalid.credentials/i.test(error?.message || '')) return 'Email or password is incorrect.';
  if (/fetch|network|offline/i.test(error?.message || '')) return 'Could not connect. Check your connection and try again.';
  return error?.message || 'Something went wrong. Please try again.';
}
