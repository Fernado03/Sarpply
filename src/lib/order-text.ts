export interface ParsedOrderLine {
  rawText: string;
  skuCode: string | null;
  orderedBundles: number | null;
}

// Intake accepts exactly the Golden 6; adding a SKU is a deliberate change to
// this list, not a side effect of catalogue growth.
export const GOLDEN_SIX_SKU_CODES = ['A1', 'A2', 'B1', 'C1', 'D1', 'E1'] as const;

const SEGMENT_SEPARATOR = /[\n\r,，;；、]+|\s+(?:and|dan)\s+|和|同/;

const UNIT =
  '(?:kotak|box(?:es)?|bundle(?:s)?|pack(?:s)?|pek|bungkus|unit(?:s)?|pcs?|pieces?|biji|buah|箱|盒|包|个|個|份)';

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  satu: 1,
  dua: 2,
  tiga: 3,
  empat: 4,
  lima: 5,
  enam: 6,
  tujuh: 7,
  lapan: 8,
  delapan: 8,
  sembilan: 9,
  sepuluh: 10,
  sebelas: 11,
  'dua belas': 12,
  'tiga belas': 13,
  'empat belas': 14,
  'lima belas': 15,
  'enam belas': 16,
  'tujuh belas': 17,
  'lapan belas': 18,
  'sembilan belas': 19,
  'dua puluh': 20,
};

const NUMBER_WORD_PATTERN = new RegExp(
  `\\b(${Object.keys(NUMBER_WORDS)
    .sort((a, b) => b.length - a.length)
    .join('|')})\\b`,
  'gi',
);

const CHINESE_DIGITS: Record<string, number> = {
  零: 0,
  〇: 0,
  一: 1,
  二: 2,
  两: 2,
  兩: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
};

const CHINESE_NUMERAL = /[零〇一二两兩三四五六七八九十百]+/g;

export function parseOrderText(raw: string): ParsedOrderLine[] {
  return raw
    .split(SEGMENT_SEPARATOR)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .flatMap((segment) => parseSegment(segment));
}

function skuPattern(skuCodes: readonly string[]): RegExp {
  const alternation = [...skuCodes]
    .sort((a, b) => b.length - a.length)
    .join('|');
  return new RegExp(`(?<![A-Za-z0-9])(${alternation})(?![0-9])`, 'gi');
}

const SKU_PATTERN = skuPattern(GOLDEN_SIX_SKU_CODES);

interface QuantityCandidates {
  before: number | null;
  after: number | null;
}

function parseSegment(segment: string): ParsedOrderLine[] {
  const normalised = normaliseNumbers(segment);
  const matches = [...normalised.matchAll(SKU_PATTERN)];
  if (matches.length === 0) {
    return [{ rawText: segment, skuCode: null, orderedBundles: null }];
  }

  const candidates: QuantityCandidates[] = matches.map(() => ({
    before: null,
    after: null,
  }));

  // A gap is the text between two SKUs; it can carry the left SKU's quantity,
  // the right SKU's quantity, or nothing. Assigning it once keeps a quantity
  // from being claimed by both sides.
  for (let position = 0; position <= matches.length; position += 1) {
    const start =
      position === 0
        ? 0
        : (matches[position - 1].index ?? 0) + matches[position - 1][0].length;
    const end =
      position === matches.length
        ? normalised.length
        : (matches[position].index ?? 0);
    const gap = normalised.slice(start, end);

    if (position === 0) {
      candidates[0].before = quantityBefore(gap);
    } else if (position === matches.length) {
      candidates[matches.length - 1].after = quantityAfter(gap);
    } else {
      const attributed = gapQuantity(gap);
      if (attributed?.side === 'left') {
        candidates[position - 1].after = attributed.quantity;
      } else if (attributed) {
        candidates[position].before = attributed.quantity;
      }
    }
  }

  return matches.map((match, position) => ({
    rawText: segment,
    skuCode: match[1].toUpperCase(),
    orderedBundles: agreedQuantity(
      candidates[position].before,
      candidates[position].after,
    ),
  }));
}

function normaliseNumbers(text: string): string {
  return text
    .replace(CHINESE_NUMERAL, (run) => {
      const value = chineseValue(run);
      return value === null ? run : ` ${value} `;
    })
    .replace(NUMBER_WORD_PATTERN, (word) => ` ${NUMBER_WORDS[word.toLowerCase()]} `);
}

function chineseValue(run: string): number | null {
  if (!/[十百]/.test(run) && [...run].length > 1) return null;

  let total = 0;
  let current = 0;
  for (const character of run) {
    if (character === '百') {
      total += (current || 1) * 100;
      current = 0;
    } else if (character === '十') {
      total += (current || 1) * 10;
      current = 0;
    } else {
      const digit = CHINESE_DIGITS[character];
      if (digit === undefined) return null;
      current = digit;
    }
  }

  const value = total + current;
  return Number.isSafeInteger(value) ? value : null;
}

function quantityBefore(text: string): number | null {
  const match = new RegExp(`(\\d+)\\s*${UNIT}?\\s*(?:of\\s*)?$`, 'i').exec(text);
  return match ? validQuantity(match[1]) : null;
}

function quantityAfter(text: string): number | null {
  const marked = markedQuantity(text);
  if (marked !== null) return marked;

  const leading = new RegExp(
    `^\\s*[:：=]?\\s*(\\d+)\\s*${UNIT}?(?![0-9A-Za-z])`,
    'i',
  ).exec(text);
  return leading ? validQuantity(leading[1]) : null;
}

function markedQuantity(text: string): number | null {
  const match = new RegExp(
    `(?:x|×|\\*)\\s*(\\d+)\\s*${UNIT}?(?![0-9A-Za-z])`,
    'i',
  ).exec(text);
  return match ? validQuantity(match[1]) : null;
}

// Between two SKUs a quantity belongs to the side its wording points at:
// "A1 x 3 C1" → left, "A1 2 kotak C1" → right. A bare number binds to the
// SKU it follows; when the cue is absent the gap assigns nothing.
function gapQuantity(
  gap: string,
): { side: 'left' | 'right'; quantity: number } | null {
  const marked = markedQuantity(gap);
  if (marked !== null) return { side: 'left', quantity: marked };

  const unitBeforeRight = new RegExp(`(\\d+)\\s*${UNIT}\\s*$`, 'i').exec(gap);
  if (unitBeforeRight) {
    const quantity = validQuantity(unitBeforeRight[1]);
    if (quantity !== null) return { side: 'right', quantity };
  }

  const leading = /^\s*(\d+)(?![0-9A-Za-z])/.exec(gap);
  if (leading) {
    const quantity = validQuantity(leading[1]);
    if (quantity !== null) return { side: 'left', quantity };
  }

  const trailing = /(\d+)\s*$/.exec(gap);
  if (trailing) {
    const quantity = validQuantity(trailing[1]);
    if (quantity !== null) return { side: 'right', quantity };
  }

  return null;
}

function agreedQuantity(
  before: number | null,
  after: number | null,
): number | null {
  if (before !== null && after !== null) return before === after ? before : null;
  return before ?? after;
}

function validQuantity(digits: string): number | null {
  const quantity = Number(digits);
  return Number.isSafeInteger(quantity) && quantity >= 1 ? quantity : null;
}
