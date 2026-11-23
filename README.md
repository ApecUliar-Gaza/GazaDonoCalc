# Zakah Assistant

A Ramadan lead generator for Wahaj's LaunchGood fundraiser for orphans in Gaza, run with Sabeel in partnership with Muslims in Need. People describe their wealth in plain words ("£5k savings, some gold and a pension"), check what the AI understood, see their zakah with every rule explained, and can have the breakdown emailed to them. A separate, unticked box lets them join a Ramadan mailing list. A donate button links to the fundraiser.

## How it works

```
public/                 static site (no build step)
  index.html, app.js    the page
  js/zakat-engine.js    every Shariah rule, in one reviewable file (also used by the email function)
  config.js             fundraiser link, names, goal: edit this
netlify/functions/
  parse.mjs             /api/parse  : Claude turns the description into rows (extraction only)
  prices.mjs            /api/prices : live gold/silver spot prices and FX (free, keyless sources)
  email.mjs             /api/email  : sends the breakdown via Brevo; adds to list only with consent
test/                   engine tests: npm test
```

The AI never decides a ruling. It only fills in the table; the person checks and edits it; `zakat-engine.js` applies fixed rules. If the AI is down or no key is set, people can still fill the table by hand.

## Shariah rules applied

| Item | Treatment | Source |
|---|---|---|
| Nisab | 612.36g silver (default, NZF recommendation) or 87.48g gold, at live prices | NZF |
| Rate | 2.5% per lunar year (2.577% if a solar year is used) | |
| Hawl | Asked directly; if not complete, shows "not due yet" | NZF |
| Cash, bank, savings, cash ISA | 100% | NZF |
| Gold/silver investment (coins, bars) | 100% of pure metal content | All schools |
| Gold/silver jewellery worn | Counted by default (Hanafi, cautious); setting to exempt (Maliki, Shafi'i, Hanbali) | NZF |
| Shares held long term | 25% of market value (NZF proxy) or the person's own %; unknown intent counted at 100% until answered | NZF |
| Shares for trading | 100% | NZF |
| Defined-contribution pension | 25% of pot (NZF view: due even before access), or own %; note that scholars differ | NZF |
| Defined-benefit / state pension | 0% | NZF |
| Business stock and cash | 100% at sale value | NZF |
| Money owed to you | 100% if likely repaid; 0% if doubtful (pay when received) | NZF |
| Crypto | 100% of value on zakah date, with a note on the minority view | NZF |
| Property | Only if bought to resell; home and rental value 0% | NZF |
| Debts | Due within 12 months, or next 12 months of long-term instalments without interest; never a whole mortgage. Setting for the Shafi'i view (no deduction) | NZF |
| Personal items | Not counted (AI lists them as ignored) | |

Every result includes a disclaimer to consult a scholar, a note on the eight eligible recipient groups (Qur'an 9:60) and links to the sources. **Please have a scholar or your imam review `zakat-engine.js` and the page text before launch.**

Charity eligibility: the fundraiser (https://www.launchgood.com/v4/campaign/wahaj_c7__sabeel_fundraising_for_gaza_orphans) goes to Muslims in Need (charity no. 1158317) for orphans in Gaza, but as of 23 Nov 2026 the page says nothing about zakah. Orphans who are poor are eligible recipients, so the page and email tell zakah-payers to confirm with Muslims in Need first, or give as sadaqah. Once MiN confirms gifts via this page are ring-fenced as zakah, set `zakahConfirmed: true` in `config.js` and `FUNDRAISER_ZAKAH_CONFIRMED=true`.

## Set up (about 30 minutes)

1. **Fundraiser link:** put your fundraising page URL in `public/config.js` (`fundraiserUrl`) and in the `FUNDRAISER_URL` env var. Make sure the page lets donors choose Zakat.
2. **Netlify:** connect this GitHub repo at https://app.netlify.com ("Add new site" → "Import from Git"). No build settings needed; `netlify.toml` covers it.
3. **Claude API key:** create one at https://console.anthropic.com, add it as `ANTHROPIC_API_KEY`, and set a monthly spend limit there.
4. **Brevo:** create a free account, verify your sender address (or domain), create a list called "Ramadan 2027", and set `BREVO_API_KEY`, `SENDER_EMAIL`, `BREVO_LIST_ID`. For double opt-in (recommended), create a DOI template in Brevo and set `BREVO_DOI_TEMPLATE_ID`.
5. Set `SITE_URL` and `ORGANISER_NAME`, and your `privacyEmail` in `config.js`. Redeploy.
6. Optional: Cloudflare Turnstile keys to block bots from the email form.

All variables are listed in `.env.example`.

## Run locally

```
npm install
cp .env.example .env   # fill in what you have
node --env-file-if-exists=.env scripts/dev-server.mjs
# open http://localhost:8888
npm test
```

## Hosting and email options

| | Recommended | Alternatives |
|---|---|---|
| Hosting | **Netlify** free tier (static + functions, deploys from GitHub) | Vercel (move functions to `/api`), Cloudflare Pages + Functions |
| Email | **Brevo** free (300/day, transactional + lists + double opt-in, EU-based) | MailerLite (great newsletters, transactional is paid), Resend + a list tool, Mailchimp (pricier) |
| AI | Claude via the Anthropic API | none needed: manual entry still works |

## The chat (added 23 Nov 2026)

`public/js/chat.js` asks one question at a time (cash, gold, silver, shares, pension, crypto,
business, money owed, property, debts, zakah already given, hawl), with an "I'm not sure" tip on
each figure. It works without AI. If someone types a whole description, it goes to `/api/parse`,
and the chat then asks only the follow-up questions the engine needs. The detailed table below
the chat stays as the editable "details" view. All rulings still come from `zakat-engine.js`.

New engine options: `ownershipPercent` on any row (joint accounts, part-owned businesses, money
held for others), gold estimated from pieces (`piece`, `count`) when the weight is unknown,
assumed karat (22ct jewellery, 24ct coins) with a flag, `business_due` debts, `personalUse`
items, settings `alreadyPaid` and `pensionView` (`nzf` or `on_access`).

## Hands photo

Netlify runs `scripts/fetch-hands.mjs` at build time to download "Close up cupped hands" by
Samantha Hurley from Burst by Shopify (free for commercial use, no attribution required) into
`public/img/hands.jpg`. To use another photo you hold a licence for, commit it at
`public/img/hands.jpg` and the script leaves it alone. Adjust `handsLanding` in `config.js` so the
coin lands in the palms.
