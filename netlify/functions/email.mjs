// POST /api/email
// Sends the person their zakah breakdown and, only if they ticked the separate marketing box,
// adds them to the Ramadan mailing list.
//
// The breakdown is rebuilt here from the rows with the same engine the page uses, and the
// email body comes from a fixed template. The endpoint therefore can't be used to send
// arbitrary content to arbitrary addresses.
//
// Email provider: Brevo (https://www.brevo.com). Swap sendEmail/addToList to use another.
import { calculate, formatMoney, STATUS_TEXT, CATEGORIES, LIABILITY_KINDS, SOURCES, DEFAULT_SETTINGS } from '../../public/js/zakat-engine.js';
import { json, rateLimit, clientIp, escapeHtml } from '../lib/shared.mjs';
import { fundraiserFrom } from '../../public/js/fundraiser.js';

const BREVO = 'https://api.brevo.com/v3';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ALLOWED_SETTINGS = {
  currency: ['GBP', 'USD', 'EUR', 'CAD', 'AUD'],
  nisabMetal: ['silver', 'gold'],
  jewellery: ['include', 'exclude'],
  deductDebts: [true, false],
  yearType: ['lunar', 'solar'],
  hawl: ['yes', 'no', 'unsure'],
  pensionView: ['nzf', 'on_access'],
};

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (!process.env.BREVO_API_KEY || !process.env.SENDER_EMAIL) return json({ error: 'Email is not set up yet.' }, 503);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  // Honeypot: real people never fill the hidden "website" field.
  if (body.website) return json({ ok: true });

  const email = String(body.email ?? '').trim().toLowerCase();
  const firstName = String(body.firstName ?? '').trim().slice(0, 60);
  if (!EMAIL_RE.test(email) || email.length > 200) return json({ error: 'Please enter a valid email address.' }, 400);
  if (!rateLimit(`email:${clientIp(req)}`, 5, 60 * 60_000) || !rateLimit(`email-to:${email}`, 3, 60 * 60_000)) {
    return json({ error: 'Too many emails sent. Please try again later.' }, 429);
  }
  if (process.env.TURNSTILE_SECRET && !(await turnstileOk(body.turnstileToken, clientIp(req)))) {
    return json({ error: 'Please complete the human check.' }, 400);
  }

  const result = calculate(sanitise(body));
  // A personal link from another fundraiser: their donate page (validated), and never our list.
  const custom = fundraiserFrom(body.fundraiser ?? {}, {});
  const fundraiser = custom.custom ? custom : null;

  try {
    await sendEmail({ email, firstName, result, fundraiser });
  } catch (err) {
    console.error('send failed', err.message);
    return json({ error: 'We could not send the email. Please try again.' }, 502);
  }

  let subscribed = false;
  if (body.marketingConsent === true && !fundraiser) {
    try {
      await addToList({ email, firstName });
      subscribed = true;
    } catch (err) {
      console.error('list add failed', err.message);
    }
  }
  return json({ ok: true, subscribed, doubleOptIn: subscribed && !!process.env.BREVO_DOI_TEMPLATE_ID });
};

function sanitise(body) {
  const settings = {};
  for (const [k, allowed] of Object.entries(ALLOWED_SETTINGS)) {
    settings[k] = allowed.includes(body.settings?.[k]) ? body.settings[k] : DEFAULT_SETTINGS[k];
  }
  const n = (v, max = 1e12) => {
    const x = Number(v);
    return Number.isFinite(x) && x >= 0 && x <= max ? x : 0;
  };
  settings.alreadyPaid = n(body.settings?.alreadyPaid);
  const share = (v) => (v === '' || v == null ? null : n(v, 100));
  const str = (v, len = 80) => String(v ?? '').slice(0, len);
  const assets = (Array.isArray(body.assets) ? body.assets : []).slice(0, 40).map((a) => ({
    category: CATEGORIES[a.category] ? a.category : 'other',
    description: str(a.description),
    amount: n(a.amount),
    grams: n(a.grams, 1e7),
    karat: n(a.karat, 24),
    fineness: n(a.fineness, 1000),
    use: str(a.use, 30),
    intent: str(a.intent, 30),
    pensionType: str(a.pensionType, 30),
    propertyUse: str(a.propertyUse, 30),
    strength: str(a.strength, 30),
    zakatablePercent: a.zakatablePercent === '' || a.zakatablePercent == null ? null : n(a.zakatablePercent, 100),
    ownershipPercent: share(a.ownershipPercent),
    piece: str(a.piece, 20),
    count: n(a.count, 1000),
    personalUse: a.personalUse === true,
    accessible: a.accessible === true,
  }));
  const liabilities = (Array.isArray(body.liabilities) ? body.liabilities : []).slice(0, 40).map((l) => ({
    kind: LIABILITY_KINDS[l.kind] ? l.kind : 'due_within_12_months',
    description: str(l.description),
    amount: n(l.amount),
    ownershipPercent: share(l.ownershipPercent),
  }));
  const prices = { goldPerGram: n(body.prices?.goldPerGram, 1e6), silverPerGram: n(body.prices?.silverPerGram, 1e5) };
  return { assets, liabilities, settings, prices };
}

async function brevo(path, payload) {
  const res = await fetch(`${BREVO}${path}`, {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });
  // 204 for DOI, 201 for create, 400 "duplicate_parameter" when the contact already exists.
  if (!res.ok && res.status !== 204) {
    const text = await res.text();
    if (res.status === 400 && text.includes('duplicate_parameter')) return;
    throw new Error(`Brevo ${path} ${res.status}: ${text.slice(0, 200)}`);
  }
}

async function sendEmail({ email, firstName, result, fundraiser }) {
  const { html, text } = renderEmail({ firstName, result, fundraiser });
  await brevo('/smtp/email', {
    sender: { email: process.env.SENDER_EMAIL, name: process.env.SENDER_NAME || 'Zakah Assistant' },
    to: [{ email, ...(firstName ? { name: firstName } : {}) }],
    subject: result.status === 'due'
      ? `Your zakah breakdown: ${formatMoney(result.zakahDue, result.settings.currency)}`
      : 'Your zakah breakdown',
    htmlContent: html,
    textContent: text,
    tags: ['zakah-breakdown'],
  });
}

async function addToList({ email, firstName }) {
  const listId = Number(process.env.BREVO_LIST_ID);
  if (!listId) throw new Error('BREVO_LIST_ID not set');
  const attributes = firstName ? { FIRSTNAME: firstName } : {};
  if (process.env.BREVO_DOI_TEMPLATE_ID) {
    // Double opt-in: Brevo emails a confirmation link and only adds them once clicked.
    await brevo('/contacts/doubleOptinConfirmation', {
      email,
      attributes,
      includeListIds: [listId],
      templateId: Number(process.env.BREVO_DOI_TEMPLATE_ID),
      redirectionUrl: `${process.env.SITE_URL || process.env.URL || ''}/confirmed.html`,
    });
  } else {
    await brevo('/contacts', { email, attributes, listIds: [listId], updateEnabled: true });
  }
}

async function turnstileOk(token, ip) {
  if (!token) return false;
  const form = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET, response: String(token), remoteip: ip });
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form, signal: AbortSignal.timeout(5000) });
    return (await res.json()).success === true;
  } catch {
    return false;
  }
}

export function renderEmail({ firstName, result, fundraiser = null }) {
  const cur = result.settings.currency;
  const m = (v) => formatMoney(v, cur);
  const fundraiserUrl = fundraiser?.url || process.env.FUNDRAISER_URL || '';
  const siteUrl = process.env.SITE_URL || process.env.URL || '';
  const organiser = fundraiser ? fundraiser.name || '' : process.env.ORGANISER_NAME || '';
  const greeting = firstName ? `Assalamu alaykum ${escapeHtml(firstName)},` : 'Assalamu alaykum,';

  const assetRows = result.assets
    .map((a) => `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee">${escapeHtml(a.description || CATEGORIES[a.category].label)}<br><span style="color:#666;font-size:12px">${escapeHtml(a.result.note)}</span></td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;white-space:nowrap">${m(a.result.value)}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;white-space:nowrap">${m(a.result.zakatable)}</td></tr>`)
    .join('');
  const debtRows = result.liabilities
    .map((l) => `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee">${escapeHtml(l.description || LIABILITY_KINDS[l.kind].label)}<br><span style="color:#666;font-size:12px">${escapeHtml(l.result.note)}</span></td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;white-space:nowrap">${m(l.result.value)}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;white-space:nowrap">-${m(l.result.deductible)}</td></tr>`)
    .join('');
  const flags = result.flags.length
    ? `<p style="background:#fff7e6;padding:10px;border-radius:6px"><strong>Worth checking:</strong><br>${result.flags.map((f) => `• ${escapeHtml(f.question)}`).join('<br>')}</p>`
    : '';
  const usedSources = [...new Set(result.assets.flatMap((a) => a.result.sources))].concat('nzfNisab', 'quran960');
  const sources = [...new Set(usedSources)].map((k) => `<li><a href="${SOURCES[k].url}">${escapeHtml(SOURCES[k].title)}</a></li>`).join('');
  const s = result.settings;
  const settingsLine = `Nisab: ${s.nisabMetal} (${result.nisabGrams}g = ${m(result.nisab ?? 0)}). Jewellery: ${s.jewellery === 'include' ? 'included (Hanafi view)' : 'worn jewellery exempt (Maliki, Shafi\'i, Hanbali view)'}. Debts: ${s.deductDebts ? 'deducted' : 'not deducted'}. Pensions: ${s.pensionView === 'on_access' ? 'counted once you can access them' : 'counted every year (NZF view)'}. Rate: ${(result.rate * 100).toFixed(3).replace(/0+$/, '')}% (${s.yearType} year). Prices used: gold ${m(result.prices.goldPerGram)}/g, silver ${m(result.prices.silverPerGram)}/g.`;

  const zakahConfirmed = process.env.FUNDRAISER_ZAKAH_CONFIRMED === 'true';
  const ctaTitle = fundraiser ? (fundraiser.cause ? `Support ${escapeHtml(fundraiser.cause)}` : 'Support this fundraiser') : 'Support orphans in Gaza';
  const ctaButton = fundraiser ? (organiser ? `Give with ${escapeHtml(organiser)}` : 'Go to the fundraiser') : `Give to Gaza orphans${organiser ? ` with ${escapeHtml(organiser)}` : ''}`;
  const donateText = fundraiser
    ? `This calculator was shared by ${escapeHtml(organiser || 'a fundraiser')}${fundraiser.cause ? `, who is raising money for ${escapeHtml(fundraiser.cause)}` : ''}. <strong>If you are giving zakah</strong>, check on the donation page that the charity accepts zakah and keeps it separate, or give as sadaqah.`
    : zakahConfirmed
    ? 'This fundraiser sends every gift to Muslims in Need (charity no. 1158317) to support orphans in Gaza, and it accepts zakah. Please make sure your gift is marked as <strong>Zakat</strong> so it is kept separate.'
    : 'This fundraiser sends every gift to Muslims in Need (charity no. 1158317) to support orphans in Gaza. Orphans who are poor are among the people zakah can be given to, but the page does not yet say whether gifts are kept separate as zakah. <strong>If you are giving zakah</strong>, please confirm with Muslims in Need first, or give it here as sadaqah.';
  const cta = fundraiserUrl
    ? `<div style="background:#0f5132;color:#fff;padding:18px;border-radius:10px;margin:20px 0">
        <p style="margin:0 0 8px;font-size:18px"><strong>${ctaTitle}</strong></p>
        <p style="margin:0 0 12px">${donateText}</p>
        <a href="${escapeHtml(fundraiserUrl)}" style="display:inline-block;background:#fff;color:#0f5132;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:bold">${ctaButton}</a>
      </div>`
    : '';

  const html = `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;max-width:640px;margin:0 auto;padding:16px">
  <p>${greeting}</p>
  <p>Here is the zakah breakdown you asked for.</p>
  <div style="background:#f3f7f4;padding:16px;border-radius:10px">
    <p style="margin:0;font-size:14px;color:#555">${escapeHtml(STATUS_TEXT[result.status])}</p>
    <p style="margin:4px 0 0;font-size:30px;font-weight:bold">${m(result.zakahDue)}</p>${result.alreadyPaid ? `<p style="margin:4px 0 0;font-size:13px">${m(result.zakahIfDue)} in total, less ${m(result.alreadyPaid)} you have already given.</p>` : ''}
    ${result.status === 'hawl_not_complete' ? `<p style="margin:4px 0 0">Once a full lunar year has passed with your wealth above the nisab, it would be about ${m(result.zakahIfDue)}.</p>` : ''}
  </div>
  ${cta}
  <h3>Your assets</h3>
  <table style="width:100%;border-collapse:collapse;font-size:14px"><tr><th style="text-align:left;padding:6px 8px">Item</th><th style="text-align:right;padding:6px 8px">Value</th><th style="text-align:right;padding:6px 8px">Zakatable</th></tr>${assetRows || '<tr><td colspan="3">None entered</td></tr>'}</table>
  ${debtRows ? `<h3>Debts</h3><table style="width:100%;border-collapse:collapse;font-size:14px"><tr><th style="text-align:left;padding:6px 8px">Debt</th><th style="text-align:right;padding:6px 8px">Amount</th><th style="text-align:right;padding:6px 8px">Deducted</th></tr>${debtRows}</table>` : ''}
  <table style="width:100%;font-size:14px;margin-top:12px">
    <tr><td>Zakatable assets</td><td style="text-align:right">${m(result.zakatableAssets)}</td></tr>
    <tr><td>Deductible debts</td><td style="text-align:right">-${m(result.deductions)}</td></tr>
    <tr><td><strong>Net zakatable wealth</strong></td><td style="text-align:right"><strong>${m(result.netZakatable)}</strong></td></tr>
    <tr><td>Nisab threshold</td><td style="text-align:right">${m(result.nisab ?? 0)}</td></tr>
  </table>
  ${flags}
  <p style="font-size:12px;color:#555">${escapeHtml(settingsLine)}</p>
  <p style="font-size:12px;color:#555"><strong>Who can receive zakah:</strong> only the eight categories named in Qur'an 9:60, such as the poor and those in need. Give through a charity that keeps zakah separate and distributes it to eligible people.</p>
  <p style="font-size:12px;color:#555"><strong>Please note:</strong> this is a guide based on mainstream scholarly views, mostly following the National Zakat Foundation (UK). It is not a fatwa. Where your situation is complex, or you follow a particular madhab, please confirm with a qualified scholar.</p>
  <p style="font-size:12px;color:#555">Sources:</p><ul style="font-size:12px;color:#555">${sources}</ul>
  <p style="font-size:12px;color:#888">You received this one email because you asked for your breakdown${siteUrl ? ` at ${escapeHtml(siteUrl)}` : ''}. We do not store your financial details.</p>
  </body></html>`;

  const text = [
    firstName ? `Assalamu alaykum ${firstName},` : 'Assalamu alaykum,',
    '',
    `${STATUS_TEXT[result.status]}: ${m(result.zakahDue)}`,
    '',
    ...result.assets.map((a) => `- ${a.description || CATEGORIES[a.category].label}: ${m(a.result.value)} (zakatable ${m(a.result.zakatable)})`),
    ...result.liabilities.map((l) => `- Debt: ${l.description || LIABILITY_KINDS[l.kind].label}: deducted ${m(l.result.deductible)}`),
    '',
    `Net zakatable wealth: ${m(result.netZakatable)}. Nisab: ${m(result.nisab ?? 0)}.`,
    settingsLine,
    '',
    fundraiser ? `Support ${fundraiser.cause || 'the fundraiser'}: ${fundraiserUrl} (if giving zakah, check the charity accepts it, or give as sadaqah)` : fundraiserUrl ? `Support orphans in Gaza through Muslims in Need: ${fundraiserUrl}${zakahConfirmed ? ' (mark your gift as Zakat)' : ' (if giving zakah, please confirm with Muslims in Need first, or give as sadaqah)'}` : '',
    '',
    'This is a guide based on mainstream scholarly views (mostly NZF UK guidance), not a fatwa. Please confirm complex cases with a qualified scholar.',
  ].join('\n');

  return { html, text };
}

export const config = { path: '/api/email' };
