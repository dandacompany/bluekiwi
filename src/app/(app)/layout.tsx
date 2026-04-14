import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { verifySession } from "@/lib/session";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const teamName = process.env.TEAM_NAME?.trim() || null;
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  const user = token ? await verifySession(token) : null;

  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");

  return (
    <AppShell user={user} teamName={teamName}>
      {children}
    </AppShell>
  );
}
