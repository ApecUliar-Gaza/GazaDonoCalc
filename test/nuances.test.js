import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate, evaluateAsset, evaluateLiability } from '../public/js/zakat-engine.js';

const prices = { goldPerGram: 100, silverPerGram: 1 };
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test('joint account: only your share is counted', () => {
  const r = evaluateAsset({ category: 'cash', amount: 20000, ownershipPercent: 50 }, {}, prices);
  close(r.value, 10000);
  close(r.zakatable, 10000);
  assert.match(r.note, /50%/);
});

test('money held for someone else (0% ownership) is not counted', () => {
  const r = evaluateAsset({ category: 'cash', amount: 3000, ownershipPercent: 0 }, {}, prices);
  close(r.zakatable, 0);
});

test('joint debt: only your share is deducted', () => {
  const r = evaluateLiability({ kind: 'due_within_12_months', amount: 4000, ownershipPercent: 50 }, {});
  close(r.deductible, 2000);
});

test('gold by pieces: 2 bangles of unknown karat estimated at 12g each, 22ct, and flagged', () => {
  const r = evaluateAsset({ category: 'gold', use: 'personal_jewellery', piece: 'bangle', count: 2 }, {}, prices);
  close(r.value, 24 * (22 / 24) * 100);
  assert.ok(r.flag);
  assert.match(r.note, /estimate/);
});

test('gold coins with grams but unknown karat assume 24ct and ask', () => {
  const r = evaluateAsset({ category: 'gold', use: 'investment', grams: 10 }, {}, prices);
  close(r.value, 1000);
  assert.match(r.flag, /karat/);
});

test('known karat and weight: no flag', () => {
  const r = evaluateAsset({ category: 'gold', use: 'investment', grams: 10, karat: 22 }, {}, prices);
  assert.equal(r.flag, null);
});

test('worn jewellery exempt under the non-Hanafi setting, even when estimated', () => {
  const r = evaluateAsset({ category: 'gold', use: 'personal_jewellery', piece: 'necklace' }, { jewellery: 'exclude' }, prices);
  close(r.zakatable, 0);
  assert.ok(r.value > 0);
});

test('zakah already paid in advance is taken off what is due', () => {
  const r = calculate({ assets: [{ category: 'cash', amount: 10000 }], settings: { alreadyPaid: 100 }, prices });
  close(r.zakahIfDue, 250);
  close(r.alreadyPaid, 100);
  close(r.zakahDue, 150);
});

test('already paid can never make zakah negative', () => {
  const r = calculate({ assets: [{ category: 'cash', amount: 10000 }], settings: { alreadyPaid: 999 }, prices });
  close(r.zakahDue, 0);
});

test('pension view "on access": DC pot not counted until it can be accessed', () => {
  const locked = evaluateAsset({ category: 'pension', pensionType: 'defined_contribution', amount: 40000 }, { pensionView: 'on_access' }, prices);
  close(locked.zakatable, 0);
  const open = evaluateAsset({ category: 'pension', pensionType: 'defined_contribution', amount: 40000, accessible: true }, { pensionView: 'on_access' }, prices);
  close(open.zakatable, 10000);
});

test('pension default (NZF): 25% of a DC pot every year', () => {
  const r = evaluateAsset({ category: 'pension', pensionType: 'defined_contribution', amount: 40000 }, {}, prices);
  close(r.zakatable, 10000);
});

test('business: stock and receivables counted, business bills due deducted', () => {
  const r = calculate({
    assets: [{ category: 'business_stock', amount: 30000 }, { category: 'receivable', amount: 5000, strength: 'strong' }],
    liabilities: [{ kind: 'business_due', amount: 8000 }],
    prices,
  });
  close(r.netZakatable, 27000);
  close(r.zakahDue, 675);
});

test('half share of a business: half the stock counted', () => {
  const r = evaluateAsset({ category: 'business_stock', amount: 30000, ownershipPercent: 50 }, {}, prices);
  close(r.zakatable, 15000);
});

test('rental flat value not counted, saved rent is cash', () => {
  const r = calculate({
    assets: [{ category: 'property', propertyUse: 'rental', amount: 250000 }, { category: 'cash', amount: 6000, description: 'saved rent' }],
    prices,
  });
  close(r.zakatableAssets, 6000);
  close(r.zakahDue, 150);
});

test('personal-use items are not zakatable', () => {
  const r = evaluateAsset({ category: 'other', amount: 15000, personalUse: true }, {}, prices);
  close(r.zakatable, 0);
  assert.equal(r.flag, null);
});

test('hawl "not sure" is assumed complete but flagged', () => {
  const r = calculate({ assets: [{ category: 'cash', amount: 10000 }], settings: { hawl: 'unsure' }, prices });
  assert.equal(r.status, 'due');
  assert.ok(r.flags.some((f) => f.id === 'hawl'));
});

test('a complex mix adds up', () => {
  const r = calculate({
    assets: [
      { category: 'cash', amount: 8000 },
      { category: 'cash', amount: 10000, ownershipPercent: 50 }, // joint savings
      { category: 'gold', use: 'personal_jewellery', grams: 50, karat: 22 },
      { category: 'shares', intent: 'long_term', amount: 20000 },
      { category: 'shares', intent: 'trading', amount: 2000 },
      { category: 'crypto', amount: 1000 },
      { category: 'pension', pensionType: 'defined_benefit', amount: 90000 },
      { category: 'property', propertyUse: 'own_home', amount: 300000 },
    ],
    liabilities: [
      { kind: 'instalments_next_12_months', amount: 6000 },
      { kind: 'long_term_total', amount: 180000 },
      { kind: 'due_within_12_months', amount: 1500 },
    ],
    settings: { alreadyPaid: 50 },
    prices,
  });
  // 8000 + 5000 + 50*22/24*100 (4583.33) + 5000 + 2000 + 1000 = 25583.33; less 7500 = 18083.33
  close(r.netZakatable, 25583.333333333336 - 7500);
  close(r.zakahDue, (25583.333333333336 - 7500) * 0.025 - 50);
});
