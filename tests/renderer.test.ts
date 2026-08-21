import { describe, expect, it } from "vitest";
import { buildProjectContextSnapshot } from "../src/core/projection.js";
import { renderSnapshot } from "../src/core/renderer.js";
import { fixtureSource } from "./fixtures.js";

describe("line-and-box UI projection", () => {
  it("escapes source text and keeps canonical links plus presentation-only lineage", () => {
    const source = fixtureSource();
    source.root.content = "<private title>";
    const html = renderSnapshot(buildProjectContextSnapshot(source));
    expect(html).toContain("&lt;private title&gt;");
    expect(html).not.toContain("<private title>");
    expect(html).toContain("https://app.todoist.com/app/task/now");
    expect(html).toContain("Context predecessors");
    expect(html).not.toContain("create");
    expect(html).not.toContain("complete");
  });
});
