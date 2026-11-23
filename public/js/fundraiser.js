// Personal links for other fundraisers.
//   https://site/?f=<donate page URL>&n=<fundraiser's name>&t=<cause, e.g. "Gaza water wells">
// Used by the page, the link maker and the email function, so the same rules apply everywhere.
// Only https links to known fundraising platforms are accepted, so nobody can use the site
// to send people to a look-alike page.

export const ALLOWED_HOSTS = [
  'launchgood.com',
  'justgiving.com',
  'gofundme.com',
  'muslimsinneed.org',
  'givebutter.com',
  'enthuse.com',
  'givewp.com',
  'donorbox.org',
  'virginmoneygiving.com',
];

export function safeFundraiserUrl(raw) {
  if (!raw) return null;
  let url;
  try {
    url = new URL(String(raw).trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
  const host = url.hostname.toLowerCase();
  if (!ALLOWED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) return null;
  return url.toString();
}

export function cleanText(raw, max = 40) {
  return String(raw ?? '')
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

// Returns the fundraiser to show: from the link if valid, otherwise the site default.
export function fundraiserFrom(params, defaults = {}) {
  const url = safeFundraiserUrl(params.get?.('f') ?? params.f);
  if (url) {
    return {
      custom: true,
      url,
      name: cleanText(params.get?.('n') ?? params.n) || null,
      cause: cleanText(params.get?.('t') ?? params.t, 60) || null,
    };
  }
  return {
    custom: false,
    url: defaults.fundraiserUrl || null,
    name: defaults.organiserName || null,
    cause: null,
  };
}

export function buildLink(base, { url, name, cause }) {
  const u = new URL(base);
  u.search = '';
  u.hash = '';
  u.searchParams.set('f', url);
  if (name) u.searchParams.set('n', name);
  if (cause) u.searchParams.set('t', cause);
  return u.toString();
}
