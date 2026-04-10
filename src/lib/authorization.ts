import { query, queryOne, type Folder, type Visibility } from "./db";
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
