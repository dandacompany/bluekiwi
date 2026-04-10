"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/lib/i18n/context";

interface InviteInfo {
  email: string;
  role: string;
  inviter?: string;
  expires_at: string;
}

export default function InvitePage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token } = useParams<{ token: string }>();

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [result, setResult] = useState<{
    api_key: string;
    server_url: string;
  } | null>(null);

  useEffect(() => {
    fetch(`/api/invites/accept/${token}`)
      .then(async (response) => {
        if (response.ok) {
          setInvite(await response.json());
          return;
        }
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error ?? "network_error");
      })
      .catch(() => setError("network_error"));
  }, [token]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    const response = await fetch(`/api/invites/accept/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = (await response.json()) as {
      api_key?: string;
      server_url?: string;
      error?: string;
    };

    if (!response.ok) {
      setError(data.error ?? "network_error");
      return;
    }

    setResult({
      api_key: data.api_key ?? "",
      server_url: data.server_url ?? "http://localhost:3100",
    });
  }

  if (error) {
    return (
      <main className="mx-auto max-w-md px-4 py-20">
        <Card>
          <CardContent className="py-10 text-center text-sm">
            {t(`invite.error.${error}`)}
          </CardContent>
        </Card>
      </main>
    );
  }

  if (result) {
    const command = `npx bluekiwi accept ${token} --server ${result.server_url}`;

    return (
      <main className="mx-auto max-w-md px-4 py-20">
        <Card>
          <CardHeader>
            <CardTitle>{t("invite.success.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm">{t("invite.success.installHint")}</p>
            <pre className="rounded-xl bg-[var(--muted)] p-3 text-xs">
              {command}
            </pre>
            <Button onClick={() => navigator.clipboard.writeText(command)}>
              {t("common.copy")}
            </Button>
            <Button variant="outline" onClick={() => router.push("/login")}>
              {t("invite.success.goLogin")}
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!invite) {
    return (
      <main className="mx-auto max-w-md px-4 py-20 text-center text-sm">
        {t("common.loading")}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 py-20">
      <Card>
        <CardHeader>
          <CardTitle>{t("invite.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm">
            {t("invite.body", { email: invite.email, role: invite.role })}
          </p>
          <form onSubmit={onSubmit} className="space-y-3">
            <Input
              placeholder={t("invite.username")}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
            <Input
              type="password"
              placeholder={t("invite.password")}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <Button type="submit" className="w-full">
              {t("invite.accept")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
