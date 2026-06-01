// ─────────────────────────────────────────────────────────────────────────────
// Brand system — never edit this file. Edit constants/brand-config.ts or
// the corresponding file in brands/ instead.
//
// To onboard a new barn, a brand file only needs 4 colors:
//   primary    — header/nav background
//   accent     — buttons and interactive highlights
//   headerText — text/icon color on top of primary (usually white or gold)
//   background — app background (warm cream, cool grey, etc.)
//
// Everything else (primaryDark, cardBorder, activeBg, etc.) is derived here.
//
// To onboard a new barn:
//   1. Copy brands/scope-and-stride.ts → brands/their-slug.ts
//   2. Fill in their 4 colors + chipStyle
//   3. Run: npm run brand their-slug
//   4. Build: eas build --profile their-slug
// ─────────────────────────────────────────────────────────────────────────────

import config from './brand-config';

// ── Color math helpers ────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function darken(hex: string, pct: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  const r = clamp(parseInt(hex.slice(1, 3), 16) * (1 - pct));
  const g = clamp(parseInt(hex.slice(3, 5), 16) * (1 - pct));
  const b = clamp(parseInt(hex.slice(5, 7), 16) * (1 - pct));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Perceived brightness (0 = black, 1 = white)
function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function mix(hex: string, towards: string, pct: number): string {
  // pct = how much of `towards` to blend in (0 = all hex, 1 = all towards)
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  const r1 = parseInt(hex.slice(1, 3), 16), r2 = parseInt(towards.slice(1, 3), 16);
  const g1 = parseInt(hex.slice(3, 5), 16), g2 = parseInt(towards.slice(3, 5), 16);
  const b1 = parseInt(hex.slice(5, 7), 16), b2 = parseInt(towards.slice(5, 7), 16);
  return `#${clamp(r1 + (r2 - r1) * pct).toString(16).padStart(2, '0')}${clamp(g1 + (g2 - g1) * pct).toString(16).padStart(2, '0')}${clamp(b1 + (b2 - b1) * pct).toString(16).padStart(2, '0')}`;
}

// ── Derive all color tokens from the 4 required inputs ────────────────────────

const { primary, accent, background } = config.colors;
// headerText: use explicit override if provided, otherwise auto-derive from primary luminance
const rawColors = config.colors as typeof config.colors & { headerText?: string };
const headerText = rawColors.headerText ?? (luminance(primary) < 0.5 ? '#FFFFFF' : '#1A1A1A');
const outlined = config.chipStyle === 'outlined';

const colors = {
  primary,
  primaryDark:    darken(primary, 0.12),
  accent,
  accentDark:     darken(accent, 0.12),
  headerText,
  background,
  card:           '#FFFFFF',
  // Card borders: prominent (accent) for outlined brands, subtle tint for filled
  cardBorder:     outlined ? accent : mix(primary, '#FFFFFF', 0.82),
  cardSeparator:  outlined ? mix(accent, '#FFFFFF', 0.85) : mix(primary, '#FFFFFF', 0.92),
  // Active state: very light tint of primary
  activeBg:       hexToRgba(primary, 0.08),
  text:           '#1A1A1A',
  textMuted:      '#6B7280',
  textWarm:       accent,
  textTan:        mix(accent, '#FFFFFF', 0.50),
  error:          '#8B2E2E',
  errorBg:        '#FDECEA',
  warning:        '#C8922A',
  warningBg:      '#FEF6E4',
  // Alpha variants derived from accent
  accentAlpha15:  hexToRgba(accent, 0.15),
  accentAlpha20:  hexToRgba(accent, 0.20),
  accentAlpha30:  hexToRgba(accent, 0.30),
  accentAlpha60:  hexToRgba(accent, 0.60),
  accentAlpha70:  hexToRgba(accent, 0.70),
};

// ── Precomputed UI style objects ──────────────────────────────────────────────
// Spread these into StyleSheet.create() — no conditional logic needed in screens.

const ui = {
  // Selectable chips / type selectors / status pills
  chip: outlined
    ? { borderWidth: 2, borderColor: colors.text, backgroundColor: colors.card }
    : { borderWidth: 1.5, borderColor: colors.cardBorder, backgroundColor: 'transparent' as const },
  chipSelected: outlined
    ? { borderWidth: 2, borderColor: colors.primary, backgroundColor: colors.primary }
    : { borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.activeBg },

  // Text color on top of accent-colored buttons — white for dark accents, dark for light accents
  buttonText: luminance(accent) < 0.5 ? '#FFFFFF' : '#1A1A1A',

  // Header save/action button — plain white text, no background fill (iOS standard)
  headerSaveBtn:       { backgroundColor: 'transparent' as const, paddingHorizontal: 4, paddingVertical: 4, borderRadius: 0, borderWidth: 0 },
  headerSaveBtnText:   { color: '#FFFFFF', fontSize: 14, fontWeight: '700' as const },

  chipLabelColor:         outlined ? colors.text : colors.textMuted,
  chipLabelSelectedColor: outlined ? colors.card : colors.primary,
  chipIconColor:          outlined ? colors.text : colors.textMuted,
  chipIconSelectedColor:  outlined ? colors.card : colors.primary,

  // Small square icon buttons in headers (home button, etc.)
  // Use semi-transparent white so buttons are visible on any brand primary color
  iconBtn:        { borderWidth: 0, borderColor: 'transparent' as const, backgroundColor: 'rgba(255,255,255,0.18)' as const },
  iconBtnHovered: { borderWidth: 0, borderColor: 'transparent' as const, backgroundColor: 'rgba(255,255,255,0.32)' as const },

  // Dashboard quick-action navigation tiles
  navTile: outlined
    ? { backgroundColor: colors.card, borderWidth: 2, borderColor: colors.text }
    : { backgroundColor: colors.primary, borderWidth: 0, borderColor: 'transparent' as const },
  navTileHovered: outlined
    ? { backgroundColor: colors.activeBg, borderWidth: 2, borderColor: colors.primary }
    : { backgroundColor: colors.primaryDark, borderWidth: 0, borderColor: 'transparent' as const },
  navTileIconColor:  outlined ? colors.text : 'white',
  navTileLabelColor: outlined ? colors.text : 'white',
};

// ─────────────────────────────────────────────────────────────────────────────

const Brand = {
  slug:      config.slug,
  barnName:  config.barnName,
  appName:   config.appName,
  tagline:   config.tagline,
  chipStyle: config.chipStyle,
  colors,
  ui,
};

export default Brand;
