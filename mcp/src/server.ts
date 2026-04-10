import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { BlueKiwiClient } from "./api-client.js";
import {
  BlueKiwiApiError,
  BlueKiwiAuthError,
  BlueKiwiNetworkError,
} from "./errors.js";

const apiUrl = process.env.BLUEKIWI_API_URL;
const apiKey = process.env.BLUEKIWI_API_KEY ?? parseApiKeyFlag();

if (!apiUrl) {
  throw new Error("BLUEKIWI_API_URL is required");
}

if (!apiKey) {
  throw new Error("BLUEKIWI_API_KEY is required");
}

const client = new BlueKiwiClient(apiUrl, apiKey);
const server = new Server(
  { name: "bluekiwi", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

const tools: Tool[] = [
  tool("list_workflows", "List all workflows available on the BlueKiwi server"),
  tool(
    "start_workflow",
    "Start a task from a workflow id",
    {
      workflow_id: { type: "number" },
      version: { type: "string" },
      context: { type: "string" },
      session_meta: { type: "string" },
      target: { type: "object" },
    },
    ["workflow_id"],
  ),
  tool(
    "execute_step",
    "Submit the result for the current workflow step",
    {
      task_id: { type: "number" },
      node_id: { type: "number" },
      output: { type: "string" },
      status: { type: "string" },
      visual_html: { type: "string" },
      loop_continue: { type: "boolean" },
      context_snapshot: { type: "object" },
      structured_output: { type: "object" },
      artifacts: { type: "array" },
      session_id: { type: "string" },
      agent_id: { type: "string" },
      user_name: { type: "string" },
      model_id: { type: "string" },
    },
    ["task_id", "node_id", "output", "status"],
  ),
  tool(
    "advance",
    "Advance a task to the next step or inspect the current step",
    {
      task_id: { type: "number" },
      peek: { type: "boolean" },
    },
    ["task_id"],
  ),
  tool(
    "heartbeat",
    "Append progress information for a running task step",
    {
      task_id: { type: "number" },
      node_id: { type: "number" },
      progress: { type: "string" },
    },
    ["task_id", "node_id", "progress"],
  ),
  tool(
    "complete_task",
    "Mark a task as completed or failed",
    {
      task_id: { type: "number" },
      status: { type: "string" },
      summary: { type: "string" },
    },
    ["task_id", "status"],
  ),
  tool(
    "rewind",
    "Rewind a task to a previous step",
    {
      task_id: { type: "number" },
      to_step: { type: "number" },
    },
    ["task_id", "to_step"],
  ),
  tool(
    "get_web_response",
    "Fetch the pending web response payload for a task",
    {
      task_id: { type: "number" },
    },
    ["task_id"],
  ),
  tool(
    "submit_visual",
    "Submit visual HTML for a task step",
    {
      task_id: { type: "number" },
      node_id: { type: "number" },
      visual_html: { type: "string" },
    },
    ["task_id", "node_id", "visual_html"],
  ),
  tool(
    "save_artifacts",
    "Save artifacts for a task step",
    {
      task_id: { type: "number" },
      artifacts: { type: "array" },
    },
    ["task_id", "artifacts"],
  ),
  tool(
    "load_artifacts",
    "Load artifacts for a task",
    {
      task_id: { type: "number" },
    },
    ["task_id"],
  ),
  tool(
    "get_comments",
    "List comments for a task",
    {
      task_id: { type: "number" },
    },
    ["task_id"],
  ),
  tool("list_credentials", "List credentials available to the current user"),
  tool(
    "create_workflow",
    "Create a new workflow",
    {
      title: { type: "string" },
      description: { type: "string" },
      version: { type: "string" },
      parent_workflow_id: { type: "number" },
      evaluation_contract: { type: "object" },
      nodes: { type: "array" },
    },
    ["title"],
  ),
  tool(
    "update_workflow",
    "Update an existing workflow",
    {
      workflow_id: { type: "number" },
      title: { type: "string" },
      description: { type: "string" },
      version: { type: "string" },
      evaluation_contract: { type: "object" },
      create_new_version: { type: "boolean" },
      nodes: { type: "array" },
    },
    ["workflow_id"],
  ),
  tool(
    "delete_workflow",
    "Delete a workflow",
    {
      workflow_id: { type: "number" },
    },
    ["workflow_id"],
  ),
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const name = request.params.name;
  const args = toArgs(request.params.arguments);

  try {
    switch (name) {
      case "list_workflows":
        return wrap(await client.request("GET", "/api/workflows"));
      case "start_workflow":
        return wrap(await client.request("POST", "/api/tasks/start", args));
      case "execute_step": {
        const taskId = requireNumberArg(args, "task_id");
        const body = { ...args };
        delete body.task_id;
        return wrap(
          await client.request("POST", `/api/tasks/${taskId}/execute`, body),
        );
      }
      case "advance": {
        const taskId = requireNumberArg(args, "task_id");
        const body = { ...args };
        delete body.task_id;
        return wrap(
          await client.request("POST", `/api/tasks/${taskId}/advance`, body),
        );
      }
      case "heartbeat": {
        const taskId = requireNumberArg(args, "task_id");
        const body = { ...args };
        delete body.task_id;
        return wrap(
          await client.request("POST", `/api/tasks/${taskId}/heartbeat`, body),
        );
      }
      case "complete_task": {
        const taskId = requireNumberArg(args, "task_id");
        const body = { ...args };
        delete body.task_id;
        return wrap(
          await client.request("POST", `/api/tasks/${taskId}/complete`, body),
        );
      }
      case "rewind": {
        const taskId = requireNumberArg(args, "task_id");
        const body = { ...args };
        delete body.task_id;
        return wrap(
          await client.request("POST", `/api/tasks/${taskId}/rewind`, body),
        );
      }
      case "get_web_response": {
        const taskId = requireNumberArg(args, "task_id");
        return wrap(await client.request("GET", `/api/tasks/${taskId}/respond`));
      }
      case "submit_visual": {
        const taskId = requireNumberArg(args, "task_id");
        const body = { ...args };
        delete body.task_id;
        return wrap(
          await client.request("POST", `/api/tasks/${taskId}/visual`, body),
        );
      }
      case "save_artifacts": {
        const taskId = requireNumberArg(args, "task_id");
        const body = { ...args };
        delete body.task_id;
        return wrap(
          await client.request("POST", `/api/tasks/${taskId}/artifacts`, body),
        );
      }
      case "load_artifacts": {
        const taskId = requireNumberArg(args, "task_id");
        return wrap(
          await client.request("GET", `/api/tasks/${taskId}/artifacts`),
        );
      }
      case "get_comments": {
        const taskId = requireNumberArg(args, "task_id");
        return wrap(await client.request("GET", `/api/tasks/${taskId}/comments`));
      }
      case "list_credentials":
        return wrap(await client.request("GET", "/api/credentials"));
      case "create_workflow":
        return wrap(await client.request("POST", "/api/workflows", args));
      case "update_workflow": {
        const workflowId = requireNumberArg(args, "workflow_id");
        const body = { ...args };
        delete body.workflow_id;
        return wrap(
          await client.request("PUT", `/api/workflows/${workflowId}`, body),
        );
      }
      case "delete_workflow": {
        const workflowId = requireNumberArg(args, "workflow_id");
        return wrap(
          await client.request("DELETE", `/api/workflows/${workflowId}`),
        );
      }
      default:
        return wrapError(`Unknown tool: ${name}`);
    }
  } catch (error) {
    if (error instanceof BlueKiwiAuthError) {
      return wrap({
        error: "auth_failed",
        hint: "Run `npx bluekiwi status` to verify your config, or re-authenticate with `npx bluekiwi accept <new-token>`.",
      });
    }

    if (error instanceof BlueKiwiApiError && error.status >= 500) {
      return wrap({
        error: "server_error",
        status: error.status,
        hint: `${apiUrl.replace(/\/$/, "")}/api/health`,
      });
    }

    if (error instanceof BlueKiwiNetworkError) {
      return wrap({
        error: "network_error",
        message: error.message,
      });
    }

    return wrapError(error instanceof Error ? error.message : String(error));
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);

type InputSchemaProperties = Record<
  string,
  {
    type: string;
  }
>;

function tool(
  name: string,
  description: string,
  properties?: InputSchemaProperties,
  required?: string[],
): Tool {
  return {
    name,
    description,
    inputSchema: {
      type: "object",
      properties,
      required,
    },
  };
}

function toArgs(
  args: Record<string, unknown> | undefined,
): Record<string, unknown> {
  return args ?? {};
}

function requireNumberArg(
  args: Record<string, unknown>,
  key: string,
): number {
  const value = args[key];

  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`${key} must be a number`);
  }

  return value;
}

function wrap(data: unknown) {
  return {
    content: [{ type: "text", text: JSON.stringify(data) }],
  };
}

function wrapError(message: string) {
  return {
    content: [{ type: "text", text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

function parseApiKeyFlag(): string | undefined {
  const index = process.argv.indexOf("--api-key");
  return index >= 0 ? process.argv[index + 1] : undefined;
}
