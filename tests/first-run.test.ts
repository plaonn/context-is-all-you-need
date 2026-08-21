import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("first-run setup", () => {
  it("asks for a local Context boundary and an explicit Todoist connection", () => {
    const html = readFileSync(new URL("../extension/index.html", import.meta.url), "utf8");
    expect(html).toContain('id="context-label"');
    expect(html).toContain('id="section-id"');
    expect(html).toContain("Connect Todoist");
    expect(html).not.toContain("client-id");
    expect(html).not.toContain("metadata URL");
    expect(html).not.toContain("client.json");
  });
});
