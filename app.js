(() => {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const stage = document.getElementById('stage');
  const muteButton = document.getElementById('mute');

  // Layout constants — an abstract 1000-wide viewBox, heights adapt to the
  // device's aspect ratio.
  const VIEW_W = 1000;
  let viewH = 1400;
  let slotY = 460;
  let trayY = 1050;
  let tileSize = 180;

  // Level increments after each solved puzzle. Puzzle count grows to 8 then
  // plateaus — endless variation via the shape library. Persisted so the
  // child picks up where they left off.
  const START_LEVEL = 1;
  const MAX_SHAPE_COUNT = 8;
  let level = START_LEVEL;

  let currentPuzzle = null;
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

  function shapeCountForLevel(lvl) {
    // 3 shapes at levels 1-2, +1 every 2 levels, capped at MAX_SHAPE_COUNT.
    return Math.min(3 + Math.floor((lvl - 1) / 2), MAX_SHAPE_COUNT);
  }

  // ------- layout -------

  function resizeStage() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const ratio = h / w;
    viewH = Math.round(VIEW_W * ratio);
    stage.setAttribute('viewBox', `0 0 ${VIEW_W} ${viewH}`);

    slotY = Math.round(viewH * 0.26);
    trayY = Math.round(viewH * 0.80);

    // Tiles size to whichever axis is tighter, using the larger of slot vs
    // tile count (letters phase has more tiles than slots because of decoys).
    const columns = currentPuzzle
      ? Math.max(currentPuzzle.slots.length, currentPuzzle.tiles.length)
      : 3;
    const perColumnWidth = VIEW_W / (columns + 1);
    const verticalGap = trayY - slotY;
    tileSize = Math.floor(Math.min(perColumnWidth * 0.42, verticalGap * 0.22, 180));

    if (currentPuzzle) layoutPuzzle(currentPuzzle);
  }

  function rowPositions(count, y) {
    const spacing = VIEW_W / (count + 1);
    return Array.from({ length: count }, (_, i) => ({
      x: Math.round(spacing * (i + 1)),
      y,
    }));
  }

  // ------- puzzle generation -------

  function generatePuzzle() {
    const count = shapeCountForLevel(level);
    const chosenIds = pickN(SHAPES.map((s) => s.id), count);
    const trayIds = shuffle(chosenIds);
    const trayColors = pickN(COLORS, chosenIds.length);
    return {
      slots: chosenIds.map((id, i) => ({ id, index: i, filled: false })),
      tiles: trayIds.map((id, i) => ({ id, color: trayColors[i], atSlotIndex: null })),
    };
  }

  function layoutPuzzle(puzzle) {
    const slotPts = rowPositions(puzzle.slots.length, slotY);
    const trayPts = rowPositions(puzzle.tiles.length, trayY);
    puzzle.slots.forEach((s, i) => { s.pos = slotPts[i]; });
    puzzle.tiles.forEach((t, i) => {
      t.homePos = trayPts[i];
      t.pos = t.atSlotIndex == null ? { ...t.homePos } : { ...puzzle.slots[t.atSlotIndex].pos };
    });
    renderPuzzle(puzzle);
  }

  // ------- rendering -------

  function renderPuzzle(puzzle) {
    while (stage.firstChild) stage.removeChild(stage.firstChild);

    for (const slot of puzzle.slots) {
      // Shapes get a clean outline (no fill). Emojis can't be outlined —
      // emoji rendering ignores stroke — so they stay ghosted via opacity.
      // Either way the reader sees a "faded target; drop matching colour
      // version on top" affordance.
      const kind = itemKind(slot.id);
      const attrs = kind === 'emoji'
        ? {
            transform: `translate(${slot.pos.x}, ${slot.pos.y}) scale(${tileSize / 45})`,
            'data-slot-index': String(slot.index),
            style: 'filter: grayscale(1); opacity: 0.5;',
          }
        : {
            transform: `translate(${slot.pos.x}, ${slot.pos.y}) scale(${tileSize / 45})`,
            'data-slot-index': String(slot.index),
            fill: 'none',
            stroke: 'var(--slot-outline)',
            'stroke-width': '3.5',
            'stroke-linejoin': 'round',
            'stroke-linecap': 'round',
          };
      const g = svgEl('g', attrs);
      g.innerHTML = itemSvgById(slot.id);
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
      const shape = svgEl('g', {
        fill: tile.color,
        stroke: 'rgba(0,0,0,0.05)',
        'stroke-width': '1',
        'pointer-events': 'none',
      });
      shape.innerHTML = itemSvgById(tile.id);
      g.appendChild(shape);
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
          // Hint: matching slot stands out. Emoji slots bump opacity;
          // shape slots keep the outline but thicken the stroke.
          for (const slot of currentPuzzle.slots) {
            const slotNode = stage.querySelector(`[data-slot-index="${slot.index}"]`);
            if (!slotNode) continue;
            if (slot.id === tile.id && !slot.filled) {
              if (itemKind(slot.id) === 'emoji') {
                // Drop grayscale and boost opacity — the matching emoji
                // "lights up" in colour while other slots stay dim + gray.
                slotNode.setAttribute('style', 'filter: none; opacity: 0.85;');
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
            } else {
              sn.setAttribute('stroke-width', '3.5');
            }
          }
          if (tile.atSlotIndex != null) return;

          const hit = findHitSlot(tile.pos);
          if (hit && hit.id === tile.id && !hit.filled) {
            tile.atSlotIndex = hit.index;
            hit.filled = true;
            animateTileTo(tile, node, { x: hit.pos.x, y: hit.pos.y }, 260, { pop: true });
            speak(itemNameById(tile.id));
            // Slot now filled — hide the silhouette so the coloured tile stands alone.
            const slotNode = stage.querySelector(`[data-slot-index="${hit.index}"]`);
            if (slotNode) slotNode.setAttribute('style', 'opacity: 0;');
            checkComplete();
          } else {
            animateTileTo(tile, node, { ...tile.homePos }, 360, { pop: false });
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

  // ------- completion + next puzzle -------

  function checkComplete() {
    if (!currentPuzzle.slots.every((s) => s.filled)) return;
    isTransitioning = true;

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

    setTimeout(() => speak('well done'), 400);
    setTimeout(() => nextPuzzle(), 2200);
  }

  function nextPuzzle() {
    level += 1;
    saveLevel();
    stage.style.transition = 'opacity 300ms ease';
    stage.style.opacity = '0';
    setTimeout(() => {
      currentPuzzle = generatePuzzle();
      resizeStage();
      stage.style.opacity = '1';
      isTransitioning = false;
    }, 320);
  }

  function loadLevel() {
    try {
      const raw = localStorage.getItem('shapes.level');
      const parsed = raw ? parseInt(raw, 10) : START_LEVEL;
      if (Number.isFinite(parsed) && parsed >= START_LEVEL) level = parsed;
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
    const base = 523.25;
    osc.frequency.setValueAtTime(base * Math.pow(2, pitchOffset / 12), now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12 * gainMul, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.55);
  }

  // ------- voice (pre-recorded audio files) -------
  //
  // Kid-account safe: uses HTMLAudioElement + m4a files instead of
  // speechSynthesis (which iOS Screen Time can restrict). iOS Safari
  // requires the first .play() to happen in a user-gesture callback; we
  // unlock the engine with a base64 silent WAV (no network fetch, plays
  // instantly) on the very first pointerdown/touchstart.

  // Tiny silent WAV, ~68 bytes decoded. Plays reliably on any Safari.
  const SILENT_WAV = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
  const warmupPlayer = new Audio(SILENT_WAV);
  const audioCache = new Map(); // slug → Audio instance, keeps files preloaded
  let audioWarmed = false;

  function nameToSlug(name) {
    return String(name).toLowerCase().replace(/\s+/g, '-');
  }

  function getAudioFor(slug) {
    let audio = audioCache.get(slug);
    if (!audio) {
      audio = new Audio(`./audio/${slug}.m4a`);
      audio.preload = 'auto';
      audioCache.set(slug, audio);
    }
    return audio;
  }

  function warmupAudio() {
    if (audioWarmed) return;
    try {
      warmupPlayer.volume = 1.0;
      warmupPlayer.currentTime = 0;
      const p = warmupPlayer.play();
      if (p && typeof p.then === 'function') {
        p.then(() => { audioWarmed = true; debugToast('warmup ok'); })
         .catch((err) => { debugToast('warmup err: ' + (err?.name || err?.message || err)); });
      } else {
        audioWarmed = true;
        debugToast('warmup ok (no promise)');
      }
    } catch (e) { debugToast('warmup throw ' + e); }
  }

  // Toggle audio debug overlay via URL param ?debug=1 (or localStorage key).
  const DEBUG_AUDIO =
    new URLSearchParams(location.search).get('debug') === '1' ||
    (() => { try { return localStorage.getItem('shapes.debug') === '1'; } catch { return false; } })();
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

  function speak(text) {
    if (muted) { debugToast('muted → skip ' + text); return; }
    if (!text) return;
    const slug = nameToSlug(text);
    try {
      const audio = getAudioFor(slug);
      audio.volume = 1.0;
      audio.currentTime = 0;
      const p = audio.play();
      if (p && typeof p.then === 'function') {
        p.then(() => debugToast('▶ ' + slug))
         .catch((err) => {
           debugToast('play err ' + slug + ': ' + (err?.name || err?.message || err));
           try {
             const fresh = new Audio(audio.src);
             fresh.volume = 1.0;
             fresh.play()
               .then(() => debugToast('▶ (retry) ' + slug))
               .catch((e) => debugToast('retry err ' + slug + ': ' + (e?.name || e?.message || e)));
           } catch (e) { debugToast('retry throw ' + slug + ': ' + e); }
         });
      } else {
        debugToast('▶ (no promise) ' + slug);
      }
    } catch (e) {
      debugToast('speak throw ' + slug + ': ' + e);
    }
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
