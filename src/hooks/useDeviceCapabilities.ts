"use client";

import { useState, useEffect, useCallback } from "react";
import { BREAKPOINTS, MEDIA_QUERIES } from "@/lib/breakpoints";

/**
 * Hook to create a reactive media query listener
 * @param query - Media query string
 * @param defaultValue - SSR-safe default value
 */
function useMediaQuery(query: string, defaultValue = false): boolean {
  const [matches, setMatches] = useState(defaultValue);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);

    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

/**
 * Detects if the viewport is mobile-sized (< 640px)
 * 
 * USE FOR: Layout decisions (stacked vs row, showing/hiding sections)
 * 
 * @example
 * const isMobile = useIsMobile();
 * // Render different component trees based on screen size
 * return isMobile ? <MobileModal /> : <DesktopDropdown />;
 */
export function useIsMobile(): boolean {
  return useMediaQuery(MEDIA_QUERIES.mobile, false);
}

/**
 * Detects if the primary pointer is imprecise (touch/finger)
 * 
 * USE FOR: Touch target sizing, gesture-based interactions
 * 
 * Note: This detects the PRIMARY pointer. A laptop with touchscreen
 * will return false if mouse is the primary input.
 * Use useHasAnyTouch() to detect hybrid devices.
 * 
 * @example
 * const isTouch = useIsTouch();
 * // Increase button padding for touch devices
 * <button className={isTouch ? "p-4" : "p-2"}>Click</button>
 */
export function useIsTouch(): boolean {
  return useMediaQuery(MEDIA_QUERIES.touch, false);
}

/**
 * Detects if the device supports hover interactions
 * 
 * USE FOR: Hover-dependent UI (tooltips, hover reveals, hover animations)
 * 
 * @example
 * const canHover = useCanHover();
 * // Only show hover-reveal content on devices that support it
 * {canHover && <HoverTooltip />}
 */
export function useCanHover(): boolean {
  return useMediaQuery(MEDIA_QUERIES.canHover, true);
}

/**
 * Detects if the device has ANY touch input capability
 * 
 * USE FOR: Hybrid device detection (Surface, touch laptops)
 * This returns true even if touch isn't the primary input.
 * 
 * @example
 * const hasTouch = useHasAnyTouch();
 * // Add touch-friendly affordances even on desktop with touchscreen
 */
export function useHasAnyTouch(): boolean {
  return useMediaQuery(MEDIA_QUERIES.hasAnyTouch, false);
}

/**
 * Combined device capabilities for complex conditional logic
 * 
 * @example
 * const { isMobile, isTouch, canHover } = useDeviceCapabilities();
 */
export function useDeviceCapabilities() {
  const isMobile = useIsMobile();
  const isTouch = useIsTouch();
  const canHover = useCanHover();
  const hasAnyTouch = useHasAnyTouch();

  return {
    // Screen size
    isMobile,
    isDesktop: !isMobile,
    
    // Input capabilities
    isTouch,
    isPrecise: !isTouch,
    canHover,
    cannotHover: !canHover,
    hasAnyTouch,
    
    // Common combinations
    /** Touch-only mobile device (typical smartphone) */
    isTouchMobile: isMobile && isTouch && !canHover,
    /** Desktop with mouse (typical computer) */
    isMouseDesktop: !isMobile && !isTouch && canHover,
    /** Hybrid device (Surface, touch laptop) */
    isHybrid: hasAnyTouch && canHover,
  };
}
