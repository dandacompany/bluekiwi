import type { Credential } from "@/lib/db";

export const WORKFLOW_PACKAGE_FORMAT = "bluekiwi.workflow-package";
export const WORKFLOW_PACKAGE_VERSION = 1;

export interface CredentialRequirementKey {
  name: string;
  required: boolean;
}

export interface CredentialRequirement {
  service_name: string;
  description?: string;
  keys: CredentialRequirementKey[];
}

export interface WorkflowInstructionTemplate {
  title: string;
  content: string;
  agent_type?: string;
  tags?: string[];
  priority?: number;
}

export interface WorkflowTransferNode {
  step_order: number;
  node_type: "action" | "gate" | "loop";
  title: string;
  instruction: string;
  loop_back_to: number | null;
  auto_advance: boolean;
  hitl: boolean;
  visual_selection: boolean;
  instruction_template?: WorkflowInstructionTemplate | null;
  credential_requirement?: CredentialRequirement | null;
}

export interface WorkflowTransferPackage {
  format: typeof WORKFLOW_PACKAGE_FORMAT;
  version: typeof WORKFLOW_PACKAGE_VERSION;
  exported_at: string;
  workflow: {
    title: string;
    description: string;
    version: string;
    evaluation_contract: unknown | null;
    nodes: WorkflowTransferNode[];
  };
}

export interface CredentialBindingStatus {
  status: "ready" | "missing" | "incomplete";
  service_name: string;
  required_keys: string[];
  missing_keys: string[];
  service_mismatch: boolean;
}

export interface CredentialCandidate {
  id: number;
  service_name: string;
  matched_keys: string[];
  missing_keys: string[];
  exact_match: boolean;
}

function normalizeKeyName(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeRequiredKeys(input: unknown): CredentialRequirementKey[] {
  if (!Array.isArray(input)) return [];

  const seen = new Set<string>();
  const keys: CredentialRequirementKey[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const name = normalizeKeyName((item as { name?: unknown }).name);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    keys.push({
      name,
      required:
        (item as { required?: unknown }).required === undefined
          ? true
          : Boolean((item as { required?: unknown }).required),
    });
  }

  return keys;
}

export function extractCredentialRequirementFromSecrets(
  serviceName: string,
  secretsJson: string,
  description?: string | null,
): CredentialRequirement | null {
  try {
    const parsed = JSON.parse(secretsJson) as Record<string, unknown>;
    const keys = Object.keys(parsed)
      .map((name) => ({ name, required: true }))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (keys.length === 0) return null;

    return {
      service_name: serviceName,
      ...(description ? { description } : {}),
      keys,
    };
  } catch {
    return null;
  }
}

export function parseCredentialRequirement(
  value: unknown,
): CredentialRequirement | null {
  if (!value) return null;

  let raw: unknown = value;
  if (typeof value === "string") {
    try {
      raw = JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }

  if (!raw || typeof raw !== "object") return null;

  const serviceName = normalizeKeyName(
    (raw as { service_name?: unknown }).service_name,
  );
  const keys = normalizeRequiredKeys((raw as { keys?: unknown }).keys);
  if (!serviceName || keys.length === 0) return null;

  const description = normalizeKeyName(
    (raw as { description?: unknown }).description,
  );

  return {
    service_name: serviceName,
    ...(description ? { description } : {}),
    keys,
  };
}

export function requiredCredentialKeyNames(
  requirement: CredentialRequirement | null | undefined,
): string[] {
  if (!requirement) return [];
  return requirement.keys
    .filter((key) => key.required)
    .map((key) => key.name)
    .sort((a, b) => a.localeCompare(b));
}

function parseCredentialSecrets(
  secretsJson: string,
): Record<string, string | undefined> {
  try {
    return JSON.parse(secretsJson) as Record<string, string | undefined>;
  } catch {
    return {};
  }
}

export function evaluateCredentialRequirement(
  requirement: CredentialRequirement | null | undefined,
  credential: Pick<Credential, "service_name" | "secrets"> | null | undefined,
): CredentialBindingStatus | null {
  if (!requirement) return null;

  const requiredKeys = requiredCredentialKeyNames(requirement);
  if (!credential) {
    return {
      status: "missing",
      service_name: requirement.service_name,
      required_keys: requiredKeys,
      missing_keys: requiredKeys,
      service_mismatch: false,
    };
  }

  const serviceMismatch =
    credential.service_name.trim().toLowerCase() !==
    requirement.service_name.trim().toLowerCase();
  const parsedSecrets = parseCredentialSecrets(credential.secrets);
  const missingKeys = requiredKeys.filter((key) => {
    const value = parsedSecrets[key];
    return typeof value !== "string" || !value.trim();
  });

  return {
    status:
      !serviceMismatch && missingKeys.length === 0 ? "ready" : "incomplete",
    service_name: requirement.service_name,
    required_keys: requiredKeys,
    missing_keys: missingKeys,
    service_mismatch: serviceMismatch,
  };
}

export function buildCredentialCandidates(
  requirement: CredentialRequirement,
  credentials: Array<Pick<Credential, "id" | "service_name" | "secrets">>,
): CredentialCandidate[] {
  const requiredKeys = requiredCredentialKeyNames(requirement);

  return credentials
    .map((credential) => {
      const parsedSecrets = parseCredentialSecrets(credential.secrets);
      const presentKeys = new Set(
        Object.keys(parsedSecrets)
          .filter((key) => typeof parsedSecrets[key] === "string")
          .map((key) => key.toLowerCase()),
      );
      const matchedKeys = requiredKeys.filter((key) =>
        presentKeys.has(key.toLowerCase()),
      );
      const missingKeys = requiredKeys.filter(
        (key) => !presentKeys.has(key.toLowerCase()),
      );
      const sameService =
        credential.service_name.trim().toLowerCase() ===
        requirement.service_name.trim().toLowerCase();

      return {
        id: credential.id,
        service_name: credential.service_name,
        matched_keys: matchedKeys,
        missing_keys: missingKeys,
        exact_match: sameService && missingKeys.length === 0,
      };
    })
    .filter(
      (candidate) =>
        candidate.service_name.trim().toLowerCase() ===
          requirement.service_name.trim().toLowerCase() ||
        candidate.matched_keys.length > 0,
    )
    .sort((a, b) => {
      if (a.exact_match !== b.exact_match) return a.exact_match ? -1 : 1;
      if (a.missing_keys.length !== b.missing_keys.length) {
        return a.missing_keys.length - b.missing_keys.length;
      }
      return a.service_name.localeCompare(b.service_name);
    });
}

export function parseWorkflowPackage(value: unknown): WorkflowTransferPackage {
  if (!value || typeof value !== "object") {
    throw new Error("워크플로 JSON 형식이 올바르지 않습니다");
  }

  const raw = value as {
    format?: unknown;
    version?: unknown;
    exported_at?: unknown;
    workflow?: unknown;
  };

  if (raw.format !== WORKFLOW_PACKAGE_FORMAT) {
    throw new Error("지원하지 않는 워크플로 패키지 형식입니다");
  }

  if (Number(raw.version) !== WORKFLOW_PACKAGE_VERSION) {
    throw new Error("지원하지 않는 워크플로 패키지 버전입니다");
  }

  if (!raw.workflow || typeof raw.workflow !== "object") {
    throw new Error("워크플로 본문이 없습니다");
  }

  const workflow = raw.workflow as {
    title?: unknown;
    description?: unknown;
    version?: unknown;
    evaluation_contract?: unknown;
    nodes?: unknown;
  };

  const title = normalizeKeyName(workflow.title);
  if (!title) {
    throw new Error("워크플로 제목이 비어 있습니다");
  }

  if (!Array.isArray(workflow.nodes) || workflow.nodes.length === 0) {
    throw new Error("가져올 노드가 없습니다");
  }

  const nodes = workflow.nodes.map((node, index) => {
    if (!node || typeof node !== "object") {
      throw new Error(`노드 ${index + 1} 형식이 올바르지 않습니다`);
    }
    const rawNode = node as Record<string, unknown>;
    const nodeType = rawNode.node_type;
    if (nodeType !== "action" && nodeType !== "gate" && nodeType !== "loop") {
      throw new Error(`노드 ${index + 1} 타입이 올바르지 않습니다`);
    }

    const nodeTitle = normalizeKeyName(rawNode.title);
    if (!nodeTitle) {
      throw new Error(`노드 ${index + 1} 제목이 비어 있습니다`);
    }

    const instruction =
      typeof rawNode.instruction === "string" ? rawNode.instruction : "";

    let instructionTemplate: WorkflowInstructionTemplate | null = null;
    const rawTemplate = rawNode.instruction_template;
    if (rawTemplate && typeof rawTemplate === "object") {
      const template = rawTemplate as Record<string, unknown>;
      const templateTitle = normalizeKeyName(template.title);
      const content =
        typeof template.content === "string" ? template.content : "";
      if (templateTitle && content.trim()) {
        instructionTemplate = {
          title: templateTitle,
          content,
          ...(normalizeKeyName(template.agent_type)
            ? { agent_type: normalizeKeyName(template.agent_type) }
            : {}),
          ...(Array.isArray(template.tags)
            ? {
                tags: template.tags
                  .filter((tag): tag is string => typeof tag === "string")
                  .map((tag) => tag.trim())
                  .filter(Boolean),
              }
            : {}),
          ...(typeof template.priority === "number"
            ? { priority: template.priority }
            : {}),
        };
      }
    }

    const requirement = parseCredentialRequirement(
      rawNode.credential_requirement,
    );

    return {
      step_order: index + 1,
      node_type: nodeType,
      title: nodeTitle,
      instruction,
      loop_back_to:
        typeof rawNode.loop_back_to === "number" ? rawNode.loop_back_to : null,
      auto_advance:
        rawNode.auto_advance === undefined
          ? nodeType === "action"
          : Boolean(rawNode.auto_advance),
      hitl: Boolean(rawNode.hitl),
      visual_selection: Boolean(rawNode.visual_selection),
      instruction_template: instructionTemplate,
      credential_requirement: requirement,
    } satisfies WorkflowTransferNode;
  });

  return {
    format: WORKFLOW_PACKAGE_FORMAT,
    version: WORKFLOW_PACKAGE_VERSION,
    exported_at:
      typeof raw.exported_at === "string"
        ? raw.exported_at
        : new Date().toISOString(),
    workflow: {
      title,
      description:
        typeof workflow.description === "string" ? workflow.description : "",
      version: normalizeKeyName(workflow.version) || "1.0",
      evaluation_contract:
        workflow.evaluation_contract === undefined
          ? null
          : workflow.evaluation_contract,
      nodes,
    },
  };
}
