import { describe, expect, it } from 'vitest';
import { parseOrderText } from '../src/lib/order-text';

describe('text order parser', () => {
  it('reads a comma-separated reply as one line per SKU', () => {
    expect(parseOrderText('A1 x 3, C1 2')).toEqual([
      { rawText: 'A1 x 3', skuCode: 'A1', orderedBundles: 3 },
      { rawText: 'C1 2', skuCode: 'C1', orderedBundles: 2 },
    ]);
  });

  it('reads a quantity written before the SKU', () => {
    expect(parseOrderText('3 kotak A1')).toEqual([
      { rawText: '3 kotak A1', skuCode: 'A1', orderedBundles: 3 },
    ]);
  });

  it('reads Malay number words', () => {
    expect(parseOrderText('tiga kotak A1, dua kotak C1')).toEqual([
      { rawText: 'tiga kotak A1', skuCode: 'A1', orderedBundles: 3 },
      { rawText: 'dua kotak C1', skuCode: 'C1', orderedBundles: 2 },
    ]);
  });

  it('reads English number words', () => {
    expect(parseOrderText('three boxes of A1')).toEqual([
      { rawText: 'three boxes of A1', skuCode: 'A1', orderedBundles: 3 },
    ]);
  });

  it('reads Chinese numerals', () => {
    expect(parseOrderText('五箱 D1, 十二包 E1')).toEqual([
      { rawText: '五箱 D1', skuCode: 'D1', orderedBundles: 5 },
      { rawText: '十二包 E1', skuCode: 'E1', orderedBundles: 12 },
    ]);
  });

  it('reads a mixed-language reply', () => {
    expect(parseOrderText('A1 x 3, 2 kotak C1, 五箱 D1')).toEqual([
      { rawText: 'A1 x 3', skuCode: 'A1', orderedBundles: 3 },
      { rawText: '2 kotak C1', skuCode: 'C1', orderedBundles: 2 },
      { rawText: '五箱 D1', skuCode: 'D1', orderedBundles: 5 },
    ]);
  });

  it('keeps an unrecognised phrase as a blank line', () => {
    expect(parseOrderText('A1 x 3, the usual 2')).toEqual([
      { rawText: 'A1 x 3', skuCode: 'A1', orderedBundles: 3 },
      { rawText: 'the usual 2', skuCode: null, orderedBundles: null },
    ]);
  });

  it('does not read an order from a SKU outside the Golden 6', () => {
    expect(parseOrderText('Z9 x 3')).toEqual([
      { rawText: 'Z9 x 3', skuCode: null, orderedBundles: null },
    ]);
  });

  it('leaves a missing quantity blank instead of guessing', () => {
    expect(parseOrderText('A1 x')).toEqual([
      { rawText: 'A1 x', skuCode: 'A1', orderedBundles: null },
    ]);
    expect(parseOrderText('A1 22oz')).toEqual([
      { rawText: 'A1 22oz', skuCode: 'A1', orderedBundles: null },
    ]);
  });

  it('refuses a zero quantity', () => {
    expect(parseOrderText('A1 x 0')).toEqual([
      { rawText: 'A1 x 0', skuCode: 'A1', orderedBundles: null },
    ]);
  });

  it('reads multi-line replies and ignores empty segments', () => {
    expect(parseOrderText('A1 x 3\n\nC1 2,\n')).toEqual([
      { rawText: 'A1 x 3', skuCode: 'A1', orderedBundles: 3 },
      { rawText: 'C1 2', skuCode: 'C1', orderedBundles: 2 },
    ]);
  });

  it('matches SKU codes regardless of case and without spaces', () => {
    expect(parseOrderText('a1x3')).toEqual([
      { rawText: 'a1x3', skuCode: 'A1', orderedBundles: 3 },
    ]);
  });

  it('splits an order joined by "dan" into separate lines', () => {
    expect(parseOrderText('A1 x 3 dan C1 2')).toEqual([
      { rawText: 'A1 x 3', skuCode: 'A1', orderedBundles: 3 },
      { rawText: 'C1 2', skuCode: 'C1', orderedBundles: 2 },
    ]);
  });

  it('pairs each SKU with its own quantity in one segment', () => {
    expect(parseOrderText('A1 x 3 C1 2')).toEqual([
      { rawText: 'A1 x 3 C1 2', skuCode: 'A1', orderedBundles: 3 },
      { rawText: 'A1 x 3 C1 2', skuCode: 'C1', orderedBundles: 2 },
    ]);
    expect(parseOrderText('3 kotak A1 2 kotak C1')).toEqual([
      { rawText: '3 kotak A1 2 kotak C1', skuCode: 'A1', orderedBundles: 3 },
      { rawText: '3 kotak A1 2 kotak C1', skuCode: 'C1', orderedBundles: 2 },
    ]);
  });

  it('leaves a conflicting quantity blank rather than guessing', () => {
    expect(parseOrderText('2 kotak A1 x 3')).toEqual([
      { rawText: '2 kotak A1 x 3', skuCode: 'A1', orderedBundles: null },
    ]);
  });
});
