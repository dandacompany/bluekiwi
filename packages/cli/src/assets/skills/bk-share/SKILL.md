---
name: bk-share
description: BlueKiwi sharing skill. Shares a folder or workflow with a user group at a specified access level. This skill should be used when the user says "/bk-share", "share workflow", "share folder", or wants to share BlueKiwi content with a group.
user_invocable: true
---

# BlueKiwi Share

Share a folder with a user group at a specified access level (viewer or editor).

## Argument Handling

- `/bk-share` → Show resource and group selection.
- `/bk-share <folder name>` → Pre-select the folder and ask for group/access level.

## Core Principles

- Sharing is applied at the **folder level**. Workflows and instructions inside the folder inherit the visibility.
- Access levels: `viewer` (read-only) or `editor` (can modify contents).
- Only the folder owner or an admin can share.

## Execution Steps

### Step 1: Select Resource

Call `list_folders` to get the accessible folder list.

Ask via AskUserQuestion:

- header: "Share what?"
- "Which folder would you like to share?"
- options: folder name list (up to 4)

### Step 2: Select Group

Call `list_my_groups` to get groups the current user belongs to.

Ask via AskUserQuestion:

- header: "Share with"
- "Which group should have access?"
- options: group name list

### Step 3: Set Access Level

Ask via AskUserQuestion:

- header: "Access level"
- options: ["Viewer (read-only)", "Editor (can modify)"]

### Step 4: Confirm and Apply

Show a confirmation summary:

```
Share settings:
━━━━━━━━━━━━━━━━━━━━━━━━━
Folder: {folder name}
Group:  {group name}
Access: {viewer | editor}
━━━━━━━━━━━━━━━━━━━━━━━━━
```

Ask via AskUserQuestion:

- header: "Confirm"
- options: ["Share", "Cancel"]

Call `share_folder`:

```json
{
  "folder_id": <id>,
  "group_id": <id>,
  "access_level": "viewer" | "editor"
}
```

### Step 5: Result

On success:

```
✅ Shared
'{folder name}' is now accessible to '{group name}' as {access level}.

To revoke access later, use `/bk-share` and select "Remove share".
```

## Revoke Access

If the user says "remove share" or "unshare" → call `unshare_folder`:

```json
{
  "folder_id": <id>,
  "group_id": <id>
}
```
