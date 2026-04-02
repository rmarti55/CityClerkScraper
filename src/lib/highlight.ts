import type { ReactNode } from "react";
import { createElement } from "react";

/**
 * Highlights the first occurrence of `query` within `text` using a <mark> tag.
 * Returns the original text if no match is found or inputs are empty.
 */
export function highlightMatch(text: string, query: string): ReactNode {
  if (!text || !query) return text;

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);

  if (index === -1) return text;

  return createElement(
    "span",
    null,
    text.slice(0, index),
    createElement(
      "mark",
      { className: "bg-yellow-200 text-gray-900 rounded px-0.5" },
      text.slice(index, index + query.length),
    ),
    text.slice(index + query.length),
  );
}
