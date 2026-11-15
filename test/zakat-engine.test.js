import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate, evaluateAsset, evaluateLiability, NISAB_GRAMS } from '../public/js/zakat-engine.js';

const prices = { goldPerGram: 100, silverPerGram: 1 };
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test('nisab weights match the standard 87.48g gold / 612.36g silver', () => {
  assert.equal(NISAB_GRAMS.gold, 87.48);
  assert.equal(NISAB_GRAMS.silver, 612.36);
});

test('cash above silver nisab held a year: 2.5% due', () => {
  const r = calculate({ assets: [{ category: 'cash', amount: 5000 }], prices });
  assert.equal(r.status, 'due');
  close(r.nisab, 612.36);
  close(r.zakahDue, 125);
});

test('same cash is below the gold nisab', () => {
  const r = calculate({ assets: [{ category: 'cash', amount: 5000 }], settings: { nisabMetal: 'gold' }, prices });
  close(r.nisab, 8748);
  assert.equal(r.status, 'below_nisab');
  assert.equal(r.zakahDue, 0);
});

test('hawl not complete: nothing due yet, amount still shown', () => {
  const r = calculate({ assets: [{ category: 'cash', amount: 5000 }], settings: { hawl: 'no' }, prices });
  assert.equal(r.status, 'hawl_not_complete');
  assert.equal(r.zakahDue, 0);
  close(r.zakahIfDue, 125);
});

test('solar year uses 2.577%', () => {
  const r = calculate({ assets: [{ category: 'cash', amount: 10000 }], settings: { yearType: 'solar' }, prices });
  close(r.zakahDue, 257.7);
});

test('gold by grams uses karat purity', () => {
  const r = evaluateAsset({ category: 'gold', grams: 24, karat: 18, use: 'investment' }, {}, prices);
  close(r.value, 1800); // 24g * 0.75 * 100
  close(r.zakatable, 1800);
});

test('worn jewellery: included under Hanafi default, excluded when majority view chosen', () => {
  const item = { category: 'gold', amount: 2000, use: 'personal_jewellery' };
  close(evaluateAsset(item, {}, prices).zakatable, 2000);
  close(evaluateAsset(item, { jewellery: 'exclude' }, prices).zakatable, 0);
});

test('investment gold is always zakatable even when jewellery is excluded', () => {
  close(evaluateAsset({ category: 'gold', amount: 2000, use: 'investment' }, { jewellery: 'exclude' }, prices).zakatable, 2000);
});

test('long-term shares use 25% proxy; trading shares 100%; custom percentage respected', () => {
  close(evaluateAsset({ category: 'shares', amount: 10000, intent: 'long_term' }, {}, prices).zakatable, 2500);
  close(evaluateAsset({ category: 'shares', amount: 10000, intent: 'trading' }, {}, prices).zakatable, 10000);
  close(evaluateAsset({ category: 'shares', amount: 10000, intent: 'long_term', zakatablePercent: 40 }, {}, prices).zakatable, 4000);
});

test('unknown share intent is counted cautiously and flagged', () => {
  const r = evaluateAsset({ category: 'shares', amount: 10000, intent: 'unknown' }, {}, prices);
  close(r.zakatable, 10000);
  assert.ok(r.flag);
});

test('pensions: DC 25%, DB and state 0', () => {
  close(evaluateAsset({ category: 'pension', amount: 40000, pensionType: 'defined_contribution' }, {}, prices).zakatable, 10000);
  close(evaluateAsset({ category: 'pension', amount: 40000, pensionType: 'defined_benefit' }, {}, prices).zakatable, 0);
  close(evaluateAsset({ category: 'pension', amount: 40000, pensionType: 'state' }, {}, prices).zakatable, 0);
});

test('property only zakatable when bought for resale', () => {
  close(evaluateAsset({ category: 'property', amount: 300000, propertyUse: 'own_home' }, {}, prices).zakatable, 0);
  close(evaluateAsset({ category: 'property', amount: 300000, propertyUse: 'rental' }, {}, prices).zakatable, 0);
  close(evaluateAsset({ category: 'property', amount: 300000, propertyUse: 'for_resale' }, {}, prices).zakatable, 300000);
  const unknown = evaluateAsset({ category: 'property', amount: 300000 }, {}, prices);
  close(unknown.zakatable, 0);
  assert.ok(unknown.flag);
});

test('receivables: strong counted, weak not', () => {
  close(evaluateAsset({ category: 'receivable', amount: 1000, strength: 'strong' }, {}, prices).zakatable, 1000);
  close(evaluateAsset({ category: 'receivable', amount: 1000, strength: 'weak' }, {}, prices).zakatable, 0);
});

test('crypto and business stock counted in full', () => {
  close(evaluateAsset({ category: 'crypto', amount: 3000 }, {}, prices).zakatable, 3000);
  close(evaluateAsset({ category: 'business_stock', amount: 3000 }, {}, prices).zakatable, 3000);
});

test('debts: short-term deducted, full long-term balance not, Shafi view deducts nothing', () => {
  close(evaluateLiability({ kind: 'due_within_12_months', amount: 500 }, {}).deductible, 500);
  close(evaluateLiability({ kind: 'instalments_next_12_months', amount: 6000 }, {}).deductible, 6000);
  const mortgage = evaluateLiability({ kind: 'long_term_total', amount: 200000 }, {});
  close(mortgage.deductible, 0);
  assert.ok(mortgage.flag);
  close(evaluateLiability({ kind: 'due_within_12_months', amount: 500 }, { deductDebts: false }).deductible, 0);
});

test('debts reduce wealth and can push it below nisab; never negative', () => {
  const r = calculate({
    assets: [{ category: 'cash', amount: 1000 }],
    liabilities: [{ kind: 'due_within_12_months', amount: 900 }],
    prices,
  });
  close(r.netZakatable, 100);
  assert.equal(r.status, 'below_nisab');
  const r2 = calculate({ assets: [{ category: 'cash', amount: 100 }], liabilities: [{ kind: 'due_within_12_months', amount: 900 }], prices });
  close(r2.netZakatable, 0);
});

test('worked example: £5k savings, 20g 22k jewellery, £40k DC pension, £2k credit card', () => {
  const r = calculate({
    assets: [
      { category: 'cash', amount: 5000 },
      { category: 'gold', grams: 20, karat: 22, use: 'personal_jewellery' },
      { category: 'pension', amount: 40000, pensionType: 'defined_contribution' },
    ],
    liabilities: [{ kind: 'due_within_12_months', amount: 2000 }],
    prices,
  });
  // 5000 + 20*(22/24)*100 + 10000 - 2000
  close(r.netZakatable, 5000 + 1833.3333333 + 10000 - 2000);
  close(r.zakahDue, r.netZakatable * 0.025);
});

test('missing prices reported, not silently zero', () => {
  const r = calculate({ assets: [{ category: 'cash', amount: 5000 }], prices: {} });
  assert.equal(r.status, 'missing_prices');
});

test('strings with currency symbols and commas are parsed', () => {
  close(evaluateAsset({ category: 'cash', amount: '£5,000' }, {}, prices).zakatable, 5000);
});
