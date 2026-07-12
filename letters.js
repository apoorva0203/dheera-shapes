// Letters and 3-letter word list. Letters are rendered as SVG <text> using
// the system rounded font so they always match the platform's kid-friendly
// typography without shipping a webfont.

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function letterSvg(letter) {
  return (
    `<text x="0" y="0" ` +
    `font-family="&quot;SF Pro Rounded&quot;, -apple-system, &quot;Nunito&quot;, system-ui, sans-serif" ` +
    `font-size="72" font-weight="800" ` +
    `text-anchor="middle" dominant-baseline="central">${letter}</text>`
  );
}

function makeLetterItem(letter) {
  return {
    id: 'letter-' + letter,
    kind: 'letter',
    letter,
    svg: letterSvg(letter),
  };
}

const LETTER_ITEMS = LETTERS.map(makeLetterItem);

// Curated 3-letter word list — common CVC + kid-friendly words. Reviewed
// to avoid anything awkward for a young reader.
const WORD_LIST = [
  'BAT','CAT','HAT','MAT','PAT','RAT','SAT','FAT',
  'DOG','LOG','HOG','BOG','FOG','JOG','COG',
  'BUG','HUG','JUG','MUG','RUG','TUG',
  'BUS','JAR','CAR',
  'SUN','BUN','FUN','RUN','PUN',
  'POT','COT','DOT','HOT','LOT','NOT','ROT','TOT',
  'BED','RED','FED','LED',
  'HOP','MOP','POP','TOP','COP',
  'BAG','TAG','WAG','RAG','NAG',
  'BIG','DIG','FIG','PIG','WIG',
  'TAP','CAP','LAP','MAP','NAP','RAP','SAP',
  'CAN','BAN','FAN','MAN','PAN','TAN','VAN',
  'CUP','PUP',
  'YES','MOM','DAD','TOY','BOY','KEY','PIE','EGG','ICE',
  'ARM','EAR','EYE','EAT','TEA','SEA','SKY','ANT','BEE','PEN','BOX',
  'BEE','ONE','TWO','TEN','DAY','WAY','PAY','HAY','JAY',
  'INK','END','ODD','NEW',
];
