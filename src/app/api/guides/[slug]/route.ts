import { readFile } from "fs/promises";
import { join } from "path";
import { NextResponse } from "next/server";

const GUIDES_DIR = join(process.cwd(), "src/content/guides");

type Params = { params: Promise<{ slug: string }> };

export async function GET(req: Request, { params }: Params) {
  const { slug } = await params;
  const { searchParams } = new URL(req.url);
  const lang = searchParams.get("lang") === "en" ? "en" : "ko";

  // Prevent path traversal
  if (!/^[\w-]+$/.test(slug)) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  // Try requested locale first, fall back to "ko"
  const locales = lang === "en" ? ["en", "ko"] : ["ko"];

  for (const locale of locales) {
    try {
      const raw = await readFile(
        join(GUIDES_DIR, locale, `${slug}.md`),
        "utf-8",
      );
      // Rewrite relative image paths to public URL
      const content = raw.replace(/\.\.(\/images\/)/g, "/guide-images/");
      return NextResponse.json({ content });
    } catch {
      // locale not found — try next
    }
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
