"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

import {
  ArrowRight,
  MessageSquare,
  Plus,
  Repeat,
  Trash2,
  Workflow,
  Zap,
} from "@/components/icons/lucide";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ChainNode {
  id: number;
  step_order: number;
  node_type: string;
  title: string;
  instruction_id: number | null;
  resolved_instruction: string;
}

interface Chain {
  id: number;
  title: string;
  description: string;
  nodes: ChainNode[];
  created_at: string;
}

function NodeBadge({ node }: { node: ChainNode }) {
  const t = node.node_type as "action" | "gate" | "loop";
  const config =
    t === "gate"
      ? {
          Icon: MessageSquare,
          className:
            "border-[color:var(--warm)] bg-[var(--warm-light)] text-[var(--foreground)]",
        }
      : t === "loop"
        ? {
            Icon: Repeat,
            className:
              "border-[var(--border)] bg-transparent text-[var(--muted)]",
          }
        : {
            Icon: Zap,
            className:
              "border-[color:var(--accent)] bg-[var(--accent-light)] text-[var(--accent-dark)]",
          };

  return (
    <Badge className={config.className}>
      <config.Icon className="h-3.5 w-3.5" />
      <span className="truncate">{node.title}</span>
      {node.instruction_id && (
        <span className="opacity-70">#{node.instruction_id}</span>
      )}
    </Badge>
  );
}

export default function ChainsPage() {
  const [chains, setChains] = useState<Chain[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchChains = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/chains");
    const json = await res.json();
    setChains(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchChains();
  }, [fetchChains]);

  const handleDelete = async (id: number) => {
    if (!confirm("이 체인을 삭제하시겠습니까?")) return;
    await fetch(`/api/chains/${id}`, { method: "DELETE" });
    fetchChains();
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Workflow className="h-5 w-5 text-[var(--muted)]" />
          <h1 className="text-2xl font-bold tracking-tight">체인</h1>
        </div>
        <Button asChild size="sm">
          <Link href="/chains/new">
            <Plus className="h-4 w-4" />새 체인
          </Link>
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-[var(--muted)]">
            로딩 중...
          </CardContent>
        </Card>
      ) : chains.length === 0 ? (
        <Card className="border-dashed shadow-none">
          <CardContent className="py-10 text-center text-sm text-[var(--muted)]">
            등록된 체인이 없습니다.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {chains.map((chain) => (
            <Card
              key={chain.id}
              className="transition-shadow hover:shadow-[var(--card-shadow-hover)]"
            >
              <CardHeader className="p-5 pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base">
                      {chain.title}
                    </CardTitle>
                    {chain.description && (
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {chain.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/chains/${chain.id}`}>편집</Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-[var(--destructive)] hover:bg-[var(--destructive-light)]"
                      onClick={() => handleDelete(chain.id)}
                      title="삭제"
                      aria-label={`체인 ${chain.title} 삭제`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="px-5 pb-5 pt-0">
                <div className="flex flex-wrap items-center gap-2">
                  {chain.nodes.map((node, i) => (
                    <div key={node.id} className="flex items-center gap-2">
                      <NodeBadge node={node} />
                      {i < chain.nodes.length - 1 && (
                        <ArrowRight className="h-4 w-4 text-[var(--muted)]" />
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>

              <CardFooter className="px-5 pb-5 pt-0">
                <p className="text-xs text-[var(--muted)]">
                  {chain.nodes.length}개 노드 &middot; {chain.created_at}
                </p>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
