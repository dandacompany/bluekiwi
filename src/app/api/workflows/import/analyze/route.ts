import { NextRequest, NextResponse } from "next/server";
import { query, errorResponse, okResponse, type Credential } from "@/lib/db";
import { buildCredentialVisibilityFilter } from "@/lib/authorization";
import { withAuth } from "@/lib/with-auth";
import {
  buildCredentialCandidates,
  parseWorkflowPackage,
} from "@/lib/workflow-transfer";

export const POST = withAuth(
  "workflows:create",
  async (request: NextRequest, user) => {
    const body = await request.json();

    let pkg;
    try {
      pkg = parseWorkflowPackage(body?.package);
    } catch (error) {
      const res = errorResponse(
        "VALIDATION_ERROR",
        error instanceof Error
          ? error.message
          : "워크플로 JSON을 해석할 수 없습니다",
        400,
      );
      return NextResponse.json(res.body, { status: res.status });
    }

    const filter = await buildCredentialVisibilityFilter("c", user, 1);
    const credentials = await query<Credential>(
      `SELECT c.* FROM credentials c WHERE ${filter.sql} ORDER BY c.updated_at DESC`,
      filter.params,
    );

    const requirements = pkg.workflow.nodes
      .map((node, index) => {
        const requirement = node.credential_requirement;
        if (!requirement) return null;

        const candidates = buildCredentialCandidates(requirement, credentials);
        const exactMatches = candidates.filter(
          (candidate) => candidate.exact_match,
        );
        return {
          node_index: index,
          step_order: node.step_order,
          node_title: node.title,
          service_name: requirement.service_name,
          keys: requirement.keys,
          candidates,
          suggested_credential_id:
            exactMatches.length === 1 ? exactMatches[0].id : null,
        };
      })
      .filter(Boolean);

    const res = okResponse({
      summary: {
        title: pkg.workflow.title,
        version: pkg.workflow.version,
        node_count: pkg.workflow.nodes.length,
        credential_requirement_count: requirements.length,
      },
      requirements,
      requires_setup: requirements.length > 0,
    });
    return NextResponse.json(res.body, { status: res.status });
  },
);
