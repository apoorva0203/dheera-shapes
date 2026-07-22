(() => {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const stage = document.getElementById('stage');
  const muteButton = document.getElementById('mute');

  // Layout constants — an abstract 1000-wide viewBox, heights adapt to the
  // device's aspect ratio.
  const VIEW_W = 1000;
  let viewH = 1400;
  let tileSize = 180;

  // MODE: MATCH. Single target ("void") with N decoys; correct tile fills the
  // void, wrong tile snaps back. Difficulty progresses in 4 tiers of 3 levels
  // each (see tierForLevel). Level plateaus at MAX_LEVEL, first solve at
  // MAX_LEVEL triggers a trophy and unlocks the milestone snapshot.
  const START_LEVEL = 1;
  const MAX_LEVEL = 12;
  const NUDGE_THRESHOLD = 3;
  // Paged board: ordered slots + jumbled tiles, PAGE_SIZE at a time. Finish a
  // page → the next slides in. Keeps tiles big vs showing all 36 at once.
  const PAGE_SIZE = 6;
  const PAGE_SLOT_COLS = 6;
  const PAGE_BANK_COLS = 6;
  let runPages = [];
  let runTotal = 0;
  let pageIndex = 0;
  let runStartTs = 0;
  let runWrongByItem = {};
  let runFilled = 0;
  let level = START_LEVEL;
  let trophyUnlocked = false;
  let covered = new Set();
  let runEnded = false;

  let currentPuzzle = null;
  let isTransitioning = false;
  let muted = false;
  let audioCtx = null;

  const levelChip = document.getElementById('level-chip');
  const levelChipLabel = document.getElementById('level-chip-label');

  // ------- utilities -------

  function shuffle(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function pickN(list, count) {
    return shuffle(list).slice(0, count);
  }

  function svgEl(name, attrs = {}) {
    const el = document.createElementNS(SVG_NS, name);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  }

  // ------- item lookup -------

  function itemById(itemId) {
    return SHAPES.find((s) => s.id === itemId) ?? null;
  }

  function itemSvgById(itemId) {
    const item = itemById(itemId);
    if (!item) return '';
    if (item.kind === 'emoji') {
      // Real SVG file (Twemoji) — CSS filters (grayscale) apply reliably to
      // <image>, unlike native emoji glyphs which iOS bypasses filters on.
      // File is named by the item's `name` (see /emoji/<name>.svg).
      return `<image href="./emoji/${item.name}.svg" x="-45" y="-45" width="90" height="90" preserveAspectRatio="xMidYMid meet" />`;
    }
    if (item.kind === 'photo') {
      // Family photo (square jpg) clipped into a rounded square.
      return `<clipPath id="pc-${item.photo}"><rect x="-42" y="-42" width="84" height="84" rx="16" /></clipPath>` +
        `<image href="./photos/${item.photo}.jpg" x="-42" y="-42" width="84" height="84" preserveAspectRatio="xMidYMid slice" clip-path="url(#pc-${item.photo})" />`;
    }
    if (item.kind === 'text') {
      const fontSize = String(item.char).length > 1 ? 55 : 78;
      return `<text x="0" y="0" text-anchor="middle" dominant-baseline="central" font-size="${fontSize}" font-family="Nunito, -apple-system, BlinkMacSystemFont, system-ui, sans-serif" font-weight="800">${item.char}</text>`;
    }
    return item.svg;
  }

  function itemKind(itemId) {
    const item = itemById(itemId);
    return item?.kind ?? 'shape';
  }

  function itemNameById(itemId) {
    const shape = SHAPES.find((s) => s.id === itemId);
    return shape ? shape.name : '';
  }

  // Difficulty tiers. Silhouette in the void is always visible; difficulty
  // comes from how many decoys and how similar they are to the target.
  function tierForLevel(lvl) {
    if (lvl <= 3) return { decoyCount: 2, decoyKind: 'random' };
    if (lvl <= 6) return { decoyCount: 3, decoyKind: 'random' };
    if (lvl <= 9) return { decoyCount: 4, decoyKind: 'category' };
    return { decoyCount: 5, decoyKind: 'confusables' };
  }

  // Pick decoys of the requested flavour, falling back to broader pools if the
  // narrower pool doesn't have enough items. Never returns the target itself.
  function pickDecoys(target, count, kind) {
    const pool = ACTIVE_ITEMS.filter((s) => s.id !== target.id);
    const sameCategory = pool.filter((s) => s.category === target.category);

    if (kind === 'random') {
      return pickN(pool.map((s) => s.id), count);
    }

    if (kind === 'category') {
      if (sameCategory.length >= count) {
        return pickN(sameCategory.map((s) => s.id), count);
      }
      const chosen = shuffle(sameCategory.map((s) => s.id));
      const remaining = pool.filter((s) => !chosen.includes(s.id));
      return chosen.concat(pickN(remaining.map((s) => s.id), count - chosen.length));
    }

    // confusables → same category → random
    const confusables = (CONFUSABLES.get(target.id) ?? []).filter((id) => id !== target.id);
    const chosen = shuffle(confusables).slice(0, count);
    if (chosen.length >= count) return chosen;

    const chosenSet = new Set(chosen);
    const catExtras = shuffle(sameCategory.map((s) => s.id).filter((id) => !chosenSet.has(id)));
    for (const id of catExtras) {
      if (chosen.length >= count) break;
      chosen.push(id);
      chosenSet.add(id);
    }
    if (chosen.length >= count) return chosen;

    const randExtras = shuffle(pool.map((s) => s.id).filter((id) => !chosenSet.has(id)));
    for (const id of randExtras) {
      if (chosen.length >= count) break;
      chosen.push(id);
    }
    return chosen;
  }

  // ------- layout -------

  function resizeStage() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    viewH = Math.round(VIEW_W * (h / w));
    stage.setAttribute('viewBox', `0 0 ${VIEW_W} ${viewH}`);
    if (currentPuzzle) layoutPuzzle(currentPuzzle);
  }

  function rowPositions(count, y) {
    const spacing = VIEW_W / (count + 1);
    return Array.from({ length: count }, (_, i) => ({
      x: Math.round(spacing * (i + 1)),
      y,
    }));
  }

  // Grid layout for the tray: single row if ≤4 tiles, otherwise two rows split
  // as evenly as possible. Rows are stacked vertically around the given center y.
  function gridPositions(count, centerY) {
    if (count <= 4) return rowPositions(count, centerY);
    const topCount = Math.ceil(count / 2);
    const bottomCount = count - topCount;
    const rowGap = Math.round(tileSize * 2.4);
    const topY = centerY - Math.round(rowGap / 2);
    const bottomY = centerY + Math.round(rowGap / 2);
    return [
      ...rowPositions(topCount, topY),
      ...rowPositions(bottomCount, bottomY),
    ];
  }

  // ------- puzzle generation -------

  // A stream of one-puzzle pages: spell-a-word (emoji cue + letter slots) with a
  // family photo dropped in roughly every 3 words. Each page is
  //   { type, ids: [slotItemId...], cue: emojiId|null, audio: nameToSpeak }.
  function buildRunPages() {
    // The emoji is a piece too: it leads the row (ghost picture) and the child
    // drops the emoji + letters. No per-letter sound — the word is said at the end.
    const wordPages = shuffle(WORDS).map((entry) => ({
      type: 'word',
      ids: [entry.emoji, ...entry.word.toLowerCase().split('').map((ch) => `l-${ch}`)],
      cue: null,
      audio: itemNameById(entry.emoji),
    }));
    const familyPages = shuffle(FAMILY).map((item) => ({
      type: 'family',
      ids: [item.id],
      cue: null,
      audio: item.name,
    }));

    const pages = [];
    let familyIndex = 0;
    wordPages.forEach((page, i) => {
      pages.push(page);
      if ((i + 1) % 3 === 0 && familyIndex < familyPages.length) pages.push(familyPages[familyIndex++]);
    });
    while (familyIndex < familyPages.length) pages.push(familyPages[familyIndex++]);
    return pages;
  }

  function pageCount() {
    return runPages.length;
  }

  function startRun() {
    runPages = buildRunPages();
    runTotal = runPages.reduce((sum, p) => sum + p.ids.length, 0);
    pageIndex = 0;
    runStartTs = Date.now();
    runWrongByItem = {};
    runFilled = 0;
    buildPage(false);
  }

  function makePagePuzzle() {
    const page = runPages[pageIndex] || { type: 'word', ids: [], cue: null, audio: '' };
    const pageIds = page.ids;
    const slots = pageIds.map((id, index) => ({ id, index, filled: false }));
    const statsCtx = window.Stats
      ? window.Stats.recordPuzzleStart({ level: pageIndex + 1, targetId: 'page', tier: 'board' })
      : null;
    return {
      type: page.type,
      cue: page.cue,
      audio: page.audio,
      slots,
      tiles: shuffle(pageIds).map((id, i) => ({ id, color: COLORS[i % COLORS.length], atSlotIndex: null })),
      wrongDropCount: 0,
      wrongByItem: {},
      nudged: false,
      statsCtx,
    };
  }

  function buildPage(fade = true) {
    const render = () => {
      currentPuzzle = makePagePuzzle();
      resizeStage();
      updateLevelChip();
      stage.style.opacity = '1';
      isTransitioning = false;
    };
    if (!fade) { render(); return; }
    stage.style.transition = 'opacity 300ms ease';
    stage.style.opacity = '0';
    setTimeout(render, 320);
  }

  function layoutPuzzle(puzzle) {
    // Word puzzles reserve the top band for the emoji picture cue.
    const topPad = Math.round(viewH * (puzzle.cue ? 0.30 : 0.11));
    const slotBottom = Math.round(viewH * 0.46);
    const bankTop = Math.round(viewH * 0.56);
    const bankBottom = viewH - Math.round(viewH * 0.06);

    const n = puzzle.slots.length;
    const slotCols = Math.min(PAGE_SLOT_COLS, n);
    const slotRows = Math.ceil(n / slotCols);
    const slotColW = VIEW_W / (slotCols + 1);
    const slotRowH = (slotBottom - topPad) / slotRows;
    puzzle.slots.forEach((slot, i) => {
      const r = Math.floor(i / slotCols);
      const c = i % slotCols;
      slot.pos = { x: Math.round(slotColW * (c + 1)), y: Math.round(topPad + slotRowH * (r + 0.5)) };
    });

    const m = puzzle.tiles.length;
    const bankCols = Math.min(PAGE_BANK_COLS, m);
    const bankRows = Math.ceil(m / bankCols);
    const bankColW = VIEW_W / (bankCols + 1);
    const bankRowH = (bankBottom - bankTop) / bankRows;
    puzzle.tiles.forEach((t, i) => {
      const r = Math.floor(i / bankCols);
      const c = i % bankCols;
      t.homePos = { x: Math.round(bankColW * (c + 1)), y: Math.round(bankTop + bankRowH * (r + 0.5)) };
      t.pos = t.atSlotIndex == null ? { ...t.homePos } : { ...puzzle.slots[t.atSlotIndex].pos };
    });

    tileSize = Math.min(Math.floor(Math.min(slotColW, bankColW, slotRowH, bankRowH) * 0.5), 120);
    renderPuzzle(puzzle);
  }

  // ------- rendering -------

  function renderPuzzle(puzzle) {
    while (stage.firstChild) stage.removeChild(stage.firstChild);

    const slotScale = tileSize / 45;

    // Word puzzles: big emoji picture at the top so the child knows what to spell.
    if (puzzle.cue) {
      const cueScale = slotScale * 2.4;
      const cue = svgEl('g', {
        transform: `translate(500, ${Math.round(viewH * 0.15)}) scale(${cueScale})`,
        'pointer-events': 'none',
      });
      cue.innerHTML = itemSvgById(puzzle.cue);
      stage.appendChild(cue);
    }

    for (const slot of puzzle.slots) {
      const kind = itemKind(slot.id);
      let attrs;
      if (kind === 'emoji') {
        attrs = {
          transform: `translate(${slot.pos.x}, ${slot.pos.y}) scale(${slotScale})`,
          'data-slot-index': String(slot.index),
          style: 'filter: grayscale(1); opacity: 0.5;',
        };
      } else if (kind === 'text') {
        // Ghosted letter/number — outlined text renders poorly on most fonts,
        // so we use muted fill + reduced opacity instead.
        attrs = {
          transform: `translate(${slot.pos.x}, ${slot.pos.y}) scale(${slotScale})`,
          'data-slot-index': String(slot.index),
          style: 'fill: var(--slot-outline); opacity: 0.55;',
        };
      } else {
        attrs = {
          transform: `translate(${slot.pos.x}, ${slot.pos.y}) scale(${slotScale})`,
          'data-slot-index': String(slot.index),
          fill: 'none',
          stroke: 'var(--slot-outline)',
          'stroke-width': '3.5',
          'stroke-linejoin': 'round',
          'stroke-linecap': 'round',
        };
      }
      const g = svgEl('g', attrs);
      // Photo slots are an empty rounded square target (drop the photo here),
      // not a faded copy of the photo.
      g.innerHTML = kind === 'photo'
        ? '<rect x="-42" y="-42" width="84" height="84" rx="16" fill="none" />'
        : itemSvgById(slot.id);
      stage.appendChild(g);
    }

    for (const tile of puzzle.tiles) {
      const g = svgEl('g', {
        transform: `translate(${tile.pos.x}, ${tile.pos.y}) scale(${tileSize / 45})`,
        class: 'tile',
        style: 'cursor: grab; touch-action: none;',
      });
      // Invisible generous hit target so a fingertip can grab anywhere near
      // the shape, not just on its visible fill. Larger than the shape itself.
      const hit = svgEl('circle', {
        cx: '0', cy: '0', r: '62',
        fill: 'rgba(0,0,0,0.001)',
        'pointer-events': 'all',
      });
      g.appendChild(hit);
      if (itemKind(tile.id) === 'text') {
        // Solid rounded "key" so a jumble of letters reads as distinct,
        // pickable tiles rather than loose coloured glyphs.
        const card = svgEl('rect', {
          x: '-42', y: '-42', width: '84', height: '84', rx: '18', ry: '18',
          fill: tile.color, stroke: 'rgba(0,0,0,0.10)', 'stroke-width': '1.5',
          'pointer-events': 'none',
        });
        g.appendChild(card);
        const label = svgEl('g', { fill: '#fff', 'pointer-events': 'none' });
        label.innerHTML = itemSvgById(tile.id);
        g.appendChild(label);
      } else if (itemKind(tile.id) === 'photo') {
        // White card behind the rounded photo so it reads as a pickable tile.
        const card = svgEl('rect', {
          x: '-46', y: '-46', width: '92', height: '92', rx: '20', ry: '20',
          fill: '#fff', stroke: 'rgba(0,0,0,0.10)', 'stroke-width': '1.5',
          'pointer-events': 'none',
        });
        g.appendChild(card);
        const photo = svgEl('g', { 'pointer-events': 'none' });
        photo.innerHTML = itemSvgById(tile.id);
        g.appendChild(photo);
      } else {
        const shape = svgEl('g', {
          fill: tile.color,
          stroke: 'rgba(0,0,0,0.05)',
          'stroke-width': '1',
          'pointer-events': 'none',
        });
        shape.innerHTML = itemSvgById(tile.id);
        g.appendChild(shape);
      }
      tile.node = g;
      tile.hitNode = hit;
      stage.appendChild(g);
      wireDrag(tile, g);
    }
  }

  // ------- drag & drop (interact.js) -------
  //
  // interact.js handles all touch/pointer normalisation so we don't have to
  // fight iOS Safari quirks by hand. We convert its pixel deltas to the SVG
  // viewBox coordinate system, then hit-test slots ourselves on end.

  function wireDrag(tile, node) {
    interact(node).draggable({
      inertia: false,
      autoScroll: false,
      cursorChecker: () => 'grab',
      listeners: {
        start(event) {
          if (isTransitioning) return interact(node).draggable(false), setTimeout(() => interact(node).draggable(true), 0);
          if (tile.atSlotIndex != null) return;
          cancelTileAnimation(tile);
          tile.dragStageRect = stage.getBoundingClientRect();
          node.style.cursor = 'grabbing';
          stage.appendChild(node); // raise above peers
          // Hint: matching slot stands out. Ghosted slots (emoji, text) bump
          // opacity; outlined shape slots thicken the stroke instead.
          for (const slot of currentPuzzle.slots) {
            const slotNode = stage.querySelector(`[data-slot-index="${slot.index}"]`);
            if (!slotNode) continue;
            if (slot.id === tile.id && !slot.filled) {
              const kind = itemKind(slot.id);
              if (kind === 'emoji') {
                slotNode.setAttribute('style', 'filter: none; opacity: 0.85;');
              } else if (kind === 'text') {
                slotNode.setAttribute('style', 'fill: var(--slot-outline); opacity: 0.95;');
              } else {
                slotNode.setAttribute('stroke-width', '5.5');
              }
            }
          }
        },
        move(event) {
          if (tile.atSlotIndex != null) return;
          const rect = tile.dragStageRect || stage.getBoundingClientRect();
          const svgDx = (event.dx / rect.width) * VIEW_W;
          const svgDy = (event.dy / rect.height) * viewH;
          tile.pos.x += svgDx;
          tile.pos.y += svgDy;
          updateTileTransform(tile, node);
        },
        end(event) {
          node.style.cursor = 'grab';
          tile.dragStageRect = null;
          // Clear hints — restore slots to their resting look. Filled slots
          // stay hidden so the coloured tile owns the space.
          for (const s of currentPuzzle.slots) {
            const sn = stage.querySelector(`[data-slot-index="${s.index}"]`);
            if (!sn) continue;
            const kind = itemKind(s.id);
            if (s.filled) {
              sn.setAttribute('style', 'opacity: 0;');
            } else if (kind === 'emoji') {
              sn.setAttribute('style', 'filter: grayscale(1); opacity: 0.5;');
            } else if (kind === 'text') {
              sn.setAttribute('style', 'fill: var(--slot-outline); opacity: 0.55;');
            } else {
              sn.setAttribute('stroke-width', '3.5');
            }
          }
          if (tile.atSlotIndex != null) return;

          // Match against the tile's OWN slot with a generous radius. Checking
          // only the correct slot (not the nearest) means a filled neighbour can
          // never block a drop — critical for the last piece in a dense grid.
          // Nearest UNFILLED slot with the tile's id. Nearest-not-first is what
          // lets a repeated letter (e.g. the two P's in APPLE) fill either slot.
          let target = null;
          let dTarget = Infinity;
          for (const s of currentPuzzle.slots) {
            if (s.id !== tile.id || s.filled) continue;
            const d = Math.hypot(s.pos.x - tile.pos.x, s.pos.y - tile.pos.y);
            if (d < dTarget) { dTarget = d; target = s; }
          }
          if (target && dTarget < tileSize * 2.0) {
            tile.atSlotIndex = target.index;
            target.filled = true;
            animateTileTo(tile, node, { x: target.pos.x, y: target.pos.y }, 260, { pop: true });
            // Say each piece as it lands (letter name / emoji / family name). Word
            // puzzles also say the whole word again on completion (see checkComplete).
            speak(itemNameById(tile.id));
            const slotNode = stage.querySelector(`[data-slot-index="${target.index}"]`);
            if (slotNode) slotNode.setAttribute('style', 'opacity: 0;');
            updateLevelChip();
            checkComplete();
          } else {
            animateTileTo(tile, node, { ...tile.homePos }, 360, { pop: false });
            // Aimed at a slot but the wrong one → gentle boop + record the fumble.
            const near = findHitSlot(tile.pos);
            if (near && near.id !== tile.id) {
              playBoop();
              currentPuzzle.wrongDropCount += 1;
              currentPuzzle.wrongByItem[tile.id] = (currentPuzzle.wrongByItem[tile.id] || 0) + 1;
              if (window.Stats) window.Stats.recordWrongDrop(currentPuzzle.statsCtx, tile.id);
            }
          }
        },
      },
    });
  }

  // rAF-driven tween for spring-back and snap-in. Cancels any in-flight
  // animation on the same tile so consecutive drops don't stack.
  function animateTileTo(tile, node, target, duration, { pop = false } = {}) {
    cancelTileAnimation(tile);
    const startX = tile.pos.x;
    const startY = tile.pos.y;
    const startTime = performance.now();
    tile.animFrame = requestAnimationFrame(function step(now) {
      const t = Math.min((now - startTime) / duration, 1);
      const eased = easeOutBack(t);
      tile.pos.x = startX + (target.x - startX) * eased;
      tile.pos.y = startY + (target.y - startY) * eased;
      const scaleMul = pop ? 1 + Math.sin(t * Math.PI) * 0.08 : 1;
      updateTileTransform(tile, node, scaleMul);
      if (t < 1) {
        tile.animFrame = requestAnimationFrame(step);
      } else {
        tile.pos.x = target.x;
        tile.pos.y = target.y;
        updateTileTransform(tile, node);
        tile.animFrame = null;
      }
    });
  }

  function cancelTileAnimation(tile) {
    if (tile.animFrame) {
      cancelAnimationFrame(tile.animFrame);
      tile.animFrame = null;
    }
  }

  function easeOutBack(t) {
    const c1 = 1.4;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  // Scaffold after 3 consecutive wrong drops: the correct tile does a small
  // bounce so a stuck child can find it without frustration.
  function bounceCorrectTile() {
    if (!currentPuzzle || currentPuzzle.slots.length !== 1) return;
    const target = currentPuzzle.slots[0];
    const correct = currentPuzzle.tiles.find((t) => t.id === target.id && t.atSlotIndex == null);
    if (!correct || !correct.node) return;
    const baseTransform = correct.node.getAttribute('transform');
    correct.node.animate(
      [
        { transform: baseTransform },
        { transform: baseTransform + ' scale(1.18)' },
        { transform: baseTransform + ' scale(0.95)' },
        { transform: baseTransform + ' scale(1.10)' },
        { transform: baseTransform },
      ],
      { duration: 900, easing: 'ease-in-out', iterations: 2 },
    );
  }

  function findHitSlot(pos) {
    let best = null;
    let bestDist = Infinity;
    for (const slot of currentPuzzle.slots) {
      const dx = slot.pos.x - pos.x;
      const dy = slot.pos.y - pos.y;
      const d = Math.hypot(dx, dy);
      if (d < tileSize * 1.4 && d < bestDist) {
        best = slot;
        bestDist = d;
      }
    }
    return best;
  }

  function updateTileTransform(tile, node, scaleMul = 1.0) {
    const s = (tileSize / 45) * scaleMul;
    node.setAttribute('transform', `translate(${tile.pos.x}, ${tile.pos.y}) scale(${s})`);
  }

  // ------- page complete → next page / finish -------

  function checkComplete() {
    if (!currentPuzzle.slots.every((s) => s.filled)) return;
    isTransitioning = true;

    // Word puzzles: say the whole word once spelled (letters already spoke as
    // they landed). Family puzzles already said the name on the drop.
    if (currentPuzzle.type === 'word' && currentPuzzle.audio) {
      setTimeout(() => speak(currentPuzzle.audio), 400);
    }

    if (window.Stats) window.Stats.recordCorrect(currentPuzzle.statsCtx);

    for (const tile of currentPuzzle.tiles) {
      if (!tile.node || tile.atSlotIndex == null) continue;
      tile.node.animate(
        [
          { transform: tile.node.getAttribute('transform') },
          { transform: tile.node.getAttribute('transform') + ' scale(1.08)' },
          { transform: tile.node.getAttribute('transform') },
        ],
        { duration: 700, easing: 'ease-in-out' },
      );
    }

    for (const [id, c] of Object.entries(currentPuzzle.wrongByItem)) {
      runWrongByItem[id] = (runWrongByItem[id] || 0) + c;
    }
    runFilled += currentPuzzle.slots.length;
    for (const s of currentPuzzle.slots) covered.add(s.id);
    saveCovered();
    updateLevelChip();

    if (pageIndex + 1 >= pageCount()) {
      launchConfetti('big');
      endRun();
    } else {
      launchConfetti();
      setTimeout(() => { pageIndex += 1; buildPage(true); }, 1200);
    }
  }

  // Simple confetti — colourful squares + circles rain from the top of the
  // stage with real gravity + rotation. rAF-driven; container is torn down
  // once every piece falls off the bottom.
  function launchConfetti(intensity = 'normal') {
    const pieces = intensity === 'big' ? 140 : 60;
    const container = svgEl('g');
    container.setAttribute('pointer-events', 'none');
    stage.appendChild(container);

    const items = [];
    for (let i = 0; i < pieces; i += 1) {
      const size = 8 + Math.random() * 12;
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      const isCircle = Math.random() < 0.4;
      const shape = isCircle
        ? svgEl('circle', { cx: '0', cy: '0', r: String(size / 2), fill: color })
        : svgEl('rect', {
            x: String(-size / 2), y: String(-size / 2),
            width: String(size), height: String(size),
            fill: color, rx: '2',
          });
      container.appendChild(shape);
      items.push({
        node: shape,
        x: Math.random() * VIEW_W,
        y: -30 - Math.random() * 100,
        vx: (Math.random() - 0.5) * 260,
        vy: 80 + Math.random() * 160,
        rot: Math.random() * 360,
        rotV: (Math.random() - 0.5) * 480,
      });
    }

    let last = performance.now();
    function step(now) {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      let alive = false;
      for (const c of items) {
        c.vy += 900 * dt; // gravity
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.rot += c.rotV * dt;
        c.node.setAttribute('transform', `translate(${c.x} ${c.y}) rotate(${c.rot})`);
        if (c.y < viewH + 60) alive = true;
      }
      if (alive) requestAnimationFrame(step);
      else container.remove();
    }
    requestAnimationFrame(step);
  }

  function newBoard() {
    stage.style.transition = 'opacity 300ms ease';
    stage.style.opacity = '0';
    setTimeout(startRun, 320);
  }

  // One-time reset when the active item pool changes fundamentally (e.g.
  // shapes+emoji → letters+numbers). Trophy state is deliberately preserved
  // so the earlier milestone stays in the archive.
  function migratePoolIfNeeded() {
    try {
      const v = localStorage.getItem('shapes.pool_version');
      if (v !== '3') {
        localStorage.setItem('shapes.pool_version', '3');
        localStorage.setItem('shapes.level', String(START_LEVEL));
        // Content changed to the words+family stream — clear the old run so it
        // starts fresh instead of showing the previous finished screen.
        localStorage.removeItem('shapes.run_ended');
        localStorage.removeItem('shapes.covered');
        localStorage.removeItem('shapes.completed_at');
      }
    } catch { /* ignore */ }
  }

  function loadLevel() {
    try {
      const raw = localStorage.getItem('shapes.level');
      const parsed = raw ? parseInt(raw, 10) : START_LEVEL;
      if (Number.isFinite(parsed) && parsed >= START_LEVEL) {
        level = Math.min(parsed, MAX_LEVEL);
      }
    } catch { /* ignore */ }
  }

  function saveLevel() {
    try { localStorage.setItem('shapes.level', String(level)); } catch { /* ignore */ }
  }

  function loadTrophy() {
    try { trophyUnlocked = localStorage.getItem('shapes.trophy') === '1'; } catch { trophyUnlocked = false; }
  }

  function saveTrophy() {
    try {
      localStorage.setItem('shapes.trophy', trophyUnlocked ? '1' : '0');
      if (trophyUnlocked && !localStorage.getItem('shapes.first_complete_ts')) {
        localStorage.setItem('shapes.first_complete_ts', String(Date.now()));
      }
    } catch { /* ignore */ }
  }

  function loadCovered() {
    try {
      const raw = localStorage.getItem('shapes.covered');
      covered = new Set(raw ? JSON.parse(raw) : []);
      runEnded = localStorage.getItem('shapes.run_ended') === '1';
    } catch { covered = new Set(); runEnded = false; }
  }

  function saveCovered() {
    try { localStorage.setItem('shapes.covered', JSON.stringify([...covered])); } catch { /* ignore */ }
  }

  // All pages done → freeze on a giant trophy, stamp completion + run stats
  // (used by the shareable certificate).
  function endRun() {
    runEnded = true;
    const now = Date.now();
    try {
      localStorage.setItem('shapes.run_ended', '1');
      if (!localStorage.getItem('shapes.completed_at')) {
        localStorage.setItem('shapes.completed_at', String(now));
      }
      localStorage.setItem('shapes.last_result', JSON.stringify({
        completedAt: now,
        boardMs: runStartTs ? now - runStartTs : 0,
        wrong: runWrongByItem,
      }));
    } catch { /* ignore */ }
    if (window.Stats) window.Stats.recordFirstCompletion();
    playCompletionChime();
    updateLevelChip();
    setTimeout(showFinishedOverlay, 900);
  }

  function showFinishedOverlay() {
    if (document.getElementById('finish-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'finish-overlay';
    const trophy = document.createElement('div');
    trophy.id = 'finish-trophy';
    trophy.textContent = '🏆';
    const sub = document.createElement('div');
    sub.id = 'finish-sub';
    sub.textContent = 'All the words and family done! 🎉';
    const cert = document.createElement('a');
    cert.id = 'finish-cert';
    cert.href = './showcase.html';
    cert.textContent = 'See certificate';
    const again = document.createElement('button');
    again.id = 'finish-again';
    again.textContent = 'Play again';
    again.addEventListener('click', resetRun);
    overlay.appendChild(trophy);
    overlay.appendChild(sub);
    overlay.appendChild(cert);
    overlay.appendChild(again);
    document.body.appendChild(overlay);
  }

  function resetRun() {
    covered = new Set();
    saveCovered();
    runEnded = false;
    try { localStorage.removeItem('shapes.run_ended'); } catch { /* ignore */ }
    const overlay = document.getElementById('finish-overlay');
    if (overlay) overlay.remove();
    isTransitioning = false;
    newBoard();
  }

  function updateLevelChip() {
    if (!levelChip || !levelChipLabel) return;
    if (runEnded) {
      levelChip.classList.add('trophy');
      levelChipLabel.textContent = '🏆';
    } else {
      levelChip.classList.remove('trophy');
      const pageFilled = currentPuzzle ? currentPuzzle.slots.filter((s) => s.filled).length : 0;
      const total = runTotal || ACTIVE_ITEMS.length;
      levelChipLabel.textContent = (runFilled + pageFilled) + '/' + total;
    }
  }

  // Transient button during the level-12 first-solve celebration. Tapping it
  // freezes the current stats as a self-contained HTML file and downloads it.
  // Auto-hides when the next puzzle transitions in.
  function showSaveMilestoneButton() {
    let btn = document.getElementById('milestone-save-btn');
    if (btn) return;
    btn = document.createElement('button');
    btn.id = 'milestone-save-btn';
    btn.textContent = '💾 Save milestone';
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = 'Saving…';
      if (!window.Stats) { btn.remove(); return; }
      const saved = await window.Stats.saveMilestone({
        id: 'match-mode-complete',
        version: 1,
        label: 'Match Mode Complete',
      });
      if (saved) {
        const day = new Date(saved.ts).toISOString().slice(0, 10);
        const blob = new Blob([saved.html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dheera-match-mode-${day}.html`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      btn.remove();
    });
    document.body.appendChild(btn);
    setTimeout(() => {
      const still = document.getElementById('milestone-save-btn');
      if (still) still.remove();
    }, 6000);
  }

  // ------- sound -------

  function ensureAudio() {
    if (audioCtx) return audioCtx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
    return audioCtx;
  }

  function playChime(pitchOffset = 0, gainMul = 1.0) {
    if (muted) return;
    const ctx = ensureAudio();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const base = 523.25;
    osc.frequency.setValueAtTime(base * Math.pow(2, pitchOffset / 12), now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12 * gainMul, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.55);
  }

  // Soft "not that one" tone — low, warm, brief. Never punitive.
  function playBoop() {
    if (muted) return;
    const ctx = ensureAudio();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.18);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.06, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  // Warmer, cascading chime for level-12 first completion.
  function playCompletionChime() {
    if (muted) return;
    const ctx = ensureAudio();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    // C5, E5, G5, C6 arpeggio
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, i) => {
      const start = now + i * 0.13;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.14, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.9);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.95);
    });
  }

  // ------- voice (Web Audio API + pre-recorded m4a) -------
  //
  // We swapped from HTMLAudioElement to Web Audio API because iOS Safari's
  // autoplay policy inside PWAs blocks HTMLAudioElement.play() when the
  // caller isn't a "direct" user gesture — interact.js's `end` callback
  // trips that check. Web Audio's rule is simpler: unlock the AudioContext
  // inside any user gesture, then BufferSource.start() plays from anywhere
  // including async callbacks. Files load once, decoded into AudioBuffers,
  // then start() is cheap.

  const bufferCache = new Map(); // slug → AudioBuffer or Promise<AudioBuffer>
  let audioWarmed = false;

  function nameToSlug(name) {
    return String(name).toLowerCase().replace(/\s+/g, '-');
  }

  function ensureCtx() {
    if (audioCtx) return audioCtx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
    return audioCtx;
  }

  async function loadBuffer(slug) {
    if (bufferCache.has(slug)) return bufferCache.get(slug);
    const ctx = ensureCtx();
    if (!ctx) return null;
    const promise = fetch(`./audio/${slug}.m4a`)
      .then((r) => {
        if (!r.ok) throw new Error('http ' + r.status);
        return r.arrayBuffer();
      })
      .then((buf) => new Promise((resolve, reject) => {
        // Safari still uses the callback form on some builds.
        ctx.decodeAudioData(buf, resolve, reject);
      }))
      .then((audioBuffer) => {
        bufferCache.set(slug, audioBuffer);
        return audioBuffer;
      })
      .catch((err) => {
        bufferCache.delete(slug);
        debugToast('load err ' + slug + ': ' + (err?.name || err?.message || err));
        audioStatus('load err ' + slug + ': ' + (err?.name || err?.message || err));
        return null;
      });
    bufferCache.set(slug, promise);
    return promise;
  }

  function warmupAudio() {
    if (audioWarmed) return;
    try {
      const ctx = ensureCtx();
      if (!ctx) { debugToast('no AudioContext'); return; }
      // Play a 1-sample silent buffer to unlock — no network fetch needed.
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
      const resumeP = ctx.state === 'suspended' ? ctx.resume() : Promise.resolve();
      resumeP
        .then(() => { audioWarmed = true; debugToast('warmup ok (' + ctx.state + ')'); })
        .catch((err) => debugToast('resume err: ' + (err?.name || err?.message || err)));
    } catch (e) { debugToast('warmup throw ' + e); }
  }

  // Debug overlay defaults ON while we're diagnosing audio. Triple-tap the
  // mute button (or ?debug=0 in the URL) to turn it off.
  const DEBUG_AUDIO = (() => {
    if (new URLSearchParams(location.search).get('debug') === '0') return false;
    try {
      const v = localStorage.getItem('shapes.debug');
      if (v === '0') return false;
    } catch { /* ignore */ }
    return true;
  })();
  function debugToast(msg) {
    if (!DEBUG_AUDIO) return;
    const div = document.createElement('div');
    div.textContent = msg;
    div.style.cssText =
      'position: fixed; top: 12px; left: 12px; background: rgba(0,0,0,0.78); ' +
      'color: white; padding: 6px 10px; border-radius: 6px; font-size: 12px; ' +
      'font-family: -apple-system, monospace; z-index: 9999; max-width: 65vw; ' +
      'word-break: break-word;';
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 3000);
  }

  // Always-on audio status line (not gated by DEBUG_AUDIO) — persists so the
  // last audio event is readable at any time while we diagnose sound.
  let audioStatusEl = null;
  function audioStatus(msg) {
    if (!audioStatusEl) {
      audioStatusEl = document.createElement('div');
      audioStatusEl.id = 'audio-status';
      audioStatusEl.style.cssText =
        'position: fixed; bottom: 8px; left: 8px; background: rgba(0,0,0,0.8); ' +
        'color: #fff; padding: 4px 8px; border-radius: 6px; font: 12px monospace; ' +
        'z-index: 9999; max-width: 70vw; word-break: break-word; pointer-events: none;';
      document.body.appendChild(audioStatusEl);
    }
    audioStatusEl.textContent = msg;
  }

  function speak(text) {
    if (muted) { debugToast('muted → skip ' + text); return; }
    if (!text) return;
    const slug = nameToSlug(text);
    const ctx = ensureCtx();
    if (!ctx) { debugToast('no AudioContext'); return; }

    Promise.resolve(loadBuffer(slug)).then((buffer) => {
      if (!buffer) return; // load error was already toasted
      const play = () => {
        try {
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(ctx.destination);
          source.start(0);
          debugToast('▶ ' + slug + ' (' + ctx.state + ')');
          audioStatus('▶ ' + slug + ' (' + ctx.state + ')');
        } catch (e) {
          debugToast('start err ' + slug + ': ' + (e?.name || e?.message || e));
          audioStatus('start err ' + slug + ' (' + ctx.state + ')');
        }
      };
      // iOS: start() into a suspended/interrupted ctx plays silently. Wait
      // for resume to land before starting the source.
      if (ctx.state === 'running') play();
      else ctx.resume().then(play).catch(play);
    });
  }

  const warmupEvents = ['pointerdown', 'touchstart', 'click', 'keydown'];
  const warmupHandler = () => {
    warmupAudio();
    warmupEvents.forEach((ev) => document.removeEventListener(ev, warmupHandler));
  };
  warmupEvents.forEach((ev) => document.addEventListener(ev, warmupHandler, { passive: true }));

  // ------- mute UI -------

  function loadMute() {
    try { muted = localStorage.getItem('shapes.muted') === '1'; } catch { muted = false; }
    updateMuteUI();
  }

  function saveMute() {
    try { localStorage.setItem('shapes.muted', muted ? '1' : '0'); } catch { /* ignore */ }
  }

  function updateMuteUI() {
    muteButton.classList.toggle('muted', muted);
    const onIcon = document.getElementById('mute-on');
    const offIcon = document.getElementById('mute-off');
    if (onIcon && offIcon) {
      onIcon.style.display = muted ? 'none' : '';
      offIcon.style.display = muted ? '' : 'none';
    }
  }

  // Triple-tap the mute button within 800ms to toggle the debug overlay.
  // The mute button still toggles per click; on the 3rd click we restore
  // the mute state to what it was BEFORE the triple-tap sequence started,
  // so debug-mode-toggling doesn't leave the app muted or unmuted by accident.
  let clickTimestamps = [];
  let preTripleMuteState = null;
  muteButton.addEventListener('click', () => {
    const now = Date.now();
    clickTimestamps = clickTimestamps.filter((t) => now - t < 800);
    if (clickTimestamps.length === 0) preTripleMuteState = muted;
    clickTimestamps.push(now);

    muted = !muted;
    saveMute();
    updateMuteUI();

    if (clickTimestamps.length >= 3) {
      clickTimestamps = [];
      // Restore original mute state — the triple-tap is a debug toggle, not
      // a mute toggle in disguise.
      muted = preTripleMuteState;
      saveMute();
      updateMuteUI();
      try {
        const on = localStorage.getItem('shapes.debug') !== '1';
        localStorage.setItem('shapes.debug', on ? '1' : '0');
        location.reload();
      } catch { /* ignore */ }
    }
  });

  // ------- level chip long-press → stats page -------

  const LONG_PRESS_MS = 2000;
  let levelChipPressTimer = null;

  function cancelLevelChipPress() {
    levelChip?.classList.remove('pressing');
    if (levelChipPressTimer) {
      clearTimeout(levelChipPressTimer);
      levelChipPressTimer = null;
    }
  }

  if (levelChip) {
    levelChip.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      levelChip.classList.add('pressing');
      levelChipPressTimer = setTimeout(() => {
        window.location.href = './stats.html';
      }, LONG_PRESS_MS);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((evt) => {
      levelChip.addEventListener(evt, cancelLevelChipPress);
    });
  }

  // ------- boot -------

  loadMute();
  migratePoolIfNeeded();
  loadLevel();
  loadTrophy();
  loadCovered();
  updateLevelChip();
  resizeStage();
  startRun();
  if (runEnded) showFinishedOverlay();

  window.addEventListener('resize', resizeStage);
  window.addEventListener('orientationchange', resizeStage);

  // Fires *after* debugToast is fully defined; confirms the app booted.
  setTimeout(() => {
    const line = 'boot v33 ' + pageCount() + ' pages / ' + runTotal + (runEnded ? ' 🏆' : '');
    debugToast(line);
    audioStatus(line);
  }, 100);
})();
