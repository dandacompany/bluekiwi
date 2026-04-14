import { readFile } from "fs/promises";
import { join } from "path";
import { NextResponse } from "next/server";

const PACKAGES_DIR = join(process.cwd(), "src/content/guides/packages");

type Params = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { slug } = await params;

  if (!/^[\w-]+$/.test(slug)) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  try {
    const raw = await readFile(join(PACKAGES_DIR, `${slug}.json`), "utf-8");
    const pkg = JSON.parse(raw) as unknown;
    return NextResponse.json({ data: pkg });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
