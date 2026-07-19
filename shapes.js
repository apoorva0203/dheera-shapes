// Shape library. Two families:
//   1. Geometric shapes — SVG paths in a centred [-45..45] box. Rendered with
//      a fill colour picked per tile.
//   2. Emoji items — real-world objects (fruit / veg / animals) rendered as
//      Twemoji <image> href="/emoji/<name>.svg". `name` also drives voice.
//
// `category` groups items for same-category decoy selection in match mode
// (tier 3+). `CONFUSABLES` below lists visually similar pairs for tier 4+.

const SHAPES = [
  { id: 'circle',        name: 'circle',        kind: 'shape', category: 'shape', svg: '<circle cx="0" cy="0" r="42" />' },
  { id: 'square',        name: 'square',        kind: 'shape', category: 'shape', svg: '<rect x="-40" y="-40" width="80" height="80" rx="8" ry="8" />' },
  { id: 'triangle',      name: 'triangle',      kind: 'shape', category: 'shape', svg: '<polygon points="0,-46 40,26 -40,26" />' },
  { id: 'pentagon',      name: 'pentagon',      kind: 'shape', category: 'shape', svg: '<polygon points="0,-45 43,-14 27,36 -27,36 -43,-14" />' },
  { id: 'hexagon',       name: 'hexagon',       kind: 'shape', category: 'shape', svg: '<polygon points="0,-45 39,-22 39,22 0,45 -39,22 -39,-22" />' },
  { id: 'star5',         name: 'star',          kind: 'shape', category: 'shape', svg: '<polygon points="0,-46 13,-14 46,-14 20,7 30,40 0,20 -30,40 -20,7 -46,-14 -13,-14" />' },
  { id: 'heart',         name: 'heart',         kind: 'shape', category: 'shape', svg: '<path d="M 0 40 C -30 15, -46 -5, -32 -25 C -20 -40, -5 -35, 0 -20 C 5 -35, 20 -40, 32 -25 C 46 -5, 30 15, 0 40 Z" />' },
  { id: 'diamond',       name: 'diamond',       kind: 'shape', category: 'shape', svg: '<polygon points="0,-45 42,0 0,45 -42,0" />' },
  { id: 'oval',          name: 'oval',          kind: 'shape', category: 'shape', svg: '<ellipse cx="0" cy="0" rx="46" ry="32" />' },
  { id: 'plus',          name: 'plus',          kind: 'shape', category: 'shape', svg: '<polygon points="-15,-45 15,-45 15,-15 45,-15 45,15 15,15 15,45 -15,45 -15,15 -45,15 -45,-15 -15,-15" />' },
  { id: 'trapezoid',     name: 'trapezoid',     kind: 'shape', category: 'shape', svg: '<polygon points="-42,30 42,30 26,-30 -26,-30" />' },
  { id: 'parallelogram', name: 'parallelogram', kind: 'shape', category: 'shape', svg: '<polygon points="-46,26 22,26 46,-26 -22,-26" />' },
  { id: 'semicircle',    name: 'half circle',   kind: 'shape', category: 'shape', svg: '<path d="M -44,10 A 44,44 0 0 1 44,10 L 44,20 L -44,20 Z" />' },
  { id: 'crescent',      name: 'moon',          kind: 'shape', category: 'shape', svg: '<path d="M 20 -40 A 44 44 0 1 0 20 40 A 34 34 0 1 1 20 -40 Z" />' },
  { id: 'arrow-right',   name: 'arrow',         kind: 'shape', category: 'shape', svg: '<polygon points="-40,-15 10,-15 10,-32 44,0 10,32 10,15 -40,15" />' },
  { id: 'arrow-up',      name: 'arrow',         kind: 'shape', category: 'shape', svg: '<polygon points="-15,40 -15,-10 -32,-10 0,-44 32,-10 15,-10 15,40" />' },
  { id: 'chevron',       name: 'chevron',       kind: 'shape', category: 'shape', svg: '<polygon points="-42,-18 0,20 42,-18 30,-30 0,-2 -30,-30" />' },
  { id: 'flower',        name: 'flower',        kind: 'shape', category: 'shape', svg: '<path d="M 0,-42 C 18,-42 26,-18 12,-6 C 30,-18 42,4 30,18 C 42,4 22,32 6,20 C 22,32 -6,42 -12,26 C -6,42 -34,26 -22,10 C -34,26 -34,-18 -14,-14 C -34,-18 -18,-42 0,-42 Z" />' },
  { id: 'sun',           name: 'sun',           kind: 'shape', category: 'shape', svg: '<g><circle cx="0" cy="0" r="22" /><g stroke="currentColor" stroke-width="6" stroke-linecap="round"><line x1="0" y1="-42" x2="0" y2="-30"/><line x1="0" y1="42" x2="0" y2="30"/><line x1="-42" y1="0" x2="-30" y2="0"/><line x1="42" y1="0" x2="30" y2="0"/><line x1="-30" y1="-30" x2="-22" y2="-22"/><line x1="30" y1="30" x2="22" y2="22"/><line x1="-30" y1="30" x2="-22" y2="22"/><line x1="30" y1="-30" x2="22" y2="-22"/></g></g>' },
  { id: 'cross-x',       name: 'cross',         kind: 'shape', category: 'shape', svg: '<polygon points="-32,-42 0,-10 32,-42 42,-32 10,0 42,32 32,42 0,10 -32,42 -42,32 -10,0 -42,-32" />' },
  { id: 'ring',          name: 'ring',          kind: 'shape', category: 'shape', svg: '<path d="M -44,0 A 44,44 0 1 1 44,0 A 44,44 0 1 1 -44,0 Z M -22,0 A 22,22 0 1 0 22,0 A 22,22 0 1 0 -22,0 Z" fill-rule="evenodd" />' },
  { id: 'star6',         name: 'star',          kind: 'shape', category: 'shape', svg: '<polygon points="0,-44 12,-22 38,-22 22,0 38,22 12,22 0,44 -12,22 -38,22 -22,0 -38,-22 -12,-22" />' },
  { id: 'kite',          name: 'kite',          kind: 'shape', category: 'shape', svg: '<polygon points="0,-44 32,-4 0,44 -32,-4" />' },
  { id: 'cloud',         name: 'cloud',         kind: 'shape', category: 'shape', svg: '<path d="M -32,10 C -50,10 -50,-14 -32,-14 C -30,-30 -8,-32 -2,-20 C 4,-32 26,-30 26,-14 C 44,-14 44,10 26,10 Z" />' },
  { id: 'lightning',     name: 'lightning',     kind: 'shape', category: 'shape', svg: '<polygon points="8,-44 -30,4 -6,4 -12,44 26,-8 4,-8 12,-44" />' },

  // Fruits
  { id: 'e-apple',       name: 'apple',        kind: 'emoji', category: 'fruit',     emoji: '🍎' },
  { id: 'e-banana',      name: 'banana',       kind: 'emoji', category: 'fruit',     emoji: '🍌' },
  { id: 'e-orange',      name: 'orange',       kind: 'emoji', category: 'fruit',     emoji: '🍊' },
  { id: 'e-strawberry',  name: 'strawberry',   kind: 'emoji', category: 'fruit',     emoji: '🍓' },
  { id: 'e-watermelon',  name: 'watermelon',   kind: 'emoji', category: 'fruit',     emoji: '🍉' },
  { id: 'e-grapes',      name: 'grapes',       kind: 'emoji', category: 'fruit',     emoji: '🍇' },
  { id: 'e-pear',        name: 'pear',         kind: 'emoji', category: 'fruit',     emoji: '🍐' },
  { id: 'e-peach',       name: 'peach',        kind: 'emoji', category: 'fruit',     emoji: '🍑' },
  { id: 'e-cherries',    name: 'cherries',     kind: 'emoji', category: 'fruit',     emoji: '🍒' },
  { id: 'e-pineapple',   name: 'pineapple',    kind: 'emoji', category: 'fruit',     emoji: '🍍' },

  // Vegetables
  { id: 'e-carrot',      name: 'carrot',       kind: 'emoji', category: 'vegetable', emoji: '🥕' },
  { id: 'e-broccoli',    name: 'broccoli',     kind: 'emoji', category: 'vegetable', emoji: '🥦' },
  { id: 'e-corn',        name: 'corn',         kind: 'emoji', category: 'vegetable', emoji: '🌽' },
  { id: 'e-mushroom',    name: 'mushroom',     kind: 'emoji', category: 'vegetable', emoji: '🍄' },
  { id: 'e-eggplant',    name: 'eggplant',     kind: 'emoji', category: 'vegetable', emoji: '🍆' },
  { id: 'e-avocado',     name: 'avocado',      kind: 'emoji', category: 'vegetable', emoji: '🥑' },
  { id: 'e-tomato',      name: 'tomato',       kind: 'emoji', category: 'vegetable', emoji: '🍅' },
  { id: 'e-potato',      name: 'potato',       kind: 'emoji', category: 'vegetable', emoji: '🥔' },
  { id: 'e-cucumber',    name: 'cucumber',     kind: 'emoji', category: 'vegetable', emoji: '🥒' },

  // Animals
  { id: 'e-cat',         name: 'cat',          kind: 'emoji', category: 'animal',    emoji: '🐱' },
  { id: 'e-dog',         name: 'dog',          kind: 'emoji', category: 'animal',    emoji: '🐶' },
  { id: 'e-rabbit',      name: 'rabbit',       kind: 'emoji', category: 'animal',    emoji: '🐰' },
  { id: 'e-bear',        name: 'bear',         kind: 'emoji', category: 'animal',    emoji: '🐻' },
  { id: 'e-panda',       name: 'panda',        kind: 'emoji', category: 'animal',    emoji: '🐼' },
  { id: 'e-lion',        name: 'lion',         kind: 'emoji', category: 'animal',    emoji: '🦁' },
  { id: 'e-tiger',       name: 'tiger',        kind: 'emoji', category: 'animal',    emoji: '🐯' },
  { id: 'e-monkey',      name: 'monkey',       kind: 'emoji', category: 'animal',    emoji: '🐵' },
  { id: 'e-fox',         name: 'fox',          kind: 'emoji', category: 'animal',    emoji: '🦊' },
  { id: 'e-frog',        name: 'frog',         kind: 'emoji', category: 'animal',    emoji: '🐸' },
  { id: 'e-pig',         name: 'pig',          kind: 'emoji', category: 'animal',    emoji: '🐷' },
  { id: 'e-cow',         name: 'cow',          kind: 'emoji', category: 'animal',    emoji: '🐮' },
  { id: 'e-horse',       name: 'horse',        kind: 'emoji', category: 'animal',    emoji: '🐴' },
  { id: 'e-elephant',    name: 'elephant',     kind: 'emoji', category: 'animal',    emoji: '🐘' },
  { id: 'e-penguin',     name: 'penguin',      kind: 'emoji', category: 'animal',    emoji: '🐧' },
  { id: 'e-owl',         name: 'owl',          kind: 'emoji', category: 'animal',    emoji: '🦉' },
  { id: 'e-turtle',      name: 'turtle',       kind: 'emoji', category: 'animal',    emoji: '🐢' },
  { id: 'e-butterfly',   name: 'butterfly',    kind: 'emoji', category: 'animal',    emoji: '🦋' },
  { id: 'e-fish',        name: 'fish',         kind: 'emoji', category: 'animal',    emoji: '🐠' },
  { id: 'e-whale',       name: 'whale',        kind: 'emoji', category: 'animal',    emoji: '🐳' },

  // Letters A-Z (uppercase). Rendered as SVG <text>. `char` is what's drawn.
  { id: 'l-a', name: 'a', kind: 'text', category: 'letter', char: 'A' },
  { id: 'l-b', name: 'b', kind: 'text', category: 'letter', char: 'B' },
  { id: 'l-c', name: 'c', kind: 'text', category: 'letter', char: 'C' },
  { id: 'l-d', name: 'd', kind: 'text', category: 'letter', char: 'D' },
  { id: 'l-e', name: 'e', kind: 'text', category: 'letter', char: 'E' },
  { id: 'l-f', name: 'f', kind: 'text', category: 'letter', char: 'F' },
  { id: 'l-g', name: 'g', kind: 'text', category: 'letter', char: 'G' },
  { id: 'l-h', name: 'h', kind: 'text', category: 'letter', char: 'H' },
  { id: 'l-i', name: 'i', kind: 'text', category: 'letter', char: 'I' },
  { id: 'l-j', name: 'j', kind: 'text', category: 'letter', char: 'J' },
  { id: 'l-k', name: 'k', kind: 'text', category: 'letter', char: 'K' },
  { id: 'l-l', name: 'l', kind: 'text', category: 'letter', char: 'L' },
  { id: 'l-m', name: 'm', kind: 'text', category: 'letter', char: 'M' },
  { id: 'l-n', name: 'n', kind: 'text', category: 'letter', char: 'N' },
  { id: 'l-o', name: 'o', kind: 'text', category: 'letter', char: 'O' },
  { id: 'l-p', name: 'p', kind: 'text', category: 'letter', char: 'P' },
  { id: 'l-q', name: 'q', kind: 'text', category: 'letter', char: 'Q' },
  { id: 'l-r', name: 'r', kind: 'text', category: 'letter', char: 'R' },
  { id: 'l-s', name: 's', kind: 'text', category: 'letter', char: 'S' },
  { id: 'l-t', name: 't', kind: 'text', category: 'letter', char: 'T' },
  { id: 'l-u', name: 'u', kind: 'text', category: 'letter', char: 'U' },
  { id: 'l-v', name: 'v', kind: 'text', category: 'letter', char: 'V' },
  { id: 'l-w', name: 'w', kind: 'text', category: 'letter', char: 'W' },
  { id: 'l-x', name: 'x', kind: 'text', category: 'letter', char: 'X' },
  { id: 'l-y', name: 'y', kind: 'text', category: 'letter', char: 'Y' },
  { id: 'l-z', name: 'z', kind: 'text', category: 'letter', char: 'Z' },

  // Numbers 1-10.
  { id: 'n-1',  name: '1',  kind: 'text', category: 'number', char: '1' },
  { id: 'n-2',  name: '2',  kind: 'text', category: 'number', char: '2' },
  { id: 'n-3',  name: '3',  kind: 'text', category: 'number', char: '3' },
  { id: 'n-4',  name: '4',  kind: 'text', category: 'number', char: '4' },
  { id: 'n-5',  name: '5',  kind: 'text', category: 'number', char: '5' },
  { id: 'n-6',  name: '6',  kind: 'text', category: 'number', char: '6' },
  { id: 'n-7',  name: '7',  kind: 'text', category: 'number', char: '7' },
  { id: 'n-8',  name: '8',  kind: 'text', category: 'number', char: '8' },
  { id: 'n-9',  name: '9',  kind: 'text', category: 'number', char: '9' },
  { id: 'n-10', name: '10', kind: 'text', category: 'number', char: '10' },
];

// Bidirectional; every listed pair mirrors both ways at lookup time.
const CONFUSABLE_PAIRS = [
  ['circle', 'oval'],
  ['circle', 'ring'],
  ['oval', 'ring'],
  ['square', 'diamond'],
  ['triangle', 'kite'],
  ['pentagon', 'hexagon'],
  ['star5', 'star6'],
  ['arrow-right', 'arrow-up'],
  ['crescent', 'semicircle'],
  ['sun', 'flower'],
  ['heart', 'diamond'],
  ['plus', 'cross-x'],

  ['e-apple', 'e-tomato'],
  ['e-apple', 'e-pear'],
  ['e-orange', 'e-peach'],
  ['e-strawberry', 'e-cherries'],
  ['e-broccoli', 'e-avocado'],
  ['e-eggplant', 'e-cucumber'],
  ['e-potato', 'e-mushroom'],

  ['e-cat', 'e-tiger'],
  ['e-cat', 'e-fox'],
  ['e-dog', 'e-fox'],
  ['e-bear', 'e-panda'],
  ['e-monkey', 'e-lion'],
  ['e-frog', 'e-turtle'],
  ['e-fish', 'e-whale'],
  ['e-cow', 'e-pig'],
  ['e-cow', 'e-horse'],
  ['e-tiger', 'e-lion'],

  // Letter confusables (uppercase).
  ['l-e', 'l-f'],
  ['l-o', 'l-q'],
  ['l-c', 'l-g'],
  ['l-p', 'l-r'],
  ['l-b', 'l-p'],
  ['l-b', 'l-d'],
  ['l-b', 'l-r'],
  ['l-d', 'l-p'],
  ['l-m', 'l-n'],
  ['l-m', 'l-w'],
  ['l-n', 'l-h'],
  ['l-u', 'l-v'],
  ['l-i', 'l-l'],
  ['l-i', 'l-t'],
  ['l-k', 'l-x'],
  ['l-a', 'l-v'],
  ['l-c', 'l-o'],
  ['l-n', 'l-z'],
  ['l-y', 'l-v'],

  // Number confusables.
  ['n-6', 'n-9'],
  ['n-3', 'n-8'],
  ['n-1', 'n-7'],
  ['n-5', 'n-6'],
  ['n-2', 'n-5'],
  ['n-4', 'n-9'],

  // Cross letter/number confusables (visually similar glyphs).
  ['l-o', 'n-10'],   // O and 1-0 both round-ish, only weak — keeps them apart in tiers
  ['l-i', 'n-1'],
  ['l-z', 'n-2'],
  ['l-s', 'n-5'],
  ['l-g', 'n-6'],
  ['l-b', 'n-8'],
];

const CONFUSABLES = (() => {
  const map = new Map();
  const add = (a, b) => {
    if (!map.has(a)) map.set(a, []);
    map.get(a).push(b);
  };
  for (const [a, b] of CONFUSABLE_PAIRS) {
    add(a, b);
    add(b, a);
  }
  return map;
})();

// Items in active use by the current game phase. Shapes + emoji stay in
// SHAPES above (data + assets preserved for future modes) but are excluded
// from what the match-mode game picks.
const ACTIVE_ITEMS = SHAPES.filter((s) => s.kind === 'text');

const COLORS = [
  '#6BB6FF', '#7BC47F', '#FFA07A', '#F5B5C0', '#B39DDB',
  '#E8B84A', '#4DB6AC', '#FFCB77', '#98D8C8', '#F4A6C6',
  '#A7C7E7', '#C8B6E2', '#EBC4A0', '#B7D7B0',
];
