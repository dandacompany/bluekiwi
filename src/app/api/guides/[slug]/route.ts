import { readFile } from "fs/promises";
import { join } from "path";
import { NextResponse } from "next/server";

const GUIDES_DIR = join(process.cwd(), "src/content/guides");

type Params = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { slug } = await params;

  // Prevent path traversal
  if (!/^[\w-]+$/.test(slug)) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  try {
    const raw = await readFile(join(GUIDES_DIR, `${slug}.md`), "utf-8");
    // Rewrite relative image paths to public URL
    const content = raw.replace(/\.\.(\/images\/)/g, "/guide-images/");
    return NextResponse.json({ content });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
