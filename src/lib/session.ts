import { SignJWT, jwtVerify } from "jose";

export interface SessionUser {
  userId: number;
  username: string;
  email: string;
  role: string;
  mustChangePassword: boolean;
}

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "bluekiwi-dev-secret-change-in-production",
);
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
    const { payload } = await jwtVerify(token, SECRET);
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
