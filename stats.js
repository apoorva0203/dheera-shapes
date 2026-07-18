// Analytics collection. Data-only — no UI. Loaded before app.js so its hooks
// are available at boot. All public methods are try/catch wrapped internally
// so instrumentation can never crash the game.
//
// Storage:
//   localStorage — fast aggregates for chip/streak display
//   IndexedDB    — per-puzzle event log + session records (for stats page)
//
// Public API (attached to window.Stats):
//   recordPuzzleStart({level, targetId, tier}) → ctx
//   recordWrongDrop(ctx, wrongId)
//   recordNudge(ctx)
//   recordCorrect(ctx)
//   recordFirstCompletion()
//   getAggregates() → { session_count, total_puzzles, puzzles_today, streak_days, ... }
//   getEvents({limit, sinceTs}) → Promise<event[]>
//   getSessions({limit}) → Promise<session[]>

(() => {
  'use strict';

  const DB_NAME = 'dheera-stats';
  const DB_VERSION = 2;
  const STORE_EVENTS = 'events';
  const STORE_SESSIONS = 'sessions';
  const STORE_MILESTONES = 'milestones';

  // Session ends after this much inactivity. On next puzzle we open a fresh
  // session row.
  const SESSION_IDLE_MS = 30 * 60 * 1000;

  let dbPromise = null;
  let currentSessionId = null;   // IDB sessions.id (ts of session start)
  let currentSessionTopLevel = 0;
  let currentSessionPuzzles = 0;

  // ------- IndexedDB wiring -------

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE_EVENTS)) {
            const events = db.createObjectStore(STORE_EVENTS, { keyPath: 'ts' });
            events.createIndex('by_level', 'level');
            events.createIndex('by_target', 'targetId');
          }
          if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
            db.createObjectStore(STORE_SESSIONS, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(STORE_MILESTONES)) {
            db.createObjectStore(STORE_MILESTONES, { keyPath: 'ts' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
    return dbPromise;
  }

  function txStore(storeName, mode) {
    return openDB().then((db) => db.transaction(storeName, mode).objectStore(storeName));
  }

  async function idbPut(storeName, value) {
    try {
      const store = await txStore(storeName, 'readwrite');
      return new Promise((resolve, reject) => {
        const req = store.put(value);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch { /* ignore */ }
  }

  async function idbGetAll(storeName) {
    try {
      const store = await txStore(storeName, 'readonly');
      return new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return [];
    }
  }

  // ------- localStorage aggregates -------

  function todayKey(ts = Date.now()) {
    const d = new Date(ts);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  function lsGet(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return fallback;
      if (typeof fallback === 'number') return Number(raw) || fallback;
      if (typeof fallback === 'object') return JSON.parse(raw);
      return raw;
    } catch {
      return fallback;
    }
  }

  function lsSet(key, value) {
    try {
      const payload = typeof value === 'object' ? JSON.stringify(value) : String(value);
      localStorage.setItem(key, payload);
    } catch { /* ignore */ }
  }

  function bumpAggregate(key, delta = 1) {
    lsSet(key, lsGet(key, 0) + delta);
  }

  function tickTodayCounter() {
    const today = todayKey();
    const stored = lsGet('stats.today_key', '');
    if (stored !== today) {
      lsSet('stats.today_key', today);
      lsSet('stats.puzzles_today', 0);
    }
    bumpAggregate('stats.puzzles_today');
  }

  // Streak = consecutive days played. Bumped when today > last_streak_day by
  // exactly 1 day; reset to 1 when the gap is larger; unchanged when same day.
  function tickStreak() {
    const today = todayKey();
    const last = lsGet('stats.streak_last_day', '');
    if (last === today) return;
    if (!last) {
      lsSet('stats.streak_days', 1);
      lsSet('stats.streak_last_day', today);
      return;
    }
    const oneDay = 24 * 60 * 60 * 1000;
    const diff = Math.round((new Date(today) - new Date(last)) / oneDay);
    if (diff === 1) {
      bumpAggregate('stats.streak_days');
    } else {
      lsSet('stats.streak_days', 1);
    }
    lsSet('stats.streak_last_day', today);
  }

  // ------- session tracking -------

  function ensureSession(level) {
    const now = Date.now();
    const lastActivity = lsGet('stats.last_activity_ts', 0);
    if (!currentSessionId || (now - lastActivity) > SESSION_IDLE_MS) {
      currentSessionId = now;
      currentSessionTopLevel = level;
      currentSessionPuzzles = 0;
      bumpAggregate('stats.session_count');
    }
    return currentSessionId;
  }

  function updateSession(level) {
    if (!currentSessionId) return;
    currentSessionTopLevel = Math.max(currentSessionTopLevel, level);
    currentSessionPuzzles += 1;
    const record = {
      id: currentSessionId,
      startTs: currentSessionId,
      endTs: Date.now(),
      puzzlesSolved: currentSessionPuzzles,
      topLevel: currentSessionTopLevel,
    };
    idbPut(STORE_SESSIONS, record);
  }

  // ------- public API -------

  const Stats = {
    recordPuzzleStart(info) {
      try {
        return {
          startTs: Date.now(),
          level: info?.level ?? 0,
          targetId: info?.targetId ?? '',
          tier: info?.tier ?? '',
          wrongDrops: [],
          nudgeFired: false,
        };
      } catch {
        return null;
      }
    },

    recordWrongDrop(ctx, wrongId) {
      try {
        if (!ctx || !wrongId) return;
        ctx.wrongDrops.push(wrongId);
        bumpAggregate('stats.total_wrong_drops');
        const map = lsGet('stats.per_item_wrong', {});
        // Key = "shown→dropped" so we can tell which decoys are actually confusing.
        const key = `${ctx.targetId}>${wrongId}`;
        map[key] = (map[key] || 0) + 1;
        lsSet('stats.per_item_wrong', map);
      } catch { /* ignore */ }
    },

    recordNudge(ctx) {
      try {
        if (!ctx) return;
        ctx.nudgeFired = true;
        bumpAggregate('stats.total_nudges');
      } catch { /* ignore */ }
    },

    recordCorrect(ctx) {
      try {
        if (!ctx) return;
        const ts = Date.now();
        const event = {
          ts,
          level: ctx.level,
          targetId: ctx.targetId,
          tier: ctx.tier,
          wrongDrops: ctx.wrongDrops.slice(),
          msToSolve: ts - ctx.startTs,
          nudgeFired: ctx.nudgeFired,
        };
        idbPut(STORE_EVENTS, event);
        bumpAggregate('stats.total_puzzles');
        tickTodayCounter();
        tickStreak();
        lsSet('stats.last_activity_ts', ts);
        ensureSession(ctx.level);
        updateSession(ctx.level);
      } catch { /* ignore */ }
    },

    recordFirstCompletion() {
      try {
        lsSet('stats.first_completion_ts', Date.now());
      } catch { /* ignore */ }
    },

    getAggregates() {
      try {
        return {
          session_count: lsGet('stats.session_count', 0),
          total_puzzles: lsGet('stats.total_puzzles', 0),
          total_wrong_drops: lsGet('stats.total_wrong_drops', 0),
          total_nudges: lsGet('stats.total_nudges', 0),
          puzzles_today: lsGet('stats.puzzles_today', 0),
          today_key: lsGet('stats.today_key', ''),
          streak_days: lsGet('stats.streak_days', 0),
          streak_last_day: lsGet('stats.streak_last_day', ''),
          first_completion_ts: lsGet('stats.first_completion_ts', 0),
          per_item_wrong: lsGet('stats.per_item_wrong', {}),
        };
      } catch {
        return {};
      }
    },

    async getEvents({ limit = 5000, sinceTs = 0 } = {}) {
      try {
        const all = await idbGetAll(STORE_EVENTS);
        const filtered = sinceTs ? all.filter((e) => e.ts >= sinceTs) : all;
        return filtered.slice(-limit);
      } catch {
        return [];
      }
    },

    async getSessions({ limit = 100 } = {}) {
      try {
        const all = await idbGetAll(STORE_SESSIONS);
        return all.slice(-limit).reverse();
      } catch {
        return [];
      }
    },

    async getMilestones() {
      try {
        const all = await idbGetAll(STORE_MILESTONES);
        return all.sort((a, b) => b.ts - a.ts);
      } catch {
        return [];
      }
    },

    // Freezes the current stats page as a self-contained HTML string + writes
    // a copy to the milestone archive. Returns the HTML for the caller to
    // trigger a download.
    async saveMilestone({ id = 'match-mode-complete', version = 1, label = 'Match Mode Complete' } = {}) {
      try {
        const html = await buildMilestoneHtml({ id, version, label });
        const ts = Date.now();
        await idbPut(STORE_MILESTONES, { ts, id, version, label, html });
        return { ts, id, version, label, html };
      } catch {
        return null;
      }
    },

    async buildMilestoneHtml(info) {
      try {
        return await buildMilestoneHtml(info);
      } catch {
        return '';
      }
    },
  };

  // ------- milestone HTML generator -------

  function escapeHtml(str) {
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function formatDate(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function itemGlyph(id) {
    try {
      const item = SHAPES.find((s) => s.id === id);
      if (!item) return id;
      if (item.kind === 'emoji') return item.emoji || item.name;
      return item.name;
    } catch {
      return id;
    }
  }

  // Roll events up per-level: attempts, first-try%, median ms.
  function perLevelStats(events) {
    const buckets = new Map();
    for (const e of events) {
      if (!buckets.has(e.level)) buckets.set(e.level, { attempts: 0, firstTry: 0, times: [] });
      const b = buckets.get(e.level);
      b.attempts += 1;
      if ((e.wrongDrops?.length ?? 0) === 0) b.firstTry += 1;
      b.times.push(e.msToSolve || 0);
    }
    const rows = [];
    for (const [level, b] of [...buckets.entries()].sort((a, b) => a[0] - b[0])) {
      const sorted = b.times.slice().sort((a, b) => a - b);
      const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
      const firstTryPct = b.attempts ? Math.round((b.firstTry / b.attempts) * 100) : 0;
      rows.push({ level, attempts: b.attempts, firstTryPct, medianMs: median });
    }
    return rows;
  }

  function topConfusables(events, limit = 10) {
    const counts = new Map();
    for (const e of events) {
      for (const wrongId of e.wrongDrops ?? []) {
        const key = `${e.targetId}>${wrongId}`;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
    return [...counts.entries()]
      .map(([key, count]) => {
        const [targetId, wrongId] = key.split('>');
        return { targetId, wrongId, count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  // 30-day highest-level trend. Returns [{day: 'YYYY-MM-DD', top: number}].
  function levelTrend(events, days = 30) {
    const byDay = new Map();
    for (const e of events) {
      const key = todayKey(e.ts);
      byDay.set(key, Math.max(byDay.get(key) || 0, e.level));
    }
    const out = [];
    const now = Date.now();
    for (let i = days - 1; i >= 0; i -= 1) {
      const key = todayKey(now - i * 86400000);
      out.push({ day: key, top: byDay.get(key) || 0 });
    }
    return out;
  }

  function sparklineSvg(trend, width = 600, height = 90) {
    if (!trend.length) return '';
    const max = Math.max(12, ...trend.map((p) => p.top));
    const step = width / (trend.length - 1 || 1);
    const points = trend.map((p, i) => {
      const x = i * step;
      const y = height - (p.top / max) * (height - 8) - 4;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    return `
      <svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" preserveAspectRatio="none">
        <polyline fill="none" stroke="#4DB6AC" stroke-width="2.5" points="${points}" />
        ${trend.map((p, i) => {
          const x = (i * step).toFixed(1);
          const y = (height - (p.top / max) * (height - 8) - 4).toFixed(1);
          return `<circle cx="${x}" cy="${y}" r="2.5" fill="#4DB6AC" />`;
        }).join('')}
      </svg>
    `;
  }

  async function buildMilestoneHtml({ label = 'Match Mode Complete', version = 1 } = {}) {
    const aggregates = window.Stats.getAggregates();
    const events = await window.Stats.getEvents({ limit: 10000 });
    const sessions = await window.Stats.getSessions({ limit: 14 });
    const trend = levelTrend(events);
    const rows = perLevelStats(events);
    const confusables = topConfusables(events);
    const nudgeRate = aggregates.total_puzzles
      ? (aggregates.total_nudges / aggregates.total_puzzles).toFixed(2)
      : '0.00';

    const savedAt = formatDate(Date.now());
    const firstCompleteAt = formatDate(aggregates.first_completion_ts);

    const chipHtml = `
      <div class="chips">
        <div class="chip"><div class="chip-value">L${rows.at(-1)?.level ?? 0}</div><div class="chip-label">top level</div></div>
        <div class="chip"><div class="chip-value">${aggregates.total_puzzles}</div><div class="chip-label">total solves</div></div>
        <div class="chip"><div class="chip-value">${aggregates.streak_days}</div><div class="chip-label">day streak</div></div>
        <div class="chip"><div class="chip-value">${nudgeRate}</div><div class="chip-label">nudges/puzzle</div></div>
      </div>
    `;

    const perLevelHtml = `
      <table><thead><tr><th>Level</th><th>Attempts</th><th>1st try</th><th>Median</th><th>Status</th></tr></thead><tbody>
        ${rows.map((r) => {
          const s = r.firstTryPct >= 75 ? '🟢 mastered' : r.firstTryPct >= 50 ? '🟡 working' : '🔴 hard';
          return `<tr><td>L${r.level}</td><td>${r.attempts}</td><td>${r.firstTryPct}%</td><td>${Math.round(r.medianMs / 100) / 10}s</td><td>${s}</td></tr>`;
        }).join('')}
      </tbody></table>
    `;

    const confusablesHtml = confusables.length
      ? `<ol>${confusables.map((c) => `<li>${escapeHtml(itemGlyph(c.targetId))} shown → ${escapeHtml(itemGlyph(c.wrongId))} dropped ×${c.count}</li>`).join('')}</ol>`
      : '<p class="empty">No wrong drops recorded — perfect run.</p>';

    const sessionsHtml = `
      <table><thead><tr><th>Date</th><th>Duration</th><th>Puzzles</th><th>Top level</th></tr></thead><tbody>
        ${sessions.map((s) => {
          const dur = Math.max(1, Math.round((s.endTs - s.startTs) / 60000));
          return `<tr><td>${formatDate(s.startTs)}</td><td>${dur} min</td><td>${s.puzzlesSolved}</td><td>L${s.topLevel}</td></tr>`;
        }).join('')}
      </tbody></table>
    `;

    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>Dheera — ${escapeHtml(label)}</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;background:#FBF7EF;color:#333;max-width:720px;margin:0 auto;padding:24px 16px 48px}
  h1{font-size:28px;margin:0 0 4px;color:#1E3A38}
  .subtitle{color:#6B7280;font-size:14px;margin-bottom:24px}
  h2{font-size:16px;margin:28px 0 10px;color:#4B5563;letter-spacing:0.5px;text-transform:uppercase;font-weight:700}
  .chips{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
  .chip{background:white;border-radius:14px;padding:14px 10px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
  .chip-value{font-size:24px;font-weight:700;color:#1E3A38}
  .chip-label{font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px}
  table{width:100%;border-collapse:collapse;background:white;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
  th,td{padding:8px 12px;text-align:left;font-size:14px}
  th{background:#F3F0E8;font-weight:700;color:#4B5563;font-size:12px;text-transform:uppercase;letter-spacing:0.5px}
  tr+tr td{border-top:1px solid #EEE}
  ol{padding-left:20px}
  ol li{font-size:15px;padding:4px 0}
  .empty{color:#9CA3AF;font-style:italic}
  .footer{margin-top:36px;color:#9CA3AF;font-size:12px;text-align:center}
</style></head>
<body>
  <h1>🏆 ${escapeHtml(label)}</h1>
  <p class="subtitle">Milestone reached ${escapeHtml(firstCompleteAt)} • Snapshot saved ${escapeHtml(savedAt)}</p>
  <h2>At a glance</h2>
  ${chipHtml}
  <h2>Level trend (last 30 days)</h2>
  ${sparklineSvg(trend)}
  <h2>Per level</h2>
  ${perLevelHtml}
  <h2>Top confusables</h2>
  ${confusablesHtml}
  <h2>Recent sessions</h2>
  ${sessionsHtml}
  <div class="footer">dheera-shapes • match mode v${version}</div>
</body></html>`;
  }

  // Expose internal helpers for stats-page.js (same origin, same file bundle).
  window.StatsInternal = {
    perLevelStats,
    topConfusables,
    levelTrend,
    sparklineSvg,
    itemGlyph,
    formatDate,
    escapeHtml,
  };

  window.Stats = Stats;
})();
