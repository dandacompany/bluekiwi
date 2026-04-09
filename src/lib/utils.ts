export type ClassName = string | false | null | undefined;

export function cn(...inputs: ClassName[]) {
  return inputs.filter(Boolean).join(" ");
}
