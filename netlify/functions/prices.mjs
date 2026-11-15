// GET /api/prices?currency=GBP
// Spot gold and silver per gram in the requested currency, plus FX rates to convert rows
// typed in other currencies. Free, keyless sources:
//   metals: https://api.gold-api.com (USD per troy ounce)
//   FX:     https://api.frankfurter.dev (European Central Bank reference rates)
// If either source fails, falls back to FALLBACK_* env vars (per gram, GBP) so the tool still works.
import { json } from '../lib/shared.mjs';

const TROY_OUNCE_GRAMS = 31.1035;
export const CURRENCIES = ['GBP', 'USD', 'EUR', 'CAD', 'AUD'];

let cache = null; // { at, data }

async function getJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

async function live() {
  const [xau, xag, fx] = await Promise.all([
    getJson('https://api.gold-api.com/price/XAU'),
    getJson('https://api.gold-api.com/price/XAG'),
    getJson(`https://api.frankfurter.dev/v1/latest?from=USD&to=${CURRENCIES.filter((c) => c !== 'USD').join(',')}`),
  ]);
  if (!(xau.price > 0 && xag.price > 0 && fx.rates?.GBP > 0)) throw new Error('bad price data');
  const usdTo = { USD: 1, ...fx.rates };
  return {
    source: 'live',
    updatedAt: xau.updatedAt || new Date().toISOString(),
    fxDate: fx.date,
    usdPerGram: { gold: xau.price / TROY_OUNCE_GRAMS, silver: xag.price / TROY_OUNCE_GRAMS },
    usdTo,
  };
}

function fallback() {
  // Per-gram GBP prices checked 15 Nov 2026. Update via env vars without redeploying code.
  const goldGbp = Number(process.env.FALLBACK_GOLD_GBP_PER_GRAM) || 94.5;
  const silverGbp = Number(process.env.FALLBACK_SILVER_GBP_PER_GRAM) || 1.18;
  const gbpPerUsd = Number(process.env.FALLBACK_GBP_PER_USD) || 0.756;
  return {
    source: 'fallback',
    updatedAt: process.env.FALLBACK_PRICES_DATE || '2026-11-15',
    usdPerGram: { gold: goldGbp / gbpPerUsd, silver: silverGbp / gbpPerUsd },
    usdTo: { USD: 1, GBP: gbpPerUsd, EUR: 0.905, CAD: 1.39, AUD: 1.52 },
  };
}

export default async (req) => {
  const currency = (new URL(req.url).searchParams.get('currency') || 'GBP').toUpperCase();
  if (!CURRENCIES.includes(currency)) return json({ error: 'Unsupported currency' }, 400);

  if (!cache || Date.now() - cache.at > 30 * 60_000) {
    try {
      cache = { at: Date.now(), data: await live() };
    } catch (err) {
      console.error('live prices failed', err.message);
      cache = { at: Date.now() - 25 * 60_000, data: fallback() }; // retry in ~5 min
    }
  }
  const d = cache.data;
  const rate = d.usdTo[currency];
  // rates[X] = how many X per 1 unit of `currency`
  const rates = Object.fromEntries(Object.entries(d.usdTo).map(([k, v]) => [k, v / rate]));
  return json(
    {
      currency,
      goldPerGram: round(d.usdPerGram.gold * rate),
      silverPerGram: round(d.usdPerGram.silver * rate),
      rates,
      source: d.source,
      updatedAt: d.updatedAt,
    },
    200,
    { 'cache-control': 'public, max-age=900' },
  );
};

const round = (n) => Math.round(n * 1000) / 1000;

export const config = { path: '/api/prices' };
