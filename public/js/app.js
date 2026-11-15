import {
  calculate, CATEGORIES, LIABILITY_KINDS, OPTIONS, KARAT_PURITY, SOURCES, STATUS_TEXT, DEFAULT_SETTINGS, formatMoney,
} from './zakat-engine.js';

const cfg = window.ZAKAH_CONFIG || {};
const $ = (sel, root = document) => root.querySelector(sel);

const state = {
  assets: [],
  liabilities: [],
  settings: { ...DEFAULT_SETTINGS, currency: cfg.defaultCurrency || 'GBP' },
  prices: { goldPerGram: null, silverPerGram: null },
  rates: { GBP: 1 },
  priceInfo: null,
  turnstileToken: null,
};
let nextId = 1;

// ---------- prices ----------
async function loadPrices() {
  const cur = state.settings.currency;
  try {
    const res = await fetch(`/api/prices?currency=${cur}`);
    if (!res.ok) throw new Error(res.status);
    const p = await res.json();
    state.prices = { goldPerGram: p.goldPerGram, silverPerGram: p.silverPerGram };
    state.rates = p.rates;
    state.priceInfo = p;
  } catch {
    state.priceInfo = null;
  }
  $('#price-gold').value = state.prices.goldPerGram ?? '';
  $('#price-silver').value = state.prices.silverPerGram ?? '';
  const info = state.priceInfo;
  $('#price-source').textContent = info
    ? `${info.source === 'live' ? 'Live spot prices' : 'Recent prices'} as of ${new Date(info.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}. Spot price is the market price of pure metal. You can type your own.`
    : 'We could not load prices. Please enter today\'s gold and silver prices per gram.';
  document.querySelectorAll('.cur-code').forEach((el) => { el.textContent = cur; });
  render();
}

// Convert an amount typed in another currency into the chosen currency.
function toBase(amount, currency) {
  if (amount == null) return null;
  if (!currency || currency === state.settings.currency) return amount;
  const rate = state.rates?.[currency.toUpperCase()];
  return rate ? Math.round((amount / rate) * 100) / 100 : amount;
}

// ---------- describe ----------
const textEl = $('#wealth-text');
document.querySelectorAll('.chip').forEach((chip) =>
  chip.addEventListener('click', () => { textEl.value = chip.dataset.example; textEl.focus(); }));

$('#parse-btn').addEventListener('click', async () => {
  const text = textEl.value.trim();
  const status = $('#parse-status');
  if (text.length < 3) { status.textContent = 'Type a few words about your savings and assets first.'; return; }
  const btn = $('#parse-btn');
  btn.disabled = true;
  status.textContent = 'Reading your description…';
  try {
    const res = await fetch('/api/parse', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error === 'ai_unavailable' || !data.error ? 'We could not read that automatically right now. Please add your items below instead.' : data.error);
    state.assets = data.assets.map((a) => ({
      id: nextId++, ...a,
      amount: toBase(a.amount, a.currency),
      // Unknown karat: engine treats it as 24ct (pure), the cautious reading. The user can change it.
      karat: a.karat && KARAT_PURITY[a.karat] ? a.karat : null,
    }));
    state.liabilities = data.liabilities.map((l) => ({ id: nextId++, ...l, amount: toBase(l.amount, l.currency) }));
    showQuestions(data.questions, data.ignored);
    status.textContent = state.assets.length ? 'Done. Please check the items below.' : '';
    showReview();
  } catch (err) {
    status.textContent = err.message;
    if (!state.assets.length) state.assets.push(blankAsset());
    showReview();
  } finally {
    btn.disabled = false;
  }
});

$('#manual-btn').addEventListener('click', () => {
  if (!state.assets.length) state.assets.push(blankAsset());
  showReview();
});

function showQuestions(questions = [], ignored = []) {
  const box = $('#questions');
  const parts = [];
  if (questions.length) parts.push(`<p><strong>A few things would make this more accurate:</strong></p><ul>${questions.map((q) => `<li>${esc(q)}</li>`).join('')}</ul>`);
  if (ignored.length) parts.push(`<p class="hint">Not counted, because personal-use items carry no zakah: ${ignored.map(esc).join(', ')}.</p>`);
  box.innerHTML = parts.join('');
  box.classList.toggle('hidden', !parts.length);
}

function showReview() {
  $('#review').classList.remove('hidden');
  $('#result').classList.remove('hidden');
  render();
  $('#review').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const blankAsset = () => ({ id: nextId++, category: 'cash', description: '', amount: null });
const blankLiability = () => ({ id: nextId++, kind: 'due_within_12_months', description: '', amount: null });
$('#add-asset').addEventListener('click', () => { state.assets.push(blankAsset()); render(); });
$('#add-liability').addEventListener('click', () => { state.liabilities.push(blankLiability()); render(); });

// ---------- settings ----------
const bindSetting = (sel, key, map = (v) => v) => $(sel).addEventListener('change', (e) => {
  state.settings[key] = map(e.target.value);
  if (key === 'currency') loadPrices(); else render();
});
bindSetting('#set-currency', 'currency');
bindSetting('#set-nisab', 'nisabMetal');
bindSetting('#set-jewellery', 'jewellery');
bindSetting('#set-debts', 'deductDebts', (v) => v === 'yes');
bindSetting('#set-year', 'yearType');
$('#set-currency').value = state.settings.currency;
$('#price-gold').addEventListener('input', (e) => { state.prices.goldPerGram = Number(e.target.value) || null; render(false); });
$('#price-silver').addEventListener('input', (e) => { state.prices.silverPerGram = Number(e.target.value) || null; render(false); });
document.querySelectorAll('input[name=hawl]').forEach((r) => r.addEventListener('change', (e) => { state.settings.hawl = e.target.value; render(false); }));

// ---------- rendering ----------
function options(map, selected) {
  return Object.entries(map).map(([v, label]) => `<option value="${v}"${v === selected ? ' selected' : ''}>${esc(typeof label === 'string' ? label : label.label)}</option>`).join('');
}

function detailFields(a) {
  const sel = (field, map, label) => `<label>${label}<select data-field="${field}">${options(map, a[field] || 'unknown')}</select></label>`;
  const pctField = `<label>Zakatable % (optional)<input type="number" min="0" max="100" step="0.1" data-field="zakatablePercent" value="${a.zakatablePercent ?? ''}" placeholder="25"></label>`;
  switch (a.category) {
    case 'gold':
      return `${sel('use', OPTIONS.metalUse, 'Kept as')}
        <label>Weight in grams (optional)<input type="number" min="0" step="0.01" data-field="grams" value="${a.grams ?? ''}"></label>
        <label>Karat<select data-field="karat">${[24, 22, 21, 18, 14, 10, 9].map((k) => `<option value="${k}"${Number(a.karat) === k ? ' selected' : ''}>${k}ct</option>`).join('')}</select></label>`;
    case 'silver':
      return `${sel('use', OPTIONS.metalUse, 'Kept as')}
        <label>Weight in grams (optional)<input type="number" min="0" step="0.01" data-field="grams" value="${a.grams ?? ''}"></label>`;
    case 'shares':
      return `${sel('intent', OPTIONS.sharesIntent, 'Held')}${a.intent === 'long_term' ? pctField : ''}`;
    case 'pension':
      return `${sel('pensionType', OPTIONS.pensionType, 'Type')}${a.pensionType === 'defined_contribution' || !a.pensionType || a.pensionType === 'unknown' ? pctField : ''}`;
    case 'property':
      return sel('propertyUse', OPTIONS.propertyUse, 'Use');
    case 'receivable':
      return sel('strength', OPTIONS.receivableStrength, 'Repayment');
    default:
      return '';
  }
}

function renderLists(result) {
  const list = $('#asset-list');
  list.innerHTML = '';
  result.assets.forEach((row) => {
    const node = $('#asset-tpl').content.firstElementChild.cloneNode(true);
    const a = state.assets.find((x) => x.id === row.id);
    $('.f-category', node).innerHTML = options(CATEGORIES, a.category);
    $('.f-description', node).value = a.description || '';
    $('.f-description', node).placeholder = CATEGORIES[a.category].hint;
    const amount = $('.f-amount', node);
    amount.value = a.amount ?? '';
    if ((a.category === 'gold' || a.category === 'silver') && Number(a.grams) > 0) {
      amount.value = '';
      amount.placeholder = `${formatMoney(row.result.value, state.settings.currency)} (from grams)`;
      amount.disabled = true;
    }
    $('.item-detail', node).innerHTML = detailFields(a);
    const z = row.result;
    $('.item-note', node).innerHTML = `<strong>${formatMoney(z.zakatable, state.settings.currency)} counted.</strong> ${esc(z.note)}${z.flag ? ` <span class="flag">${esc(z.flag)}</span>` : ''}`;
    if (a.amount == null && !(Number(a.grams) > 0)) node.classList.add('missing');

    $('.f-category', node).addEventListener('change', (e) => { a.category = e.target.value; render(); });
    $('.f-description', node).addEventListener('input', (e) => { a.description = e.target.value; });
    amount.addEventListener('change', (e) => { a.amount = e.target.value === '' ? null : Number(e.target.value); render(); });
    node.querySelectorAll('[data-field]').forEach((el) => el.addEventListener('change', (e) => {
      const f = el.dataset.field;
      a[f] = ['grams', 'karat', 'zakatablePercent'].includes(f) ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value;
      render();
    }));
    $('.remove', node).addEventListener('click', () => { state.assets = state.assets.filter((x) => x.id !== a.id); render(); });
    list.appendChild(node);
  });

  const llist = $('#liability-list');
  llist.innerHTML = '';
  result.liabilities.forEach((row) => {
    const node = $('#liability-tpl').content.firstElementChild.cloneNode(true);
    const l = state.liabilities.find((x) => x.id === row.id);
    $('.f-kind', node).innerHTML = options(LIABILITY_KINDS, l.kind);
    $('.f-description', node).value = l.description || '';
    $('.f-description', node).placeholder = LIABILITY_KINDS[l.kind].hint;
    $('.f-amount', node).value = l.amount ?? '';
    $('.item-note', node).innerHTML = `<strong>${formatMoney(row.result.deductible, state.settings.currency)} deducted.</strong> ${esc(row.result.note)}${row.result.flag ? ` <span class="flag">${esc(row.result.flag)}</span>` : ''}`;
    $('.f-kind', node).addEventListener('change', (e) => { l.kind = e.target.value; render(); });
    $('.f-description', node).addEventListener('input', (e) => { l.description = e.target.value; });
    $('.f-amount', node).addEventListener('change', (e) => { l.amount = e.target.value === '' ? null : Number(e.target.value); render(); });
    $('.remove', node).addEventListener('click', () => { state.liabilities = state.liabilities.filter((x) => x.id !== l.id); render(); });
    llist.appendChild(node);
  });
}

function render(rebuildLists = true) {
  const result = calculate(state);
  const m = (v) => formatMoney(v, state.settings.currency);
  if (rebuildLists) renderLists(result);

  $('#status-text').textContent = STATUS_TEXT[result.status];
  $('#zakah-amount').textContent = result.status === 'missing_prices' ? '–' : m(result.zakahDue);
  let extra = '';
  if (result.status === 'hawl_not_complete') extra = `When a full lunar year has passed with your wealth above the nisab, your zakah would be about ${m(result.zakahIfDue)}.`;
  if (result.status === 'due' && state.settings.hawl === 'unsure') extra = 'You said you are not sure about your zakah date. If you cannot work it out, scholars advise picking your best estimate and paying from then on.';
  if (result.status === 'below_nisab' && state.settings.nisabMetal === 'gold') extra = 'Using the silver nisab gives a lower threshold, which many scholars recommend as safer.';
  $('#status-extra').textContent = extra;
  $('#sum-assets').textContent = m(result.zakatableAssets);
  $('#sum-debts').textContent = `-${m(result.deductions)}`;
  $('#sum-net').textContent = m(result.netZakatable);
  $('#sum-nisab').textContent = result.nisab == null ? 'enter prices' : m(result.nisab);
  $('#nisab-metal').textContent = `${state.settings.nisabMetal}, ${result.nisabGrams}g`;

  const flags = $('#flags');
  flags.innerHTML = result.flags.length ? `<p><strong>Worth checking:</strong></p><ul>${result.flags.map((f) => `<li>${esc(f.question)}</li>`).join('')}</ul>` : '';
  flags.classList.toggle('hidden', !result.flags.length);

  const used = new Set(result.assets.flatMap((a) => a.result.sources));
  used.add('nzfNisab');
  $('#breakdown').innerHTML = `<ol>${result.assets.map((a) => `<li><strong>${esc(a.description || CATEGORIES[a.category].label)}</strong>: ${m(a.result.value)} → ${m(a.result.zakatable)} counted (${Math.round(a.result.fraction * 1000) / 10}%). ${esc(a.result.note)}</li>`).join('')}
    ${result.liabilities.map((l) => `<li><strong>${esc(l.description || LIABILITY_KINDS[l.kind].label)}</strong>: ${m(l.result.deductible)} deducted. ${esc(l.result.note)}</li>`).join('')}</ol>
    <p class="fineprint">Sources: ${[...used].map((k) => `<a href="${SOURCES[k].url}" target="_blank" rel="noopener">${esc(SOURCES[k].title)}</a>`).join('; ')}.</p>`;
}

// ---------- donate ----------
function setupDonate() {
  $('#charity-name').textContent = cfg.charityName || 'Muslims in Need';
  $('#charity-number').textContent = cfg.charityNumber || '1158317';
  $('#appeal-name').textContent = cfg.appealName || 'Gaza Emergency Appeal';
  document.querySelectorAll('.organiser').forEach((el) => { el.textContent = cfg.organiserName || 'the organiser'; });
  const link = $('#donate-link');
  if (!cfg.fundraiserUrl) { $('#donate').classList.add('hidden'); return; }
  link.href = cfg.fundraiserUrl;
  link.textContent = cfg.organiserName ? `Give to the Gaza appeal with ${cfg.organiserName}` : 'Give to the Gaza appeal';
  if (cfg.fundraiserGoal && cfg.fundraiserRaised != null) {
    const pctDone = Math.min(100, Math.round((cfg.fundraiserRaised / cfg.fundraiserGoal) * 100));
    $('#goal .bar span').style.width = `${pctDone}%`;
    $('#goal p').textContent = `${formatMoney(cfg.fundraiserRaised, 'GBP').replace('.00', '')} raised of ${formatMoney(cfg.fundraiserGoal, 'GBP').replace('.00', '')}`;
    $('#goal').classList.remove('hidden');
  }
}

// ---------- email ----------
function setupTurnstile() {
  if (!cfg.turnstileSiteKey) return;
  window.onTurnstileLoad = () => window.turnstile.render('#turnstile', { sitekey: cfg.turnstileSiteKey, callback: (t) => { state.turnstileToken = t; } });
  const s = document.createElement('script');
  s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad';
  s.async = true;
  document.head.appendChild(s);
}

$('#email-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const status = $('#email-status');
  const email = $('#email').value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { status.textContent = 'Please enter a valid email address.'; return; }
  const btn = $('#email-btn');
  btn.disabled = true;
  status.textContent = 'Sending…';
  try {
    const res = await fetch('/api/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email,
        firstName: $('#first-name').value.trim(),
        website: $('#website').value,
        marketingConsent: $('#marketing').checked,
        turnstileToken: state.turnstileToken,
        assets: state.assets,
        liabilities: state.liabilities,
        settings: state.settings,
        prices: state.prices,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'We could not send the email. Please try again.');
    status.textContent = data.doubleOptIn
      ? 'Sent. Check your inbox, and click the confirmation link to join the Ramadan list.'
      : data.subscribed ? 'Sent, and you are on the Ramadan list. JazakAllahu khayran.' : 'Sent. Check your inbox.';
  } catch (err) {
    status.textContent = err.message;
  } finally {
    btn.disabled = false;
  }
});

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

setupDonate();
setupTurnstile();
loadPrices();
