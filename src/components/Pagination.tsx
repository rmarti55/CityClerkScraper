"use client";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    const showPages = 5; // Max pages to show at once
    
    if (totalPages <= showPages + 2) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (currentPage > 3) {
        pages.push("ellipsis");
      }

      // Show pages around current
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push("ellipsis");
      }

      // Always show last page
      pages.push(totalPages);
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <nav className="flex items-center justify-center gap-1 sm:gap-2" aria-label="Pagination">
      {/* Previous button - larger touch target on touch devices */}
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-3 py-2 pointer-coarse:min-h-[44px] pointer-coarse:min-w-[44px] pointer-coarse:px-4 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md can-hover:hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        aria-label="Previous page"
      >
        <svg
          className="w-4 h-4 pointer-coarse:w-5 pointer-coarse:h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
      </button>

      {/* Page numbers - hide middle pages on mobile, show prev/current/next */}
      <div className="flex items-center gap-1">
        {pageNumbers.map((page, index) =>
          page === "ellipsis" ? (
            <span
              key={`ellipsis-${index}`}
              className="px-2 sm:px-3 py-2 text-sm text-gray-500 hidden sm:inline"
            >
              ...
            </span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              disabled={page === currentPage}
              className={`px-3 py-2 pointer-coarse:min-h-[44px] pointer-coarse:min-w-[44px] text-sm font-medium rounded-md transition-colors flex items-center justify-center ${
                page === currentPage
                  ? "bg-indigo-600 text-white"
                  : "text-gray-700 bg-white border border-gray-300 can-hover:hover:bg-gray-50"
              } ${
                // On mobile, only show first, last, current, and adjacent pages
                page !== 1 &&
                page !== totalPages &&
                page !== currentPage &&
                Math.abs(page - currentPage) > 1
                  ? "hidden sm:flex"
                  : ""
              }`}
              aria-label={`Page ${page}`}
              aria-current={page === currentPage ? "page" : undefined}
            >
              {page}
            </button>
          )
        )}
      </div>

      {/* Next button - larger touch target on touch devices */}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-3 py-2 pointer-coarse:min-h-[44px] pointer-coarse:min-w-[44px] pointer-coarse:px-4 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md can-hover:hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        aria-label="Next page"
      >
        <svg
          className="w-4 h-4 pointer-coarse:w-5 pointer-coarse:h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </button>
    </nav>
  );
}
