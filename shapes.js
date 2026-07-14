// Shape library. Two families:
//   1. Geometric shapes — SVG paths in a centred [-45..45] box. Rendered with
//      a fill colour picked per tile.
//   2. Emoji items — real-world objects (fruit / veg / animals) rendered as
//      SVG <text> so they show the system's colour emoji (Apple Color Emoji
//      on iPad). `name` is what the voice reads aloud.

const SHAPES = [
  { id: 'circle',        name: 'circle',        kind: 'shape', svg: '<circle cx="0" cy="0" r="42" />' },
  { id: 'square',        name: 'square',        kind: 'shape', svg: '<rect x="-40" y="-40" width="80" height="80" rx="8" ry="8" />' },
  { id: 'triangle',      name: 'triangle',      kind: 'shape', svg: '<polygon points="0,-46 40,26 -40,26" />' },
  { id: 'pentagon',      name: 'pentagon',      kind: 'shape', svg: '<polygon points="0,-45 43,-14 27,36 -27,36 -43,-14" />' },
  { id: 'hexagon',       name: 'hexagon',       kind: 'shape', svg: '<polygon points="0,-45 39,-22 39,22 0,45 -39,22 -39,-22" />' },
  { id: 'star5',         name: 'star',          kind: 'shape', svg: '<polygon points="0,-46 13,-14 46,-14 20,7 30,40 0,20 -30,40 -20,7 -46,-14 -13,-14" />' },
  { id: 'heart',         name: 'heart',         kind: 'shape', svg: '<path d="M 0 40 C -30 15, -46 -5, -32 -25 C -20 -40, -5 -35, 0 -20 C 5 -35, 20 -40, 32 -25 C 46 -5, 30 15, 0 40 Z" />' },
  { id: 'diamond',       name: 'diamond',       kind: 'shape', svg: '<polygon points="0,-45 42,0 0,45 -42,0" />' },
  { id: 'oval',          name: 'oval',          kind: 'shape', svg: '<ellipse cx="0" cy="0" rx="46" ry="32" />' },
  { id: 'plus',          name: 'plus',          kind: 'shape', svg: '<polygon points="-15,-45 15,-45 15,-15 45,-15 45,15 15,15 15,45 -15,45 -15,15 -45,15 -45,-15 -15,-15" />' },
  { id: 'trapezoid',     name: 'trapezoid',     kind: 'shape', svg: '<polygon points="-42,30 42,30 26,-30 -26,-30" />' },
  { id: 'parallelogram', name: 'parallelogram', kind: 'shape', svg: '<polygon points="-46,26 22,26 46,-26 -22,-26" />' },
  { id: 'semicircle',    name: 'half circle',   kind: 'shape', svg: '<path d="M -44,10 A 44,44 0 0 1 44,10 L 44,20 L -44,20 Z" />' },
  { id: 'crescent',      name: 'moon',          kind: 'shape', svg: '<path d="M 20 -40 A 44 44 0 1 0 20 40 A 34 34 0 1 1 20 -40 Z" />' },
  { id: 'arrow-right',   name: 'arrow',         kind: 'shape', svg: '<polygon points="-40,-15 10,-15 10,-32 44,0 10,32 10,15 -40,15" />' },
  { id: 'arrow-up',      name: 'arrow',         kind: 'shape', svg: '<polygon points="-15,40 -15,-10 -32,-10 0,-44 32,-10 15,-10 15,40" />' },
  { id: 'chevron',       name: 'chevron',       kind: 'shape', svg: '<polygon points="-42,-18 0,20 42,-18 30,-30 0,-2 -30,-30" />' },
  { id: 'flower',        name: 'flower',        kind: 'shape', svg: '<path d="M 0,-42 C 18,-42 26,-18 12,-6 C 30,-18 42,4 30,18 C 42,4 22,32 6,20 C 22,32 -6,42 -12,26 C -6,42 -34,26 -22,10 C -34,26 -34,-18 -14,-14 C -34,-18 -18,-42 0,-42 Z" />' },
  { id: 'sun',           name: 'sun',           kind: 'shape', svg: '<g><circle cx="0" cy="0" r="22" /><g stroke="currentColor" stroke-width="6" stroke-linecap="round"><line x1="0" y1="-42" x2="0" y2="-30"/><line x1="0" y1="42" x2="0" y2="30"/><line x1="-42" y1="0" x2="-30" y2="0"/><line x1="42" y1="0" x2="30" y2="0"/><line x1="-30" y1="-30" x2="-22" y2="-22"/><line x1="30" y1="30" x2="22" y2="22"/><line x1="-30" y1="30" x2="-22" y2="22"/><line x1="30" y1="-30" x2="22" y2="-22"/></g></g>' },
  { id: 'cross-x',       name: 'cross',         kind: 'shape', svg: '<polygon points="-32,-42 0,-10 32,-42 42,-32 10,0 42,32 32,42 0,10 -32,42 -42,32 -10,0 -42,-32" />' },
  { id: 'ring',          name: 'ring',          kind: 'shape', svg: '<path d="M -44,0 A 44,44 0 1 1 44,0 A 44,44 0 1 1 -44,0 Z M -22,0 A 22,22 0 1 0 22,0 A 22,22 0 1 0 -22,0 Z" fill-rule="evenodd" />' },
  { id: 'star6',         name: 'star',          kind: 'shape', svg: '<polygon points="0,-44 12,-22 38,-22 22,0 38,22 12,22 0,44 -12,22 -38,22 -22,0 -38,-22 -12,-22" />' },
  { id: 'kite',          name: 'kite',          kind: 'shape', svg: '<polygon points="0,-44 32,-4 0,44 -32,-4" />' },
  { id: 'cloud',         name: 'cloud',         kind: 'shape', svg: '<path d="M -32,10 C -50,10 -50,-14 -32,-14 C -30,-30 -8,-32 -2,-20 C 4,-32 26,-30 26,-14 C 44,-14 44,10 26,10 Z" />' },
  { id: 'lightning',     name: 'lightning',     kind: 'shape', svg: '<polygon points="8,-44 -30,4 -6,4 -12,44 26,-8 4,-8 12,-44" />' },

  // Fruits
  { id: 'e-apple',       name: 'apple',        kind: 'emoji', emoji: '🍎' },
  { id: 'e-banana',      name: 'banana',       kind: 'emoji', emoji: '🍌' },
  { id: 'e-orange',      name: 'orange',       kind: 'emoji', emoji: '🍊' },
  { id: 'e-strawberry',  name: 'strawberry',   kind: 'emoji', emoji: '🍓' },
  { id: 'e-watermelon',  name: 'watermelon',   kind: 'emoji', emoji: '🍉' },
  { id: 'e-grapes',      name: 'grapes',       kind: 'emoji', emoji: '🍇' },
  { id: 'e-pear',        name: 'pear',         kind: 'emoji', emoji: '🍐' },
  { id: 'e-peach',       name: 'peach',        kind: 'emoji', emoji: '🍑' },
  { id: 'e-cherries',    name: 'cherries',     kind: 'emoji', emoji: '🍒' },
  { id: 'e-pineapple',   name: 'pineapple',    kind: 'emoji', emoji: '🍍' },

  // Vegetables
  { id: 'e-carrot',      name: 'carrot',       kind: 'emoji', emoji: '🥕' },
  { id: 'e-broccoli',    name: 'broccoli',     kind: 'emoji', emoji: '🥦' },
  { id: 'e-corn',        name: 'corn',         kind: 'emoji', emoji: '🌽' },
  { id: 'e-mushroom',    name: 'mushroom',     kind: 'emoji', emoji: '🍄' },
  { id: 'e-eggplant',    name: 'eggplant',     kind: 'emoji', emoji: '🍆' },
  { id: 'e-avocado',     name: 'avocado',      kind: 'emoji', emoji: '🥑' },
  { id: 'e-tomato',      name: 'tomato',       kind: 'emoji', emoji: '🍅' },
  { id: 'e-potato',      name: 'potato',       kind: 'emoji', emoji: '🥔' },
  { id: 'e-cucumber',    name: 'cucumber',     kind: 'emoji', emoji: '🥒' },

  // Animals
  { id: 'e-cat',         name: 'cat',          kind: 'emoji', emoji: '🐱' },
  { id: 'e-dog',         name: 'dog',          kind: 'emoji', emoji: '🐶' },
  { id: 'e-rabbit',      name: 'rabbit',       kind: 'emoji', emoji: '🐰' },
  { id: 'e-bear',        name: 'bear',         kind: 'emoji', emoji: '🐻' },
  { id: 'e-panda',       name: 'panda',        kind: 'emoji', emoji: '🐼' },
  { id: 'e-lion',        name: 'lion',         kind: 'emoji', emoji: '🦁' },
  { id: 'e-tiger',       name: 'tiger',        kind: 'emoji', emoji: '🐯' },
  { id: 'e-monkey',      name: 'monkey',       kind: 'emoji', emoji: '🐵' },
  { id: 'e-fox',         name: 'fox',          kind: 'emoji', emoji: '🦊' },
  { id: 'e-frog',        name: 'frog',         kind: 'emoji', emoji: '🐸' },
  { id: 'e-pig',         name: 'pig',          kind: 'emoji', emoji: '🐷' },
  { id: 'e-cow',         name: 'cow',          kind: 'emoji', emoji: '🐮' },
  { id: 'e-horse',       name: 'horse',        kind: 'emoji', emoji: '🐴' },
  { id: 'e-elephant',    name: 'elephant',     kind: 'emoji', emoji: '🐘' },
  { id: 'e-penguin',     name: 'penguin',      kind: 'emoji', emoji: '🐧' },
  { id: 'e-owl',         name: 'owl',          kind: 'emoji', emoji: '🦉' },
  { id: 'e-turtle',      name: 'turtle',       kind: 'emoji', emoji: '🐢' },
  { id: 'e-butterfly',   name: 'butterfly',    kind: 'emoji', emoji: '🦋' },
  { id: 'e-fish',        name: 'fish',         kind: 'emoji', emoji: '🐠' },
  { id: 'e-whale',       name: 'whale',        kind: 'emoji', emoji: '🐳' },
];

const COLORS = [
  '#6BB6FF', '#7BC47F', '#FFA07A', '#F5B5C0', '#B39DDB',
  '#E8B84A', '#4DB6AC', '#FFCB77', '#98D8C8', '#F4A6C6',
  '#A7C7E7', '#C8B6E2', '#EBC4A0', '#B7D7B0',
];
