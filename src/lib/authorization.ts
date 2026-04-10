import { query, queryOne, type Visibility } from "./db";
import type { User } from "./auth";

// ─── Resource shape (minimum fields needed by permission funcs) ───

export interface OwnedResource {
  id: number;
  owner_id: number;
  folder_id: number;
  visibility_override: "personal" | null;
}

export interface OwnedFolder {
  id: number;
  owner_id: number;
  parent_id: number | null;
  visibility: Visibility;
  is_system: boolean;
}

export interface OwnedCredential {
  id: number;
  owner_id: number;
  folder_id: number;
}

// ─── Loaders ───

export async function loadFolder(id: number): Promise<OwnedFolder | undefined> {
  return queryOne<OwnedFolder>(
    "SELECT id, owner_id, parent_id, visibility, is_system FROM folders WHERE id = $1",
    [id],
  );
}

/**
 * Resolve the *root* visibility of a folder. With 2-level nesting the child
 * folder inherits from its parent unless the child is itself more restrictive.
 * This returns the effective visibility of the folder itself (used as the
 * inherited value for resources inside it).
 */
export async function resolveFolderVisibility(
  folderId: number,
): Promise<Visibility> {
  const folder = await loadFolder(folderId);
  if (!folder) return "personal";
  if (folder.parent_id === null) return folder.visibility;
  const parent = await loadFolder(folder.parent_id);
  if (!parent) return folder.visibility;
  // Child "personal" override is honored; otherwise inherit parent.
  if (folder.visibility === "personal") return "personal";
  return parent.visibility;
}

export async function effectiveResourceVisibility(
  resource: OwnedResource,
): Promise<Visibility> {
  if (resource.visibility_override === "personal") return "personal";
  return resolveFolderVisibility(resource.folder_id);
}

/** Groups the user belongs to. */
export async function userGroupIds(userId: number): Promise<number[]> {
  const rows = await query<{ group_id: number }>(
    "SELECT group_id FROM user_group_members WHERE user_id = $1",
    [userId],
  );
  return rows.map((r) => r.group_id);
}

/** Returns folder_shares rows matching any of the user's groups, for this folder or its parent. */
export async function userFolderShareLevel(
  user: User,
  folderId: number,
): Promise<"viewer" | "editor" | null> {
  const groups = await userGroupIds(user.id);
  if (groups.length === 0) return null;
  const rows = await query<{ access_level: "viewer" | "editor" }>(
    `SELECT fs.access_level
       FROM folder_shares fs
       JOIN folders f ON f.id = $1
       WHERE fs.folder_id IN (f.id, f.parent_id)
         AND fs.group_id = ANY($2::int[])`,
    [folderId, groups],
  );
  if (rows.length === 0) return null;
  // editor beats viewer
  return rows.some((r) => r.access_level === "editor") ? "editor" : "viewer";
}

export async function userCredentialShareLevel(
  user: User,
  credentialId: number,
): Promise<"use" | "manage" | null> {
  const groups = await userGroupIds(user.id);
  if (groups.length === 0) return null;
  const rows = await query<{ access_level: "use" | "manage" }>(
    `SELECT access_level FROM credential_shares
      WHERE credential_id = $1 AND group_id = ANY($2::int[])`,
    [credentialId, groups],
  );
  if (rows.length === 0) return null;
  return rows.some((r) => r.access_level === "manage") ? "manage" : "use";
}

// ─── Permission predicates ───

function isPrivileged(user: User, roles: Array<User["role"]>): boolean {
  return roles.includes(user.role);
}

export async function canRead(
  user: User,
  resource: OwnedResource,
): Promise<boolean> {
  if (resource.owner_id === user.id) return true;
  if (isPrivileged(user, ["admin", "superuser"])) return true;

  const vis = await effectiveResourceVisibility(resource);
  if (vis === "public") return true;
  if (vis === "group") {
    return (await userFolderShareLevel(user, resource.folder_id)) !== null;
  }
  return false;
}

export async function canEdit(
  user: User,
  resource: OwnedResource,
): Promise<boolean> {
  if (resource.owner_id === user.id) return true;
  if (user.role === "superuser") return true;

  const vis = await effectiveResourceVisibility(resource);
  if (vis === "group") {
    const lvl = await userFolderShareLevel(user, resource.folder_id);
    return lvl === "editor";
  }
  return false;
}

export async function canDelete(
  user: User,
  resource: OwnedResource,
): Promise<boolean> {
  return resource.owner_id === user.id || user.role === "superuser";
}

export async function canExecute(
  user: User,
  resource: OwnedResource,
): Promise<boolean> {
  return canRead(user, resource);
}

export async function canTransferOwnership(
  user: User,
  resource: OwnedResource,
): Promise<boolean> {
  return (
    resource.owner_id === user.id || isPrivileged(user, ["admin", "superuser"])
  );
}

/** For workflow/instruction visibility_override (only 'personal' or null). */
export async function canChangeResourceVisibility(
  user: User,
  resource: OwnedResource,
): Promise<boolean> {
  return canEdit(user, resource);
}

// ─── Folder predicates ───

export async function canReadFolder(
  user: User,
  folder: OwnedFolder,
): Promise<boolean> {
  if (folder.owner_id === user.id) return true;
  if (isPrivileged(user, ["admin", "superuser"])) return true;
  if (folder.visibility === "public") return true;
  if (folder.visibility === "group") {
    return (await userFolderShareLevel(user, folder.id)) !== null;
  }
  return false;
}

export async function canEditFolder(
  user: User,
  folder: OwnedFolder,
): Promise<boolean> {
  if (folder.owner_id === user.id) return true;
  if (user.role === "superuser") return true;
  if (folder.visibility === "group") {
    return (await userFolderShareLevel(user, folder.id)) === "editor";
  }
  return false;
}

export async function canDeleteFolder(
  user: User,
  folder: OwnedFolder,
): Promise<boolean> {
  if (folder.is_system) return false;
  // Non-empty guard is enforced by the caller (needs to count contents).
  return folder.owner_id === user.id || user.role === "superuser";
}

export async function canChangeFolderVisibility(
  user: User,
  folder: OwnedFolder,
  newVisibility: Visibility,
): Promise<boolean> {
  if (newVisibility === "public" || folder.visibility === "public") {
    return isPrivileged(user, ["admin", "superuser"]);
  }
  return (
    folder.owner_id === user.id || isPrivileged(user, ["admin", "superuser"])
  );
}

export async function canManageFolderShares(
  user: User,
  folder: OwnedFolder,
): Promise<boolean> {
  return (
    folder.owner_id === user.id || isPrivileged(user, ["admin", "superuser"])
  );
}

// ─── Credential predicates ───

export async function canUseCredential(
  user: User,
  cred: OwnedCredential,
): Promise<boolean> {
  if (cred.owner_id === user.id) return true;
  if (user.role === "superuser") return true;
  const lvl = await userCredentialShareLevel(user, cred.id);
  return lvl !== null; // use or manage
}

export async function canRevealCredential(
  user: User,
  cred: OwnedCredential,
): Promise<boolean> {
  if (cred.owner_id === user.id) return true;
  if (user.role === "superuser") return true;
  const lvl = await userCredentialShareLevel(user, cred.id);
  return lvl === "manage";
}

export async function canListCredential(
  user: User,
  cred: OwnedCredential,
): Promise<boolean> {
  if (await canUseCredential(user, cred)) return true;
  return user.role === "admin";
}

export async function canEditCredential(
  user: User,
  cred: OwnedCredential,
): Promise<boolean> {
  return canRevealCredential(user, cred);
}

export async function canManageCredentialShares(
  user: User,
  cred: OwnedCredential,
): Promise<boolean> {
  return canRevealCredential(user, cred);
}

// ─── List filter predicate builders ───
// These return a WHERE clause fragment + params for callers to compose
// into their own SELECTs. Parameter numbering starts at the given offset.

export interface AuthFilter {
  sql: string;
  params: unknown[];
}

export async function buildResourceVisibilityFilter(
  tableAlias: string,
  user: User,
  nextParamIndex: number,
): Promise<AuthFilter> {
  const groups = await userGroupIds(user.id);
  if (user.role === "admin" || user.role === "superuser") {
    return { sql: "TRUE", params: [] };
  }
  const params: unknown[] = [user.id];
  let p = nextParamIndex;
  const userIdx = p;
  p += 1;

  let groupClause = "FALSE";
  if (groups.length > 0) {
    params.push(groups);
    groupClause = `(
      f.visibility = 'group' AND EXISTS (
        SELECT 1 FROM folder_shares fs
        WHERE fs.folder_id IN (f.id, f.parent_id)
          AND fs.group_id = ANY($${p}::int[])
      )
    )`;
    p += 1;
  }

  const sql = `(
    ${tableAlias}.owner_id = $${userIdx}
    OR EXISTS (
      SELECT 1 FROM folders f
      WHERE f.id = ${tableAlias}.folder_id
        AND (
          ${tableAlias}.visibility_override IS NULL
          AND (
            f.visibility = 'public'
            OR ${groupClause}
          )
        )
    )
  )`;

  return { sql, params };
}

export async function buildFolderVisibilityFilter(
  tableAlias: string,
  user: User,
  nextParamIndex: number,
): Promise<AuthFilter> {
  if (user.role === "admin" || user.role === "superuser") {
    return { sql: "TRUE", params: [] };
  }
  const groups = await userGroupIds(user.id);
  const params: unknown[] = [user.id];
  let p = nextParamIndex;
  const userIdx = p;
  p += 1;

  let groupClause = "FALSE";
  if (groups.length > 0) {
    params.push(groups);
    groupClause = `(
      ${tableAlias}.visibility = 'group' AND EXISTS (
        SELECT 1 FROM folder_shares fs
        WHERE fs.folder_id IN (${tableAlias}.id, ${tableAlias}.parent_id)
          AND fs.group_id = ANY($${p}::int[])
      )
    )`;
    p += 1;
  }

  const sql = `(
    ${tableAlias}.owner_id = $${userIdx}
    OR ${tableAlias}.visibility = 'public'
    OR ${groupClause}
  )`;

  return { sql, params };
}

export async function buildCredentialVisibilityFilter(
  tableAlias: string,
  user: User,
  nextParamIndex: number,
): Promise<AuthFilter> {
  if (user.role === "superuser") {
    return { sql: "TRUE", params: [] };
  }
  const groups = await userGroupIds(user.id);
  const params: unknown[] = [user.id];
  let p = nextParamIndex;
  const userIdx = p;
  p += 1;

  let groupClause = "FALSE";
  if (groups.length > 0) {
    params.push(groups);
    groupClause = `EXISTS (
      SELECT 1 FROM credential_shares cs
      WHERE cs.credential_id = ${tableAlias}.id
        AND cs.group_id = ANY($${p}::int[])
    )`;
    p += 1;
  }

  const adminClause = user.role === "admin" ? "OR TRUE" : "";

  const sql = `(
    ${tableAlias}.owner_id = $${userIdx}
    OR ${groupClause}
    ${adminClause}
  )`;

  return { sql, params };
}
