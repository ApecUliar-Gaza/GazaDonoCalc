// Edit these values, then redeploy. Nothing here is secret.
window.ZAKAH_CONFIG = {
  // Your Muslims in Need fundraising page. Leave empty to hide the donate buttons.
  fundraiserUrl: 'https://www.launchgood.com/v4/campaign/wahaj_c7__sabeel_fundraising_for_gaza_orphans',
  // Shown on the donate button, e.g. "Give with Wahaj".
  organiserName: 'Wahaj',
  charityName: 'Muslims in Need',
  charityNumber: '1158317',
  appealName: 'Gaza Orphans fundraiser',
  // Only set to true once Muslims in Need (or LaunchGood) confirms gifts through this page
  // can be given and ring-fenced as zakah. Until then the page tells donors to check first.
  zakahConfirmed: false,
  // Optional: fundraising goal progress shown under the donate button.
  fundraiserGoal: null, // e.g. 10000
  fundraiserRaised: null, // e.g. 2350 (update by hand)
  // Contact for privacy requests (shown on the privacy page).
  privacyEmail: '',
  // Optional Cloudflare Turnstile site key to stop bots using the email form.
  turnstileSiteKey: '',
  defaultCurrency: 'GBP',
  // What a gift achieves, from the fundraiser's giving levels: £480 sponsors one orphan for a
  // year. Shown next to the person's zakah ("enough to sponsor 2 orphans"). null hides it.
  impactPerYear: 480,
  // A real photo of open, cupped hands. Netlify downloads the free Burst photo
  // ("Close up cupped hands" by Samantha Hurley) into img/hands.jpg at build time
  // (scripts/fetch-hands.mjs). Swap in any photo you hold a licence for at public/img/hands.jpg.
  // If the file is missing the drawn hands show instead. handsLanding is where coins land,
  // as % across and down the photo.
  handsImage: 'img/hands.jpg',
  handsLanding: { x: 50, y: 62 },
};
