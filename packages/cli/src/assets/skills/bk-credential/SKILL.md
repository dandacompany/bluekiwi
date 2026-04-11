---
name: bk-credential
description: BlueKiwi credential management skill. Securely registers, updates, and deletes external service credentials (API keys, tokens) in BlueKiwi. This skill should be used when the user says "/bk-credential", "add credential", "register API key", or wants to manage credentials in BlueKiwi.
user_invocable: true
---

# BlueKiwi Credential Management

Securely manage external service credentials (API keys, tokens) on the BlueKiwi server.

## Argument Handling

- `/bk-credential` → Show action selection menu.
- `/bk-credential add <service name>` → Start the add credential flow.
- `/bk-credential list` → Show registered credentials list.

## Security Principles

<HARD-RULE>
- Never print credential secret values to the user.
- When editing, never display existing secrets. Accept new values and replace entirely.
- Credentials must be stored in **private (personal) folders only**. Never store in public folders.
</HARD-RULE>

## Execution Steps

### Step 0: Select Action

If no argument, ask via AskUserQuestion:

- header: "Credentials"
- options: ["List", "Add new", "Edit", "Delete"]

---

### Action: List

Call `list_credentials` and display results:

```
Registered Credentials
━━━━━━━━━━━━━━━━━━━━━━━━━
ID  Service Name      Description
━━━━━━━━━━━━━━━━━━━━━━━━━
1   openai            OpenAI API
2   github            GitHub PAT
━━━━━━━━━━━━━━━━━━━━━━━━━
2 total
```

---

### Action: Add New

**Service name**: Ask via AskUserQuestion.

**Folder selection**: Call `list_folders`, filter for private folders only, then ask via AskUserQuestion:

- header: "Save folder"
- "Which folder should this be stored in? (Only private folders shown)"
- options: private folder list + "My Workspace (default)"

**Secrets input**: Ask the user for key-value pairs:

```
Enter the credentials for <service name>.
Format: KEY=VALUE (one per line)
Example:
  API_KEY=sk-xxxx
  BASE_URL=https://api.example.com
```

Parse the input to build the secrets object.

**Description** (optional): Accept a short description.

**Confirm**: Ask via AskUserQuestion before registering:

- header: "Confirm"
- "Service: <service_name>\nKeys: <key list (values masked)>\nRegister?"
- options: ["Register", "Cancel"]

Call `create_credential`:

```json
{
  "service_name": "<service name>",
  "description": "<description>",
  "secrets": { "KEY": "value", ... },
  "folder_id": <folder id or omit>
}
```

---

### Action: Edit

Call `list_credentials`, then ask which one to edit via AskUserQuestion.

Ask what to change (AskUserQuestion):

- options: ["Change service name", "Change description", "Replace secrets", "Cancel"]

For "Replace secrets" → accept all new key-value pairs and replace entirely.

Call `update_credential`:

```json
{
  "credential_id": <id>,
  "service_name": "<if changed>",
  "description": "<if changed>",
  "secrets": { ... }
}
```

---

### Action: Delete

Call `list_credentials`, then ask which one to delete via AskUserQuestion.

Confirm via AskUserQuestion:

- header: "Confirm delete"
- "Delete the '<service_name>' credential? This will fail if any workflow node references it."
- options: ["Delete", "Cancel"]

Call `delete_credential`. On 409 error (in use), inform the user which workflow is using it.

---

## Linking to Workflows

Credentials are linked to workflow nodes via `credential_id`.

When designing workflows (`/bk-design`, `/bk-improve`), set the credential on the node that calls an external API:

```json
{
  "title": "Call External API",
  "credential_id": <credential id>
}
```

BlueKiwi automatically injects the secrets into that node at runtime.
