// Scope & Stride default brand.
// Run `npm run brand scope-and-stride` to activate.
//
// 3 colors required:
//   background  — lighter shade, used as the app background
//   primary     — darker color, used for headers and nav
//   accent      — darker color, used for buttons, highlights, and borders
//
// Optional override:
//   headerText  — text/icon color on the header (defaults to white for dark
//                 headers, dark for light headers). S&S uses gold as a brand
//                 distinction — most barns won't need this.

const config = {
  slug:      'scope-and-stride',
  barnName:  'Hollow Creek',
  appName:   'Scope & Stride',
  tagline:   'Barn management, refined.',
  chipStyle: 'filled' as const,
  colors: {
    background:  '#FAF7F2',  // warm cream
    primary:     '#2C4A35',  // hunter green — headers, nav
    accent:      '#C9A85C',  // gold — buttons, highlights
    headerText:  '#C9A85C',  // gold on dark green (optional override)
  },
} as const;

export default config;
