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
  const descMatch = content.match(/^>\s+(.+)$/m);
  return {
    slug,
    title: titleMatch?.[1]?.trim() ?? slug,
    description: descMatch?.[1]?.trim() ?? "",
  };
}

export async function GET() {
  try {
    const files = await readdir(GUIDES_DIR);
    const guides: GuideMeta[] = [];
    for (const file of files.filter((f) => f.endsWith(".md")).sort()) {
      const slug = file.replace(/\.md$/, "");
      const content = await readFile(join(GUIDES_DIR, file), "utf-8");
      guides.push(extractMeta(content, slug));
    }
    return NextResponse.json(guides);
  } catch {
    return NextResponse.json([]);
  }
}
