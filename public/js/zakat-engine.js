// Zakah calculation engine.
//
// This file is the single source of truth for every Shariah rule the tool applies.
// It runs in the browser (to show the result) and in the email function (to rebuild the
// breakdown server-side so nobody can send arbitrary content through it).
//
// The AI never decides a ruling. It only turns a sentence into rows; every row is then
// evaluated here by fixed, reviewable rules. Where scholars differ, the rule is a setting
// with a default and a note, never a silent choice.

export const NISAB_GRAMS = { gold: 87.48, silver: 612.36 };

// 2.5% per lunar (Hijri) year. A solar year is ~11 days longer, so scholars who allow a
// solar-year anniversary adjust the rate to 2.577%.
export const ZAKAT_RATE = { lunar: 0.025, solar: 0.02577 };

// Fraction of pure gold by karat. Zakah is on the pure metal content.
export const KARAT_PURITY = { 24: 1, 22: 22 / 24, 21: 21 / 24, 18: 18 / 24, 14: 14 / 24, 10: 10 / 24, 9: 9 / 24 };

// Silver fineness (parts per thousand).
export const SILVER_PURITY = { 999: 0.999, 958: 0.958, 925: 0.925, 900: 0.9, 800: 0.8 };

// NZF's proxy for the zakatable portion of shares held for the long term (and of
// share-based defined-contribution pension funds) when company balance sheets are not
// to hand: 25% of market value.
export const LONG_TERM_SHARE_PROXY = 0.25;

export const DEFAULT_SETTINGS = Object.freeze({
  currency: 'GBP',
  nisabMetal: 'silver', // NZF recommends silver: "safer and more beneficial for the recipients"
  jewellery: 'include', // Hanafi view (and the cautious one). 'exclude' = majority of other schools.
  deductDebts: true, // Hanafi/Hanbali and NZF allow deducting debts due within 12 months.
  yearType: 'lunar',
  hawl: 'yes', // 'yes' | 'no' | 'unsure'
});

export const SOURCES = {
  nzfCalc: {
    title: 'National Zakat Foundation (UK): Calculating your Zakat',
    url: 'https://nzf.org.uk/wp-content/uploads/2021/03/NZF_Calculating-your-Zakat_A5_P_2021_V1.1.pdf',
  },
  nzfNisab: { title: "NZF: What is today's Nisab?", url: 'https://nzf.org.uk/nisab/' },
  nzfJewellery: {
    title: 'NZF: Zakat on gold, silver and jewellery',
    url: 'https://nzf.org.uk/knowledge/zakat-on-gold-silver-jewellery/',
  },
  nzfPensions: { title: 'NZF: Zakat on pensions', url: 'https://nzf.org.uk/knowledge/pensions/' },
  nzfProperty: { title: 'NZF: Zakat on property and fixed assets', url: 'https://nzf.org.uk/knowledge/zakat-on-property/' },
  quran960: { title: "Qur'an 9:60 (the eight categories of zakah recipients)", url: 'https://quran.com/9/60' },
};

export const CATEGORIES = {
  cash: { label: 'Cash, bank and savings', hint: 'Current accounts, savings, cash at home, cash ISAs, money in PayPal/Wise, foreign currency.' },
  gold: { label: 'Gold', hint: 'Coins, bars or jewellery. Enter grams and karat if you know them, otherwise its value.' },
  silver: { label: 'Silver', hint: 'Coins, bars or jewellery. Enter grams if you know them, otherwise its value.' },
  shares: { label: 'Shares, funds and stocks & shares ISAs', hint: 'Current market value.' },
  pension: { label: 'Pension', hint: 'Current pot value for defined-contribution schemes (workplace pension, SIPP).' },
  business_stock: { label: 'Business stock and business cash', hint: 'Stock at the price you would sell it, plus business cash.' },
  receivable: { label: 'Money owed to you', hint: 'Loans you made to others, unpaid invoices.' },
  crypto: { label: 'Cryptocurrency', hint: 'Value in your currency on your zakah date.' },
  property: { label: 'Property', hint: 'Only property bought to resell is zakatable.' },
  other: { label: 'Other assets', hint: 'Anything else held for its value.' },
};

export const LIABILITY_KINDS = {
  due_within_12_months: { label: 'Debt due within the next 12 months', hint: 'Bills, personal loans, credit cards, money you owe friends or family.' },
  instalments_next_12_months: { label: 'Next 12 months of a long-term debt', hint: 'e.g. 12 mortgage or car-finance payments, without the interest.' },
  long_term_total: { label: 'Full balance of a long-term debt', hint: 'Not deductible in full. Enter only the next 12 months of payments instead.' },
};

// Options shown in the review table for each detail field.
export const OPTIONS = {
  metalUse: {
    investment: 'Investment (coins, bars) or kept for value',
    personal_jewellery: 'Jewellery I wear',
    unknown: 'Not sure',
  },
  sharesIntent: {
    long_term: 'Held long term for dividends/growth',
    trading: 'Bought to sell soon (trading)',
    unknown: 'Not sure',
  },
  pensionType: {
    defined_contribution: 'Defined contribution / pot (workplace pension, SIPP)',
    defined_benefit: 'Defined benefit / final salary',
    state: 'State pension',
    unknown: 'Not sure',
  },
  propertyUse: {
    for_resale: 'Bought to sell for profit',
    own_home: 'My home',
    rental: 'Rented out',
    unknown: 'Not sure',
  },
  receivableStrength: {
    strong: 'Likely to be repaid',
    weak: 'Unlikely or disputed',
    unknown: 'Not sure',
  },
};

const num = (v) => {
  const n = typeof v === 'string' ? Number(v.replace(/[,£$€\s]/g, '')) : Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const pct = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.min(Math.max(n, 0), 100) / 100;
};

function metalValue(item, prices) {
  const grams = num(item.grams);
  if (grams > 0) {
    if (item.category === 'gold') {
      const purity = KARAT_PURITY[item.karat] ?? KARAT_PURITY[24];
      if (!prices?.goldPerGram) return { value: 0, missingPrice: true };
      return { value: grams * purity * prices.goldPerGram, grams, purity };
    }
    const purity = SILVER_PURITY[item.fineness] ?? SILVER_PURITY[999];
    if (!prices?.silverPerGram) return { value: 0, missingPrice: true };
    return { value: grams * purity * prices.silverPerGram, grams, purity };
  }
  return { value: num(item.amount) };
}

/**
 * Evaluate one asset row.
 * Returns { value, fraction, zakatable, rule, note, sources, flag }.
 * `flag` is a question the user should answer; the row still gets the default shown.
 */
export function evaluateAsset(item, settings, prices) {
  const s = { ...DEFAULT_SETTINGS, ...settings };
  const out = (value, fraction, rule, note, sources = [], flag = null) => ({
    value,
    fraction,
    zakatable: value * fraction,
    rule,
    note,
    sources,
    flag,
  });

  switch (item.category) {
    case 'cash':
      return out(num(item.amount), 1, 'cash', 'All cash and bank balances are zakatable in full.', ['nzfCalc']);

    case 'gold':
    case 'silver': {
      const m = metalValue(item, prices);
      const metal = item.category === 'gold' ? 'Gold' : 'Silver';
      const flag = m.missingPrice ? `Enter the ${item.category} price per gram, or the item's value.` : null;
      const weighed = m.grams ? ` Valued on its pure ${item.category} content (${round(m.grams * m.purity, 2)}g).` : '';
      if (item.use === 'personal_jewellery') {
        if (s.jewellery === 'exclude') {
          return out(m.value, 0, 'jewellery_exempt',
            `${metal} jewellery worn for personal use is exempt under the Maliki, Shafi'i and Hanbali schools (within customary amounts). You chose this view.${weighed}`,
            ['nzfJewellery'], flag);
        }
        return out(m.value, 1, 'jewellery_hanafi',
          `${metal} jewellery is zakatable under the Hanafi school, which is also the cautious view. You can change this in the settings if you follow another school.${weighed}`,
          ['nzfJewellery'], flag);
      }
      if (item.use === 'unknown' || !item.use) {
        return out(m.value, 1, 'metal_unknown',
          `${metal} kept as an investment is always zakatable. If this is jewellery you wear, say so: the schools differ on it.${weighed}`,
          ['nzfJewellery'], flag ?? `Is this ${item.category} jewellery you wear, or kept as an investment?`);
      }
      return out(m.value, 1, 'metal_investment',
        `${metal} held as coins, bars or for its value is zakatable in full, by agreement of the schools.${weighed}`,
        ['nzfJewellery', 'nzfCalc'], flag);
    }

    case 'shares': {
      const value = num(item.amount);
      if (item.intent === 'trading') {
        return out(value, 1, 'shares_trading', 'Shares bought to sell are trade goods: zakah is due on their full market value.', ['nzfCalc']);
      }
      const custom = pct(item.zakatablePercent);
      if (item.intent === 'long_term') {
        if (custom !== null) {
          return out(value, custom, 'shares_long_term_custom',
            `Long-term shares: zakah is on your share of the companies' zakatable assets (cash, receivables, stock). You entered ${round(custom * 100, 1)}%.`,
            ['nzfCalc']);
        }
        return out(value, LONG_TERM_SHARE_PROXY, 'shares_long_term',
          "Long-term shares: zakah is on your share of the companies' zakatable assets. Without balance sheets, NZF suggests using 25% of market value.",
          ['nzfCalc']);
      }
      return out(value, 1, 'shares_unknown',
        'Counted in full (the cautious view) until you tell us whether you hold these long term or to sell. Long-term holdings usually use 25%.',
        ['nzfCalc'], 'Do you hold these shares long term, or did you buy them to sell?');
    }

    case 'pension': {
      const value = num(item.amount);
      if (item.pensionType === 'defined_benefit') {
        return out(value, 0, 'pension_db', 'Defined-benefit (final salary) schemes have no pot you own, so NZF says zakah is not due on them.', ['nzfPensions']);
      }
      if (item.pensionType === 'state') {
        return out(value, 0, 'pension_state', 'The state pension is not an asset you own, so it is not counted. Pension money you have received and saved is counted as cash.', ['nzfPensions']);
      }
      const custom = pct(item.zakatablePercent);
      const fraction = custom ?? LONG_TERM_SHARE_PROXY;
      const note = custom !== null
        ? `Defined-contribution pension: zakah is on the zakatable assets in the fund. You entered ${round(custom * 100, 1)}%.`
        : "Defined-contribution pension: NZF's view is that zakah is due on the zakatable assets inside the fund, even before you can access it. For a share-based fund, 25% of the pot is used. Scholars differ here; some say nothing is due until you can access it.";
      return out(value, fraction, custom !== null ? 'pension_dc_custom' : 'pension_dc', note, ['nzfPensions'],
        item.pensionType === 'defined_contribution' ? null : 'Is this a pension pot (defined contribution) or a final-salary (defined benefit) scheme?');
    }

    case 'business_stock':
      return out(num(item.amount), 1, 'business', 'Business stock is valued at the price you would sell it for on your zakah date, and business cash is counted in full.', ['nzfCalc']);

    case 'receivable': {
      const value = num(item.amount);
      if (item.strength === 'weak') {
        return out(value, 0, 'receivable_weak', 'Money you are unlikely to get back is not counted now. Many scholars say to pay zakah on it once you receive it.', ['nzfCalc']);
      }
      return out(value, 1, 'receivable_strong', 'Money owed to you that you expect to be repaid is counted in full.', ['nzfCalc'],
        item.strength === 'strong' ? null : 'Do you expect this money to be repaid?');
    }

    case 'crypto':
      return out(num(item.amount), 1, 'crypto',
        "Cryptocurrency is counted at its value on your zakah date. This follows NZF and most contemporary scholars, who treat it like currency or trade goods. Some hold that long-term holdings should be treated like shares.",
        ['nzfCalc']);

    case 'property': {
      const value = num(item.amount);
      if (item.propertyUse === 'for_resale') {
        return out(value, 1, 'property_trade', 'Property bought to resell is trade goods: zakah is due on its market value.', ['nzfProperty']);
      }
      if (item.propertyUse === 'rental') {
        return out(value, 0, 'property_rental', 'No zakah on the value of a rental property. Rent you have saved is counted as cash.', ['nzfProperty']);
      }
      if (item.propertyUse === 'own_home') {
        return out(value, 0, 'property_home', 'No zakah on the home you live in.', ['nzfProperty']);
      }
      return out(value, 0, 'property_unknown', 'Not counted: only property bought to resell is zakatable. Tell us if you bought it to sell.', ['nzfProperty'],
        'Did you buy this property to sell for profit?');
    }

    default:
      return out(num(item.amount), 1, 'other', 'Counted in full. Check with a scholar if this asset is for personal use (car, furniture, tools), which is not zakatable.', ['nzfCalc'],
        'What is this asset? Personal-use items are not zakatable.');
  }
}

export function evaluateLiability(item, settings) {
  const s = { ...DEFAULT_SETTINGS, ...settings };
  const value = num(item.amount);
  if (!s.deductDebts) {
    return { value, deductible: 0, note: "Debts not deducted (you chose the Shafi'i view).", flag: null };
  }
  if (item.kind === 'long_term_total') {
    return {
      value,
      deductible: 0,
      note: 'A long-term debt is not deducted in full. Enter only the payments due in the next 12 months, without interest.',
      flag: 'What will you repay on this debt in the next 12 months?',
    };
  }
  return {
    value,
    deductible: value,
    note: item.kind === 'instalments_next_12_months'
      ? 'Up to 12 months of payments on a long-term debt can be deducted (not interest).'
      : 'Debts due within the next 12 months can be deducted.',
    flag: null,
  };
}

export function nisabValue(settings, prices) {
  const s = { ...DEFAULT_SETTINGS, ...settings };
  const perGram = s.nisabMetal === 'gold' ? prices?.goldPerGram : prices?.silverPerGram;
  if (!perGram) return null;
  return NISAB_GRAMS[s.nisabMetal] * perGram;
}

/**
 * Full calculation.
 * input: { assets: [...], liabilities: [...], settings, prices: { goldPerGram, silverPerGram } }
 */
export function calculate({ assets = [], liabilities = [], settings = {}, prices = {} }) {
  const s = { ...DEFAULT_SETTINGS, ...settings };
  const assetRows = assets.map((a) => ({ ...a, result: evaluateAsset(a, s, prices) }));
  const liabilityRows = liabilities.map((l) => ({ ...l, result: evaluateLiability(l, s) }));

  const totalAssets = sum(assetRows.map((r) => r.result.value));
  const zakatableAssets = sum(assetRows.map((r) => r.result.zakatable));
  const deductions = Math.min(sum(liabilityRows.map((r) => r.result.deductible)), zakatableAssets);
  const netZakatable = Math.max(zakatableAssets - deductions, 0);
  const nisab = nisabValue(s, prices);
  const rate = ZAKAT_RATE[s.yearType] ?? ZAKAT_RATE.lunar;
  const zakahIfDue = netZakatable * rate;

  let status;
  if (nisab === null) status = 'missing_prices';
  else if (netZakatable < nisab) status = 'below_nisab';
  else if (s.hawl === 'no') status = 'hawl_not_complete';
  else status = 'due';

  const flags = [
    ...assetRows.filter((r) => r.result.flag).map((r) => ({ id: r.id, question: r.result.flag })),
    ...liabilityRows.filter((r) => r.result.flag).map((r) => ({ id: r.id, question: r.result.flag })),
  ];

  return {
    settings: s,
    prices,
    assets: assetRows,
    liabilities: liabilityRows,
    totalAssets,
    zakatableAssets,
    deductions,
    netZakatable,
    nisab,
    nisabGrams: NISAB_GRAMS[s.nisabMetal],
    rate,
    zakahDue: status === 'due' ? zakahIfDue : 0,
    zakahIfDue,
    status,
    flags,
  };
}

export const STATUS_TEXT = {
  due: 'Zakah is due',
  below_nisab: 'No zakah is due: your net zakatable wealth is below the nisab',
  hawl_not_complete: 'Not due yet: your wealth has not been above the nisab for a full lunar year',
  missing_prices: 'Enter gold and silver prices to check the nisab',
};

export function formatMoney(value, currency = 'GBP') {
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
  } catch {
    return `${currency} ${(value || 0).toFixed(2)}`;
  }
}

function sum(xs) {
  return xs.reduce((a, b) => a + b, 0);
}

function round(n, dp) {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
