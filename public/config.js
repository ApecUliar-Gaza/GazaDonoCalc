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
  // Optional: a real photo of open, cupped hands to replace the illustration (e.g. 'img/hands.jpg').
  // handsLanding is where coins land, as % across and down the photo.
  handsImage: '',
  handsLanding: { x: 50, y: 62 },
};
