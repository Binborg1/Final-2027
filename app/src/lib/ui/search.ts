const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** True when every word of the query is in the label, in any order (case and accents ignored). */
export function matchesQuery(label: string, query: string): boolean {
  const text = fold(label);
  return fold(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => text.includes(word));
}
