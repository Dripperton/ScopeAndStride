// Hidden Hill Farm white-label brand.
// Run `npm run brand hidden-hill-farm` to activate.
//
// 3 colors required:
//   background  — lighter shade, used as the app background
//   primary     — darker color, used for headers and nav
//   accent      — darker color, used for buttons, highlights, and borders

const config = {
  slug:      'hidden-hill-farm',
  barnName:  'Hidden Hill Farm',
  appName:   'HHF',
  tagline:   '',
  chipStyle: 'outlined' as const,
  colors: {
    background: '#F4F5F7',  // cool silver-grey
    primary:    '#182C63',  // deep navy blue — headers, nav
    accent:     '#1A1A1A',  // black — buttons, highlights, borders
    // headerText is auto-derived (white, since primary is dark)
  },
} as const;

export default config;
