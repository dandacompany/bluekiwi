import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { query, queryOne } from "../src/lib/db";
import type { User } from "../src/lib/auth";
import {
  canRead,
  canEdit,
  canDelete,
  canExecute,
  canTransferOwnership,
  canChangeFolderVisibility,
  canManageFolderShares,
  canUseCredential,
  canRevealCredential,
  canListCredential,
  type OwnedResource,
  type OwnedFolder,
  type OwnedCredential,
} from "../src/lib/authorization";

// Test fixtures — created in beforeAll, cleaned in afterAll.
let userA: User;
let userB: User;
let userAdmin: User;
let userSuper: User;
let groupMarketing: { id: number };
let folderPersonal: OwnedFolder;
let folderGroup: OwnedFolder;
let folderGroupEditor: OwnedFolder;
let folderPublic: OwnedFolder;
let resourceInPersonal: OwnedResource;
let resourceInGroup: OwnedResource;
let resourceInPublic: OwnedResource;
let credOwnedByA: OwnedCredential;

async function createUser(username: string, role: User["role"]): Promise<User> {
  const row = await queryOne<User>(
    `INSERT INTO users (username, email, password_hash, role)
     VALUES ($1, $1 || '@test.local', 'x', $2)
     ON CONFLICT (username) DO UPDATE SET role = EXCLUDED.role
     RETURNING *`,
    [username, role],
  );
  return row!;
}

async function createFolder(
  name: string,
  owner: User,
  visibility: "personal" | "group" | "public",
): Promise<OwnedFolder> {
  const row = await queryOne<OwnedFolder>(
    `INSERT INTO folders (name, owner_id, visibility)
     VALUES ($1, $2, $3) RETURNING id, owner_id, parent_id, visibility, is_system`,
    [name, owner.id, visibility],
  );
  return row!;
}

beforeAll(async () => {
  userA = await createUser("authz_test_a", "editor");
  userB = await createUser("authz_test_b", "editor");
  userAdmin = await createUser("authz_test_admin", "admin");
  userSuper = await createUser("authz_test_super", "superuser");

  const grp = await queryOne<{ id: number }>(
    `INSERT INTO user_groups (name) VALUES ('authz_test_marketing')
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
  );
  groupMarketing = grp!;

  await query(
    `INSERT INTO user_group_members (user_id, group_id) VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [userB.id, groupMarketing.id],
  );

  folderPersonal = await createFolder("authz_personal", userA, "personal");
  folderGroup = await createFolder("authz_group_v", userA, "group");
  folderGroupEditor = await createFolder("authz_group_e", userA, "group");
  folderPublic = await createFolder("authz_public", userA, "public");

  await query(
    `INSERT INTO folder_shares (folder_id, group_id, access_level) VALUES ($1, $2, 'viewer')`,
    [folderGroup.id, groupMarketing.id],
  );
  await query(
    `INSERT INTO folder_shares (folder_id, group_id, access_level) VALUES ($1, $2, 'editor')`,
    [folderGroupEditor.id, groupMarketing.id],
  );

  resourceInPersonal = {
    id: 9001,
    owner_id: userA.id,
    folder_id: folderPersonal.id,
    visibility_override: null,
  };
  resourceInGroup = {
    id: 9002,
    owner_id: userA.id,
    folder_id: folderGroup.id,
    visibility_override: null,
  };
  resourceInPublic = {
    id: 9003,
    owner_id: userA.id,
    folder_id: folderPublic.id,
    visibility_override: null,
  };

  const cred = await queryOne<OwnedCredential>(
    `INSERT INTO credentials (service_name, description, secrets, owner_id, folder_id)
     VALUES ('authz_test', '', '{}', $1, $2)
     RETURNING id, owner_id, folder_id`,
    [userA.id, folderPersonal.id],
  );
  credOwnedByA = cred!;
});

afterAll(async () => {
  await query("DELETE FROM credentials WHERE service_name = 'authz_test'");
  await query(
    "DELETE FROM folders WHERE name IN ('authz_personal','authz_group_v','authz_group_e','authz_public')",
  );
  await query("DELETE FROM user_groups WHERE name = 'authz_test_marketing'");
  await query(
    "DELETE FROM users WHERE username IN ('authz_test_a','authz_test_b','authz_test_admin','authz_test_super')",
  );
});

describe("canRead", () => {
  it("owner can read own personal resource", async () => {
    expect(await canRead(userA, resourceInPersonal)).toBe(true);
  });
  it("unrelated user cannot read personal resource", async () => {
    expect(await canRead(userB, resourceInPersonal)).toBe(false);
  });
  it("admin can read any resource", async () => {
    expect(await canRead(userAdmin, resourceInPersonal)).toBe(true);
  });
  it("group-shared viewer can read", async () => {
    expect(await canRead(userB, resourceInGroup)).toBe(true);
  });
  it("anyone can read public", async () => {
    expect(await canRead(userB, resourceInPublic)).toBe(true);
  });
});

describe("canEdit", () => {
  it("owner can edit", async () => {
    expect(await canEdit(userA, resourceInPersonal)).toBe(true);
  });
  it("admin cannot edit others", async () => {
    expect(await canEdit(userAdmin, resourceInPersonal)).toBe(false);
  });
  it("superuser can edit anything", async () => {
    expect(await canEdit(userSuper, resourceInPersonal)).toBe(true);
  });
  it("viewer share cannot edit", async () => {
    expect(await canEdit(userB, resourceInGroup)).toBe(false);
  });
  it("editor share can edit", async () => {
    const editorRes: OwnedResource = {
      ...resourceInGroup,
      folder_id: folderGroupEditor.id,
    };
    expect(await canEdit(userB, editorRes)).toBe(true);
  });
});

describe("canDelete", () => {
  it("owner deletes", async () => {
    expect(await canDelete(userA, resourceInPersonal)).toBe(true);
  });
  it("superuser deletes", async () => {
    expect(await canDelete(userSuper, resourceInPersonal)).toBe(true);
  });
  it("admin cannot delete others", async () => {
    expect(await canDelete(userAdmin, resourceInPersonal)).toBe(false);
  });
});

describe("canExecute = canRead", () => {
  it("public execution allowed", async () => {
    expect(await canExecute(userB, resourceInPublic)).toBe(true);
  });
});

describe("canTransferOwnership", () => {
  it("admin can transfer", async () => {
    expect(await canTransferOwnership(userAdmin, resourceInPersonal)).toBe(
      true,
    );
  });
  it("random user cannot transfer", async () => {
    expect(await canTransferOwnership(userB, resourceInPersonal)).toBe(false);
  });
});

describe("canChangeFolderVisibility", () => {
  it("editor cannot publish to public", async () => {
    expect(
      await canChangeFolderVisibility(userA, folderPersonal, "public"),
    ).toBe(false);
  });
  it("admin can publish to public", async () => {
    expect(
      await canChangeFolderVisibility(userAdmin, folderPersonal, "public"),
    ).toBe(true);
  });
  it("owner can switch personal to group", async () => {
    expect(
      await canChangeFolderVisibility(userA, folderPersonal, "group"),
    ).toBe(true);
  });
  it("shared editor cannot change visibility", async () => {
    expect(
      await canChangeFolderVisibility(userB, folderGroupEditor, "personal"),
    ).toBe(false);
  });
});

describe("canManageFolderShares", () => {
  it("owner manages", async () => {
    expect(await canManageFolderShares(userA, folderGroup)).toBe(true);
  });
  it("shared editor cannot manage shares", async () => {
    expect(await canManageFolderShares(userB, folderGroupEditor)).toBe(false);
  });
  it("admin can manage", async () => {
    expect(await canManageFolderShares(userAdmin, folderGroup)).toBe(true);
  });
});

describe("credential use vs reveal", () => {
  it("owner can use and reveal", async () => {
    expect(await canUseCredential(userA, credOwnedByA)).toBe(true);
    expect(await canRevealCredential(userA, credOwnedByA)).toBe(true);
  });
  it("unrelated editor cannot use", async () => {
    expect(await canUseCredential(userB, credOwnedByA)).toBe(false);
  });
  it("admin CANNOT reveal plaintext", async () => {
    expect(await canRevealCredential(userAdmin, credOwnedByA)).toBe(false);
  });
  it("admin CAN list metadata", async () => {
    expect(await canListCredential(userAdmin, credOwnedByA)).toBe(true);
  });
  it("superuser can reveal", async () => {
    expect(await canRevealCredential(userSuper, credOwnedByA)).toBe(true);
  });

  it("use share grants execution but not reveal", async () => {
    await query(
      `INSERT INTO credential_shares (credential_id, group_id, access_level)
       VALUES ($1, $2, 'use')`,
      [credOwnedByA.id, groupMarketing.id],
    );
    try {
      expect(await canUseCredential(userB, credOwnedByA)).toBe(true);
      expect(await canRevealCredential(userB, credOwnedByA)).toBe(false);
    } finally {
      await query(`DELETE FROM credential_shares WHERE credential_id = $1`, [
        credOwnedByA.id,
      ]);
    }
  });

  it("manage share grants reveal", async () => {
    await query(
      `INSERT INTO credential_shares (credential_id, group_id, access_level)
       VALUES ($1, $2, 'manage')`,
      [credOwnedByA.id, groupMarketing.id],
    );
    try {
      expect(await canRevealCredential(userB, credOwnedByA)).toBe(true);
    } finally {
      await query(`DELETE FROM credential_shares WHERE credential_id = $1`, [
        credOwnedByA.id,
      ]);
    }
  });
});

describe("list filter builders", () => {
  it("user sees own resources only in visible set", async () => {
    const { buildResourceVisibilityFilter } =
      await import("../src/lib/authorization");
    const filter = await buildResourceVisibilityFilter("w", userA, 1);
    const rows = await query(
      `SELECT w.id FROM (VALUES
        (9001::int, ${userA.id}::int, ${folderPersonal.id}::int, null::text),
        (9002::int, ${userB.id}::int, ${folderPersonal.id}::int, null::text)
       ) AS w(id, owner_id, folder_id, visibility_override)
       WHERE ${filter.sql}`,
      filter.params,
    );
    expect(rows.map((r: { id: number }) => r.id)).toEqual([9001]);
  });
});
