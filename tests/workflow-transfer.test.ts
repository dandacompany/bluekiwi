import { describe, expect, it } from "vitest";
import {
  buildCredentialCandidates,
  evaluateCredentialRequirement,
  parseWorkflowPackage,
} from "../src/lib/workflow-transfer";

describe("workflow transfer helpers", () => {
  it("parses a workflow package with embedded credential manifest", () => {
    const pkg = parseWorkflowPackage({
      format: "bluekiwi.workflow-package",
      version: 1,
      workflow: {
        title: "Imported workflow",
        description: "desc",
        version: "1.0",
        nodes: [
          {
            step_order: 1,
            node_type: "action",
            title: "Publish",
            instruction: "publish it",
            credential_requirement: {
              service_name: "Notion",
              keys: [
                { name: "api_key", required: true },
                { name: "database_id", required: true },
              ],
            },
          },
        ],
      },
    });

    expect(pkg.workflow.title).toBe("Imported workflow");
    expect(pkg.workflow.nodes[0]?.credential_requirement?.service_name).toBe(
      "Notion",
    );
  });

  it("marks requirement missing when no credential is bound", () => {
    const status = evaluateCredentialRequirement(
      {
        service_name: "Notion",
        keys: [
          { name: "api_key", required: true },
          { name: "database_id", required: true },
        ],
      },
      null,
    );

    expect(status?.status).toBe("missing");
    expect(status?.missing_keys).toEqual(["api_key", "database_id"]);
  });

  it("marks requirement incomplete when service or keys do not match", () => {
    const status = evaluateCredentialRequirement(
      {
        service_name: "Notion",
        keys: [
          { name: "api_key", required: true },
          { name: "database_id", required: true },
        ],
      },
      {
        service_name: "Slack",
        secrets: JSON.stringify({ api_key: "secret" }),
      },
    );

    expect(status?.status).toBe("incomplete");
    expect(status?.service_mismatch).toBe(true);
    expect(status?.missing_keys).toEqual(["database_id"]);
  });

  it("ranks exact credential matches first", () => {
    const candidates = buildCredentialCandidates(
      {
        service_name: "Notion",
        keys: [
          { name: "api_key", required: true },
          { name: "database_id", required: true },
        ],
      },
      [
        {
          id: 2,
          service_name: "Notion",
          secrets: JSON.stringify({ api_key: "a" }),
        },
        {
          id: 1,
          service_name: "Notion",
          secrets: JSON.stringify({ api_key: "a", database_id: "b" }),
        },
      ],
    );

    expect(candidates[0]?.id).toBe(1);
    expect(candidates[0]?.exact_match).toBe(true);
    expect(candidates[1]?.missing_keys).toEqual(["database_id"]);
  });
});
