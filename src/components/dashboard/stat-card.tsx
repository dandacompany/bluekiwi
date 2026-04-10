import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
  label: string;
  value: number;
  subtitle: string;
  icon: LucideIcon;
  href?: string;
}

export function StatCard({
  label,
  value,
  subtitle,
  icon: Icon,
  href,
}: StatCardProps) {
  const content = (
    <Card
      className={href ? "cursor-pointer transition-shadow hover:shadow-md" : ""}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
            {label}
          </p>
          <Icon className="h-4 w-4 text-[var(--muted-foreground)]" />
        </div>
        <p className="mt-2 text-2xl font-semibold">{value}</p>
        <p className="mt-1 text-[10px] text-[var(--muted-foreground)]">
          {subtitle}
        </p>
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}
