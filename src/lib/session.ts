import { SignJWT, jwtVerify } from "jose";

export interface SessionUser {
  userId: number;
  username: string;
  email: string;
  role: string;
  mustChangePassword: boolean;
}

const DEV_FALLBACK_SECRET = "bluekiwi-dev-secret-change-in-production";

function resolveSecret(): Uint8Array {
  const configured = process.env.JWT_SECRET;
  if (configured && configured.length > 0) {
    return new TextEncoder().encode(configured);
  }
  if (process.env.NODE_ENV === "production") {
    // Fail fast: never boot production with a forgeable default secret.
    throw new Error(
      "JWT_SECRET is not set. Refusing to start in production with a default secret.",
    );
  }
  console.warn(
    "[session] JWT_SECRET not set — using insecure development fallback secret. Do NOT use in production.",
  );
  return new TextEncoder().encode(DEV_FALLBACK_SECRET);
}

const SECRET = resolveSecret();
const EXPIRY = "7d";

export async function createSession(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(SECRET);
}

export async function verifySession(
  token: string,
): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET, {
      algorithms: ["HS256"],
    });
    return {
      userId: payload.userId as number,
      username: payload.username as string,
      email: payload.email as string,
      role: payload.role as string,
      mustChangePassword: (payload.mustChangePassword as boolean) ?? false,
    };
  } catch {
    return null;
  }
}
