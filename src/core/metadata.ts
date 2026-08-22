import { PROJECT_CONTEXT_METADATA_VERSION } from "./model.js";

export type ProjectMetadata = {
  goal: string | null;
  workstreams: Array<{ id: string; label: string }>;
  objectives: Array<{ id: string; label: string }>;
};

export type TaskMetadata = {
  workstreamId: string | null;
  objectiveId: string | null;
  summary: string | null;
  predecessorIds: string[];
  checkpoint: string | null;
};

/**
 * Optional bounded fields from the existing exception/decision packet shape.
 * Missing or unrecognised values intentionally remain null; the viewer never
 * infers an owner or an authority from lifecycle labels or task titles.
 */
export type TaskAttentionMetadata = {
  blockedOn: string | null;
  whyWorkerCannotDecide: string | null;
  decisionOwner: string | null;
  recommendation: string | null;
  alternatives: string | null;
  safeState: string | null;
  independentWork: string | null;
  resumeCondition: string | null;
  evidence: string | null;
  disposition: string | null;
};

export function hasProjectContextMetadata(description: string): boolean {
  return description.split(/\r?\n/).some((line) => /^Project context v1:\s*$/i.test(line.trim()));
}

export function parseProjectMetadata(description: string): ProjectMetadata {
  const block = metadataBlock(description);
  const goal = readField(block, "Project Goal");
  return {
    goal,
    workstreams: readRegistry(block, "Workstream registry"),
    objectives: readRegistry(block, "Objective registry")
  };
}

export function parseTaskMetadata(description: string): TaskMetadata {
  const block = metadataBlock(description);
  return {
    workstreamId: normalizeWorkstreamId(readField(block, "Workstream")),
    objectiveId: normalizeObjectiveId(readField(block, "Objective")),
    summary: readField(block, "Summary"),
    predecessorIds: (readField(block, "Context Predecessors") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter((id, index, ids) => /^[A-Za-z0-9_-]{1,64}$/.test(id) && ids.indexOf(id) === index)
      .slice(0, 8),
    checkpoint: readField(block, "Checkpoint")
  };
}

export function parseTaskAttentionMetadata(description: string): TaskAttentionMetadata {
  return {
    blockedOn: boundedFirstField(description, ["Blocked on", "Blocker"]),
    whyWorkerCannotDecide: boundedFirstField(description, ["Why worker cannot decide"]),
    decisionOwner: boundedFirstField(description, ["Decision owner"]),
    recommendation: boundedFirstField(description, ["Recommended safe/default path", "Recommendation"]),
    alternatives: boundedFirstField(description, ["Alternatives"]),
    safeState: boundedFirstField(description, ["Safe state preserved"]),
    independentWork: boundedFirstField(description, ["Independent work completed"]),
    resumeCondition: boundedFirstField(description, ["Resume condition"]),
    evidence: boundedFirstField(description, ["Evidence/provenance", "Evidence", "Provenance"]),
    disposition: boundedFirstState(description, ["Attention state", "Exception state", "Disposition", "Resolution"])
  };
}

export function readDescriptionField(description: string, field: string): string | null {
  return readField(metadataBlock(description), field);
}

function boundedFirstField(description: string, fields: string[]): string | null {
  for (const field of fields) {
    const value = readDescriptionField(description, field);
    if (value) return value.slice(0, 240);
  }
  return null;
}

function boundedFirstState(description: string, fields: string[]): string | null {
  return boundedFirstField(description, fields)?.toLowerCase() ?? null;
}

function metadataBlock(description: string): string {
  const lines = description.split(/\r?\n/);
  const start = lines.findIndex((line) => /^Project context v(\d+):\s*$/i.test(line.trim()));
  if (start < 0) return "";
  const version = Number(/^Project context v(\d+):\s*$/i.exec(lines[start]!.trim())?.[1]);
  if (version !== PROJECT_CONTEXT_METADATA_VERSION) return "";
  const block: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (isSectionHeader(line) && !/^(?:Workstream|Objective) registry:/i.test(line.trim())) break;
    block.push(line);
  }
  return block.join("\n");
}

function readRegistry(block: string, field: string): Array<{ id: string; label: string }> {
  const lines = block.split(/\r?\n/);
  const registryIndex = lines.findIndex((line) => new RegExp(`^${field}:\\s*$`, "i").test(line.trim()));
  if (registryIndex < 0) return [];
  const values: Array<{ id: string; label: string }> = [];
  for (const line of lines.slice(registryIndex + 1)) {
    if (isSectionHeader(line)) break;
    const match = /^\s*-\s*([a-z0-9][a-z0-9._-]{0,63})\s*\|\s*(.{1,120})\s*$/i.exec(line);
    if (!match) continue;
    const id = match[1]!;
    const label = match[2]!.trim();
    if (!values.some((value) => value.id === id)) values.push({ id, label });
  }
  return values;
}

function isSectionHeader(line: string): boolean {
  return /^[A-Z][A-Za-z /-]{1,40}:\s*$/.test(line.trim());
}

function readField(text: string, field: string): string | null {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`^${escaped}:\\s*(.{1,500})$`, "im").exec(text);
  return match?.[1]?.trim() || null;
}

function normalizeWorkstreamId(value: string | null): string | null {
  return value && /^[a-z0-9][a-z0-9._-]{0,63}$/i.test(value) ? value : null;
}

function normalizeObjectiveId(value: string | null): string | null {
  return value && /^[a-z0-9][a-z0-9._-]{0,63}$/i.test(value) ? value : null;
}
