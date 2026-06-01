// ─────────────────────────────────────────────────────────────────────────────
// ThemeContext — runtime design token system
//
// Accepts 3 barn-supplied base colors and derives the full token set.
// Fonts (DM Sans + DM Serif Display) are loaded here and exposed via theme.fonts.
//
// Usage:
//   const theme = useTheme();
//   style={{ backgroundColor: theme.colors.primary }}
//   style={{ fontFamily: theme.fonts.sansBold }}
// ─────────────────────────────────────────────────────────────────────────────

import React, { createContext, useContext, useMemo } from 'react';
import { useFonts } from 'expo-font';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import { DMSerifDisplay_400Regular } from '@expo-google-fonts/dm-serif-display';

// ── Color math helpers (same as brand.ts) ────────────────────────────────────

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

function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function mix(hex: string, towards: string, pct: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  const r1 = parseInt(hex.slice(1, 3), 16), r2 = parseInt(towards.slice(1, 3), 16);
  const g1 = parseInt(hex.slice(3, 5), 16), g2 = parseInt(towards.slice(3, 5), 16);
  const b1 = parseInt(hex.slice(5, 7), 16), b2 = parseInt(towards.slice(5, 7), 16);
  return `#${clamp(r1 + (r2 - r1) * pct).toString(16).padStart(2, '0')}${clamp(g1 + (g2 - g1) * pct).toString(16).padStart(2, '0')}${clamp(b1 + (b2 - b1) * pct).toString(16).padStart(2, '0')}`;
}

// ── Token types ───────────────────────────────────────────────────────────────

export interface ThemeColors {
  // Base
  primary: string;
  primaryDark: string;
  secondary: string;
  secondaryDark: string;
  surface: string;
  background: string;

  // Header
  headerText: string;

  // Cards & surfaces
  card: string;
  cardBorder: string;
  cardSeparator: string;
  activeBg: string;

  // Typography
  text: string;
  textMuted: string;
  textWarm: string;

  // Semantic
  success: string;
  successBg: string;
  warning: string;
  warningBg: string;
  error: string;
  errorBg: string;

  // Alpha variants of secondary (for overlays, badges)
  secondaryAlpha10: string;
  secondaryAlpha15: string;
  secondaryAlpha20: string;
  secondaryAlpha30: string;
  secondaryAlpha60: string;
}

export interface ThemeFonts {
  sans: string;
  sansMedium: string;
  sansBold: string;
  serif: string;
  loaded: boolean;
}

export interface Theme {
  colors: ThemeColors;
  fonts: ThemeFonts;
}

// ── Context ───────────────────────────────────────────────────────────────────

const ThemeContext = createContext<Theme | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

interface ThemeProviderProps {
  /**
   * primary — header/nav background (e.g. #1A1A1A)
   * secondary — interactive color: buttons, highlights, borders (e.g. #2B5FD9)
   * surface — app background (e.g. #E8E8EC)
   */
  primary: string;
  secondary: string;
  surface: string;
  children: React.ReactNode;
}

export function ThemeProvider({ primary, secondary, surface, children }: ThemeProviderProps) {
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
    DMSerifDisplay_400Regular,
  });

  const theme = useMemo<Theme>(() => {
    const headerText = luminance(primary) < 0.5 ? '#FFFFFF' : '#1A1A1A';

    const colors: ThemeColors = {
      // Base
      primary,
      primaryDark: darken(primary, 0.12),
      secondary,
      secondaryDark: darken(secondary, 0.12),
      surface,
      background: surface,

      // Header
      headerText,

      // Cards
      card: '#FFFFFF',
      cardBorder: mix(secondary, '#FFFFFF', 0.72),
      cardSeparator: mix(secondary, '#FFFFFF', 0.90),
      activeBg: hexToRgba(secondary, 0.08),

      // Typography
      text: '#1A1A1A',
      textMuted: '#6B7280',
      textWarm: secondary,

      // Semantic
      success: '#2C6B45',
      successBg: '#EDF5EF',
      warning: '#C8922A',
      warningBg: '#FEF6E4',
      error: '#8B2E2E',
      errorBg: '#FDECEA',

      // Alpha
      secondaryAlpha10: hexToRgba(secondary, 0.10),
      secondaryAlpha15: hexToRgba(secondary, 0.15),
      secondaryAlpha20: hexToRgba(secondary, 0.20),
      secondaryAlpha30: hexToRgba(secondary, 0.30),
      secondaryAlpha60: hexToRgba(secondary, 0.60),
    };

    const fonts: ThemeFonts = {
      sans: 'DMSans_400Regular',
      sansMedium: 'DMSans_500Medium',
      sansBold: 'DMSans_700Bold',
      serif: 'DMSerifDisplay_400Regular',
      loaded: fontsLoaded ?? false,
    };

    return { colors, fonts };
  }, [primary, secondary, surface, fontsLoaded]);

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}

// ── Hidden Hill Farm defaults (for convenience) ───────────────────────────────

export const HHF_THEME = {
  primary: '#1A1A1A',
  secondary: '#2B5FD9',
  surface: '#E8E8EC',
} as const;
