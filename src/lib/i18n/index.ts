import ko from "./ko.json";
import en from "./en.json";

export type Locale = "ko" | "en";
export const locales: Locale[] = ["ko", "en"];
export const defaultLocale: Locale = "ko";
export type TranslationParams = Record<string, string | number>;

const dictionaries = { ko, en } as const;

type Dictionary = typeof ko;
type DotPath<T, Prefix extends string = ""> = T extends object
  ? {
      [K in keyof T & string]: DotPath<
        T[K],
        Prefix extends "" ? K : `${Prefix}.${K}`
      >;
    }[keyof T & string]
  : Prefix;

export type TranslationKey = DotPath<Dictionary>;

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries[defaultLocale];
}

export function getNestedValue(
  obj: Record<string, unknown>,
  path: string,
): string {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== "object") return path;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" ? current : path;
}

export function interpolate(value: string, params?: TranslationParams): string {
  if (!params) return value;

  return Object.entries(params).reduce((result, [key, paramValue]) => {
    return result.replaceAll(`{${key}}`, String(paramValue));
  }, value);
}
