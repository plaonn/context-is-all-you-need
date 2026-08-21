import { describe, expect, it } from "vitest";
import { readBoundedPages } from "../src/core/pagination.js";

describe("bounded cursor pagination", () => {
  it("follows cursors up to the configured page cap and reports truncation", async () => {
    const cursors: Array<string | null> = [];
    const result = await readBoundedPages(async (cursor) => {
      cursors.push(cursor);
      if (cursor === null) return { items: [1], nextCursor: "cursor-1" };
      if (cursor === "cursor-1") return { items: [2], nextCursor: "cursor-2" };
      return { items: [3], nextCursor: "cursor-3" };
    }, 2);
    expect(result).toEqual({ items: [1, 2], pagesFetched: 2, nextCursor: "cursor-2", truncated: true });
    expect(cursors).toEqual([null, "cursor-1"]);
  });

  it("does not over-fetch a terminal page", async () => {
    let reads = 0;
    await expect(readBoundedPages(async () => {
      reads += 1;
      return { items: ["done"], nextCursor: null };
    }, 4)).resolves.toMatchObject({ pagesFetched: 1, truncated: false });
    expect(reads).toBe(1);
  });

  it("rejects repeated cursors instead of looping", async () => {
    await expect(readBoundedPages(async (cursor) => ({ items: [cursor], nextCursor: "same" }), 4)).rejects.toThrow("cursor repeated");
  });
});
