export type Page<T> = { items: T[]; nextCursor: string | null };

export type BoundedPages<T> = {
  items: T[];
  pagesFetched: number;
  nextCursor: string | null;
  truncated: boolean;
};

export async function readBoundedPages<T>(
  readPage: (cursor: string | null) => Promise<Page<T>>,
  maxPages: number
): Promise<BoundedPages<T>> {
  if (!Number.isInteger(maxPages) || maxPages < 1) {
    throw new Error("maxPages must be a positive integer");
  }
  const items: T[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | null = null;
  let pagesFetched = 0;
  do {
    if (cursor && seenCursors.has(cursor)) {
      throw new Error("Todoist pagination cursor repeated");
    }
    if (cursor) seenCursors.add(cursor);
    const page = await readPage(cursor);
    if (!Array.isArray(page.items)) throw new Error("Todoist page items must be an array");
    items.push(...page.items);
    pagesFetched += 1;
    cursor = typeof page.nextCursor === "string" && page.nextCursor.length > 0 ? page.nextCursor : null;
  } while (cursor && pagesFetched < maxPages);
  return { items, pagesFetched, nextCursor: cursor, truncated: Boolean(cursor) };
}
