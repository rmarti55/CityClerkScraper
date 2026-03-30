/**
 * Parse a user search query into a Postgres tsquery string.
 *
 * Supports Google-style syntax:
 *   "exact phrase"  → phraseto_tsquery('english', 'exact phrase')
 *   -word           → !! to_tsquery('english', 'word')
 *   word1 OR word2  → to_tsquery('english', 'word1') | to_tsquery('english', 'word2')
 *   word1 word2     → to_tsquery('english', 'word1') & to_tsquery('english', 'word2')
 *
 * Returns a raw SQL fragment suitable for use in a WHERE clause with @@.
 * Also returns a plainto_tsquery fallback for ts_rank (which needs a single tsquery value).
 */

interface ParsedQuery {
  /** SQL expression that evaluates to a tsquery, e.g. "(phraseto_tsquery('english','age friendly') & ...)" */
  tsqueryExpr: string;
  /** Whether the parsed query has any meaningful search terms */
  hasTerms: boolean;
  /** The original cleaned terms for highlighting / display */
  displayTerms: string[];
}

function escapeForTsquery(word: string): string {
  return word.replace(/[^a-zA-Z0-9\s-]/g, '').trim();
}

function escapeSqlString(s: string): string {
  return s.replace(/'/g, "''");
}

export function parseSearchQuery(raw: string): ParsedQuery {
  const input = raw.trim();
  if (!input) {
    return { tsqueryExpr: '', hasTerms: false, displayTerms: [] };
  }

  const parts: string[] = [];
  const displayTerms: string[] = [];
  let remaining = input;

  // 1. Extract quoted phrases
  const phraseRegex = /"([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = phraseRegex.exec(input)) !== null) {
    const phrase = escapeForTsquery(match[1]);
    if (phrase) {
      parts.push(`phraseto_tsquery('english', '${escapeSqlString(phrase)}')`);
      displayTerms.push(match[1]);
    }
  }
  remaining = remaining.replace(phraseRegex, ' ');

  // 2. Extract negated terms (-word)
  const negatedTerms: string[] = [];
  const negateRegex = /(?:^|\s)-(\w+)/g;
  while ((match = negateRegex.exec(remaining)) !== null) {
    const word = escapeForTsquery(match[1]);
    if (word) {
      negatedTerms.push(`!! to_tsquery('english', '${escapeSqlString(word)}')`);
    }
  }
  remaining = remaining.replace(negateRegex, ' ');

  // 3. Split remaining on OR (case-sensitive) and plain words
  const tokens = remaining.split(/\s+/).filter(Boolean);
  const orGroups: string[][] = [[]];

  for (const token of tokens) {
    if (token === 'OR') {
      orGroups.push([]);
    } else {
      const cleaned = escapeForTsquery(token);
      if (cleaned) {
        orGroups[orGroups.length - 1].push(cleaned);
        displayTerms.push(cleaned);
      }
    }
  }

  // Build OR groups: words within a group are ANDed, groups are ORed
  const orParts: string[] = [];
  for (const group of orGroups) {
    if (group.length === 0) continue;
    if (group.length === 1) {
      orParts.push(`to_tsquery('english', '${escapeSqlString(group[0])}')`);
    } else {
      const andExpr = group
        .map(w => escapeSqlString(w))
        .join(' & ');
      orParts.push(`to_tsquery('english', '${andExpr}')`);
    }
  }

  if (orParts.length === 1) {
    parts.push(orParts[0]);
  } else if (orParts.length > 1) {
    parts.push(`(${orParts.join(' || ')})`);
  }

  // Combine: AND all phrase/word parts together, then AND with negations
  const allParts = [...parts, ...negatedTerms];
  if (allParts.length === 0) {
    return { tsqueryExpr: '', hasTerms: false, displayTerms: [] };
  }

  const tsqueryExpr = allParts.length === 1
    ? allParts[0]
    : `(${allParts.join(' && ')})`;

  return { tsqueryExpr, hasTerms: true, displayTerms };
}

/**
 * Build a simple plainto_tsquery for ts_rank scoring.
 * Strips special syntax and just uses all meaningful words.
 */
export function buildRankQuery(raw: string): string {
  const cleaned = raw
    .replace(/"([^"]+)"/g, '$1')
    .replace(/(?:^|\s)-\w+/g, ' ')
    .replace(/\bOR\b/g, ' ')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim();

  if (!cleaned) return "plainto_tsquery('english', '')";
  return `plainto_tsquery('english', '${escapeSqlString(cleaned)}')`;
}
