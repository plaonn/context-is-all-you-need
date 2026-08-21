import { PROJECT_CONTEXT_METADATA_VERSION } from "./model.js";

export type ProjectMetadata = {
  goal: string | null;
  workstreams: Array<{ id: string; label: string }>;
};

export type TaskMetadata = {
  workstreamId: string | null;
  summary: string | null;
  predecessorIds: string[];
  checkpoint: string | null;
};

export function hasProjectContextMetadata(description: string): boolean {
  return description.split(/\r?\n/).some((line) => /^Project context v1:\s*$/i.test(line.trim()));
}

export function parseProjectMetadata(description: string): ProjectMetadata {
  const block = metadataBlock(description);
  const goal = readField(block, "Project Goal");
  const workstreams: Array<{ id: string; label: string }> = [];
  const lines = block.split(/\r?\n/);
  const registryIndex = lines.findIndex((line) => /^Workstream registry:\s*$/i.test(line.trim()));
  if (registryIndex >= 0) {
    for (const line of lines.slice(registryIndex + 1)) {
      const match = /^\s*-\s*([a-z0-9][a-z0-9._-]{0,63})\s*\|\s*(.{1,120})\s*$/i.exec(line);
      if (!match) {
        if (line.trim() && !/^\s*-/.test(line)) break;
        continue;
      }
      const id = match[1]!;
      const label = match[2]!.trim();
      if (!workstreams.some((workstream) => workstream.id === id)) {
        workstreams.push({ id, label });
      }
    }
  }
  return { goal, workstreams };
}

export function parseTaskMetadata(description: string): TaskMetadata {
  const block = metadataBlock(description);
  return {
    workstreamId: normalizeWorkstreamId(readField(block, "Workstream")),
    summary: readField(block, "Summary"),
    predecessorIds: (readField(block, "Context Predecessors") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter((id, index, ids) => /^[A-Za-z0-9_-]{1,64}$/.test(id) && ids.indexOf(id) === index)
      .slice(0, 8),
    checkpoint: readField(block, "Checkpoint")
  };
}

export function readDescriptionField(description: string, field: string): string | null {
  return readField(metadataBlock(description), field);
}

function metadataBlock(description: string): string {
  const lines = description.split(/\r?\n/);
  const start = lines.findIndex((line) => /^Project context v(\d+):\s*$/i.test(line.trim()));
  if (start < 0) return "";
  const version = Number(/^Project context v(\d+):\s*$/i.exec(lines[start]!.trim())?.[1]);
  if (version !== PROJECT_CONTEXT_METADATA_VERSION) return "";
  const block: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^[A-Z][A-Za-z /-]{1,40}:\s*$/.test(line) && !/^Workstream registry:/i.test(line)) break;
    block.push(line);
  }
  return block.join("\n");
}

function readField(text: string, field: string): string | null {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`^${escaped}:\\s*(.{1,500})$`, "im").exec(text);
  return match?.[1]?.trim() || null;
}

function normalizeWorkstreamId(value: string | null): string | null {
  return value && /^[a-z0-9][a-z0-9._-]{0,63}$/i.test(value) ? value : null;
}
