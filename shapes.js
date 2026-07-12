// Shape library. Each shape has a centred, unit-ish bounding box in the
// range [-45, 45]. Colours are applied via `fill` on the parent <g>.

const SHAPES = [
  { id: 'circle',        svg: '<circle cx="0" cy="0" r="42" />' },
  { id: 'square',        svg: '<rect x="-40" y="-40" width="80" height="80" rx="8" ry="8" />' },
  { id: 'triangle',      svg: '<polygon points="0,-46 40,26 -40,26" />' },
  { id: 'pentagon',      svg: '<polygon points="0,-45 43,-14 27,36 -27,36 -43,-14" />' },
  { id: 'hexagon',       svg: '<polygon points="0,-45 39,-22 39,22 0,45 -39,22 -39,-22" />' },
  { id: 'star5',         svg: '<polygon points="0,-46 13,-14 46,-14 20,7 30,40 0,20 -30,40 -20,7 -46,-14 -13,-14" />' },
  { id: 'heart',         svg: '<path d="M 0 40 C -30 15, -46 -5, -32 -25 C -20 -40, -5 -35, 0 -20 C 5 -35, 20 -40, 32 -25 C 46 -5, 30 15, 0 40 Z" />' },
  { id: 'diamond',       svg: '<polygon points="0,-45 42,0 0,45 -42,0" />' },
  { id: 'oval',          svg: '<ellipse cx="0" cy="0" rx="46" ry="32" />' },
  { id: 'plus',          svg: '<polygon points="-15,-45 15,-45 15,-15 45,-15 45,15 15,15 15,45 -15,45 -15,15 -45,15 -45,-15 -15,-15" />' },
  { id: 'trapezoid',     svg: '<polygon points="-42,30 42,30 26,-30 -26,-30" />' },
  { id: 'parallelogram', svg: '<polygon points="-46,26 22,26 46,-26 -22,-26" />' },
  { id: 'semicircle',    svg: '<path d="M -44,10 A 44,44 0 0 1 44,10 L 44,20 L -44,20 Z" />' },
  { id: 'crescent',      svg: '<path d="M 20 -40 A 44 44 0 1 0 20 40 A 34 34 0 1 1 20 -40 Z" />' },
  { id: 'arrow-right',   svg: '<polygon points="-40,-15 10,-15 10,-32 44,0 10,32 10,15 -40,15" />' },
  { id: 'arrow-up',      svg: '<polygon points="-15,40 -15,-10 -32,-10 0,-44 32,-10 15,-10 15,40" />' },
  { id: 'chevron',       svg: '<polygon points="-42,-18 0,20 42,-18 30,-30 0,-2 -30,-30" />' },
  { id: 'flower',        svg: '<path d="M 0,-42 C 18,-42 26,-18 12,-6 C 30,-18 42,4 30,18 C 42,4 22,32 6,20 C 22,32 -6,42 -12,26 C -6,42 -34,26 -22,10 C -34,26 -34,-18 -14,-14 C -34,-18 -18,-42 0,-42 Z" />' },
  { id: 'sun',           svg: '<g><circle cx="0" cy="0" r="22" /><g stroke="currentColor" stroke-width="6" stroke-linecap="round"><line x1="0" y1="-42" x2="0" y2="-30"/><line x1="0" y1="42" x2="0" y2="30"/><line x1="-42" y1="0" x2="-30" y2="0"/><line x1="42" y1="0" x2="30" y2="0"/><line x1="-30" y1="-30" x2="-22" y2="-22"/><line x1="30" y1="30" x2="22" y2="22"/><line x1="-30" y1="30" x2="-22" y2="22"/><line x1="30" y1="-30" x2="22" y2="-22"/></g></g>' },
  { id: 'cross-x',       svg: '<polygon points="-32,-42 0,-10 32,-42 42,-32 10,0 42,32 32,42 0,10 -32,42 -42,32 -10,0 -42,-32" />' },
  { id: 'ring',          svg: '<path d="M -44,0 A 44,44 0 1 1 44,0 A 44,44 0 1 1 -44,0 Z M -22,0 A 22,22 0 1 0 22,0 A 22,22 0 1 0 -22,0 Z" fill-rule="evenodd" />' },
  { id: 'star6',         svg: '<polygon points="0,-44 12,-22 38,-22 22,0 38,22 12,22 0,44 -12,22 -38,22 -22,0 -38,-22 -12,-22" />' },
  { id: 'kite',          svg: '<polygon points="0,-44 32,-4 0,44 -32,-4" />' },
  { id: 'cloud',         svg: '<path d="M -32,10 C -50,10 -50,-14 -32,-14 C -30,-30 -8,-32 -2,-20 C 4,-32 26,-30 26,-14 C 44,-14 44,10 26,10 Z" />' },
  { id: 'lightning',     svg: '<polygon points="8,-44 -30,4 -6,4 -12,44 26,-8 4,-8 12,-44" />' },

  // Material-style solid icons — kid-friendly, all rendered as flat silhouettes.
  { id: 'house',         svg: '<path d="M -38 -4 L 0 -40 L 38 -4 L 38 38 L 12 38 L 12 10 L -12 10 L -12 38 L -38 38 Z" />' },
  { id: 'car',           svg: '<path d="M -40 6 L -32 -12 L -14 -22 L 14 -22 L 32 -12 L 40 6 L 40 22 Q 40 26 36 26 L -36 26 Q -40 26 -40 22 Z M -22 30 A 8 8 0 1 1 -6 30 A 8 8 0 1 1 -22 30 Z M 6 30 A 8 8 0 1 1 22 30 A 8 8 0 1 1 6 30 Z" />' },
  { id: 'tree',          svg: '<polygon points="0,-42 -24,-12 -14,-12 -30,10 -18,10 -34,32 34,32 18,10 30,10 14,-12 24,-12" /><rect x="-7" y="32" width="14" height="12" />' },
  { id: 'apple',         svg: '<circle cx="0" cy="6" r="34" /><path d="M -2 -38 L 2 -38 L 4 -26 L -4 -26 Z" /><ellipse cx="10" cy="-30" rx="8" ry="5" transform="rotate(20 10 -30)" />' },
  { id: 'balloon',       svg: '<ellipse cx="0" cy="-4" rx="28" ry="34" /><polygon points="-4,28 4,28 3,42 -3,42" />' },
  { id: 'gift',          svg: '<rect x="-38" y="-10" width="76" height="50" rx="4" /><rect x="-7" y="-10" width="14" height="50" /><rect x="-38" y="8" width="76" height="10" /><path d="M -18 -18 Q -18 -30 -6 -30 Q 0 -30 0 -20 Q 0 -30 6 -30 Q 18 -30 18 -18 L 18 -10 L -18 -10 Z" />' },
  { id: 'rocket',        svg: '<path d="M 0 -42 L -16 -12 L -16 24 Q -16 28 -12 28 L 12 28 Q 16 28 16 24 L 16 -12 Z M -16 24 L -26 40 L -18 34 Z M 16 24 L 26 40 L 18 34 Z" /><circle cx="0" cy="-8" r="7" fill="white" />' },
  { id: 'fish',          svg: '<path d="M -38 0 Q -34 -22 -6 -20 Q 4 -12 12 -8 L 34 -22 L 34 22 L 12 8 Q 4 12 -6 20 Q -34 22 -38 0 Z" /><circle cx="-16" cy="-6" r="4" fill="white" />' },
  { id: 'icecream',      svg: '<circle cx="0" cy="-14" r="20" /><circle cx="-14" cy="-24" r="14" /><circle cx="14" cy="-24" r="14" /><polygon points="-22,6 22,6 0,42" />' },
  { id: 'leaf',          svg: '<path d="M -30 30 Q -40 -20 0 -40 Q 40 -20 30 30 Q 20 34 0 32 Q -20 34 -30 30 Z M 0 -40 L 0 32" fill-rule="nonzero" stroke-linejoin="round" />' },
];

const COLORS = [
  '#6BB6FF', // sky blue
  '#7BC47F', // sage green
  '#FFA07A', // warm coral
  '#F5B5C0', // dusty pink
  '#B39DDB', // lavender
  '#E8B84A', // mustard
  '#4DB6AC', // teal
  '#FFCB77', // peach
  '#98D8C8', // seafoam
  '#F4A6C6', // rose
  '#A7C7E7', // powder blue
  '#C8B6E2', // pale purple
  '#EBC4A0', // sand
  '#B7D7B0', // soft mint
];
