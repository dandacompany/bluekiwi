import type { TranslationParams } from ".";

/**
 * Shape of the error payload returned by API routes via errorResponse().
 */
export interface ServerErrorBody {
  code?: string;
  message?: string;
  details?: Record<string, unknown>;
}

/**
 * Map server-side error codes (SCREAMING_SNAKE_CASE) to client-side i18n keys.
 * Add new entries here as routes start surfacing structured errors. Codes with
 * no entry fall back to the raw server `message` so existing routes keep
 * working without immediate migration.
 */
const CODE_TO_I18N_KEY: Record<string, string> = {
  // RBAC / domain-specific (already mapped)
  OWNERSHIP_REQUIRED: "rbacErrors.ownershipRequired",
  VISIBILITY_GATE: "rbacErrors.visibilityGate",
  CREDENTIAL_USE_DENIED: "rbacErrors.credentialUseDenied",
  CREDENTIAL_REVEAL_DENIED: "rbacErrors.credentialRevealDenied",
  FOLDER_DEPTH_EXCEEDED: "rbacErrors.folderDepthExceeded",
  FOLDER_VISIBILITY_INVALID: "rbacErrors.folderVisibilityInvalid",
  FOLDER_SHARE_DENIED: "rbacErrors.folderShareDenied",
  FOLDER_NOT_EMPTY: "rbacErrors.folderNotEmpty",
  INSTRUCTION_IN_USE: "rbacErrors.instructionInUse",
  CREDENTIAL_IN_USE: "rbacErrors.credentialInUse",
  // Generic HTTP-style codes
  NOT_FOUND: "serverErrors.notFound",
  UNAUTHORIZED: "serverErrors.unauthorized",
  FORBIDDEN: "serverErrors.forbidden",
  CONFLICT: "serverErrors.conflict",
  PRECONDITION_FAILED: "serverErrors.preconditionFailed",
  VALIDATION_ERROR: "validationErrors.generic",
  // System / state codes
  WORKSPACE_MISSING: "serverErrors.myWorkspaceMissing",
  MY_WORKSPACE_MISSING: "serverErrors.myWorkspaceMissing",
  VERSION_INACTIVE: "serverErrors.versionInactive",
  WORKFLOW_CREDENTIAL_SETUP_REQUIRED:
    "serverErrors.workflowCredentialSetupRequired",
};

/**
 * Translate a server error payload using the current locale's translator.
 * Looks up the code in CODE_TO_I18N_KEY, interpolating details as params.
 * Returns the server `message` as a fallback when no mapping exists, or a
 * generic fallback when neither is available.
 */
export function translateServerError(
  error: ServerErrorBody | null | undefined,
  t: (key: string, params?: TranslationParams) => string,
  fallback: string,
): string {
  if (!error) return fallback;

  const code = error.code;
  if (code && CODE_TO_I18N_KEY[code]) {
    const params: TranslationParams = {};
    if (error.details) {
      for (const [key, value] of Object.entries(error.details)) {
        if (typeof value === "string" || typeof value === "number") {
          params[key] = value;
        }
      }
    }
    const translated = t(CODE_TO_I18N_KEY[code], params);
    if (translated && translated !== CODE_TO_I18N_KEY[code]) {
      return translated;
    }
  }

  return error.message ?? fallback;
}
