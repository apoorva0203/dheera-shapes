// Stats page renderer. Reads data via window.Stats, renders into #stats-root.
(() => {
  'use strict';

  const root = document.getElementById('stats-root');
  const saveBtn = document.getElementById('save-milestone');
  const {
    perLevelStats,
    topConfusables,
    levelTrend,
    sparklineSvg,
    itemGlyph,
    formatDate,
    escapeHtml,
  } = window.StatsInternal;

  function statusFor(pct) {
    if (pct >= 75) return { cls: 'status-good', text: '🟢 mastered' };
    if (pct >= 50) return { cls: 'status-warn', text: '🟡 working' };
    return { cls: 'status-hard', text: '🔴 hard' };
  }

  function chipsHtml(aggregates, topLevel, nudgeRate) {
    return `
      <div class="chips">
        <div class="chip"><div class="chip-value">L${topLevel}</div><div class="chip-label">top level</div></div>
        <div class="chip"><div class="chip-value">${aggregates.puzzles_today}</div><div class="chip-label">today</div></div>
        <div class="chip"><div class="chip-value">${aggregates.streak_days}</div><div class="chip-label">day streak</div></div>
        <div class="chip"><div class="chip-value">${nudgeRate}</div><div class="chip-label">nudges/puzzle</div></div>
      </div>
    `;
  }

  function perLevelHtml(rows) {
    if (!rows.length) return '<p class="empty">No puzzles solved yet.</p>';
    return `
      <table>
        <thead><tr><th>Level</th><th>Attempts</th><th>1st try</th><th>Median</th><th>Status</th></tr></thead>
        <tbody>
          ${rows.map((r) => {
            const s = statusFor(r.firstTryPct);
            return `<tr>
              <td>L${r.level}</td>
              <td>${r.attempts}</td>
              <td>${r.firstTryPct}%</td>
              <td>${(Math.round(r.medianMs / 100) / 10).toFixed(1)}s</td>
              <td class="${s.cls}">${s.text}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  function confusablesHtml(list) {
    if (!list.length) return '<p class="empty">No wrong drops recorded yet.</p>';
    return `
      <ul class="confusables">
        ${list.map((c) => `
          <li>
            <span>${escapeHtml(itemGlyph(c.targetId))} shown → ${escapeHtml(itemGlyph(c.wrongId))} dropped</span>
            <span class="count">×${c.count}</span>
          </li>
        `).join('')}
      </ul>
    `;
  }

  function sessionsHtml(sessions) {
    if (!sessions.length) return '<p class="empty">No sessions yet.</p>';
    return `
      <table>
        <thead><tr><th>Date</th><th>Duration</th><th>Puzzles</th><th>Top level</th></tr></thead>
        <tbody>
          ${sessions.map((s) => {
            const dur = Math.max(1, Math.round((s.endTs - s.startTs) / 60000));
            return `<tr>
              <td>${escapeHtml(formatDate(s.startTs))}</td>
              <td>${dur} min</td>
              <td>${s.puzzlesSolved}</td>
              <td>L${s.topLevel}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  function archiveHtml(milestones) {
    if (!milestones.length) {
      return '<p class="empty">No milestones saved yet. Reach level 12 to unlock.</p>';
    }
    return `
      <div class="archive">
        ${milestones.map((m, i) => `
          <div class="archive-row">
            <div>
              <div style="font-weight:700">${escapeHtml(m.label)}</div>
              <div style="color:var(--muted);font-size:12px">${escapeHtml(formatDate(m.ts))} • v${m.version}</div>
            </div>
            <button class="archive-download" data-idx="${i}">💾 Download</button>
          </div>
        `).join('')}
      </div>
    `;
  }

  function downloadHtml(html, filename) {
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function todayFilenamePart() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  async function render() {
    const aggregates = window.Stats.getAggregates();
    const events = await window.Stats.getEvents({ limit: 10000 });
    const sessions = await window.Stats.getSessions({ limit: 14 });
    const milestones = await window.Stats.getMilestones();

    const rows = perLevelStats(events);
    const trend = levelTrend(events);
    const confusables = topConfusables(events);
    const topLevel = rows.length ? rows.at(-1).level : 0;
    const nudgeRate = aggregates.total_puzzles
      ? (aggregates.total_nudges / aggregates.total_puzzles).toFixed(2)
      : '0.00';

    const trophyUnlocked = (() => {
      try { return localStorage.getItem('shapes.trophy') === '1'; } catch { return false; }
    })();

    if (trophyUnlocked) {
      saveBtn.hidden = false;
    }

    root.innerHTML = `
      <section>
        <h2>At a glance</h2>
        ${chipsHtml(aggregates, topLevel, nudgeRate)}
      </section>

      <section>
        <h2>Level trend (last 30 days)</h2>
        <div class="sparkline-card">
          ${sparklineSvg(trend)}
          <div class="sparkline-axis"><span>30 days ago</span><span>today</span></div>
        </div>
      </section>

      <section>
        <h2>Per level</h2>
        ${perLevelHtml(rows)}
      </section>

      <section>
        <h2>Top confusables</h2>
        ${confusablesHtml(confusables)}
      </section>

      <section>
        <h2>Recent sessions</h2>
        ${sessionsHtml(sessions)}
      </section>

      <section>
        <h2>Archive</h2>
        ${archiveHtml(milestones)}
      </section>
    `;

    // Wire archive download buttons.
    root.querySelectorAll('.archive-download').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.idx);
        const m = milestones[idx];
        if (!m) return;
        const day = new Date(m.ts).toISOString().slice(0, 10);
        downloadHtml(m.html, `dheera-${m.id}-${day}.html`);
      });
    });
  }

  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    const saved = await window.Stats.saveMilestone({
      id: 'match-mode-complete',
      version: 1,
      label: 'Match Mode Complete',
    });
    if (saved) {
      downloadHtml(saved.html, `dheera-match-mode-${todayFilenamePart()}.html`);
    }
    saveBtn.disabled = false;
    saveBtn.textContent = '💾 Save milestone';
    render();
  });

  render();
})();
