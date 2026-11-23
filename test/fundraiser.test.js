import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeFundraiserUrl, fundraiserFrom, buildLink, expandLink } from '../public/js/fundraiser.js';

test('accepts https links on known fundraising sites', () => {
  assert.ok(safeFundraiserUrl('https://www.launchgood.com/v4/campaign/abc'));
  assert.ok(safeFundraiserUrl('https://www.justgiving.com/page/x'));
});

test('rejects other sites, http, look-alikes and credentials', () => {
  for (const bad of ['https://evil.com/launchgood.com', 'http://launchgood.com/x', 'https://launchgood.com.evil.io/x',
    'https://user:pw@launchgood.com/x', 'javascript:alert(1)', 'https://notlaunchgood.com/x']) {
    assert.equal(safeFundraiserUrl(bad), null, bad);
  }
});

test('names are stripped of markup and shortened', () => {
  const f = fundraiserFrom(new URLSearchParams({ f: 'https://launchgood.com/x', n: '<b>Aisha</b>' + 'x'.repeat(80) }));
  assert.equal(f.custom, true);
  assert.ok(!f.name.includes('<'));
  assert.ok(f.name.length <= 40);
});

test('falls back to site defaults without a valid link', () => {
  const f = fundraiserFrom(new URLSearchParams({ f: 'https://evil.com' }), { fundraiserUrl: 'https://launchgood.com/default', organiserName: 'Wahaj' });
  assert.equal(f.custom, false);
  assert.equal(f.url, 'https://launchgood.com/default');
});

test('buildLink round-trips', () => {
  const link = buildLink('https://site.test/share.html?x=1', { url: 'https://launchgood.com/c', name: 'Aisha', cause: 'Gaza wells' });
  const f = fundraiserFrom(new URL(link).searchParams);
  assert.deepEqual(f, { custom: true, url: 'https://www.launchgood.com/c', name: 'Aisha', cause: 'Gaza wells' });
});

test('?link= accepts a LaunchGood path, a bare link or an http link', () => {
  const want = 'https://www.launchgood.com/v4/campaign/abc';
  assert.equal(expandLink('v4/campaign/abc'), want);
  assert.equal(expandLink('/v4/campaign/abc'), want);
  assert.equal(expandLink('http://www.launchgood.com/v4/campaign/abc'), want);
  assert.equal(expandLink('www.launchgood.com/v4/campaign/abc'), want);
  assert.equal(expandLink('justgiving.com/page/x'), 'https://justgiving.com/page/x');
  assert.equal(expandLink('evil.com/x'), 'https://www.launchgood.com/evil.com/x'); // stays on LaunchGood
  assert.equal(expandLink('https://evil.com/x'), null);
  assert.equal(expandLink('javascript:alert(1)'), null);
  const f = fundraiserFrom(new URLSearchParams('link=v4/campaign/abc'));
  assert.equal(f.custom, true);
  assert.equal(f.url, want);
});

test('buildLink makes the short ?link= form for LaunchGood', () => {
  const l = buildLink('https://gazadonocalc.netlify.app/', { url: 'https://www.launchgood.com/v4/campaign/abc', name: 'Aisha' });
  assert.equal(l, 'https://gazadonocalc.netlify.app/?link=v4%2Fcampaign%2Fabc&n=Aisha');
  assert.equal(fundraiserFrom(new URL(l).searchParams).url, 'https://www.launchgood.com/v4/campaign/abc');
});
