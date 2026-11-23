// Personal links for other fundraisers.
//   https://site/?link=<LaunchGood page path, or any donate page URL>&n=<name>&t=<cause>
//   e.g. ?link=v4/campaign/my_fundraiser  ->  https://www.launchgood.com/v4/campaign/my_fundraiser
//   The older ?f=<full URL> still works.
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

// Turns what people paste into a full https URL: a LaunchGood path on its own, a link
// without https://, or an http:// link. The result still has to pass safeFundraiserUrl.
export function expandLink(raw) {
  let v = String(raw ?? '').trim();
  if (!v) return null;
  if (/^http:\/\//i.test(v)) v = `https://${v.slice(7)}`;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(v)) {
    const first = v.replace(/^\/+/, '').split('/')[0].toLowerCase();
    const isHost = ALLOWED_HOSTS.some((h) => first === h || first.endsWith(`.${h}`));
    v = isHost ? `https://${v.replace(/^\/+/, '')}` : `https://www.launchgood.com/${v.replace(/^\/+/, '')}`;
  }
  return safeFundraiserUrl(v);
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
  const get = (k) => (params.get ? params.get(k) : params[k]);
  const url = expandLink(get('link')) || safeFundraiserUrl(get('f'));
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
  // Shortest form: LaunchGood pages only need their path.
  const lg = new URL(url);
  const short = /(^|\.)launchgood\.com$/i.test(lg.hostname) && !lg.search && !lg.hash ? lg.pathname.replace(/^\/+/, '') : url;
  u.searchParams.set('link', short);
  if (name) u.searchParams.set('n', name);
  if (cause) u.searchParams.set('t', cause);
  return u.toString();
}
