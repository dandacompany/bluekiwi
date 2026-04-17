/**
 * Recognizes slugs that look like model names (e.g. `claude-sonnet-4-6`,
 * `gpt-5.2`, `gemini-2.5-pro`, `kimi-k2`, `grok-4`) vs tool names
 * (e.g. `claude-code`, `cursor`, `windsurf`).
 *
 * Used by `start_workflow` to classify the MCP handshake's `clientInfo.name`:
 * matches → model slug fallback, misses → provider slug fallback.
 *
 * Add new families here when a new model provider lands. The delimiter class
 * `[-/.]` is important: it separates `claude-` model series from `claude-code`
 * (tool name) even though both start with `claude`.
 */
export const MODEL_NAME_RE =
  /^(claude|gpt|gemini|o\d|llama|mistral|qwen|deepseek|kimi|grok|glm)[-/.]/i;
