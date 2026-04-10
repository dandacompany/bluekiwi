import { describe, it, expect } from "vitest";
import { translateServerError } from "../src/lib/i18n/server-errors";
import {
  getDictionary,
  getNestedValue,
  interpolate,
  type TranslationParams,
} from "../src/lib/i18n";

function makeT(locale: "ko" | "en") {
  const dict = getDictionary(locale) as unknown as Record<string, unknown>;
  return (key: string, params?: TranslationParams) =>
    interpolate(getNestedValue(dict, key), params);
}

describe("translateServerError", () => {
  const tKo = makeT("ko");
  const tEn = makeT("en");

  it("translates known code with details (ko)", () => {
    const msg = translateServerError(
      {
        code: "INSTRUCTION_IN_USE",
        message: "server fallback",
        details: { count: 3 },
      },
      tKo,
      "default",
    );
    expect(msg).toContain("3개");
    expect(msg).toContain("지침");
  });

  it("translates known code with details (en)", () => {
    const msg = translateServerError(
      {
        code: "CREDENTIAL_IN_USE",
        message: "server fallback",
        details: { count: 7 },
      },
      tEn,
      "default",
    );
    expect(msg).toContain("7");
    expect(msg).toContain("workflow node");
  });

  it("falls back to server message for unknown code", () => {
    const msg = translateServerError(
      { code: "TOTALLY_UNKNOWN", message: "원본 서버 메시지" },
      tKo,
      "default",
    );
    expect(msg).toBe("원본 서버 메시지");
  });

  it("falls back to default when neither code nor message exists", () => {
    const msg = translateServerError({}, tKo, "default fallback");
    expect(msg).toBe("default fallback");
  });

  it("handles null error", () => {
    const msg = translateServerError(null, tKo, "default fallback");
    expect(msg).toBe("default fallback");
  });

  it("translates known code without details", () => {
    const msg = translateServerError(
      { code: "OWNERSHIP_REQUIRED" },
      tKo,
      "default",
    );
    expect(msg).toBe("소유자 권한이 필요합니다");
  });
});
