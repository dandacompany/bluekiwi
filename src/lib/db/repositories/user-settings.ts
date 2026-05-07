import { execute, queryOne } from "@/lib/db";

export async function getUserSetting(
  userId: number,
  key: string,
): Promise<string | null> {
  const row = await queryOne<{ value: string }>(
    "SELECT value FROM user_settings WHERE user_id = $1 AND key = $2 LIMIT 1",
    [userId, key],
  );
  return row?.value ?? null;
}

export async function setUserSetting(
  userId: number,
  key: string,
  value: string,
): Promise<void> {
  await execute(
    `INSERT INTO user_settings (user_id, key, value, updated_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, key)
     DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [userId, key, value, new Date().toISOString()],
  );
}

export async function deleteUserSetting(
  userId: number,
  key: string,
): Promise<void> {
  await execute("DELETE FROM user_settings WHERE user_id = $1 AND key = $2", [
    userId,
    key,
  ]);
}
