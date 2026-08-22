import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Context graph plane responsive surface", () => {
  it("defines one desktop graph plane and a narrow stacked transpose", () => {
    const css = readFileSync(new URL("../extension/styles.css", import.meta.url), "utf8");
    expect(css).toContain(".context-graph-plane");
    expect(css).toContain(".graph-plane-now-rule");
    expect(css).toContain(".graph-plane-now-rule { position: absolute; z-index: 1;");
    expect(css).toContain(".graph-lane-canvas");
    expect(css).toContain("grid-auto-flow: column");
    expect(css).toContain(".graph-edge-layer");
    expect(css).toContain(".graph-objective-region");
    expect(css).toContain("white-space: nowrap");
    expect(css).toContain("@media (max-width: 700px)");
    expect(css).toContain("grid-auto-flow: row");
    expect(css).toContain(".lineage-edge-branch");
    expect(css).toContain(".context-row { align-items: flex-start; flex-direction: column; }");
    expect(css).not.toContain(".project-columns");
    expect(css).not.toContain(".project-column");
    expect(css).not.toContain(".project-graph-band");
    expect(css).not.toContain("subgrid");
  });
});
