/* Gerado por scripts/montar-demo-coworking.mjs — nao editar a mao.
   "Servidor" da demo no navegador: o gerador do --demo do coworking-agents
   (MIT, Lucas Chacon) responde ao EventSource e aos fetch da pagina. */
(function () {
  var process = window.process = window.process || { env: {} };
  process.env = process.env || {};
  process.kill = function () { throw Object.assign(new Error('demo'), { code: 'ESRCH' }); };
  var modulos = {
'./util': function (module, exports, require) {
'use strict';
// Pieces shared by the sources: git, incremental JSONL reading, small formatters.

const fs = require('fs');
const path = require('path');

const FIRST_READ_MAX = 24 * 1024 * 1024; // huge transcript: start from the end
const PARTIAL_MAX = 1024 * 1024;          // a line with no end (odd file) is dropped
const STATE_IDLE_MS = 26 * 3600 * 1000;   // state of a file unread this long is evicted

function safeJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function alive(pid) {
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

// commands may carry secrets (TOKEN=..., --password x, Bearer ...): mask them before showing
const SECRET = /((?:token|secret|passw(?:or)?d|api[_-]?key|auth|bearer|credential)[\w-]*\s*[=:\s]\s*)("[^"]*"|'[^']*'|\S+)/gi;
function short(s, n = 48) {
  s = String(s || '').replace(/\s+/g, ' ').trim().replace(/(bearer\s+)\S+/gi, '$1•••').replace(SECRET, (m, k, v) => v === '•••' ? m : k + '•••');
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

const repoCache = new Map();
function resolveRepo(dir) {
  if (!dir || typeof dir !== 'string') return null;
  const hit = repoCache.get(dir);
  if (hit && Date.now() - hit.at < 30000) return hit.v;
  let v = null, cur = dir;
  for (let i = 0; i < 40 && cur; i++) {
    const g = path.join(cur, '.git');
    let st = null;
    try { st = fs.statSync(g); } catch {}
    if (st) {
      let common = g;
      if (st.isFile()) {
        // worktree: .git is a file pointing at the gitdir; commondir leads to the main repo
        let txt = '';
        try { txt = fs.readFileSync(g, 'utf8'); } catch {} // unreadable .git (another user): skip instead of crashing
        const m = /gitdir:\s*(.+)/.exec(txt);
        if (m) {
          const gitdir = path.resolve(cur, m[1].trim());
          let cd = null;
          try { cd = fs.readFileSync(path.join(gitdir, 'commondir'), 'utf8').trim(); } catch {}
          common = cd ? path.resolve(gitdir, cd) : gitdir;
        }
      }
      const main = path.basename(common) === '.git' ? path.dirname(common) : common;
      v = { worktree: cur, repo: main, name: path.basename(main), isWorktree: st.isFile() };
      break;
    }
    const up = path.dirname(cur);
    if (up === cur) break;
    cur = up;
  }
  repoCache.set(dir, { at: Date.now(), v });
  return v;
}

// Reads only what was appended since last time; `absorb(state, obj)` accumulates.
function incremental(newState, absorb) {
  const states = new Map();
  let lastSweep = Date.now();
  return function read(file) {
    const now = Date.now();
    if (now - lastSweep > 3600 * 1000) { lastSweep = now; for (const [f, s] of states) if (now - s.seen > STATE_IDLE_MS) states.delete(f); }
    let st = states.get(file), stat;
    try { stat = fs.statSync(file); } catch { return null; }
    if (!st || stat.size < st.offset) { st = Object.assign(newState(), { offset: 0, partial: '', mtime: 0 }); states.set(file, st); }
    st.mtime = stat.mtimeMs; st.seen = now;
    if (stat.size === st.offset) return st;
    let start = st.offset;
    // first read or a huge jump: read only the tail (the rest no longer matters to the screen)
    if (stat.size - start > FIRST_READ_MAX) { start = stat.size - FIRST_READ_MAX; st.partial = ''; st.skipFirst = true; }
    const fd = fs.openSync(file, 'r');
    try {
      const len = stat.size - start, buf = Buffer.alloc(len);
      fs.readSync(fd, buf, 0, len, start);
      let text = st.partial + buf.toString('utf8');
      if (st.skipFirst) { text = text.slice(text.indexOf('\n') + 1); st.skipFirst = false; }
      const lines = text.split('\n');
      st.partial = lines.pop();
      if (st.partial.length > PARTIAL_MAX) st.partial = '';
      for (const line of lines) {
        if (!line) continue;
        try { absorb(st, JSON.parse(line)); } catch {}
      }
      st.offset = stat.size;
    } finally { fs.closeSync(fd); }
    return st;
  };
}

// Most recent pending call (the tool running right now).
function newest(pending) {
  let best = null;
  for (const v of pending.values()) if (!best || v.ts > best.ts) best = v;
  return best;
}

function track(st, item, filePath) {
  st.pending.set(item.id, item);
  st.recent.push(item);
  if (st.recent.length > 12) st.recent.shift();
  st.tools[item.name] = (st.tools[item.name] || 0) + 1;
  event(st, item.ts, item.kind);
  if (filePath && item.kind === 'edit') {
    st.files.set(filePath, item.ts);
    const r = resolveRepo(path.dirname(filePath));
    if (r) st.edits.set(r.worktree, { at: item.ts, repo: r });
  }
}

// Timeline: every tool call, every message of yours and every turn end becomes a timestamped marker.
const EVENTS_MAX = 6000, EVENTS_AGE = 26 * 3600 * 1000;
function event(st, ts, kind) {
  if (!ts) return;
  const ev = st.events;
  const last = ev[ev.length - 1];
  if (last && last.kind === kind && ts - last.ts < 1000) return;
  ev.push({ ts, kind });
  if (ev.length > EVENTS_MAX || ts - ev[0].ts > EVENTS_AGE) {
    const cut = ev.findIndex(e => ts - e.ts <= EVENTS_AGE);
    ev.splice(0, Math.max(cut, ev.length - EVENTS_MAX));
  }
}

function dayKey(ts) { const d = new Date(ts); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
function addTokens(st, ts, n) { if (ts && n) { const k = dayKey(ts); st.outByDay[k] = (st.outByDay[k] || 0) + n; } }

function baseState() {
  // prototype-less counters: tool names from the transcript ("constructor", "__proto__") can't collide
  const bag = () => Object.create(null);
  return { title: '', cwd: '', branch: '', model: '', ctx: 0, ctxMax: 0, lastTs: 0, pending: new Map(), recent: [], tools: bag(), skills: bag(), mcps: bag(), edits: new Map(), turns: 0, events: [], files: new Map(), outByDay: bag(), usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cacheWrite1h: 0 }, cost: 0, costUnpriced: false, limits: null };
}

module.exports = { safeJson, alive, short, resolveRepo, incremental, newest, track, baseState, event, addTokens, dayKey };

},
'./prices': function (module, exports, require) {
'use strict';
// Estimated cost in USD from measured tokens. Prices are the public API list prices (per 1M tokens),
// copied from the official pages on 2026-10-09:
//   https://platform.claude.com/docs/en/about-claude/pricing
//   https://developers.openai.com/api/docs/pricing
// A model missing here has no price (shown as such, never guessed). Override or add models in
// ~/.config/coworking-agents/prices.json: { "opus-5-5": { "in": 4, "out": 20, "cacheRead": 0.2, "cacheWrite": 5 } }
// Simplifications, stated in the UI: cache writes use the 5-minute rate unless the 1-hour split is known,
// and models with long-context tiers (Haiku 5.5 over 100k, GPT-5.x over 272k) use their short-context rate.

const os = require('os');
const path = require('path');
const { safeJson } = require('./util');

const PRICES = {
  // Claude: in, 5m cache write, 1h cache write, cache read, out
  'fable-5-1': { in: 10, cacheWrite: 12.5, cacheWrite1h: 20, cacheRead: 0.25, out: 50 },
  'mythos-5-1': { in: 10, cacheWrite: 12.5, cacheWrite1h: 20, cacheRead: 0.25, out: 50 },
  'fable-5': { in: 10, cacheWrite: 12.5, cacheWrite1h: 20, cacheRead: 1, out: 50 },
  'mythos-5': { in: 10, cacheWrite: 12.5, cacheWrite1h: 20, cacheRead: 1, out: 50 },
  'opus-5-5': { in: 4, cacheWrite: 5, cacheWrite1h: 8, cacheRead: 0.2, out: 20 },
  'opus-5': { in: 5, cacheWrite: 6.25, cacheWrite1h: 10, cacheRead: 0.5, out: 25 },
  'opus-4-8': { in: 5, cacheWrite: 6.25, cacheWrite1h: 10, cacheRead: 0.5, out: 25 },
  'opus-4-7': { in: 5, cacheWrite: 6.25, cacheWrite1h: 10, cacheRead: 0.5, out: 25 },
  'opus-4-6': { in: 5, cacheWrite: 6.25, cacheWrite1h: 10, cacheRead: 0.5, out: 25 },
  'opus-4-5': { in: 5, cacheWrite: 6.25, cacheWrite1h: 10, cacheRead: 0.5, out: 25 },
  'opus-4-1': { in: 15, cacheWrite: 18.75, cacheWrite1h: 30, cacheRead: 1.5, out: 75 },
  'opus-4': { in: 15, cacheWrite: 18.75, cacheWrite1h: 30, cacheRead: 1.5, out: 75 },
  'sonnet-5-5': { in: 2, cacheWrite: 2.5, cacheWrite1h: 4, cacheRead: 0.1, out: 10 },
  'sonnet-5': { in: 2, cacheWrite: 2.5, cacheWrite1h: 4, cacheRead: 0.2, out: 10 },
  'sonnet-4-6': { in: 3, cacheWrite: 3.75, cacheWrite1h: 6, cacheRead: 0.3, out: 15 },
  'sonnet-4-5': { in: 3, cacheWrite: 3.75, cacheWrite1h: 6, cacheRead: 0.3, out: 15 },
  'sonnet-4': { in: 3, cacheWrite: 3.75, cacheWrite1h: 6, cacheRead: 0.3, out: 15 },
  'haiku-5-5': { in: 0.1, cacheWrite: 0.125, cacheWrite1h: 0.2, cacheRead: 0.01, out: 0.5 },
  'haiku-4-5': { in: 1, cacheWrite: 1.25, cacheWrite1h: 2, cacheRead: 0.1, out: 5 },
  'haiku-3-5': { in: 0.8, cacheWrite: 1, cacheWrite1h: 1.6, cacheRead: 0.08, out: 4 },
  // OpenAI (standard tier, short context): in, cached in, out
  'gpt-6-astra': { in: 10, cacheRead: 1, out: 50 },
  'gpt-6.1-sol': { in: 2, cacheRead: 0.1, out: 10 },
  'gpt-6-sol': { in: 2, cacheRead: 0.2, out: 10 },
  'gpt-6-luna': { in: 0.1, cacheRead: 0.01, out: 0.5 },
  'gpt-5.6-sol': { in: 4, cacheRead: 0.4, out: 20 },
  'gpt-5.6-terra': { in: 2, cacheRead: 0.2, out: 12 },
  'gpt-5.6-luna': { in: 0.2, cacheRead: 0.02, out: 1.2 },
  'gpt-5.5': { in: 5, cacheRead: 0.5, out: 30 },
  'gpt-5.4': { in: 2.5, cacheRead: 0.25, out: 15 },
  'gpt-5.4-mini': { in: 0.75, cacheRead: 0.075, out: 4.5 },
  'gpt-5.4-nano': { in: 0.2, cacheRead: 0.02, out: 1.25 },
  'gpt-5.3-codex': { in: 1.75, cacheRead: 0.175, out: 14 },
  'gpt-5.2': { in: 1.75, cacheRead: 0.175, out: 14 },
  'gpt-5.1': { in: 1.25, cacheRead: 0.125, out: 10 },
  'gpt-5': { in: 1.25, cacheRead: 0.125, out: 10 },
  'gpt-5-mini': { in: 0.25, cacheRead: 0.025, out: 2 },
  'gpt-5-nano': { in: 0.05, cacheRead: 0.005, out: 0.4 },
};

// "claude-opus-5-5-20260922" → "opus-5-5"; "claude-opus-5-5[1m]" → "opus-5-5"; "gpt-5.5" stays
function modelKey(model) {
  return String(model || '').toLowerCase().replace(/\[.*?\]/g, '').replace(/^claude-/, '').replace(/-\d{8}$/, '').trim();
}

let extra = { at: 0, table: {} };
function table() {
  if (Date.now() - extra.at > 30000) {
    const d = safeJson(path.join(os.homedir(), '.config', 'coworking-agents', 'prices.json'));
    extra = { at: Date.now(), table: d && typeof d === 'object' && !Array.isArray(d) ? d : {} };
  }
  return { ...PRICES, ...extra.table };
}

function priceOf(model) {
  const p = table()[modelKey(model)];
  return p && Number(p.in) >= 0 && Number(p.out) >= 0 ? p : null;
}

// usage = { input, output, cacheRead, cacheWrite, cacheWrite1h? } in tokens → USD, or null when unpriced
function costOf(model, u) {
  const p = priceOf(model);
  if (!p || !u) return null;
  const w1h = Math.min(u.cacheWrite1h || 0, u.cacheWrite || 0), w5m = (u.cacheWrite || 0) - w1h;
  const n = x => Number(x) || 0;
  return (n(u.input) * n(p.in) + n(u.output) * n(p.out) + n(u.cacheRead) * n(p.cacheRead ?? p.in)
    + w5m * n(p.cacheWrite ?? p.in) + w1h * n(p.cacheWrite1h ?? p.cacheWrite ?? p.in)) / 1e6;
}

module.exports = { costOf, priceOf, modelKey, PRICES };

},
'./demo': function (module, exports, require) {
'use strict';
const { costOf } = require('./prices');
// Fake office for `--demo`: shows every state without needing real sessions.

const STATES = ['edit', 'terminal', 'needs_you', 'read', 'web', 'delegate', 'idle', 'waiting', 'thinking', 'asleep'];
const TITLES = ['Refactor checkout flow', 'Fix flaky CI test', 'Migrate auth to OAuth', 'Write release notes', 'Investigate slow query', 'Add dark mode', 'Port profile page', 'Review PR #482', 'Bump dependencies', 'Explain the codebase'];
const REPOS = ['web-app', 'web-app', 'api', 'docs', 'api', 'design-system', 'mobile', 'web-app', 'infra', 'api'];
const WHAT = { edit: 'Checkout.tsx', terminal: 'Run test suite', read: 'schema.sql', web: 'developer.mozilla.org', delegate: 'Map all call sites', needs_you: '', waiting: 'npm run build', thinking: '' };
const TOOL = { edit: 'Edit', terminal: 'Bash', read: 'Read', web: 'WebFetch', delegate: 'Agent', needs_you: 'AskUserQuestion', waiting: 'Bash' };

function demoSnapshot() {
  const COUNT = Math.max(1, Math.min(500, Number(process.env.COWORKING_DEMO_COUNT) || 10)); // read per call: `--demo N` sets it after require
  const now = Date.now();
  // a living demo: each fake agent moves to its next state on its own rhythm (9–21s), so requests
  // arrive, people walk to the lounge and back, answered ones play the happy exit — no real sessions, no tokens
  const live = process.env.COWORKING_DEMO_STATIC !== '1';
  const people = Array.from({ length: COUNT }, (_, i) => {
    if (!live) return { state: STATES[i % STATES.length], since: 0, i };
    const period = 9000 + (i * 2371) % 12000, step = Math.floor((now + i * 1337) / period);
    return { state: STATES[(i + step) % STATES.length], since: step * period - i * 1337, i };
  }).map(({ state, since: stepStart }, i) => {
    const busy = !['idle', 'asleep'].includes(state);
    const forMs = stepStart ? now - stepStart : state === 'waiting' ? 42000 : 3000;
    const doing = TOOL[state] ? { tool: TOOL[state], what: WHAT[state] || '', kind: state === 'needs_you' ? 'ask' : state === 'waiting' ? 'terminal' : state, for: forMs } : null;
    const agent = [1, 4, 8].includes(i) ? 'codex' : 'claude';
    return {
      agent, ctxMax: agent === 'codex' ? 258400 : 1e6,
      id: `demo-${i}-${TITLES[i % TITLES.length]}`, name: ['ada', 'grace', 'linus', 'alan', 'margaret', 'ken', 'barbara', 'dennis', 'radia', 'guido'][i % 10] + (i >= 10 ? '-' + ((i / 10) | 0) : ''),
      pid: 1000 + i, kind: 'interactive', entrypoint: 'cli', version: 'demo', status: busy ? 'busy' : 'idle', state,
      since: stepStart || now - (state === 'asleep' ? 3 * 36e5 : 4 * 6e4), startedAt: now - (i + 1) * 3.1 * 36e5,
      title: TITLES[i % TITLES.length], cwd: `/home/dev/${REPOS[i % REPOS.length]}`, branch: i % 3 ? 'main' : `feat/${REPOS[i % REPOS.length]}-${i}`,
      repo: { name: REPOS[i % REPOS.length], path: `/home/dev/${REPOS[i % REPOS.length]}`, worktree: `/home/dev/${REPOS[i % REPOS.length]}`, isWorktree: false },
      model: agent === 'codex' ? 'gpt-5.5' : 'claude-opus-5-5', ctx: [42e3, 180e3, 810e3, 95e3, 320e3, 150e3, 88e3, 240e3, 30e3, 12e3][i % 10], turns: [12, 64, 30, 8, 51, 22, 5, 70, 3, 1][i % 10],
      git: [{ dirty: 3, ahead: 2, behind: 0, upstream: true }, null, { dirty: 0, ahead: 0, behind: 1, upstream: true }, { dirty: 12, ahead: 0, behind: 0, upstream: false }][i % 4],
      usage: { input: 4e4 * (i + 1), output: 9e4 * (i + 2), cacheRead: 6e6 * (i + 1), cacheWrite: 4e5 * (i + 1) },
      doing, recent: doing ? [{ tool: doing.tool, what: doing.what, kind: doing.kind, ts: now - 3000 }, { tool: 'Read', what: 'README.md', kind: 'read', ts: now - 60000 }] : [],
      skills: i === 0 ? { 'frontend-design': 3, simplify: 1 } : i === 4 ? { 'web-research': 2 } : i === 2 ? { 'code-review': 1 } : {},
      mcps: i === 4 ? { playwright: 6 } : i === 1 ? { github: 4 } : {},
      tools: { Bash: [20, 120, 8, 4, 30, 10, 3, 60, 1, 0][i % 10], Edit: [80, 12, 40, 2, 5, 9, 0, 20, 0, 0][i % 10], WebSearch: i === 4 ? 3 : 0, Agent: i === 5 ? 3 : 0 },
      editing: i === 0 || i === 7 ? [{ worktree: '/home/dev/web-app', repo: 'web-app', at: now - 60000 }] : [],
      subagents: state === 'delegate' ? [
        { id: 'a1', type: 'Explore', description: 'Map all call sites', state: 'read', doing: 'Grep useCart' },
        { id: 'a2', type: 'Explore', description: 'Find tests', state: 'terminal', doing: 'Run vitest' },
        { id: 'a3', type: 'Plan', description: 'Plan migration', state: 'thinking', doing: '' },
      ] : [],
      lastActivity: now - 2000,
    };
  });
  // every 30s someone new joins (fresh id, so the office builds a desk and they walk in with their computer)
  if (live) {
    const cycle = Math.floor(now / 30000);
    if (cycle % 2) {
      const base = people[0];
      people.push({ ...base, id: `demo-new-${cycle}`, name: 'newbie-' + (cycle % 100), title: 'Just joined: set up the project', state: 'edit', status: 'busy',
        repo: { name: 'new-service', path: '/home/dev/new-service', worktree: '/home/dev/new-service', isWorktree: false }, cwd: '/home/dev/new-service',
        startedAt: cycle * 30000, since: cycle * 30000, subagents: [], editing: [], files: [], skills: {}, mcps: {}, tools: { Edit: 1 },
        doing: { tool: 'Edit', what: 'package.json', kind: 'edit', for: now - cycle * 30000 } });
    }
  }
  for (const p of people) if (p.usage && !p.cost) p.cost = { usd: costOf(p.model, p.usage) || 0, partial: false };
  return {
    now, host: 'demo', people,
    clashes: [{ worktree: '/home/dev/web-app', repo: 'web-app', who: [people[0].id, people[7].id] }],
    agents: [{ id: 'claude', label: 'Claude Code', sessions: 7 }, { id: 'codex', label: 'Codex', sessions: 3 }],
    credentials: {
      claude: {
        topSkills: [{ name: 'frontend-design', count: 41 }, { name: 'code-review', count: 17 }, { name: 'simplify', count: 9 }],
        skills: ['frontend-design', 'code-review', 'simplify', 'web-research'], mcps: ['playwright', 'github'],
        plugins: [{ name: 'code-review', count: 17 }],
      },
      codex: { topSkills: [], skills: ['imagegen', 'openai-docs', 'skill-creator'], mcps: [], plugins: [] },
    },
  };
}

function demoReport() {
  const now = Date.now(), d = new Date(now), since = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const rows = demoSnapshot().people.map((p, i) => ({ agent: p.agent, id: p.id, name: p.name, live: true, title: p.title, repo: p.repo.name, activeMs: (10 - (i % 10)) * 23 * 60000, tools: 40 + i * 7, turns: 3 + i, files: i % 6, outTokens: 20000 + i * 3100 }));
  const sum = k => rows.reduce((a, r) => a + r[k], 0);
  return { since, now, rows, topFiles: [{ repo: 'web-app', rel: 'src/Checkout.tsx', n: 2 }, { repo: 'api', rel: 'auth/oauth.ts', n: 1 }], totals: { sessions: rows.length, activeMs: sum('activeMs'), tools: sum('tools'), files: 9, outTokens: sum('outTokens'), turns: sum('turns') } };
}

function demoUsage() {
  const byDay = {}, now = Date.now();
  for (let i = 0; i < 14; i++) { const d = new Date(now - i * 864e5), k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); byDay[k] = { input: 2e4, output: 4e5 + (i * 7919) % 9e5, cacheRead: 3e8, cacheWrite: 2e6 }; }
  const agent = (k, models) => ({ sessions: 40, total: { input: 3e5, output: 9e6 * k, cacheRead: 6e9 * k, cacheWrite: 5e7 * k }, byDay, byModel: Object.fromEntries(models.map((m, i) => [m, { input: 1e5, output: 3e6 / (i + 1), cacheRead: 2e9, cacheWrite: 1e7 }])) });
  const byAgent = { claude: agent(1, ['claude-opus-5-5', 'claude-sonnet-5']), codex: agent(.2, ['gpt-5.5']) };
  for (const o of Object.values(byAgent)) {
    o.costByModel = Object.fromEntries(Object.entries(o.byModel).map(([m, u]) => [m, costOf(m, u)]));
    o.cost = { usd: Object.values(o.costByModel).reduce((a, b) => a + b, 0), unpricedModels: [] };
  }
  const days = {};
  for (let i = 0; i < 40; i++) {
    const d = new Date(now - i * 864e5), k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const first = new Date(d.getFullYear(), d.getMonth(), d.getDate(), i % 9 === 0 ? 2 : 9).getTime();
    if (i % 11 !== 10) days[k] = { tools: 300 + (i * 97) % 900, activeMs: (3 + (i * 7) % 9) * 36e5, sessions: 4, agents: i % 3 ? ['claude'] : ['claude', 'codex'], first, last: first + 8 * 36e5, output: 4e5 };
  }
  const ppl = demoSnapshot().people;
  const top = ppl.slice(0, 5).map((p, i) => ({ id: p.id, agent: p.agent, title: p.title, activeMs: (40 - i * 7) * 36e5, tools: 2400 - i * 380, output: 3e6 - i * 4e5, last: now }));
  return { scanning: false, scannedAt: now, byAgent, days, month: { key: Object.keys(days)[0].slice(0, 7), top } };
}

module.exports = { demoSnapshot, demoReport, demoUsage };

}
  };
  var falsos = {
    fs: { readFileSync: function () { throw new Error('demo'); }, existsSync: function () { return false; }, statSync: function () { throw new Error('demo'); }, readdirSync: function () { return []; } },
    path: { join: function () { return Array.prototype.join.call(arguments, '/'); }, dirname: function (p) { return p; }, basename: function (p) { return p; }, resolve: function (p) { return p; }, sep: '/' },
    os: { homedir: function () { return '/demo'; }, tmpdir: function () { return '/tmp'; }, platform: function () { return 'demo'; } },
    child_process: {}
  };
  var cache = {};
  function req(nome) {
    if (falsos[nome]) return falsos[nome];
    if (cache[nome]) return cache[nome].exports;
    var m = { exports: {} }; cache[nome] = m; modulos[nome](m, m.exports, req); return m.exports;
  }
  var demo = req('./demo');
  var progresso = {};
  function resposta(corpo) { return Promise.resolve(new Response(JSON.stringify(corpo), { headers: { 'Content-Type': 'application/json' } })); }
  var fetchOriginal = window.fetch.bind(window);
  window.fetch = function (url, opc) {
    var u = String(url).replace(/^\//, '');
    var metodo = (opc && opc.method) || 'GET';
    if (u.indexOf('api/') !== 0) return fetchOriginal(url, opc);
    var rota = u.split('?')[0];
    if (rota === 'api/usage') return resposta(demo.demoUsage());
    if (rota === 'api/report') return resposta(demo.demoReport());
    if (rota === 'api/state') return resposta(Object.assign(demo.demoSnapshot({ privacy: false }), { update: null }));
    if (rota === 'api/ping') return resposta({ ok: true });
    if (rota === 'api/progress') {
      if (metodo === 'POST') { try { progresso = JSON.parse(opc.body) || progresso; } catch (e) { /* */ } return resposta({ ok: true }); }
      return resposta(progresso);
    }
    return resposta({ ok: false, reason: 'demo' });   // focus, reply, answer, compact: so existem com sessoes de verdade
  };
  // o "SSE": um retrato novo por segundo, como o servidor faz
  function EventSourceDemo() {
    var es = this; es.readyState = 1; es.url = 'events';
    function manda() { var ev = { data: JSON.stringify(Object.assign(demo.demoSnapshot({ privacy: false }), { update: null })) }; if (es.onmessage) es.onmessage(ev); }
    setTimeout(manda, 30); es._iv = setInterval(manda, 1000);
  }
  EventSourceDemo.prototype.close = function () { clearInterval(this._iv); this.readyState = 2; };
  EventSourceDemo.prototype.addEventListener = function () {};
  window.EventSource = EventSourceDemo;
  // o clima pede a localizacao do navegador: numa demo embutida isso viraria um pedido de permissao para quem visita
  try { Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition: function (ok, erro) { if (erro) erro({ code: 1, message: 'demo' }); }, watchPosition: function () { return 0; }, clearWatch: function () {} }, configurable: true }); } catch (e) { /* */ }
})();
