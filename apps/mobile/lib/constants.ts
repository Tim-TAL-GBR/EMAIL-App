/**
 * TeamMail Design System Constants
 *
 * Premium dark-mode-first design system inspired by Vercel/Linear aesthetics.
 * All values are optimized for React Native StyleSheet usage.
 */

import { Platform, type TextStyle } from 'react-native';

export const API_URL = process.env.EXPO_PUBLIC_SERVER_URL || 'http://localhost:3001';

// ─── Color Palette ──────────────────────────────────────────────────────────

/** Core color tokens – light mode first, premium aesthetic */
export const Colors = {
  /** Primary background – pure white */
  background: '#FFFFFF',
  /** Elevated surface (cards, modals) */
  surface: '#FFFFFF',
  /** Surface hover/pressed state */
  surfaceHover: '#F9FAFB',
  /** Default border color */
  border: '#E5E7EB',
  /** Lighter border for subtle separators */
  borderLight: '#F3F4F6',

  /** Primary text – near-black */
  text: '#111827',
  /** Secondary text – muted for labels and descriptions */
  textSecondary: '#4B5563',
  /** Tertiary text – very muted for timestamps and hints */
  textTertiary: '#9CA3AF',

  /** Primary brand color – Blue */
  primary: '#2563EB',
  /** Lighter primary for hover states */
  primaryLight: '#3B82F6',
  /** Darker primary for pressed states */
  primaryDark: '#1D4ED8',

  /** Semantic colors */
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',

  /** Accent color – Violet */
  accent: '#8B5CF6',

  /** Transparent overlays */
  overlay: 'rgba(0, 0, 0, 0.6)',
  overlayLight: 'rgba(0, 0, 0, 0.3)',

  /** White with alpha for glass effects */
  whiteAlpha10: 'rgba(0, 0, 0, 0.05)',
  whiteAlpha5: 'rgba(0, 0, 0, 0.02)',
} as const;

/** Preset colors for inbox badges and identifiers */
export const InboxColors = [
  '#6366F1', // Indigo
  '#8B5CF6', // Violet
  '#EC4899', // Pink
  '#F43F5E', // Rose
  '#F59E0B', // Amber
  '#10B981', // Emerald
  '#06B6D4', // Cyan
  '#3B82F6', // Blue
] as const;

// ─── Spacing Scale ──────────────────────────────────────────────────────────

/** Consistent spacing scale (4px base) */
export const Spacing = {
  /** 4px – Tight spacing for inline elements */
  xs: 4,
  /** 8px – Default tight spacing */
  sm: 8,
  /** 12px – Between related elements */
  md: 12,
  /** 16px – Standard component padding */
  lg: 16,
  /** 20px – Comfortable padding */
  xl: 20,
  /** 24px – Section padding */
  '2xl': 24,
  /** 32px – Large section gaps */
  '3xl': 32,
  /** 40px – Extra large gaps */
  '4xl': 40,
  /** 48px – Page-level spacing */
  '5xl': 48,
  /** 64px – Hero spacing */
  '6xl': 64,
} as const;

// ─── Border Radius ──────────────────────────────────────────────────────────

/** Border radius tokens */
export const BorderRadius = {
  /** 6px – Subtle rounding for small elements */
  sm: 6,
  /** 10px – Default component rounding */
  md: 10,
  /** 14px – Card-level rounding */
  lg: 14,
  /** 20px – Large card / modal rounding */
  xl: 20,
  /** Full circle / pill shape */
  full: 9999,
} as const;

// ─── Typography ─────────────────────────────────────────────────────────────

/** Font family – uses system font (SF Pro on Apple devices) */
export const FontFamily = Platform.select({
  ios: 'System',
  android: 'Roboto',
  default: 'System',
}) as string;

/** Type scale – optimized for mobile readability */
export const FontSize = {
  /** 11px – Fine print, badges */
  xs: 11,
  /** 13px – Captions, timestamps */
  sm: 13,
  /** 15px – Body text */
  md: 15,
  /** 17px – Subtitles, nav items */
  lg: 17,
  /** 20px – Section headings */
  xl: 20,
  /** 24px – Page headings */
  xxl: 24,
  /** 32px – Hero / display text */
  hero: 32,
} as const;

/** Font weight tokens */
export const FontWeight = {
  regular: '400' as TextStyle['fontWeight'],
  medium: '500' as TextStyle['fontWeight'],
  semibold: '600' as TextStyle['fontWeight'],
  bold: '700' as TextStyle['fontWeight'],
};

// ─── Shadows ────────────────────────────────────────────────────────────────

/**
 * Shadow presets – iOS-compatible.
 * On Android, use `elevation` instead.
 */
export const Shadows = {
  /** Subtle shadow for cards at rest */
  subtle: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.15,
      shadowRadius: 3,
    },
    android: { elevation: 2 },
    default: {},
  }) as Record<string, unknown>,

  /** Medium shadow for hovered/active cards */
  medium: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
    },
    android: { elevation: 4 },
    default: {},
  }) as Record<string, unknown>,

  /** Strong shadow for modals and floating elements */
  strong: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
    },
    android: { elevation: 8 },
    default: {},
  }) as Record<string, unknown>,

  /** Glow effect for primary-colored elements */
  glow: Platform.select({
    ios: {
      shadowColor: '#6366F1',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
    },
    android: { elevation: 6 },
    default: {},
  }) as Record<string, unknown>,
} as const;

// ─── Status Colors ──────────────────────────────────────────────────────────

/** Maps email status to semantic color */
export const StatusColors: Record<string, string> = {
  open: Colors.primary,
  in_progress: Colors.warning,
  done: Colors.success,
} as const;

/** Human-readable status labels */
export const StatusLabels: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  done: 'Done',
} as const;

// ─── Layout ─────────────────────────────────────────────────────────────────

/** Layout constants for consistent structure */
export const Layout = {
  /** Sidebar width for tablet/iPad layouts */
  sidebarWidth: 280,
  /** Max content width for readability */
  maxContentWidth: 700,
  /** Header height */
  headerHeight: 56,
  /** Bottom tab bar height */
  tabBarHeight: 80,
} as const;

// ─── Animation ──────────────────────────────────────────────────────────────

/** Animation duration presets (ms) */
export const AnimationDuration = {
  fast: 150,
  normal: 250,
  slow: 400,
} as const;

/** Spring config presets for react-native-reanimated */
export const SpringConfig = {
  /** Snappy interactions (buttons, toggles) */
  snappy: { damping: 20, stiffness: 300, mass: 0.8 },
  /** Smooth transitions (page, modal) */
  smooth: { damping: 25, stiffness: 200, mass: 1 },
  /** Bouncy feedback (success, delight) */
  bouncy: { damping: 12, stiffness: 180, mass: 0.9 },
} as const;
