#!/usr/bin/env -S npx tsx
import { Pool } from "pg";
import { randomBytes, createHash } from "crypto";
import bcrypt from "bcryptjs";
import { createInterface } from "readline/promises";

// ─── DB ───

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://bluekiwi:bluekiwi_dev_2026@localhost:5433/bluekiwi";

const pool = new Pool({ connectionString: DATABASE_URL, max: 5 });

// ─── Helpers ───

function die(msg: string): never {
  console.error(`Error: ${msg}`);
  process.exit(1);
}

function getFlag(name: string): string | undefined {
  const prefix = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function generateApiKey(): { rawKey: string; prefix: string; keyHash: string } {
  const bytes = randomBytes(32);
  const rawKey = "bk_" + bytes.toString("base64url");
  const prefix = rawKey.slice(0, 10);
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  return { rawKey, prefix, keyHash };
}

// ─── Commands ───

async function superuserCreate() {
  const force = hasFlag("force");

  // Check if superuser already exists
  const { rows: existing } = await pool.query(
    "SELECT id, username FROM users WHERE role = 'superuser' LIMIT 1",
  );
  if (existing.length > 0 && !force) {
    die(
      `Superuser already exists: ${existing[0].username} (id=${existing[0].id}). Use --force to create another.`,
    );
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const username = await rl.question("Username: ");
    if (!username.trim()) die("Username is required");

    const email = await rl.question("Email (optional): ");

    const password = await rl.question("Password (min 8 chars): ");
    if (password.length < 8) die("Password must be at least 8 characters");

    const passwordHash = await bcrypt.hash(password, 12);

    const { rows } = await pool.query(
      "INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, 'superuser') RETURNING id, username",
      [username.trim(), email.trim() || null, passwordHash],
    );

    console.log(`\nSuperuser created: ${rows[0].username} (id=${rows[0].id})`);
  } finally {
    rl.close();
  }
}

async function userAdd() {
  const username = getFlag("username");
  const email = getFlag("email");
  const password = getFlag("password");
  const role = getFlag("role") ?? "editor";

  if (!username) die("--username is required");
  if (!password) die("--password is required");
  if (!["admin", "editor", "viewer"].includes(role)) {
    die(
      "--role must be admin, editor, or viewer (use 'superuser create' for superuser)",
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const { rows } = await pool.query(
    "INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, username, role",
    [username.trim(), email?.trim() || null, passwordHash, role],
  );

  console.log(
    `User created: ${rows[0].username} (id=${rows[0].id}, role=${rows[0].role})`,
  );
}

async function userList() {
  const { rows } = await pool.query(
    "SELECT id, username, email, role, is_active, created_at FROM users ORDER BY id ASC",
  );

  if (rows.length === 0) {
    console.log("No users found.");
    return;
  }

  console.log(
    "\n" +
      ["ID", "Username", "Email", "Role", "Active", "Created"]
        .map((h) => h.padEnd(18))
        .join(""),
  );
  console.log("-".repeat(108));
  for (const u of rows) {
    console.log(
      [
        String(u.id).padEnd(18),
        (u.username ?? "").padEnd(18),
        (u.email ?? "-").padEnd(18),
        u.role.padEnd(18),
        (u.is_active ? "yes" : "no").padEnd(18),
        new Date(u.created_at).toISOString().slice(0, 10).padEnd(18),
      ].join(""),
    );
  }
  console.log(`\nTotal: ${rows.length}`);
}

async function userRemove() {
  const username = process.argv[4];
  if (!username) die("Usage: bluekiwi user remove <username> [--hard]");

  const hard = hasFlag("hard");

  if (hard) {
    const { rowCount } = await pool.query(
      "DELETE FROM users WHERE username = $1",
      [username],
    );
    if (rowCount === 0) die(`User not found: ${username}`);
    console.log(`User permanently deleted: ${username}`);
  } else {
    const { rowCount } = await pool.query(
      "UPDATE users SET is_active = false, updated_at = NOW() WHERE username = $1",
      [username],
    );
    if (rowCount === 0) die(`User not found: ${username}`);
    console.log(`User deactivated: ${username}`);
  }
}

async function apikeyCreate() {
  const userIdStr = getFlag("user-id");
  if (!userIdStr) die("--user-id is required");
  const userId = Number(userIdStr);
  if (Number.isNaN(userId)) die("--user-id must be a number");

  const name = getFlag("name") ?? "";
  const expiresDays = getFlag("expires");

  // Verify user exists
  const { rows: userRows } = await pool.query(
    "SELECT id, username FROM users WHERE id = $1 AND is_active = true",
    [userId],
  );
  if (userRows.length === 0) die(`Active user not found: id=${userId}`);

  const { rawKey, prefix, keyHash } = generateApiKey();

  let expiresAt: string | null = null;
  if (expiresDays) {
    const days = Number(expiresDays);
    if (Number.isNaN(days) || days <= 0)
      die("--expires must be a positive number (days)");
    expiresAt = new Date(Date.now() + days * 86400000).toISOString();
  }

  const { rows } = await pool.query(
    "INSERT INTO api_keys (user_id, key_hash, prefix, name, expires_at) VALUES ($1, $2, $3, $4, $5) RETURNING id",
    [userId, keyHash, prefix, name, expiresAt],
  );

  console.log(`\nAPI Key created for ${userRows[0].username}:`);
  console.log(`  ID:      ${rows[0].id}`);
  console.log(`  Prefix:  ${prefix}`);
  console.log(`  Name:    ${name || "(none)"}`);
  console.log(`  Expires: ${expiresAt ?? "never"}`);
  console.log(`\n  Raw Key (save this — shown only once):`);
  console.log(`  ${rawKey}\n`);
}

async function apikeyList() {
  const userIdStr = getFlag("user-id");
  const params: unknown[] = [];
  let where = "";

  if (userIdStr) {
    where = " WHERE ak.user_id = $1";
    params.push(Number(userIdStr));
  }

  const { rows } = await pool.query(
    `SELECT ak.id, ak.prefix, ak.name, ak.user_id, u.username,
            ak.last_used_at, ak.expires_at, ak.is_revoked, ak.created_at
     FROM api_keys ak JOIN users u ON ak.user_id = u.id${where}
     ORDER BY ak.id ASC`,
    params,
  );

  if (rows.length === 0) {
    console.log("No API keys found.");
    return;
  }

  console.log(
    "\n" +
      ["ID", "Prefix", "Name", "User", "LastUsed", "Expires", "Revoked"]
        .map((h) => h.padEnd(16))
        .join(""),
  );
  console.log("-".repeat(112));
  for (const k of rows) {
    console.log(
      [
        String(k.id).padEnd(16),
        k.prefix.padEnd(16),
        (k.name || "-").padEnd(16),
        k.username.padEnd(16),
        (k.last_used_at
          ? new Date(k.last_used_at).toISOString().slice(0, 16)
          : "-"
        ).padEnd(16),
        (k.expires_at
          ? new Date(k.expires_at).toISOString().slice(0, 10)
          : "never"
        ).padEnd(16),
        (k.is_revoked ? "YES" : "no").padEnd(16),
      ].join(""),
    );
  }
  console.log(`\nTotal: ${rows.length}`);
}

async function apikeyRevoke() {
  const idStr = process.argv[4];
  if (!idStr) die("Usage: bluekiwi apikey revoke <id>");
  const id = Number(idStr);
  if (Number.isNaN(id)) die("API key ID must be a number");

  const { rowCount } = await pool.query(
    "UPDATE api_keys SET is_revoked = true WHERE id = $1",
    [id],
  );
  if (rowCount === 0) die(`API key not found: id=${id}`);
  console.log(`API key revoked: id=${id}`);
}

function printUsage() {
  console.log(`
BlueKiwi CLI

Usage: npx tsx scripts/cli.ts <command> [subcommand] [options]

Commands:
  superuser create              Create first superuser (interactive)
  user add                      Add user (--username, --password, --email, --role)
  user list                     List all users
  user remove <username>        Deactivate user (--hard to delete)
  apikey create                 Create API key (--user-id, --name, --expires)
  apikey list                   List API keys (--user-id to filter)
  apikey revoke <id>            Revoke API key
  seed                          Run seed data

Options:
  --force                       Force operation (e.g., create another superuser)
  --hard                        Hard delete instead of soft delete
`);
}

// ─── Main ───

async function main() {
  const cmd = process.argv[2];
  const sub = process.argv[3];

  try {
    switch (cmd) {
      case "superuser":
        if (sub === "create") await superuserCreate();
        else die(`Unknown: superuser ${sub}. Did you mean 'superuser create'?`);
        break;

      case "user":
        switch (sub) {
          case "add":
            await userAdd();
            break;
          case "list":
            await userList();
            break;
          case "remove":
            await userRemove();
            break;
          default:
            die(`Unknown: user ${sub}. Options: add, list, remove`);
        }
        break;

      case "apikey":
        switch (sub) {
          case "create":
            await apikeyCreate();
            break;
          case "list":
            await apikeyList();
            break;
          case "revoke":
            await apikeyRevoke();
            break;
          default:
            die(`Unknown: apikey ${sub}. Options: create, list, revoke`);
        }
        break;

      case "seed":
        console.log("Run: bash scripts/seed.sh");
        break;

      default:
        printUsage();
        break;
    }
  } finally {
    await pool.end();
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
