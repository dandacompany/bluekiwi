# Migration 007 — Ownership & RBAC upgrade guide

## Summary

Migration 007 introduces per-resource ownership, folder-based sharing, and credential use/reveal separation to BlueKiwi workflows, instructions, and credentials. **Read this before applying in production.**

Key changes:

- New tables: `folders`, `folder_shares`, `credential_shares`
- New columns on `workflows`, `instructions`, `credentials`: `owner_id`, `folder_id`, `visibility_override`
- Every existing row is backfilled and owner/folder columns become NOT NULL
- Admin role becomes read-only for other users' resources (was: full access)
- admin can no longer see credential secrets in plaintext — only the owner or a `manage`-shared user, plus superuser

## Prerequisites

- At least one `superuser` user must exist. Verify:

  ```sql
  SELECT id, username, role FROM users WHERE role = 'superuser';
  ```

  If none exist, create one first; the migration will abort with a clear error otherwise.

- Migrations 001–006 applied (the normal order).

## Backfill behavior

Migration 007 makes three deterministic backfill decisions. Understand these before rollout:

- **Workflows** — assigned to the first superuser (lowest `id`) and moved into that user's auto-generated `My Workspace` folder (visibility: `personal`). Team members lose visibility to those workflows until the superuser shares or transfers them via the new folder/group flow.
- **Instructions** — assigned to the first superuser and moved into a single shared `Public Library` folder (visibility: `public`). This preserves the previous "anyone can use" behavior. **Audit your instructions immediately if any contain sensitive prompts** — move those out of `Public Library` into `My Workspace`.
- **Credentials** — assigned to the first superuser's `My Workspace`. Previously credentials were admin-only, so this preserves access for the superuser and restricts access for every other admin. Admins do not automatically get credential access after 007.

## New folder hierarchy rules

- Every active user gets an auto-generated `My Workspace` root folder marked `is_system=true`. It cannot be renamed, deleted, or reparented.
- There is exactly one `Public Library` root folder (global), also marked `is_system=true`. It cannot be renamed or deleted. Admins and superusers can publish content into it.
- Folder nesting is capped at 2 levels (root + 1 child). Attempts to create a 3rd level are rejected by a database trigger.
- Credentials cannot live in a public folder. A database trigger rejects this.

## Downtime window

Estimated 30–60 seconds on databases with fewer than 10k resources. Longer for larger data due to the `UPDATE ... SET folder_id = ...` full table scans. Run outside business hours if you have substantial data.

**User-visible effects immediately after the migration:**

- Workflows, tasks, and credentials that team members previously created disappear from their views until the superuser transfers ownership or shares the parent folder.
- Instructions remain visible to everyone (via Public Library).
- Running tasks continue to execute — the new enforcement is on `POST /api/tasks/start`, not on in-flight tasks.
- The web UI starts showing owner/visibility badges and folder trees once the paired application code is deployed.

## Post-migration checklist

Run as the superuser that performed the backfill:

1. Open `/settings/groups` (after the companion UI ships). Create the teams your organization uses and add members.
2. Open `/workflows` and for each workflow decide:
   - **Stays personal** — leave in your `My Workspace`.
   - **Belongs to a team** — create or reuse a group-visible folder, move the workflow in, and share the folder with the relevant group (`viewer` or `editor`).
   - **Broadly useful** — either transfer ownership to the right individual, or move it into a folder you publish as `public` (admin-only action).
3. Open `/credentials` and triage the same way. Use `Share with group` (`use` for execution-only access, `manage` if the recipient should be able to reveal plaintext).
4. Audit `/instructions` inside `Public Library`. Move any instruction that references sensitive context (internal tokens, customer IDs, compliance rules) out to your `My Workspace` or into a group-shared folder.
5. Announce to the team what they can expect to lose or regain after the migration. A short note saying "if you can't see a workflow you used to, tell me — I'll share the parent folder" usually handles the transition.

## Rollback

Migration 007 is **forward-only in practice**. An `008_rollback_ownership.sql` that drops the new tables and columns is possible, but it loses ownership metadata and cannot recreate the prior admin behavior accurately. Only run in a disaster scenario and only after taking a full backup.

## Related REST endpoints

- `POST /api/folders`, `GET /api/folders`, `PUT/DELETE /api/folders/:id`
- `POST /api/folders/:id/visibility`
- `POST /api/folders/:id/transfer`
- `GET/POST /api/folders/:id/shares`, `DELETE /api/folders/:id/shares/:groupId`
- `POST /api/workflows/:id/visibility`, `POST /api/workflows/:id/transfer`
- `POST /api/instructions/:id/visibility`, `POST /api/instructions/:id/transfer`
- `POST /api/credentials/:id/reveal`
- `GET/POST /api/credentials/:id/shares`, `DELETE /api/credentials/:id/shares/:groupId`
- `POST /api/credentials/:id/transfer`
- `POST /api/tasks/start` — now requires the caller to have both `canExecute` on the workflow and `canUseCredential` on every referenced credential.

## Error codes introduced

| Code                          | Meaning                                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------- |
| `OWNERSHIP_REQUIRED`          | The operation is reserved for the resource owner (or superuser).                                        |
| `VISIBILITY_GATE`             | Changing visibility to/from `public` requires admin or superuser.                                       |
| `CREDENTIAL_USE_DENIED`       | A task start failed because the caller cannot use a credential referenced by one of the workflow nodes. |
| `CREDENTIAL_REVEAL_DENIED`    | A reveal/edit of credential secrets was denied.                                                         |
| `FOLDER_SHARE_DENIED`         | The caller cannot manage shares on this folder.                                                         |
| `FOLDER_NOT_EMPTY`            | Folder delete was refused because it still contains resources or subfolders.                            |
| `FOLDER_VISIBILITY_INVALID`   | Attempted to set a child folder's visibility wider than its parent.                                     |
| `CREDENTIAL_IN_PUBLIC_FOLDER` | Attempted to create or move a credential into a public folder.                                          |

## FAQ

**Why can't admins see credential plaintext anymore?**  
Previously, any admin could read every credential's secrets, which made the admin role a single point of compromise. Migration 007 separates "use" from "reveal": admins can still see that a credential exists and who owns it, but they cannot read the plaintext unless they are the owner or hold a `manage`-level share. Only superuser retains universal reveal access for disaster recovery.

**A team member can't see the workflow they created last week. What happened?**  
The migration reassigned every existing workflow to the first superuser. Ask the superuser to `POST /api/workflows/:id/transfer` with the original author's `new_owner_id`, or to move the workflow into a group-shared folder.

**Why did the Public Library end up holding all my instructions?**  
Instructions were previously "anyone can use", so the migration preserves that contract by placing them in a `public` folder. If any instruction is sensitive, move it to `My Workspace` manually — the migration cannot distinguish sensitive content automatically.
