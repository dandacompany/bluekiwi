"use client";

import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Provider = "none" | "smtp" | "resend";

interface FormState {
  provider: Provider;
  from_email: string;
  from_name: string;
  smtp_host: string;
  smtp_port: string;
  smtp_secure: boolean;
  smtp_user: string;
  smtp_pass: string;
  resend_api_key: string;
}

const DEFAULTS: FormState = {
  provider: "none",
  from_email: "",
  from_name: "",
  smtp_host: "",
  smtp_port: "587",
  smtp_secure: false,
  smtp_user: "",
  smtp_pass: "",
  resend_api_key: "",
};

const GMAIL_PRESET = {
  smtp_host: "smtp.gmail.com",
  smtp_port: "587",
  smtp_secure: false,
};

export function EmailTab() {
  const [form, setForm] = useState<FormState>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/settings/email");
        if (!res.ok) return;
        const data = await res.json();
        setForm({
          provider: data.provider ?? "none",
          from_email: data.from_email ?? "",
          from_name: data.from_name ?? "",
          smtp_host: data.smtp_host ?? "",
          smtp_port: String(data.smtp_port ?? "587"),
          smtp_secure: data.smtp_secure ?? false,
          smtp_user: data.smtp_user ?? "",
          smtp_pass: data.smtp_pass ?? "",
          resend_api_key: data.resend_api_key ?? "",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function set(patch: Partial<FormState>) {
    setForm((f) => ({ ...f, ...patch }));
  }

  function applyGmailPreset() {
    set(GMAIL_PRESET);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/settings/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, smtp_port: Number(form.smtp_port) }),
      });
      if (!res.ok) throw new Error();
      toast.success("이메일 설정이 저장되었습니다.");
    } catch {
      toast.error("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-[var(--muted-foreground)]">
          불러오는 중...
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSave}>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-[var(--muted-foreground)]" />
            <CardTitle>이메일 설정</CardTitle>
          </div>
          <CardDescription>
            초대 메일 발송에 사용할 이메일 공급자를 설정합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Provider */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--foreground)]">
              공급자
            </label>
            <Select
              value={form.provider}
              onValueChange={(v) => set({ provider: v as Provider })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">사용 안 함</SelectItem>
                <SelectItem value="smtp">SMTP (Gmail, Naver 등)</SelectItem>
                <SelectItem value="resend">Resend API</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Common: From */}
          {form.provider !== "none" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[var(--foreground)]">
                  발신자 이름
                </label>
                <Input
                  placeholder="BlueKiwi"
                  value={form.from_name}
                  onChange={(e) => set({ from_name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[var(--foreground)]">
                  발신자 이메일
                </label>
                <Input
                  type="email"
                  placeholder="noreply@example.com"
                  value={form.from_email}
                  onChange={(e) => set({ from_email: e.target.value })}
                  required
                />
              </div>
            </div>
          )}

          {/* SMTP fields */}
          {form.provider === "smtp" && (
            <div className="space-y-4 rounded-xl border border-[var(--border)] p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">SMTP 서버 설정</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={applyGmailPreset}
                >
                  Gmail 기본값 적용
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <label className="text-sm font-medium text-[var(--foreground)]">
                    SMTP 호스트
                  </label>
                  <Input
                    placeholder="smtp.gmail.com"
                    value={form.smtp_host}
                    onChange={(e) => set({ smtp_host: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-[var(--foreground)]">
                    포트
                  </label>
                  <Input
                    type="number"
                    placeholder="587"
                    value={form.smtp_port}
                    onChange={(e) => set({ smtp_port: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[var(--foreground)]">
                  암호화 방식
                </label>
                <Select
                  value={form.smtp_secure ? "tls" : "starttls"}
                  onValueChange={(v) => set({ smtp_secure: v === "tls" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starttls">
                      STARTTLS (포트 587)
                    </SelectItem>
                    <SelectItem value="tls">TLS (포트 465)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-[var(--foreground)]">
                    계정 (이메일)
                  </label>
                  <Input
                    type="email"
                    placeholder="you@gmail.com"
                    value={form.smtp_user}
                    onChange={(e) => set({ smtp_user: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-[var(--foreground)]">
                    앱 비밀번호{" "}
                    <span className="text-xs text-[var(--muted-foreground)]">
                      (Gmail은 앱 비밀번호 사용)
                    </span>
                  </label>
                  <Input
                    type="password"
                    placeholder="앱 비밀번호 입력"
                    value={form.smtp_pass}
                    onChange={(e) => set({ smtp_pass: e.target.value })}
                  />
                </div>
              </div>

              <p className="text-xs text-[var(--muted-foreground)]">
                Gmail은 <strong>2단계 인증 → 앱 비밀번호 생성</strong> 후
                사용하세요. 일반 비밀번호는 동작하지 않습니다.
              </p>
            </div>
          )}

          {/* Resend fields */}
          {form.provider === "resend" && (
            <div className="space-y-3 rounded-xl border border-[var(--border)] p-4">
              <p className="text-sm font-medium">Resend API 설정</p>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[var(--foreground)]">
                  API Key
                </label>
                <Input
                  type="password"
                  placeholder="re_..."
                  value={form.resend_api_key}
                  onChange={(e) => set({ resend_api_key: e.target.value })}
                  required
                />
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={saving}>
              {saving ? "저장 중..." : "저장"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
