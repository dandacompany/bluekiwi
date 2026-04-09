import { NextRequest, NextResponse } from "next/server";
import {
  queryOne,
  execute,
  withTransaction,
  Chain,
  resolveNodes,
  okResponse,
  errorResponse,
} from "@/lib/db";
import { withOptionalAuth } from "@/lib/with-auth";

type Params = { params: Promise<{ id: string }> };

interface NodeInput {
  title: string;
  instruction?: string;
  instruction_id?: number;
  credential_id?: number;
  node_type?: string;
  loop_back_to?: number;
  auto_advance?: boolean;
}

function jsonbParam(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function incrementChainVersion(version: string): string {
  const trimmed = version.trim();
  if (!trimmed) return "1.0";

  const match = trimmed.match(/^(\d+(?:\.\d+)*)(.*)$/);
  if (!match) return "1.0";

  const numericPrefix = match[1];
  const suffix = match[2];

  const parts = numericPrefix.split(".");
  const last = Number.parseInt(parts[parts.length - 1] ?? "0", 10);
  if (Number.isNaN(last)) return "1.0";
  parts[parts.length - 1] = String(last + 1);

  return parts.join(".") + suffix;
}

export const GET = withOptionalAuth<Params>(
  "chains:read",
  async (_request, _user, { params }: Params) => {
    const { id } = await params;

    const chain = await queryOne<Chain>("SELECT * FROM chains WHERE id = $1", [
      Number(id),
    ]);
    if (!chain) {
      const res = errorResponse("NOT_FOUND", "체인을 찾을 수 없습니다", 404);
      return NextResponse.json(res.body, { status: res.status });
    }

    const res = okResponse({ ...chain, nodes: await resolveNodes(chain.id) });
    return NextResponse.json(res.body, { status: res.status });
  },
);

export const PUT = withOptionalAuth<Params>(
  "chains:update",
  async (request: NextRequest, _user, { params }: Params) => {
    const { id } = await params;
    const body = await request.json();
    const {
      title,
      description,
      nodes,
      version,
      evaluation_contract,
      create_new_version,
    } = body;
    const chainId = Number(id);

    const existing = await queryOne<Chain>(
      "SELECT * FROM chains WHERE id = $1",
      [chainId],
    );
    if (!existing) {
      const res = errorResponse("NOT_FOUND", "체인을 찾을 수 없습니다", 404);
      return NextResponse.json(res.body, { status: res.status });
    }

    const updated = await withTransaction(async (client) => {
      const shouldCreateNewVersion =
        Array.isArray(nodes) && create_new_version === true;

      if (shouldCreateNewVersion) {
        const newVersion = incrementChainVersion(existing.version);
        const evaluationContractValue =
          evaluation_contract === undefined
            ? jsonbParam(existing.evaluation_contract)
            : jsonbParam(evaluation_contract);

        const { rows: chainRows } = await client.query(
          "INSERT INTO chains (title, description, version, parent_chain_id, evaluation_contract) VALUES ($1, $2, $3, $4, $5) RETURNING id",
          [
            (title ?? existing.title).trim(),
            (description ?? existing.description).trim(),
            newVersion,
            chainId,
            evaluationContractValue,
          ],
        );
        const newChainId = chainRows[0].id as number;

        for (let i = 0; i < nodes.length; i++) {
          const node: NodeInput = nodes[i];
          await client.query(
            "INSERT INTO chain_nodes (chain_id, step_order, node_type, title, instruction, instruction_id, loop_back_to, auto_advance, credential_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
            [
              newChainId,
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

        const { rows } = await client.query(
          "SELECT * FROM chains WHERE id = $1",
          [newChainId],
        );
        const chain = rows[0] as Chain;
        return { ...chain, nodes: await resolveNodes(newChainId) };
      }

      const versionValue =
        typeof version === "string" && version.trim()
          ? version.trim()
          : undefined;
      const evaluationContractValue =
        evaluation_contract === undefined
          ? jsonbParam(existing.evaluation_contract)
          : jsonbParam(evaluation_contract);

      await client.query(
        "UPDATE chains SET title = $1, description = $2, version = $3, evaluation_contract = $4, updated_at = NOW() WHERE id = $5",
        [
          (title ?? existing.title).trim(),
          (description ?? existing.description).trim(),
          versionValue ?? existing.version,
          evaluationContractValue,
          chainId,
        ],
      );

      if (Array.isArray(nodes)) {
        await client.query("DELETE FROM chain_nodes WHERE chain_id = $1", [
          chainId,
        ]);
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

    const res = okResponse(updated);
    return NextResponse.json(res.body, { status: res.status });
  },
);

export const DELETE = withOptionalAuth<Params>(
  "chains:delete",
  async (_request, _user, { params }: Params) => {
    const { id } = await params;
    const result = await execute("DELETE FROM chains WHERE id = $1", [
      Number(id),
    ]);

    if (result.rowCount === 0) {
      const res = errorResponse("NOT_FOUND", "체인을 찾을 수 없습니다", 404);
      return NextResponse.json(res.body, { status: res.status });
    }

    const res = okResponse({ id: Number(id), deleted: true });
    return NextResponse.json(res.body, { status: res.status });
  },
);
