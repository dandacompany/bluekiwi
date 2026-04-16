import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

export async function runSqliteMigrations(options: {
  sqlitePath: string;
  migrationsDir?: string;
}): Promise<void> {
  fs.mkdirSync(path.dirname(options.sqlitePath), { recursive: true });

  const db = new Database(options.sqlitePath);
  const migrationsDir =
    options.migrationsDir ??
    path.resolve(process.cwd(), "src/lib/db/migrations/sqlite/sql");

  try {
    db.pragma("foreign_keys = ON");
    db.pragma("journal_mode = WAL");
    db.pragma("busy_timeout = 5000");

    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      )
    `);

    const applied = db
      .prepare("SELECT filename FROM schema_migrations ORDER BY filename")
      .all() as Array<{ filename: string }>;
    const appliedSet = new Set(applied.map((row) => row.filename));

    if (!fs.existsSync(migrationsDir)) {
      console.log("[migrate] No sqlite migrations directory found, skipping.");
      return;
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    let count = 0;
    for (const file of files) {
      if (appliedSet.has(file)) continue;

      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
      console.log(`[migrate] applying sqlite ${file}`);

      const apply = db.transaction(() => {
        db.exec(sql);
        db.prepare(
          "INSERT INTO schema_migrations (filename, applied_at) VALUES (?, ?)",
        ).run(file, new Date().toISOString());
      });

      apply();
      count += 1;
    }

    if (count === 0) {
      console.log(
        `[migrate] sqlite up to date (${files.length} migrations tracked)`,
      );
    } else {
      console.log(`[migrate] applied ${count} sqlite migration(s)`);
    }
  } finally {
    db.close();
  }
}
