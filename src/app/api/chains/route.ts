import { NextRequest, NextResponse } from "next/server";
import {
  query,
  insert,
  withTransaction,
  Chain,
  resolveNodes,
  okResponse,
  listResponse,
  errorResponse,
} from "@/lib/db";
import { withOptionalAuth } from "@/lib/with-auth";

export const GET = withOptionalAuth("chains:read", async () => {
  const chains = await query<Chain>(
    "SELECT * FROM chains ORDER BY updated_at DESC",
  );

  const chainsWithNodes = await Promise.all(
    chains.map(async (chain) => ({
      ...chain,
      nodes: await resolveNodes(chain.id),
    })),
  );

  const res = listResponse(chainsWithNodes, chainsWithNodes.length);
  return NextResponse.json(res.body, { status: res.status });
});

interface NodeInput {
  title: string;
  instruction?: string;
  instruction_id?: number;
  credential_id?: number;
  node_type?: string;
  loop_back_to?: number;
  auto_advance?: boolean;
}

export const POST = withOptionalAuth(
  "chains:create",
  async (request: NextRequest) => {
    const body = await request.json();
    const {
      title,
      description,
      nodes,
      version,
      parent_chain_id,
      evaluation_contract,
    } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      const res = errorResponse("VALIDATION_ERROR", "title is required", 400);
      return NextResponse.json(res.body, { status: res.status });
    }

    const versionValue =
      typeof version === "string" && version.trim() ? version.trim() : "1.0";
    const parentChainIdValue =
      typeof parent_chain_id === "number" ? parent_chain_id : null;
    const evaluationContractValue =
      evaluation_contract === undefined || evaluation_contract === null
        ? null
        : typeof evaluation_contract === "string"
          ? evaluation_contract
          : JSON.stringify(evaluation_contract);

    const created = await withTransaction(async (client) => {
      const { rows: chainRows } = await client.query(
        "INSERT INTO chains (title, description, version, parent_chain_id, evaluation_contract) VALUES ($1, $2, $3, $4, $5) RETURNING id",
        [
          title.trim(),
          (description ?? "").trim(),
          versionValue,
          parentChainIdValue,
          evaluationContractValue,
        ],
      );
      const chainId = chainRows[0].id as number;

      if (Array.isArray(nodes)) {
        for (let i = 0; i < nodes.length; i++) {
          const node: NodeInput = nodes[i];
          await client.query(
            "INSERT INTO chain_nodes (chain_id, step_order, node_type, title, instruction, instruction_id, loop_back_to, auto_advance, credential_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
            [
              chainId,
              i + 1,
              (node.node_type ?? "action").trim(),
              (node.title ?? "").trim(),
              (node.instruction ?? "").trim(),
              node.instruction_id ?? null,
              node.loop_back_to ?? null,
              node.auto_advance ? 1 : 0,
              node.credential_id ?? null,
            ],
          );
        }
      }

      const { rows } = await client.query(
        "SELECT * FROM chains WHERE id = $1",
        [chainId],
      );
      const chain = rows[0] as Chain;
      return { ...chain, nodes: await resolveNodes(chainId) };
    });

    const res = okResponse(created, 201);
    return NextResponse.json(res.body, { status: res.status });
  },
);
