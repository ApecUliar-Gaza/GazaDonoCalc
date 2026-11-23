// The chat: asks one short question at a time, explains how to find each figure, and fills
// the same rows the detailed table uses. All the rulings still come from zakat-engine.js.
//
// It works without AI. If someone types a whole description instead, it is sent to
// /api/parse (AI) and the chat then asks only the follow-up questions the engine raises.

import { formatMoney, NISAB_GRAMS, GOLD_PIECE_GRAMS } from './zakat-engine.js';

// "5k", "£5,000", "about 2.5k", "1.2m", "none" -> number (or null if no number found).
export function parseMoney(text) {
  const t = String(text).toLowerCase().replace(/,/g, '').trim();
  if (isUnsure(t)) return null;
  if (/^(no|none|nothing|nil|zero|n\/a|0|£0|nope|na)\b/.test(t)) return 0;
  const m = t.match(/(\d+(?:\.\d+)?)\s*(k|m|thousand|million|grand)?/);
  if (!m) return null;
  let n = Number(m[1]);
  const unit = m[2];
  if (unit === 'k' || unit === 'thousand' || unit === 'grand') n *= 1000;
  if (unit === 'm' || unit === 'million') n *= 1e6;
  return Math.round(n * 100) / 100;
}

export const isUnsure = (t) => /(no idea|not sure|unsure|don'?t know|dunno|no clue|idk|help)/i.test(String(t));

// "2 bangles and a necklace" -> [{piece:'bangle', count:2}, {piece:'necklace', count:1}]
export function parsePieces(text) {
  const words = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, pair: 1, couple: 2, few: 3 };
  const alias = { rings: 'ring', ring: 'ring', earring: 'earrings', earrings: 'earrings', chain: 'chain', chains: 'chain', bracelet: 'bracelet', bracelets: 'bracelet', bangle: 'bangle', bangles: 'bangle', kara: 'bangle', necklace: 'necklace', necklaces: 'necklace', set: 'set', sets: 'set', coin: 'coin', coins: 'coin', sovereign: 'coin', sovereigns: 'coin' };
  const out = {};
  const re = /(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|pair|couple|few)?\s*(?:of\s+)?(?:gold\s+|small\s+|thin\s+|big\s+|heavy\s+|wedding\s+)*(rings?|earrings?|chains?|bracelets?|bangles?|kara|necklaces?|sets?|coins?|sovereigns?)\b/gi;
  for (const m of String(text).matchAll(re)) {
    const raw = (m[1] || '1').toLowerCase();
    const count = Number(raw) || words[raw] || 1;
    const piece = alias[m[2].toLowerCase()];
    out[piece] = (out[piece] || 0) + count;
  }
  return Object.entries(out).map(([piece, count]) => ({ piece, count }));
}

export function startChat({ root, state, newId, onChange, onDone, parseText }) {
  const log = root.querySelector('.chat-log');
  const form = root.querySelector('.chat-form');
  const input = root.querySelector('.chat-input');
  const chipsEl = root.querySelector('.chat-chips');
  const cur = () => state.settings.currency;
  const m = (v) => formatMoney(v, cur()).replace(/\.00$/, '');
  let handler = null; // what to do with the next typed answer
  let queue = []; // steps still to ask
  let busy = false;

  // ---------- output ----------
  function bubble(html, who = 'bot', extraClass = '') {
    const b = document.createElement('div');
    b.className = `msg ${who} ${extraClass}`.trim();
    b.innerHTML = html;
    log.appendChild(b);
    log.scrollTop = log.scrollHeight; // scrolls the chat only, never the page
    return b;
  }
  const say = (html, extra) => bubble(html, 'bot', extra);
  const tip = (html) => bubble(`<span class="tip-label">How to find it</span>${html}`, 'bot', 'tip');

  // chips: [{label, value?, run?}]. Typing is always allowed too.
  function ask(html, chips = [], onAnswer, { placeholder = 'Type your answer…', numeric = false } = {}) {
    say(html);
    setChips(chips, onAnswer);
    handler = onAnswer;
    input.placeholder = placeholder;
    input.inputMode = numeric ? 'decimal' : 'text';
    if (window.matchMedia('(hover: hover)').matches) input.focus({ preventScroll: true });
  }

  function setChips(chips, onAnswer) {
    chipsEl.innerHTML = '';
    chips.forEach((c) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `chat-chip${c.primary ? ' primary' : ''}`;
      b.textContent = c.label;
      b.addEventListener('click', () => {
        if (busy) return;
        bubble(esc(c.label), 'me');
        clearChips();
        if (c.run) c.run();
        else onAnswer(c.value ?? c.label, true);
      });
      chipsEl.appendChild(b);
    });
  }
  const clearChips = () => { chipsEl.innerHTML = ''; };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || busy || !handler) return;
    input.value = '';
    bubble(esc(text), 'me');
    clearChips();
    handler(text, false);
  });

  // Ask for an amount; "help" chip shows how to find it, "none" answers 0.
  function askAmount(html, help, then, { noneLabel = 'None', extraChips = [] } = {}) {
    const onAnswer = (text) => {
      if (help && isUnsure(text)) {
        tip(help);
        handler = onAnswer;
        return setChips(chips.filter((c) => c.label !== "I'm not sure"), onAnswer);
      }
      const n = parseMoney(text);
      if (n === null) {
        say("Sorry, I need a number for that, like <b>2500</b> or <b>2.5k</b>. A rough figure is fine.");
        return setChips(chips, onAnswer);
      }
      then(n);
    };
    const chips = [
      ...(help ? [{ label: "I'm not sure", run: () => { tip(help); setChips(chips.filter((c) => c.label !== "I'm not sure"), onAnswer); handler = onAnswer; } }] : []),
      ...extraChips,
      ...(noneLabel ? [{ label: noneLabel, value: '0' }] : []),
    ];
    ask(html, chips, onAnswer, { placeholder: 'e.g. 2500 or 2.5k', numeric: true });
  }

  const yesNo = (html, yes, no = next, labels = ['Yes', 'No']) =>
    ask(html, [{ label: labels[0], value: 'yes' }, { label: labels[1], value: 'no' }], (t) => (/^(y|yes|yeah|yep|i do|some|1)/i.test(t) ? yes() : no()));

  const addAsset = (a) => { state.assets.push({ id: newId(), ...a }); onChange(); };
  const addDebt = (l) => { state.liabilities.push({ id: newId(), ...l }); onChange(); };

  function next() {
    const step = queue.shift();
    if (step) step();
    else finish();
  }

  // ---------- the questions ----------
  const nisabText = () => {
    const per = state.prices?.silverPerGram;
    return per ? `about ${m(per * NISAB_GRAMS.silver)}` : 'the value of 612g of silver';
  };

  const steps = {
    cash() {
      askAmount(
        "Let's start with money. <b>How much do you have in cash and bank accounts altogether?</b> Current accounts, savings, cash ISAs, cash at home, PayPal or Wise.",
        "Open your banking app and add up the balance of every account, as of today. Money set aside for bills or a holiday still counts. Leave out money that isn't yours, like a child's savings in their name or money you're holding for someone.",
        (n) => {
          if (!n) return next();
          addAsset({ category: 'cash', description: 'Cash and bank accounts', amount: n });
          ask(`Got it, ${m(n)}. Is all of that yours?`, [
            { label: "It's all mine", value: 'all' },
            { label: 'Some is a joint account', value: 'joint' },
            { label: 'Some belongs to someone else', value: 'other' },
          ], (v) => {
            const row = state.assets[state.assets.length - 1];
            if (v === 'joint' || /joint/i.test(v)) {
              askAmount('How much of that is in joint accounts?', null, (j) => {
                j = Math.min(j, row.amount);
                ask('And what share of the joint money is yours?', [{ label: 'Half', value: '50' }, { label: 'A third', value: '33.3' }, { label: 'A quarter', value: '25' }], (p) => {
                  const share = parseMoney(p) ?? 50;
                  row.amount -= j;
                  addAsset({ category: 'cash', description: 'Joint account (your share)', amount: j, ownershipPercent: Math.min(share, 100) });
                  say("Each owner works out zakah on their own share, so I've counted only yours.");
                  next();
                }, { placeholder: 'e.g. 50 (for 50%)' });
              }, { noneLabel: null });
            } else if (v === 'other' || /someone|not mine|other/i.test(v)) {
              askAmount("How much of it belongs to someone else? That's their zakah, not yours.", null, (o) => {
                row.amount = Math.max(row.amount - o, 0);
                onChange();
                next();
              }, { noneLabel: null });
            } else next();
          });
        },
      );
    },

    gold() {
      ask('<b>Do you own any gold?</b> Jewellery, coins or bars.', [
        { label: 'No', value: 'no' },
        { label: 'Jewellery I wear', value: 'jewellery' },
        { label: 'Coins or bars', value: 'investment' },
        { label: 'Both', value: 'both' },
      ], (v) => {
        if (/^n/i.test(v)) return next();
        const kinds = v === 'both' || /both/i.test(v) ? ['personal_jewellery', 'investment'] : /coin|bar|invest/i.test(v) ? ['investment'] : ['personal_jewellery'];
        queue.unshift(...kinds.map((use) => () => goldItem(use)));
        next();
      });
    },

    silver() {
      yesNo('<b>Any silver worth counting?</b> Silver coins, bars, or a lot of silver jewellery. Most people can skip this.', () => {
        askAmount('Roughly what is your silver worth?', 'A jeweller or a site like the Royal Mint can value it. Silver is worth far less than gold, so a rough guess is fine.', (n) => {
          if (n) addAsset({ category: 'silver', description: 'Silver', amount: n, use: 'unknown' });
          next();
        });
      });
    },

    shares() {
      yesNo('<b>Do you have any shares, funds or a stocks and shares ISA?</b> Include apps like Trading 212, Freetrade or Vanguard.', () => {
        askAmount('What are they worth today?', 'Your investing app shows the total value on its home screen. Use that number.', (n) => {
          if (!n) return next();
          ask('Do you hold them <b>long term</b> (for growth or dividends) or did you buy them to <b>sell soon</b>?', [
            { label: 'Long term', value: 'long_term' }, { label: 'To sell soon', value: 'trading' }, { label: 'A mix', value: 'mix' },
          ], (v) => {
            if (/mix/i.test(v)) {
              askAmount('How much of it is for trading (selling soon)?', null, (t) => {
                t = Math.min(t, n);
                if (t) addAsset({ category: 'shares', description: 'Shares for trading', amount: t, intent: 'trading' });
                if (n - t) addAsset({ category: 'shares', description: 'Long-term shares', amount: n - t, intent: 'long_term' });
                say('Long-term shares count at 25% of their value (the National Zakat Foundation method), trading shares in full.');
                next();
              }, { noneLabel: null });
              return;
            }
            const trading = /sell|trad/i.test(v);
            addAsset({ category: 'shares', description: trading ? 'Shares for trading' : 'Long-term shares', amount: n, intent: trading ? 'trading' : 'long_term' });
            if (!trading) say('Long-term shares are counted at 25% of their value, because zakah is only on the cash, stock and debts the companies hold (the National Zakat Foundation method).');
            next();
          });
        });
      });
    },

    pension() {
      const types = [
        { label: 'A pot (workplace or SIPP)', value: 'dc' },
        { label: 'Final salary', value: 'db' },
        { label: "I don't know which", value: 'unsure' },
        { label: 'No pension', value: 'no' },
      ];
      const onType = (v) => {
        if (/^no/i.test(v)) return next();
        if (v === 'unsure' || /know|sure/i.test(v)) {
          tip("Look at your latest pension statement or app. If it shows a <b>pot value</b> or <b>fund value</b>, it's a pot (defined contribution). If it promises a yearly income based on your salary, it's <b>final salary</b> (defined benefit). Almost all workplace pensions started since 2012 are pots. Lost track? The free <a href=\"https://www.gov.uk/find-pension-contact-details\" target=\"_blank\" rel=\"noopener\">Pension Tracing Service</a> can help.");
          return ask('So which is yours?', types.filter((t) => t.value !== 'unsure'), onType);
        }
        if (/db|final/i.test(v)) {
          addAsset({ category: 'pension', description: 'Final salary pension', amount: 0, pensionType: 'defined_benefit' });
          say("No zakah is due on a final salary pension, because there's no pot you own. Once you get paid from it and save the money, that counts as cash.");
          return next();
        }
        askAmount('What is the pot worth?', 'Log in to your pension provider (your payslip names it) and use the current pot or fund value.', (n) => {
          if (!n) return next();
          addAsset({ category: 'pension', description: 'Pension pot', amount: n, pensionType: 'defined_contribution' });
          say(`I've counted 25% of it (${m(n * 0.25)}), following the National Zakat Foundation. Some scholars say nothing is due until you can access it; you can switch to that view in the settings.`);
          next();
        });
      };
      ask('<b>Do you have a pension?</b>', types, onType);
    },

    crypto() {
      yesNo('<b>Any cryptocurrency?</b>', () => {
        askAmount('What is it worth today, in pounds?', 'Your exchange or wallet app shows the total value. Use today\'s value.', (n) => {
          if (n) addAsset({ category: 'crypto', description: 'Crypto', amount: n });
          next();
        });
      });
    },

    business() {
      yesNo('<b>Do you run a business, or own part of one?</b> Including selling online or as a sole trader.', () => {
        const biz = {};
        askAmount('What is your <b>stock</b> worth, at the price you would sell it for? Say none if you sell a service.', "Count everything you hold to sell, finished or not, at today's sale price. Equipment, vans and premises you use to run the business don't count.", (stock) => {
          biz.stock = stock;
          askAmount("How much is in the <b>business bank account</b>?", null, (cash) => {
            biz.cash = cash;
            askAmount('How much do <b>customers owe you</b> that you expect to be paid?', 'Unpaid invoices you expect to be paid. Leave out ones you have written off.', (owed) => {
              biz.owed = owed;
              askAmount('How much does the business <b>owe and have to pay in the next 12 months</b>? Suppliers, wages, rent, tax.', null, (due) => {
                biz.due = due;
                ask('What share of the business is yours?', [{ label: 'All of it', value: '100' }, { label: 'Half', value: '50' }], (p) => {
                  const share = Math.min(parseMoney(p) ?? 100, 100);
                  const own = share === 100 ? {} : { ownershipPercent: share };
                  if (biz.stock + biz.cash) addAsset({ category: 'business_stock', description: 'Business stock and cash', amount: biz.stock + biz.cash, ...own });
                  if (biz.owed) addAsset({ category: 'receivable', description: 'Money customers owe the business', amount: biz.owed, strength: 'strong', ...own });
                  if (biz.due) addDebt({ kind: 'business_due', description: 'Business bills due', amount: biz.due, ...own });
                  next();
                }, { placeholder: 'e.g. 50 (for 50%)' });
              });
            });
          });
        });
      });
    },

    owed() {
      ask('<b>Has anyone borrowed money from you</b> that they still owe?', [
        { label: 'No', value: 'no' }, { label: "Yes, I'll get it back", value: 'strong' }, { label: "Yes, but I doubt I'll get it back", value: 'weak' },
      ], (v) => {
        if (/^n/i.test(v)) return next();
        const strength = /doubt|weak|unlikely/i.test(v) ? 'weak' : 'strong';
        askAmount('How much are you owed?', null, (n) => {
          if (n) addAsset({ category: 'receivable', description: 'Money lent to others', amount: n, strength });
          if (strength === 'weak') say("Money you're unlikely to get back isn't counted now. When it is repaid, give zakah on it then.");
          next();
        }, { noneLabel: null });
      });
    },

    property() {
      ask('<b>Do you own property other than your home?</b>', [
        { label: 'No', value: 'no' }, { label: 'A rental', value: 'rental' }, { label: 'Bought to sell', value: 'resale' },
      ], (v) => {
        if (/^n/i.test(v)) return next();
        if (/rent/i.test(v)) {
          say("No zakah on the value of a rental property, or on your own home. Rent you've saved is already in your bank balance, so it's counted there.");
          return next();
        }
        askAmount('What would it sell for today?', 'Use a recent valuation, or a similar sold property on Rightmove or Zoopla.', (n) => {
          if (n) addAsset({ category: 'property', description: 'Property bought to sell', amount: n, propertyUse: 'for_resale' });
          next();
        }, { noneLabel: null });
      });
    },

    debts() {
      askAmount(
        "Now debts, which can be taken off. <b>What do you have to repay in the next 12 months?</b> Credit cards, overdraft, personal loans, money owed to family, bills that are due.",
        "Add up your credit card and overdraft balances, plus the next 12 months of any loan payments. Leave out mortgages and car finance for now; that's the next question.",
        (n) => {
          if (n) addDebt({ kind: 'due_within_12_months', description: 'Debts due within 12 months', amount: n });
          ask('Do you have a <b>mortgage, car finance or a student loan</b>?', [
            { label: 'No', value: 'no' }, { label: 'Mortgage', value: 'Mortgage' }, { label: 'Car finance', value: 'Car finance' }, { label: 'Student loan', value: 'Student loan' },
          ], (v) => {
            if (/^(no|none|nope|nah)\b/i.test(v)) return next();
            const what = /student/i.test(v) ? 'Student loan' : /car/i.test(v) ? 'Car finance' : 'Mortgage';
            const help = what === 'Student loan'
              ? 'UK student loan repayments come out of your pay. Your payslip shows the monthly amount; multiply it by 12. If you earn under the threshold and repay nothing, enter none.'
              : 'Take your monthly payment and multiply by 12. Leave out the interest part if your statement shows it.';
            askAmount(`For your ${what.toLowerCase()}, only the <b>next 12 months of payments</b> are taken off, not the whole balance. What will you pay in the next 12 months?`, help, (p) => {
              if (p) addDebt({ kind: 'instalments_next_12_months', description: `${what}: next 12 months`, amount: p });
              yesNo('Any other long-term debts?', () => steps.debtsMore(), next, ['Yes', 'No, that\'s all']);
            });
          });
        },
      );
    },

    debtsMore() {
      askAmount('What will you repay on it in the next 12 months?', null, (p) => {
        if (p) addDebt({ kind: 'instalments_next_12_months', description: 'Other debt: next 12 months', amount: p });
        next();
      });
    },

    paid() {
      yesNo('<b>Have you already given any zakah</b> for this year in advance?', () => {
        askAmount('How much have you given so far?', null, (n) => {
          state.settings.alreadyPaid = n;
          onChange();
          next();
        }, { noneLabel: null });
      }, next, ['Yes', 'No']);
    },

    hawl() {
      ask(`Last question. <b>Has your wealth been above the nisab (${nisabText()}) for a full Islamic year?</b>`, [
        { label: 'Yes', value: 'yes' }, { label: 'Not yet', value: 'no' }, { label: 'Not sure', value: 'unsure' },
      ], (v) => {
        const val = /not yet|^no/i.test(v) ? 'no' : /sure|know/i.test(v) ? 'unsure' : 'yes';
        state.settings.hawl = val;
        document.querySelector(`input[name=hawl][value=${val}]`)?.click();
        if (val === 'unsure') tip("Most people who've had savings for a while have passed a year. Zakah is due on the anniversary of the day your wealth first reached the nisab. If you can't work out the date, pick your best estimate (many people use Ramadan) and pay every year from then. Money that came in during the year is counted on that date too.");
        onChange();
        next();
      });
    },
  };

  // Gold: weight if known, value if known, otherwise estimate from pieces.
  function goldItem(use) {
    const label = use === 'investment' ? 'gold coins or bars' : 'gold jewellery';
    ask(`For your ${label}: <b>do you know the weight, or what it's worth?</b>`, [
      { label: 'I know the weight', value: 'weight' }, { label: 'I know the value', value: 'value' }, { label: 'No idea', value: 'none' },
    ], (v) => {
      if (/weight|gram|^\d/i.test(v)) {
        const pre = parseMoney(v);
        const afterGrams = (g) => {
          ask('What karat is it?', [
            { label: '22ct', value: '22' }, { label: '24ct', value: '24' }, { label: '21ct', value: '21' }, { label: '18ct', value: '18' }, { label: '9ct', value: '9' }, { label: 'Not sure', value: '?' },
          ], (k) => {
            const karat = [24, 22, 21, 18, 14, 10, 9].includes(Number(parseMoney(k))) ? Number(parseMoney(k)) : null;
            if (!karat) tip('Look for a stamp inside the piece: <b>916</b> means 22ct, <b>750</b> is 18ct, <b>375</b> is 9ct, <b>999</b> is 24ct. Jewellery bought in South Asia or the Gulf is usually 21-22ct, and in the UK often 9ct. I\'ve assumed ' + (use === 'investment' ? '24ct' : '22ct') + ' for now.');
            addAsset({ category: 'gold', description: use === 'investment' ? 'Gold coins/bars' : 'Gold jewellery', grams: g, karat, use });
            next();
          });
        };
        if (pre && v !== 'weight') return afterGrams(pre);
        return askAmount('How many grams, roughly?', 'Kitchen scales are fine. Receipts from jewellers usually show the weight.', (g) => (g ? afterGrams(g) : next()), { noneLabel: null });
      }
      if (/value|worth|£/i.test(v)) {
        return askAmount("What's it worth today?", 'A jeweller can value it, or use its weight instead: tap back and say you know the weight.', (n) => {
          if (n) addAsset({ category: 'gold', description: use === 'investment' ? 'Gold coins/bars' : 'Gold jewellery', amount: n, use });
          next();
        }, { noneLabel: null });
      }
      const onPieces = (t) => {
        const pieces = parsePieces(t);
        if (!pieces.length) {
          say('I didn\'t catch any pieces there. Try something like <b>"2 bangles, a necklace and 3 rings"</b>.');
          return setChips(pieceChips, onPieces);
        }
        pieces.forEach((p) => addAsset({ category: 'gold', description: `${p.count} × ${p.piece} (estimated weight)`, piece: p.piece, count: p.count, use }));
        const grams = pieces.reduce((s, p) => s + GOLD_PIECE_GRAMS[p.piece] * p.count, 0);
        say(`I've estimated about ${grams}g from typical weights. It's only a guide, so weighing it is better if you can.`);
        next();
      };
      const pieceChips = [
        { label: 'A wedding set', value: '1 set' }, { label: '2 bangles', value: '2 bangles' }, { label: 'A chain and a ring', value: 'a chain and a ring' },
      ];
      ask('No problem, I can estimate it. <b>What pieces do you have?</b> e.g. "2 bangles, a necklace and 3 rings".', pieceChips, onPieces, { placeholder: 'e.g. 2 bangles and a necklace' });
    });
  }

  // ---------- AI route: one free-text description ----------
  async function describe(text) {
    busy = true;
    const thinking = say('<span class="typing"><i></i><i></i><i></i></span>', 'thinking');
    try {
      const got = await parseText(text);
      thinking.remove();
      busy = false;
      if (!got.assets.length && !got.liabilities.length) {
        say("I couldn't pick out any figures from that, so let's go step by step.");
        return stepByStep();
      }
      const lines = [...got.assets.map((a) => a.description || a.category), ...got.liabilities.map((l) => l.description || 'debt')];
      say(`Here's what I understood:<ul>${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>You can fix anything in <a href="#review">the details</a> below.`);
      // Then only the follow-up questions the engine still has.
      queue = [...followUps(), steps.paid, steps.hawl];
      next();
    } catch (err) {
      thinking.remove();
      busy = false;
      say(`${esc(err.message || 'I could not read that right now.')} Let's go step by step instead.`);
      stepByStep();
    }
  }

  // Turn engine flags into quick questions with tappable answers.
  function followUps() {
    const qs = [];
    state.assets.forEach((a) => {
      const name = esc(a.description || a.category);
      if ((a.category === 'gold' || a.category === 'silver') && (!a.use || a.use === 'unknown')) {
        qs.push(() => ask(`Is your ${name} <b>jewellery you wear</b>, or kept as an investment?`, [{ label: 'Jewellery I wear', value: 'personal_jewellery' }, { label: 'Investment', value: 'investment' }],
          (v) => { a.use = /wear|jewel/i.test(v) ? 'personal_jewellery' : 'investment'; onChange(); next(); }));
      }
      if (a.category === 'gold' && Number(a.grams) > 0 && !a.karat) {
        qs.push(() => ask(`What karat is your ${name}?`, [22, 24, 21, 18, 9].map((k) => ({ label: `${k}ct`, value: String(k) })).concat({ label: 'Not sure', value: '?' }),
          (v) => {
            const k = Number(parseMoney(v));
            if ([24, 22, 21, 18, 14, 10, 9].includes(k)) a.karat = k;
            else tip('Look for a stamp inside: <b>916</b> = 22ct, <b>750</b> = 18ct, <b>375</b> = 9ct, <b>999</b> = 24ct. I\'ve assumed 22ct for jewellery and 24ct for coins and bars.');
            onChange();
            next();
          }));
      }
      if (a.category === 'shares' && (!a.intent || a.intent === 'unknown')) {
        qs.push(() => ask(`Your ${name}: held <b>long term</b>, or bought to <b>sell soon</b>?`, [{ label: 'Long term', value: 'long_term' }, { label: 'To sell soon', value: 'trading' }],
          (v) => { a.intent = /sell|trad/i.test(v) ? 'trading' : 'long_term'; onChange(); next(); }));
      }
      if (a.category === 'pension' && (!a.pensionType || a.pensionType === 'unknown')) {
        qs.push(() => ask(`Is your ${name} a <b>pot</b> (workplace or SIPP) or <b>final salary</b>?`, [{ label: 'A pot', value: 'defined_contribution' }, { label: 'Final salary', value: 'defined_benefit' }, { label: 'State pension', value: 'state' }],
          (v) => { a.pensionType = /final|db/i.test(v) ? 'defined_benefit' : /state/i.test(v) ? 'state' : 'defined_contribution'; onChange(); next(); }));
      }
      if (a.category === 'property' && (!a.propertyUse || a.propertyUse === 'unknown')) {
        qs.push(() => ask(`Your ${name}: is it your home, rented out, or bought to sell?`, [{ label: 'My home', value: 'own_home' }, { label: 'Rented out', value: 'rental' }, { label: 'Bought to sell', value: 'for_resale' }],
          (v) => { a.propertyUse = /home/i.test(v) ? 'own_home' : /rent/i.test(v) ? 'rental' : 'for_resale'; onChange(); next(); }));
      }
      if (a.category === 'receivable' && (!a.strength || a.strength === 'unknown')) {
        qs.push(() => ask(`Do you expect the ${name} to be repaid?`, [{ label: 'Yes', value: 'strong' }, { label: 'Probably not', value: 'weak' }],
          (v) => { a.strength = /not|no/i.test(v) ? 'weak' : 'strong'; onChange(); next(); }));
      }
      if (a.amount == null && !(Number(a.grams) > 0) && !a.piece) {
        qs.push(() => askAmount(`Roughly what is your ${name} worth?`, null, (n) => { a.amount = n; onChange(); next(); }, { noneLabel: null }));
      }
    });
    state.liabilities.forEach((l) => {
      const name = esc(l.description || 'debt');
      if (l.kind === 'unknown' || l.kind === 'long_term_total' || l.amount == null) {
        qs.push(() => askAmount(`For your ${name}: <b>how much do you have to repay in the next 12 months?</b> Only that part is taken off.`, 'For a loan or mortgage, it\'s your monthly payment times 12. For a credit card or money owed to family that\'s due now, it\'s the full amount.', (n) => {
          l.kind = 'instalments_next_12_months';
          l.amount = n;
          onChange();
          next();
        }));
      }
    });
    return qs;
  }

  // ---------- result ----------
  function finish() {
    handler = null;
    clearChips();
    input.placeholder = 'Want to change something? Type it, or edit the details below';
    handler = () => say('You can change any figure in <a href="#review">the details</a> below and the total updates straight away. Or <button type="button" class="linkish" data-restart>start again</button>.');
    const el = say('', 'result-msg');
    onDone(el);
    // Show the result from its top, and bring the chat into view if it has scrolled off.
    requestAnimationFrame(() => {
      log.scrollTop = el.offsetTop - 12; // .chat-log is position: relative
      const r = root.getBoundingClientRect();
      if (r.top < 0 || r.bottom > innerHeight) root.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function stepByStep() {
    queue = ['cash', 'gold', 'silver', 'shares', 'pension', 'crypto', 'business', 'owed', 'property', 'debts', 'paid', 'hawl'].map((k) => steps[k]);
    next();
  }

  function begin() {
    log.innerHTML = '';
    queue = [];
    state.assets.length = 0;
    state.liabilities.length = 0;
    state.settings.alreadyPaid = 0;
    onChange();
    say("Assalamu alaykum! I'll help you work out your zakah in about two minutes. I'll ask short questions, and if you don't know a figure, I'll show you how to find it. A rough number is fine.");
    ask('Shall I ask you step by step, or would you like to tell me everything in one message?', [
      { label: 'Ask me step by step', primary: true, run: stepByStep },
      { label: "I'll type it all", run: () => ask('Go ahead. Tell me like you\'d tell a friend, e.g. <i>"£5k savings, 40g of 22ct gold I wear, a £30k workplace pension and £2k on my credit card"</i>.', [], (t) => describe(t), { placeholder: 'Describe your savings, gold, pension, debts…' }) },
    ], (t) => (t.length > 12 ? describe(t) : stepByStep()));
  }

  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-restart]')) { e.preventDefault(); begin(); }
  });

  begin();
  return { restart: begin, say };
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
