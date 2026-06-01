// ─────────────────────────────────────────────────────────────────────────────
// colors.ts — static token snapshot for Hidden Hill Farm
//
// These values mirror what ThemeContext derives at runtime from:
//   primary #1A1A1A · secondary #2B5FD9 · surface #E8E8EC
//
// For dynamic access inside components, prefer useTheme() from
// context/ThemeContext instead of importing Colors directly.
// ─────────────────────────────────────────────────────────────────────────────

export const Colors = {
  // ── Base ────────────────────────────────────────────────────────────────────
  primary:    '#1A1A1A',   // header / nav background (near-black)
  secondary:  '#2B5FD9',   // interactive: buttons, highlights, borders
  surface:    '#E8E8EC',   // app background (cool silver-grey)

  // ── Cards & surfaces ────────────────────────────────────────────────────────
  card:           '#FFFFFF',
  cardBorder:     '#A8BFEE',   // secondary mixed 72% toward white
  cardSeparator:  '#E4EAFB',   // secondary mixed 90% toward white
  activeBg:       'rgba(43,95,217,0.08)',

  // ── Typography ──────────────────────────────────────────────────────────────
  text:       '#1A1A1A',
  textMuted:  '#6B7280',
  textWarm:   '#2B5FD9',   // secondary

  // ── Semantic ────────────────────────────────────────────────────────────────
  success:    '#2C6B45',
  successBg:  '#EDF5EF',
  warning:    '#C8922A',
  warningBg:  '#FEF6E4',
  error:      '#8B2E2E',
  errorBg:    '#FDECEA',

  // ── Legacy aliases (kept for screens not yet migrated to useTheme) ──────────
  hunterGreen: '#1A1A1A',
  gold:        '#2B5FD9',
  goldLight:   '#A8BFEE',
  sage:        '#3B50A0',
  cream:       '#FFFFFF',
  sand:        '#E8E8EC',
  warmGray:    '#6B7280',
  charcoal:    '#1A1A1A',
  tan:         '#A8BFEE',
};
