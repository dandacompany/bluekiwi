import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { NextResponse } from "next/server";

const GUIDES_DIR = join(process.cwd(), "src/content/guides");

interface GuideMeta {
  slug: string;
  title: string;
  description: string;
}

function extractMeta(content: string, slug: string): GuideMeta {
  const titleMatch = content.match(/^#\s+(.+)$/m);
  // First regular paragraph — skip headings, blockquotes, lists, code fences, blank lines
  const descMatch = content.match(/^(?!#|>|-|\*|\d+\.|```|\s*$)(.{10,})$/m);
  return {
    slug,
    title: titleMatch?.[1]?.trim() ?? slug,
    description: descMatch?.[1]?.trim() ?? "",
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lang = searchParams.get("lang") === "en" ? "en" : "ko";

  // Try requested locale dir first, fall back to "ko"
  const locales = lang === "en" ? ["en", "ko"] : ["ko"];

  for (const locale of locales) {
    const dir = join(GUIDES_DIR, locale);
    try {
      const files = await readdir(dir);
      const guides: GuideMeta[] = [];
      for (const file of files.filter((f) => f.endsWith(".md")).sort()) {
        const slug = file.replace(/\.md$/, "");
        const content = await readFile(join(dir, file), "utf-8");
        guides.push(extractMeta(content, slug));
      }
      return NextResponse.json(guides);
    } catch {
      // locale dir not found or empty — try next
    }
  }

  return NextResponse.json([]);
}
