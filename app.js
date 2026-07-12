(() => {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const stage = document.getElementById('stage');
  const muteButton = document.getElementById('mute');

  // Puzzle sizing lives in an abstract 1000-wide viewBox — heights adapt to
  // the device's aspect ratio so the layout works on tablet portrait, phone
  // portrait, and desktop landscape without special-casing.
  const VIEW_W = 1000;
  let viewH = 1400;
  let slotY = 460;      // slot row centre
  let trayY = 1050;     // tray row centre
  let tileSize = 180;   // rendered radius per shape

  // Difficulty ramp: start at 3 shapes, add one every completed puzzle up to
  // MAX_LEVEL. Level is persisted so the kid picks up where they left off.
  const START_LEVEL = 3;
  const MAX_LEVEL = 8;
  let level = START_LEVEL;

  // Runtime state.
  let currentPuzzle = null;
  let dragging = null;
  let isTransitioning = false;
  let muted = false;
  let audioCtx = null;

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

  // ------- layout -------

  function resizeStage() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const ratio = h / w;
    viewH = Math.round(VIEW_W * ratio);
    stage.setAttribute('viewBox', `0 0 ${VIEW_W} ${viewH}`);

    // More vertical air between slots and tray — a comfortable gap keeps
    // the two rows visually separated on both tablet portrait and desktop.
    slotY = Math.round(viewH * 0.26);
    trayY = Math.round(viewH * 0.80);

    // Tile size shrinks as the level grows so more shapes still fit in one
    // row. Scaled by whichever is tighter — column width or the vertical
    // gap between rows.
    const count = currentPuzzle ? currentPuzzle.slots.length : level;
    const perColumnWidth = VIEW_W / (count + 1);
    const verticalGap = trayY - slotY;
    tileSize = Math.floor(Math.min(perColumnWidth * 0.42, verticalGap * 0.22, 180));

    if (currentPuzzle) layoutPuzzle(currentPuzzle);
  }

  function slotPositions(count) {
    const spacing = VIEW_W / (count + 1);
    return Array.from({ length: count }, (_, i) => ({
      x: Math.round(spacing * (i + 1)),
      y: slotY,
    }));
  }

  function trayPositions(count) {
    const spacing = VIEW_W / (count + 1);
    return Array.from({ length: count }, (_, i) => ({
      x: Math.round(spacing * (i + 1)),
      y: trayY,
    }));
  }

  // ------- puzzle generation -------

  function generatePuzzle() {
    const count = Math.min(level, MAX_LEVEL);
    const chosen = pickN(SHAPES.map((s) => s.id), count);
    const trayOrder = shuffle(chosen);
    // Cycle through the palette so we never repeat a colour within one puzzle
    // when count <= COLORS.length (always true given MAX_LEVEL < COLORS.length).
    const trayColors = pickN(COLORS, chosen.length);
    return {
      slots: chosen.map((id, i) => ({ id, index: i, filled: false })),
      tiles: trayOrder.map((id, i) => ({
        id,
        colorIndex: i,
        color: trayColors[i],
        atSlotIndex: null,
      })),
    };
  }

  function layoutPuzzle(puzzle) {
    const slotPts = slotPositions(puzzle.slots.length);
    const trayPts = trayPositions(puzzle.tiles.length);
    puzzle.slots.forEach((s, i) => {
      s.pos = slotPts[i];
    });
    puzzle.tiles.forEach((t, i) => {
      t.homePos = trayPts[i];
      if (t.atSlotIndex == null) {
        t.pos = { ...t.homePos };
      } else {
        t.pos = { ...puzzle.slots[t.atSlotIndex].pos };
      }
    });
    renderPuzzle(puzzle);
  }

  // ------- rendering -------

  function renderPuzzle(puzzle) {
    while (stage.firstChild) stage.removeChild(stage.firstChild);

    // Slot outlines (drawn first so tiles sit on top).
    for (const slot of puzzle.slots) {
      const g = svgEl('g', {
        transform: `translate(${slot.pos.x}, ${slot.pos.y}) scale(${tileSize / 45})`,
        'data-slot-index': String(slot.index),
        fill: 'var(--slot-fill)',
        stroke: 'var(--slot-outline)',
        'stroke-width': '3.5',
        'stroke-dasharray': '6 5',
        'stroke-linejoin': 'round',
      });
      const def = shapeById(slot.id);
      g.innerHTML = def.svg;
      stage.appendChild(g);
    }

    // Tiles.
    for (const tile of puzzle.tiles) {
      const g = svgEl('g', {
        transform: `translate(${tile.pos.x}, ${tile.pos.y}) scale(${tileSize / 45})`,
        'data-tile-color': tile.colorIndex,
        fill: tile.color,
        stroke: 'rgba(0,0,0,0.05)',
        'stroke-width': '1',
        style: 'cursor: grab; transition: transform 240ms cubic-bezier(0.34, 1.2, 0.64, 1);',
      });
      const def = shapeById(tile.id);
      g.innerHTML = def.svg;
      // Wire drag handlers to the group.
      g.addEventListener('pointerdown', (ev) => onPointerDown(ev, tile, g));
      tile.node = g;
      stage.appendChild(g);
    }
  }

  function shapeById(id) {
    return SHAPES.find((s) => s.id === id);
  }

  // ------- drag & drop -------

  function screenToStage(clientX, clientY) {
    const rect = stage.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * VIEW_W;
    const y = ((clientY - rect.top) / rect.height) * viewH;
    return { x, y };
  }

  function onPointerDown(ev, tile, node) {
    if (isTransitioning) return;
    if (tile.atSlotIndex != null) return; // already placed
    ev.preventDefault();
    const p = screenToStage(ev.clientX, ev.clientY);
    dragging = {
      tile,
      node,
      grabOffset: { x: p.x - tile.pos.x, y: p.y - tile.pos.y },
      pointerId: ev.pointerId,
    };
    node.setPointerCapture(ev.pointerId);
    node.style.transition = 'none';
    node.style.cursor = 'grabbing';
    // Raise the dragged tile to the top so it renders above slots + peers.
    stage.appendChild(node);
    // Hint: fade the matching slot subtly so kid can find its home.
    for (const slot of currentPuzzle.slots) {
      const slotNode = stage.querySelector(`[data-slot-index="${slot.index}"]`);
      if (!slotNode) continue;
      if (slot.id === tile.id && !slot.filled) {
        slotNode.setAttribute('fill', 'var(--hint)');
      }
    }
    node.addEventListener('pointermove', onPointerMove);
    node.addEventListener('pointerup', onPointerUp);
    node.addEventListener('pointercancel', onPointerUp);
  }

  function onPointerMove(ev) {
    if (!dragging || ev.pointerId !== dragging.pointerId) return;
    const p = screenToStage(ev.clientX, ev.clientY);
    dragging.tile.pos.x = p.x - dragging.grabOffset.x;
    dragging.tile.pos.y = p.y - dragging.grabOffset.y;
    updateTileTransform(dragging.tile, dragging.node);
  }

  function onPointerUp(ev) {
    if (!dragging || ev.pointerId !== dragging.pointerId) return;
    const { tile, node } = dragging;
    // Clear hint tints.
    for (const s of currentPuzzle.slots) {
      const sn = stage.querySelector(`[data-slot-index="${s.index}"]`);
      if (sn) sn.setAttribute('fill', 'var(--slot-fill)');
    }
    node.removeEventListener('pointermove', onPointerMove);
    node.removeEventListener('pointerup', onPointerUp);
    node.removeEventListener('pointercancel', onPointerUp);
    node.style.transition = 'transform 380ms cubic-bezier(0.34, 1.2, 0.64, 1)';
    node.style.cursor = 'grab';

    // Hit-test against slots.
    const hit = findHitSlot(tile.pos);
    if (hit && hit.id === tile.id && !hit.filled) {
      tile.atSlotIndex = hit.index;
      hit.filled = true;
      tile.pos = { ...hit.pos };
      updateTileTransform(tile, node, 1.06);
      setTimeout(() => updateTileTransform(tile, node, 1.0), 60);
      playChime(0.6);
      // Recolour matching slot outline to a softer 'settled' tint.
      const slotNode = stage.querySelector(`[data-slot-index="${hit.index}"]`);
      if (slotNode) slotNode.setAttribute('stroke-dasharray', '0');
      checkComplete();
    } else {
      // Spring back home.
      tile.pos = { ...tile.homePos };
      updateTileTransform(tile, node);
    }
    dragging = null;
  }

  function findHitSlot(pos) {
    let best = null;
    let bestDist = Infinity;
    for (const slot of currentPuzzle.slots) {
      const dx = slot.pos.x - pos.x;
      const dy = slot.pos.y - pos.y;
      const d = Math.hypot(dx, dy);
      if (d < tileSize * 0.9 && d < bestDist) {
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

  // ------- puzzle completion + reset -------

  function checkComplete() {
    if (currentPuzzle.slots.every((s) => s.filled)) {
      isTransitioning = true;
      // Gentle celebratory pulse on each filled tile.
      for (const tile of currentPuzzle.tiles) {
        if (!tile.node) continue;
        tile.node.animate(
          [
            { transform: tile.node.getAttribute('transform') },
            { transform: tile.node.getAttribute('transform') + ' scale(1.08)' },
            { transform: tile.node.getAttribute('transform') },
          ],
          { duration: 700, easing: 'ease-in-out' },
        );
      }
      setTimeout(() => playChime(1.0, 0.15), 250);
      setTimeout(() => nextPuzzle(), 1400);
    }
  }

  function nextPuzzle() {
    // Bump level after each solved puzzle (capped) so the ramp is gentle.
    level = Math.min(level + 1, MAX_LEVEL);
    saveLevel();
    // Fade out, generate, fade in.
    stage.style.transition = 'opacity 300ms ease';
    stage.style.opacity = '0';
    setTimeout(() => {
      currentPuzzle = generatePuzzle();
      resizeStage(); // recompute tileSize for the new count
      stage.style.opacity = '1';
      isTransitioning = false;
    }, 320);
  }

  function loadLevel() {
    try {
      const raw = localStorage.getItem('shapes.level');
      const parsed = raw ? parseInt(raw, 10) : START_LEVEL;
      if (Number.isFinite(parsed) && parsed >= START_LEVEL && parsed <= MAX_LEVEL) {
        level = parsed;
      }
    } catch { /* ignore */ }
  }

  function saveLevel() {
    try { localStorage.setItem('shapes.level', String(level)); } catch { /* ignore */ }
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
    // Warm mid-range chime around C5 / E5.
    const base = 523.25;
    osc.frequency.setValueAtTime(base * Math.pow(2, pitchOffset / 12), now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12 * gainMul, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.55);
  }

  // ------- mute persistence + UI -------

  function loadMute() {
    try {
      muted = localStorage.getItem('shapes.muted') === '1';
    } catch { muted = false; }
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

  muteButton.addEventListener('click', () => {
    muted = !muted;
    saveMute();
    updateMuteUI();
  });

  // ------- boot -------

  loadMute();
  loadLevel();
  resizeStage();
  currentPuzzle = generatePuzzle();
  resizeStage();
  layoutPuzzle(currentPuzzle);

  window.addEventListener('resize', resizeStage);
  window.addEventListener('orientationchange', resizeStage);
})();
