import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Context board responsive surface", () => {
  it("defines desktop project columns and narrow stacked matrix layout", () => {
    const css = readFileSync(new URL("../extension/styles.css", import.meta.url), "utf8");
    expect(css).toContain(".project-columns");
    expect(css).toContain("grid-auto-flow: column");
    expect(css).toContain(".project-band-now");
    expect(css).toContain("subgrid");
    expect(css).toContain("@media (max-width: 700px)");
    expect(css).toContain("grid-auto-flow: row");
    expect(css).toContain(".lineage-edge-branch");
    expect(css).toContain(".context-row { align-items: flex-start; flex-direction: column; }");
  });
});
