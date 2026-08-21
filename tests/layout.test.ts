import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Context board responsive surface", () => {
  it("defines desktop project grid and narrow stacked workstream layout", () => {
    const css = readFileSync(new URL("../extension/styles.css", import.meta.url), "utf8");
    expect(css).toContain(".project-grid");
    expect(css).toContain(".map-connector");
    expect(css).toContain("@media (max-width: 700px)");
    expect(css).toContain(".workstream-track { display: grid");
    expect(css).toContain(".context-row { align-items: flex-start; flex-direction: column; }");
  });
});
