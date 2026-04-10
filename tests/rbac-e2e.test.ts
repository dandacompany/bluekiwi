import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { query, queryOne } from "../src/lib/db";
import { generateApiKey } from "../src/lib/auth";

interface UserFixture {
  id: number;
  apiKey: string;
}

let userA: UserFixture;
let userB: UserFixture;
let admin: UserFixture;
let folderId: number;
let workflowId: number;
let credentialId: number;
let groupId: number;

const BASE = process.env.BLUEKIWI_BASE_URL ?? "http://localhost:3100";

async function createUserWithKey(
  username: string,
  role: "editor" | "admin",
): Promise<UserFixture> {
  const u = await queryOne<{ id: number }>(
    `INSERT INTO users (username, email, password_hash, role)
     VALUES ($1, $1 || '@t.local', 'x', $2)
     ON CONFLICT (username) DO UPDATE SET role = EXCLUDED.role RETURNING id`,
    [username, role],
  );
  const { rawKey, prefix, keyHash } = generateApiKey();
  await query(
    "INSERT INTO api_keys (user_id, key_hash, prefix, name) VALUES ($1, $2, $3, $4)",
    [u!.id, keyHash, prefix, "e2e"],
  );
  return { id: u!.id, apiKey: rawKey };
}

async function api(
  path: string,
  method: string,
  apiKey: string,
  body?: unknown,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { raw: text };
  }
  return { status: res.status, body: parsed };
}

beforeAll(async () => {
  userA = await createUserWithKey("e2e_userA", "editor");
  userB = await createUserWithKey("e2e_userB", "editor");
  admin = await createUserWithKey("e2e_admin", "admin");

  // Ensure each editor has a My Workspace (migration only covered users present at migration time)
  for (const u of [userA, userB]) {
    await query(
      `INSERT INTO folders (name, owner_id, parent_id, visibility, is_system)
       SELECT 'My Workspace', $1, NULL, 'personal', true
       WHERE NOT EXISTS (
         SELECT 1 FROM folders
         WHERE owner_id = $1 AND is_system = true AND name = 'My Workspace'
       )`,
      [u.id],
    );
  }

  const grp = await queryOne<{ id: number }>(
    `INSERT INTO user_groups (name) VALUES ('e2e_marketing')
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
  );
  groupId = grp!.id;
});

afterAll(async () => {
  await query("DELETE FROM credentials WHERE owner_id = ANY($1::int[])", [
    [userA.id, userB.id],
  ]);
  // Null out FK references then delete workflows
  await query("DELETE FROM workflows WHERE owner_id = ANY($1::int[])", [
    [userA.id, userB.id],
  ]);
  await query(
    "DELETE FROM folder_shares WHERE folder_id IN (SELECT id FROM folders WHERE owner_id = ANY($1::int[]))",
    [[userA.id, userB.id]],
  );
  await query("DELETE FROM folders WHERE owner_id = ANY($1::int[])", [
    [userA.id, userB.id],
  ]);
  await query("DELETE FROM user_group_members WHERE group_id = $1", [groupId]);
  await query("DELETE FROM user_groups WHERE name = 'e2e_marketing'");
  await query("DELETE FROM api_keys WHERE user_id = ANY($1::int[])", [
    [userA.id, userB.id, admin.id],
  ]);
  await query("DELETE FROM users WHERE id = ANY($1::int[])", [
    [userA.id, userB.id, admin.id],
  ]);
});

describe("RBAC E2E — 2 user timeline", () => {
  it("1. userA creates workflow in own My Workspace", async () => {
    const mw = await queryOne<{ id: number }>(
      "SELECT id FROM folders WHERE owner_id = $1 AND is_system = true LIMIT 1",
      [userA.id],
    );
    folderId = mw!.id;
    const r = await api("/api/workflows", "POST", userA.apiKey, {
      title: "e2e wf",
      description: "",
      nodes: [],
      folder_id: folderId,
    });
    expect(r.status).toBeLessThan(300);
    const data = r.body.data as { id: number };
    workflowId = data.id;
    expect(workflowId).toBeTruthy();
  });

  it("2. userB cannot see it in list", async () => {
    const r = await api("/api/workflows", "GET", userB.apiKey);
    const data = r.body.data as Array<{ id: number }>;
    const ids = data.map((w) => w.id);
    expect(ids).not.toContain(workflowId);
  });

  it("2b. userB gets 403 on direct access", async () => {
    const r = await api(`/api/workflows/${workflowId}`, "GET", userB.apiKey);
    expect(r.status).toBe(403);
    const err = r.body.error as { code: string };
    expect(err.code).toBe("OWNERSHIP_REQUIRED");
  });

  it("3. userA switches folder to group and shares to marketing (viewer)", async () => {
    const visR = await api(
      `/api/folders/${folderId}/visibility`,
      "POST",
      userA.apiKey,
      { visibility: "group" },
    );
    expect(visR.status).toBe(200);

    await query(
      "INSERT INTO user_group_members (user_id, group_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [userB.id, groupId],
    );

    const shareR = await api(
      `/api/folders/${folderId}/shares`,
      "POST",
      userA.apiKey,
      { group_id: groupId, access_level: "viewer" },
    );
    expect(shareR.status).toBe(201);
  });

  it("4. userB can now read the workflow", async () => {
    const r = await api(`/api/workflows/${workflowId}`, "GET", userB.apiKey);
    expect(r.status).toBe(200);
  });

  it("5. userB PUT still rejected (viewer only)", async () => {
    const r = await api(`/api/workflows/${workflowId}`, "PUT", userB.apiKey, {
      title: "hijack",
    });
    expect(r.status).toBe(403);
  });

  it("6. promote share to editor → userB can edit", async () => {
    const r1 = await api(
      `/api/folders/${folderId}/shares`,
      "POST",
      userA.apiKey,
      { group_id: groupId, access_level: "editor" },
    );
    expect(r1.status).toBe(201);
    const r2 = await api(`/api/workflows/${workflowId}`, "PUT", userB.apiKey, {
      title: "joint edit",
    });
    expect(r2.status).toBe(200);
  });

  it("7. admin flips folder to public", async () => {
    const r = await api(
      `/api/folders/${folderId}/visibility`,
      "POST",
      admin.apiKey,
      { visibility: "public" },
    );
    expect(r.status).toBe(200);
  });

  it("7b. editor cannot flip public back down", async () => {
    const r = await api(
      `/api/folders/${folderId}/visibility`,
      "POST",
      userA.apiKey,
      { visibility: "personal" },
    );
    expect(r.status).toBe(403);
    const err = r.body.error as { code: string };
    expect(err.code).toBe("VISIBILITY_GATE");
  });

  it("8. userB creates credential → userA cannot see", async () => {
    const r = await api("/api/credentials", "POST", userB.apiKey, {
      service_name: "e2e_cred",
      secrets: { token: "top-secret-xyz" },
    });
    expect(r.status).toBe(200);
    const data = r.body.data as { id: number };
    credentialId = data.id;

    const listForA = await api("/api/credentials", "GET", userA.apiKey);
    const listData = listForA.body.data as Array<{ id: number }>;
    expect(listData.map((c) => c.id)).not.toContain(credentialId);
  });

  it("9. userB shares credential (use) with marketing", async () => {
    await query(
      "INSERT INTO user_group_members (user_id, group_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [userA.id, groupId],
    );
    const r = await api(
      `/api/credentials/${credentialId}/shares`,
      "POST",
      userB.apiKey,
      { group_id: groupId, access_level: "use" },
    );
    expect(r.status).toBe(201);
  });

  it("10. userA with use-share cannot reveal plaintext", async () => {
    const r = await api(
      `/api/credentials/${credentialId}/reveal`,
      "POST",
      userA.apiKey,
    );
    expect(r.status).toBe(403);
    const err = r.body.error as { code: string };
    expect(err.code).toBe("CREDENTIAL_REVEAL_DENIED");
  });

  it("10b. admin cannot reveal plaintext either", async () => {
    const r = await api(
      `/api/credentials/${credentialId}/reveal`,
      "POST",
      admin.apiKey,
    );
    expect(r.status).toBe(403);
  });

  it("11. owner (userB) can reveal plaintext", async () => {
    const r = await api(
      `/api/credentials/${credentialId}/reveal`,
      "POST",
      userB.apiKey,
    );
    expect(r.status).toBe(200);
    const data = r.body.data as { secrets: string };
    const parsed =
      typeof data.secrets === "string"
        ? JSON.parse(data.secrets)
        : data.secrets;
    expect(parsed.token).toBe("top-secret-xyz");
  });

  it("12. admin transfers workflow → new owner userB can delete", async () => {
    const transfer = await api(
      `/api/workflows/${workflowId}/transfer`,
      "POST",
      admin.apiKey,
      { new_owner_id: userB.id },
    );
    expect(transfer.status).toBe(200);
    const del = await api(
      `/api/workflows/${workflowId}`,
      "DELETE",
      userB.apiKey,
    );
    expect(del.status).toBe(200);
  });
});
