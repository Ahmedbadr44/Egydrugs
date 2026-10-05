import { useEffect, useMemo, useState } from "react";
import { buildIndex, search, Medicine, SearchBy, SearchResult } from "./drugSearch";

/**
 * useDrugSearch(medicines, query, by)
 * - builds the phonetic index once per list
 * - debounces typing so the list doesn't recompute on every keystroke
 */
export function useDrugSearch<T extends Medicine>(
  medicines: T[],
  query: string,
  by: SearchBy,
  { debounceMs = 150, limit = 30 }: { debounceMs?: number; limit?: number } = {}
): SearchResult<T> {
  const index = useMemo(() => buildIndex(medicines), [medicines]);

  const [debounced, setDebounced] = useState(query);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), debounceMs);
    return () => clearTimeout(t);
  }, [query, debounceMs]);

  return useMemo(() => search(index, debounced, { by, limit }), [index, debounced, by, limit]);
}
