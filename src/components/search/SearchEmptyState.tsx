import { SearchIcon, WarningIcon } from "@/components/icons";

interface SearchEmptyStateProps {
  variant: "no-results" | "error";
  filterDescription?: string;
  message?: string;
  hint?: string;
  children?: React.ReactNode;
}

/**
 * Shared empty/error state for search result containers.
 *
 * `variant="no-results"` shows the magnifying glass with "No results" messaging.
 * `variant="error"` shows the warning triangle with the error text.
 *
 * Pass `children` for extra actions like a "Clear filter" button.
 */
export function SearchEmptyState({
  variant,
  filterDescription,
  message,
  hint,
  children,
}: SearchEmptyStateProps) {
  if (variant === "error") {
    return (
      <div className="text-center py-12">
        <WarningIcon className="w-12 h-12 text-red-300 mx-auto mb-4" />
        <p className="text-gray-600">{message ?? "Something went wrong"}</p>
        <p className="text-sm text-gray-500 mt-1">{hint ?? "Please try again"}</p>
        {children}
      </div>
    );
  }

  return (
    <div className="text-center py-12">
      <SearchIcon className="w-12 h-12 text-gray-900 mx-auto mb-4" />
      <p className="text-gray-600">
        {message ?? (filterDescription ? `No meetings found for ${filterDescription}` : "No results found")}
      </p>
      <p className="text-sm text-gray-500 mt-1">
        {hint ?? "Try different keywords or check spelling"}
      </p>
      {children}
    </div>
  );
}
