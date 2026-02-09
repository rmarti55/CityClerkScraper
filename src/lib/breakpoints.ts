/**
 * Breakpoint and Device Detection Constants
 * 
 * This file centralizes all breakpoint values and media queries for consistent
 * mobile/desktop detection across the application.
 * 
 * DESIGN PHILOSOPHY:
 * We use a dual-layer approach:
 * 1. LAYOUT LAYER (screen width) - For structural layout changes
 *    - Use `sm:` Tailwind prefix or `useIsMobile()` hook
 *    - Example: stacked vs side-by-side layouts
 * 
 * 2. INTERACTION LAYER (device capabilities) - For touch-friendly UX
 *    - Use `pointer-coarse:` Tailwind prefix or `useIsTouch()` hook
 *    - Example: larger touch targets, avoiding hover-dependent UI
 * 
 * Keep these values in sync with CSS custom properties in globals.css
 */

/**
 * Screen width breakpoints (matches Tailwind defaults)
 * - sm: Mobile/Desktop layout boundary
 * - md: Tablet breakpoint
 * - lg: Large desktop breakpoint
 */
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

/**
 * Media query strings for JavaScript-based detection
 * Use these with window.matchMedia() or the hooks in useDeviceCapabilities.ts
 */
export const MEDIA_QUERIES = {
  // Screen size based (for layout decisions)
  mobile: `(max-width: ${BREAKPOINTS.sm - 1}px)`,
  tablet: `(min-width: ${BREAKPOINTS.sm}px) and (max-width: ${BREAKPOINTS.md - 1}px)`,
  desktop: `(min-width: ${BREAKPOINTS.md}px)`,
  
  // Capability based (for interaction decisions)
  /** Primary pointer is imprecise (touch/finger) */
  touch: '(pointer: coarse)',
  /** Primary pointer is precise (mouse/stylus) */
  precise: '(pointer: fine)',
  /** Device supports hover interactions */
  canHover: '(hover: hover)',
  /** Device does NOT support hover (touch-only) */
  cannotHover: '(hover: none)',
  /** Device has ANY touch input (includes hybrid devices like Surface) */
  hasAnyTouch: '(any-pointer: coarse)',
} as const;

/**
 * Minimum touch target size (in pixels)
 * Per WCAG 2.1 guidelines, interactive elements should be at least 44x44px
 * for touch accessibility.
 */
export const TOUCH_TARGET_MIN = 44;

/**
 * Device type detection matrix
 * Combines pointer and hover capabilities to identify device types:
 * 
 * | pointer  | hover | Device Type                    |
 * |----------|-------|--------------------------------|
 * | coarse   | none  | Smartphones, touchscreens      |
 * | fine     | none  | Stylus-based screens           |
 * | coarse   | hover | Smart TVs, game consoles       |
 * | fine     | hover | Desktop/laptop with mouse      |
 */
