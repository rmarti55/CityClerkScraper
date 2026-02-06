interface SkeletonProps {
  className?: string;
}

/**
 * Base skeleton component with pulse animation.
 * Use className to set dimensions (h-4, w-full, etc.)
 */
export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-gray-200 rounded ${className}`}
      aria-hidden="true"
    />
  );
}

/**
 * Text-like skeleton with preset height
 */
export function SkeletonText({
  width = "w-full",
  height = "h-4",
}: {
  width?: string;
  height?: string;
}) {
  return <Skeleton className={`${height} ${width}`} />;
}

/**
 * Circular skeleton for avatars/icons
 */
export function SkeletonCircle({ size = "w-8 h-8" }: { size?: string }) {
  return <Skeleton className={`${size} rounded-full`} />;
}

/**
 * Badge-like skeleton with pill shape
 */
export function SkeletonBadge({
  width = "w-16",
}: {
  width?: string;
}) {
  return <Skeleton className={`h-5 ${width} rounded-full`} />;
}

/**
 * Rectangle skeleton for icons/images
 */
export function SkeletonRect({
  width = "w-8",
  height = "h-8",
}: {
  width?: string;
  height?: string;
}) {
  return <Skeleton className={`${width} ${height} rounded-lg`} />;
}
