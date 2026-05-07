import { existsSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let sqlitePath: string;
let query: typeof import("../src/lib/db").query;
let queryOne: typeof import("../src/lib/db").queryOne;
let createDesignSystem: typeof import("../src/lib/db/repositories/design-systems").createDesignSystem;
let createDesignSystemVersion: typeof import("../src/lib/db/repositories/design-systems").createDesignSystemVersion;
let listDesignSystemsForVisibilityFilter: typeof import("../src/lib/db/repositories/design-systems").listDesignSystemsForVisibilityFilter;
let getDesignSystemDetail: typeof import("../src/lib/db/repositories/design-systems").getDesignSystemDetail;
let getDesignSystemSectionValue: typeof import("../src/lib/db/repositories/design-systems").getDesignSystemSectionValue;
let getDesignSystemSectionEntryValue: typeof import("../src/lib/db/repositories/design-systems").getDesignSystemSectionEntryValue;
let getDesignSystemComponentValue: typeof import("../src/lib/db/repositories/design-systems").getDesignSystemComponentValue;
let updateDesignSystemSection: typeof import("../src/lib/db/repositories/design-systems").updateDesignSystemSection;
let clearDesignSystemSection: typeof import("../src/lib/db/repositories/design-systems").clearDesignSystemSection;
let upsertDesignSystemSectionEntry: typeof import("../src/lib/db/repositories/design-systems").upsertDesignSystemSectionEntry;
let deleteDesignSystemSectionEntry: typeof import("../src/lib/db/repositories/design-systems").deleteDesignSystemSectionEntry;
let upsertDesignSystemComponent: typeof import("../src/lib/db/repositories/design-systems").upsertDesignSystemComponent;
let deleteDesignSystemComponent: typeof import("../src/lib/db/repositories/design-systems").deleteDesignSystemComponent;
let addDesignSystemAsset: typeof import("../src/lib/db/repositories/design-systems").addDesignSystemAsset;
let deleteDesignSystemAsset: typeof import("../src/lib/db/repositories/design-systems").deleteDesignSystemAsset;
let setUserSetting: typeof import("../src/lib/db/repositories/user-settings").setUserSetting;
let getUserSetting: typeof import("../src/lib/db/repositories/user-settings").getUserSetting;
let deleteUserSetting: typeof import("../src/lib/db/repositories/user-settings").deleteUserSetting;

let ownerId: number;
let folderId: number;
let designSystemId: number;

async function createFixtureUser(): Promise<void> {
  const user = await queryOne<{ id: number }>(
    `INSERT INTO users (username, email, password_hash, role)
     VALUES ($1, $2, 'x', 'editor')
     RETURNING id`,
    ["ds_repo_user", "ds_repo_user@example.test"],
  );
  ownerId = user!.id;

  const folder = await queryOne<{ id: number }>(
    `INSERT INTO folders (name, description, owner_id, visibility, is_system)
     VALUES ('My Workspace', '', $1, 'personal', true)
     RETURNING id`,
    [ownerId],
  );
  folderId = folder!.id;
}

beforeAll(async () => {
  sqlitePath = join(
    tmpdir(),
    `bluekiwi-design-system-repo-${process.pid}-${Date.now()}.sqlite`,
  );
  process.env.DB_TYPE = "sqlite";
  process.env.SQLITE_PATH = sqlitePath;

  const db = await import("../src/lib/db");
  const designSystems = await import(
    "../src/lib/db/repositories/design-systems"
  );
  const userSettings = await import("../src/lib/db/repositories/user-settings");

  query = db.query;
  queryOne = db.queryOne;
  createDesignSystem = designSystems.createDesignSystem;
  createDesignSystemVersion = designSystems.createDesignSystemVersion;
  listDesignSystemsForVisibilityFilter =
    designSystems.listDesignSystemsForVisibilityFilter;
  getDesignSystemDetail = designSystems.getDesignSystemDetail;
  getDesignSystemSectionValue = designSystems.getDesignSystemSectionValue;
  getDesignSystemSectionEntryValue =
    designSystems.getDesignSystemSectionEntryValue;
  getDesignSystemComponentValue = designSystems.getDesignSystemComponentValue;
  updateDesignSystemSection = designSystems.updateDesignSystemSection;
  clearDesignSystemSection = designSystems.clearDesignSystemSection;
  upsertDesignSystemSectionEntry =
    designSystems.upsertDesignSystemSectionEntry;
  deleteDesignSystemSectionEntry =
    designSystems.deleteDesignSystemSectionEntry;
  upsertDesignSystemComponent = designSystems.upsertDesignSystemComponent;
  deleteDesignSystemComponent = designSystems.deleteDesignSystemComponent;
  addDesignSystemAsset = designSystems.addDesignSystemAsset;
  deleteDesignSystemAsset = designSystems.deleteDesignSystemAsset;
  setUserSetting = userSettings.setUserSetting;
  getUserSetting = userSettings.getUserSetting;
  deleteUserSetting = userSettings.deleteUserSetting;

  await createFixtureUser();
});

afterAll(() => {
  for (const path of [sqlitePath, `${sqlitePath}-shm`, `${sqlitePath}-wal`]) {
    if (existsSync(path)) rmSync(path, { force: true });
  }
});

describe("design-system repository integration", () => {
  it("creates systems with taxonomy and supports list filters", async () => {
    const created = await createDesignSystem({
      title: "Repository Test System",
      slug: "repository-test-system",
      description: "A system for category-level agent tests.",
      category: "Developer Tools",
      surface: "web",
      schema: { version: "1.0", mediums: ["web"] },
      colorTokens: {
        canvas: "#FAFAFA",
        surface: "#FFFFFF",
        ink: "#171717",
        line: "#E5E7EB",
        accent: "#2563EB",
      },
      typographyTokens: {
        body: { family: "Geist", size: "15px" },
        heading: { family: "Geist", weight: 650 },
        label: { family: "Geist", size: "12px" },
      },
      componentTokens: {
        Button: {
          framework: "shadcn",
          style_system: "shadcn/ui + Tailwind CSS",
          description: "Primary command button.",
          states: ["default", "hover", "focus-visible", "disabled"],
          variants: ["default", "secondary"],
          preview: {
            html: "<button class=\"bk-button\">Run</button>",
            css: ".bk-button{height:36px;border-radius:6px}",
          },
        },
      },
      guidelinesMarkdown: "## Principles\n\nKeep workflows precise.",
      skillMarkdown: "Use this system for developer workflow surfaces.",
      ownerId,
      folderId,
    });

    designSystemId = created.id;
    expect(created.category).toBe("Developer Tools");
    expect(created.surface).toBe("web");
    expect(getDesignSystemSectionValue(created, "colors")).toMatchObject({
      accent: "#2563EB",
    });

    const filtered = await listDesignSystemsForVisibilityFilter({
      filterSql: "ds.owner_id = $1",
      filterParams: [ownerId],
      category: "developer tools",
      surface: "web",
      q: "repository",
    });

    expect(filtered.map((system) => system.id)).toContain(designSystemId);
  });

  it("updates and clears category sections without replacing the full system", async () => {
    const withAccent = await upsertDesignSystemSectionEntry({
      id: designSystemId,
      section: "colors",
      key: "focus",
      value: "#0F766E",
    });
    expect(getDesignSystemSectionEntryValue(withAccent, "palette", "focus")).toBe(
      "#0F766E",
    );

    const withFonts = await updateDesignSystemSection({
      id: designSystemId,
      section: "typography",
      mode: "merge",
      value: {
        mono: { family: "JetBrains Mono", size: "13px" },
      },
    });
    expect(getDesignSystemSectionValue(withFonts, "fonts")).toMatchObject({
      mono: { family: "JetBrains Mono" },
    });

    const withoutFocus = await deleteDesignSystemSectionEntry({
      id: designSystemId,
      section: "colors",
      key: "focus",
    });
    expect(
      getDesignSystemSectionEntryValue(withoutFocus, "colors", "focus"),
    ).toBeNull();

    const cleared = await clearDesignSystemSection({
      id: designSystemId,
      section: "guidelines",
    });
    expect(getDesignSystemSectionValue(cleared, "guidelines")).toBe("");
  });

  it("upserts and deletes individual component documents", async () => {
    const withComponent = await upsertDesignSystemComponent({
      id: designSystemId,
      name: "CommandPalette",
      value: {
        framework: "react",
        style_system: "React + Tailwind CSS",
        description: "Fast command search for agent workflows.",
        props: [{ name: "open", type: "boolean" }],
        variants: ["default", "compact"],
        states: ["default", "focus-visible", "loading", "empty"],
        tailwind: {
          classes: ["rounded-md", "border", "bg-popover"],
        },
        preview: {
          html: "<div class=\"bk-command\">Search commands...</div>",
          css: ".bk-command{border:1px solid #E5E7EB;padding:12px}",
        },
        source: {
          react:
            "export function CommandPalette(){ return <div>Search commands...</div>; }",
        },
      },
    });

    const component = getDesignSystemComponentValue(
      withComponent,
      "CommandPalette",
    );
    expect(component?.document?.framework).toBe("react");
    expect(component?.document?.states).toContain("focus-visible");

    const withoutComponent = await deleteDesignSystemComponent({
      id: designSystemId,
      name: "CommandPalette",
    });
    expect(
      getDesignSystemComponentValue(withoutComponent, "CommandPalette"),
    ).toBeNull();
  });

  it("adds and deletes assets through the asset-specific path", async () => {
    const asset = await addDesignSystemAsset({
      designSystemId,
      kind: "css",
      filename: "repo-test.css",
      mimeType: "text/css",
      contentText: ":root{--accent:#2563EB}",
    });
    let detail = await getDesignSystemDetail(designSystemId);
    expect(detail?.assets.map((item) => item.filename)).toContain(
      "repo-test.css",
    );

    await deleteDesignSystemAsset({
      designSystemId,
      assetId: asset.id,
    });
    detail = await getDesignSystemDetail(designSystemId);
    expect(detail?.assets.map((item) => item.filename)).not.toContain(
      "repo-test.css",
    );
  });

  it("creates versions and keeps only the latest version active", async () => {
    const source = await getDesignSystemDetail(designSystemId);
    const next = await createDesignSystemVersion({
      source: source!,
      version: "1.1",
      guidelinesMarkdown: "## Principles\n\nVersioned update.",
      colorTokens: {
        accent: "#0F766E",
      },
      copyAssets: false,
    });

    expect(next.version).toBe("1.1");
    expect(next.parent_design_system_id).toBe(designSystemId);
    expect(next.family_root_id).toBe(source!.family_root_id);
    expect(next.is_active).toBe(true);

    const previous = await getDesignSystemDetail(designSystemId);
    expect(previous?.is_active).toBe(false);

    const activeOnly = await listDesignSystemsForVisibilityFilter({
      filterSql: "ds.owner_id = $1",
      filterParams: [ownerId],
      q: "repository-test-system",
    });
    expect(activeOnly.map((system) => system.id)).toEqual([next.id]);

    designSystemId = next.id;
  });

  it("stores active design-system context as a user setting", async () => {
    await setUserSetting(
      ownerId,
      "active_design_system_id",
      String(designSystemId),
    );
    await expect(
      getUserSetting(ownerId, "active_design_system_id"),
    ).resolves.toBe(String(designSystemId));

    await deleteUserSetting(ownerId, "active_design_system_id");
    await expect(
      getUserSetting(ownerId, "active_design_system_id"),
    ).resolves.toBeNull();
  });
});
