import { NextResponse } from "next/server";
import pkg from "../../../../package.json";

const RELEASES_URL =
  "https://api.github.com/repos/dandacompany/bluekiwi/releases/latest";

export const runtime = "nodejs";

export async function GET() {
  const current = pkg.version;

  try {
    const res = await fetch(RELEASES_URL, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(process.env.GITHUB_TOKEN
          ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
          : {}),
      },
      next: { revalidate: 3600 }, // 1시간 캐시
    });

    if (!res.ok) {
      return NextResponse.json({ current, latest: null, hasUpdate: false });
    }

    const data = (await res.json()) as {
      tag_name: string;
      html_url: string;
      name: string;
    };

    const latest = data.tag_name.replace(/^v/, "");
    const releaseUrl = data.html_url;
    const hasUpdate = isNewer(latest, current);

    return NextResponse.json({ current, latest, hasUpdate, releaseUrl });
  } catch {
    return NextResponse.json({ current, latest: null, hasUpdate: false });
  }
}

/** semver 대소 비교: a > b → true */
function isNewer(a: string, b: string): boolean {
  const parse = (v: string) => v.split(".").map(Number);
  const [aMaj, aMin, aPat] = parse(a);
  const [bMaj, bMin, bPat] = parse(b);
  if (aMaj !== bMaj) return aMaj > bMaj;
  if (aMin !== bMin) return aMin > bMin;
  return aPat > bPat;
}
