const NPM_REGISTRY = "https://registry.npmjs.org/bluekiwi/latest";
const GITHUB_REPO = "dandacompany/bluekiwi";
const FETCH_TIMEOUT_MS = 4000;

async function fetchWithTimeout(url: string): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "bluekiwi-cli" },
    });
    return res;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function getLatestVersion(): Promise<string | null> {
  const res = await fetchWithTimeout(NPM_REGISTRY);
  if (!res || !res.ok) return null;
  const json = (await res.json().catch(() => null)) as {
    version?: string;
  } | null;
  return json?.version ?? null;
}

interface CommitSummary {
  sha: string;
  message: string;
}

async function fetchCompareCommits(
  fromTag: string,
  toTag: string,
): Promise<CommitSummary[] | null> {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/compare/${fromTag}...${toTag}`;
  const res = await fetchWithTimeout(url);
  if (!res || !res.ok) return null;
  const json = (await res.json().catch(() => null)) as {
    commits?: Array<{ sha: string; commit: { message: string } }>;
  } | null;
  if (!json?.commits) return null;
  return json.commits.map((c) => ({
    sha: c.sha.slice(0, 7),
    message: c.commit.message.split("\n")[0],
  }));
}

async function fetchReleaseBody(tag: string): Promise<string | null> {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/releases/tags/${tag}`;
  const res = await fetchWithTimeout(url);
  if (!res || !res.ok) return null;
  const json = (await res.json().catch(() => null)) as {
    body?: string;
  } | null;
  const body = json?.body?.trim() ?? "";
  // GitHub auto-generated bodies are just "**Full Changelog**: ..." — treat as empty
  if (!body || /^\*\*Full Changelog\*\*:/i.test(body)) return null;
  return body;
}

export interface ReleaseNotes {
  tag: string;
  body?: string;
  commits?: CommitSummary[];
  compareUrl: string;
}

export async function getReleaseNotes(
  fromVersion: string,
  toVersion: string,
): Promise<ReleaseNotes | null> {
  const fromTag = `v${fromVersion}`;
  const toTag = `v${toVersion}`;
  const compareUrl = `https://github.com/${GITHUB_REPO}/compare/${fromTag}...${toTag}`;

  const [body, commits] = await Promise.all([
    fetchReleaseBody(toTag),
    fromVersion !== toVersion ? fetchCompareCommits(fromTag, toTag) : null,
  ]);

  if (!body && (!commits || commits.length === 0)) return null;

  return {
    tag: toTag,
    body: body ?? undefined,
    commits: commits ?? undefined,
    compareUrl,
  };
}
