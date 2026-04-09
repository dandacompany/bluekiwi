"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Pause,
  Play,
  Plus,
  Repeat,
  Trash2,
  Zap,
} from "@/components/icons/lucide";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";

interface InstructionOption {
  id: number;
  title: string;
  content: string;
}

interface CredentialOption {
  id: number;
  service_name: string;
  title: string;
}

interface NodeDraft {
  key: string; // 클라이언트 임시 ID
  title: string;
  node_type: "action" | "gate" | "loop";
  source: "inline" | "reference";
  instruction: string;
  instruction_id: number | null;
  credential_id: number | null;
  loop_back_to: number | null;
  auto_advance: boolean;
}

const NODE_TYPES = [
  { value: "action", label: "Action", desc: "지침을 수행하고 결과 보고" },
  { value: "gate", label: "Gate", desc: "사용자 입력 대기" },
  { value: "loop", label: "Loop", desc: "조건 충족까지 반복" },
] as const;

const TYPE_STYLE: Record<string, string> = {
  action: "border-[color:var(--accent)]",
  gate: "border-[color:var(--warm)]",
  loop: "border-[var(--border)]",
};

const TYPE_BADGE: Record<string, string> = {
  action:
    "border-[color:var(--accent)] bg-[var(--accent-light)] text-[var(--accent-dark)]",
  gate: "border-[color:var(--warm)] bg-[var(--warm-light)] text-[var(--foreground)]",
  loop: "border-[var(--border)] bg-transparent text-[var(--muted)]",
};

function newKey() {
  return Math.random().toString(36).slice(2, 10);
}

export default function ChainEditor({ chainId }: { chainId: number | null }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [nodes, setNodes] = useState<NodeDraft[]>([]);
  const [instructions, setInstructions] = useState<InstructionOption[]>([]);
  const [credentials, setCredentials] = useState<CredentialOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [creatingInstructionFor, setCreatingInstructionFor] = useState<
    number | null
  >(null);
  const [newInstTitle, setNewInstTitle] = useState("");
  const [newInstContent, setNewInstContent] = useState("");
  const [savingInst, setSavingInst] = useState(false);

  // 재사용 가능한 지침 목록 로드
  useEffect(() => {
    fetch("/api/instructions")
      .then((r) => r.json())
      .then((json) => setInstructions(json.data ?? []));
    fetch("/api/credentials")
      .then((r) => r.json())
      .then((json) => setCredentials(json.data ?? []));
  }, []);

  // 기존 체인 로드
  const loadChain = useCallback(async () => {
    if (!chainId) return;
    const res = await fetch(`/api/chains/${chainId}`);
    if (!res.ok) return;
    const json = await res.json();
    const chain = json.data;
    setTitle(chain.title);
    setDescription(chain.description);
    setNodes(
      chain.nodes.map(
        (n: {
          title: string;
          node_type: string;
          instruction: string;
          instruction_id: number | null;
          credential_id: number | null;
          loop_back_to: number | null;
          auto_advance: number;
        }) => ({
          key: newKey(),
          title: n.title,
          node_type: n.node_type as NodeDraft["node_type"],
          source: n.instruction_id ? "reference" : "inline",
          instruction: n.instruction,
          instruction_id: n.instruction_id,
          credential_id: n.credential_id,
          loop_back_to: n.loop_back_to,
          auto_advance: !!n.auto_advance,
        }),
      ),
    );
  }, [chainId]);

  useEffect(() => {
    loadChain();
  }, [loadChain]);

  const addNode = () => {
    setNodes([
      ...nodes,
      {
        key: newKey(),
        title: "",
        node_type: "action",
        source: "inline",
        instruction: "",
        instruction_id: null,
        credential_id: null,
        loop_back_to: null,
        auto_advance: false,
      },
    ]);
  };

  const removeNode = (index: number) => {
    setNodes(nodes.filter((_, i) => i !== index));
  };

  const updateNode = (index: number, updates: Partial<NodeDraft>) => {
    setNodes(nodes.map((n, i) => (i === index ? { ...n, ...updates } : n)));
  };

  const moveNode = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= nodes.length) return;
    const copy = [...nodes];
    [copy[index], copy[target]] = [copy[target], copy[index]];
    setNodes(copy);
  };

  const handleCreateInstruction = async (nodeIndex: number) => {
    if (!newInstTitle.trim()) return;
    setSavingInst(true);
    const res = await fetch("/api/instructions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newInstTitle.trim(),
        content: newInstContent.trim(),
      }),
    });
    if (res.ok) {
      const json = await res.json();
      const created = json.data as InstructionOption;
      setInstructions((prev) => [...prev, created]);
      updateNode(nodeIndex, { instruction_id: created.id });
      setCreatingInstructionFor(null);
      setNewInstTitle("");
      setNewInstContent("");
    }
    setSavingInst(false);
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);

    const payload = {
      title,
      description,
      nodes: nodes.map((n) => ({
        title: n.title,
        node_type: n.node_type,
        instruction: n.source === "inline" ? n.instruction : "",
        instruction_id: n.source === "reference" ? n.instruction_id : null,
        credential_id: n.credential_id,
        loop_back_to: n.node_type === "loop" ? n.loop_back_to : null,
        auto_advance: n.auto_advance,
      })),
    };

    const url = chainId ? `/api/chains/${chainId}` : "/api/chains";
    const method = chainId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      router.push("/chains");
    }
    setSaving(false);
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">
        {chainId ? "체인 편집" : "새 체인 만들기"}
      </h1>

      {/* 기본 정보 */}
      <Card className="mb-8">
        <CardHeader className="p-5 pb-0">
          <CardTitle className="text-sm">기본 정보</CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <div className="grid gap-4">
            <Input
              placeholder="체인 제목"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-base font-medium"
              required
            />
            <Input
              placeholder="설명 (선택)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* 노드 목록 */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">노드 ({nodes.length})</h2>
        <Button onClick={addNode} size="sm">
          <Plus className="h-4 w-4" />
          노드 추가
        </Button>
      </div>

      {nodes.length === 0 ? (
        <Card className="border-dashed shadow-none">
          <CardContent className="py-12 text-center">
            <p className="mb-4 text-sm text-[var(--muted)]">
              아직 노드가 없습니다
            </p>
            <Button onClick={addNode} size="sm">
              <Plus className="h-4 w-4" />첫 번째 노드 추가
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {nodes.map((node, i) => {
            const TypeIcon =
              node.node_type === "gate"
                ? MessageSquare
                : node.node_type === "loop"
                  ? Repeat
                  : Zap;

            return (
              <Card
                key={node.key}
                className={`border-2 ${TYPE_STYLE[node.node_type] ?? "border-[var(--border)]"}`}
              >
                <CardContent className="p-5">
                  {/* 노드 헤더 */}
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="w-7 text-center font-mono text-sm text-[var(--muted)]">
                        {i + 1}
                      </span>
                      <Badge className={TYPE_BADGE[node.node_type]}>
                        <TypeIcon className="h-3.5 w-3.5" />
                        {node.node_type}
                      </Badge>

                      <Input
                        placeholder="노드 제목"
                        value={node.title}
                        onChange={(e) =>
                          updateNode(i, { title: e.target.value })
                        }
                        className="h-9 min-w-[220px] flex-1"
                      />

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => moveNode(i, -1)}
                          disabled={i === 0}
                          title="위로"
                          aria-label="위로 이동"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => moveNode(i, 1)}
                          disabled={i === nodes.length - 1}
                          title="아래로"
                          aria-label="아래로 이동"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-[var(--destructive)] hover:bg-[var(--destructive-light)]"
                          onClick={() => removeNode(i)}
                          title="삭제"
                          aria-label="노드 삭제"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <Toggle
                        pressed={node.auto_advance}
                        onPressedChange={(pressed) =>
                          updateNode(i, { auto_advance: pressed })
                        }
                        size="sm"
                        className={
                          node.auto_advance
                            ? "border-[color:var(--accent)]"
                            : undefined
                        }
                        title="auto_advance"
                      >
                        {node.auto_advance ? (
                          <Play className="h-4 w-4" />
                        ) : (
                          <Pause className="h-4 w-4" />
                        )}
                        <span className="hidden sm:inline">
                          {node.auto_advance ? "자동" : "수동"}
                        </span>
                      </Toggle>

                      <Select
                        value={node.credential_id ?? ""}
                        onChange={(e) =>
                          updateNode(i, {
                            credential_id: e.target.value
                              ? Number(e.target.value)
                              : null,
                          })
                        }
                        className="h-9 w-48"
                        title="Credential"
                      >
                        <option value="">Credential 없음</option>
                        {credentials.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.title} ({c.service_name})
                          </option>
                        ))}
                      </Select>
                    </div>

                    {/* 노드 설정 */}
                    <div className="grid gap-3 pl-9">
                      {/* 타입 선택 */}
                      <div className="flex flex-wrap gap-2">
                        {NODE_TYPES.map((t) => {
                          const Icon =
                            t.value === "gate"
                              ? MessageSquare
                              : t.value === "loop"
                                ? Repeat
                                : Zap;

                          const selected = node.node_type === t.value;
                          const selectedClass =
                            t.value === "gate"
                              ? TYPE_BADGE.gate
                              : t.value === "loop"
                                ? TYPE_BADGE.loop
                                : TYPE_BADGE.action;

                          return (
                            <Button
                              key={t.value}
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                updateNode(i, { node_type: t.value })
                              }
                              className={selected ? selectedClass : undefined}
                              title={t.desc}
                            >
                              <Icon className="h-4 w-4" />
                              {t.label}
                            </Button>
                          );
                        })}
                      </div>

                      {/* 지침 소스 선택 */}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            updateNode(i, {
                              source: "inline",
                              instruction_id: null,
                            })
                          }
                          className={
                            node.source === "inline"
                              ? "border-[color:var(--accent)] bg-[var(--accent-light)] text-[var(--accent-dark)]"
                              : undefined
                          }
                        >
                          직접 작성
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => updateNode(i, { source: "reference" })}
                          className={
                            node.source === "reference"
                              ? "border-[color:var(--accent)] bg-[var(--accent-light)] text-[var(--accent-dark)]"
                              : undefined
                          }
                        >
                          지침 참조
                        </Button>
                      </div>

                      {/* 인라인 또는 참조 */}
                      {node.source === "inline" ? (
                        <Textarea
                          placeholder="지침 내용을 입력하세요..."
                          value={node.instruction}
                          onChange={(e) =>
                            updateNode(i, { instruction: e.target.value })
                          }
                          rows={4}
                          className="font-mono"
                        />
                      ) : (
                        <div className="grid gap-2">
                          <Select
                            value={
                              creatingInstructionFor === i
                                ? "__new__"
                                : (node.instruction_id ?? "")
                            }
                            onChange={(e) => {
                              if (e.target.value === "__new__") {
                                setCreatingInstructionFor(i);
                                setNewInstTitle("");
                                setNewInstContent("");
                              } else {
                                setCreatingInstructionFor(null);
                                updateNode(i, {
                                  instruction_id: e.target.value
                                    ? Number(e.target.value)
                                    : null,
                                });
                              }
                            }}
                          >
                            <option value="">-- 지침 선택 --</option>
                            {instructions.map((inst) => (
                              <option key={inst.id} value={inst.id}>
                                #{inst.id} {inst.title} —{" "}
                                {inst.content.slice(0, 50)}
                                ...
                              </option>
                            ))}
                            <option value="__new__">+ 새 지침 만들기</option>
                          </Select>

                          {creatingInstructionFor === i && (
                            <Card className="border-[color:var(--accent)] shadow-none">
                              <CardContent className="grid gap-3 p-4">
                                <Input
                                  placeholder="지침 제목"
                                  value={newInstTitle}
                                  onChange={(e) =>
                                    setNewInstTitle(e.target.value)
                                  }
                                />
                                <Textarea
                                  placeholder="지침 내용"
                                  value={newInstContent}
                                  onChange={(e) =>
                                    setNewInstContent(e.target.value)
                                  }
                                  rows={4}
                                  className="font-mono"
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleCreateInstruction(i)}
                                    disabled={
                                      !newInstTitle.trim() || savingInst
                                    }
                                  >
                                    {savingInst ? "저장 중..." : "생성"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    type="button"
                                    onClick={() =>
                                      setCreatingInstructionFor(null)
                                    }
                                  >
                                    취소
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          )}
                        </div>
                      )}

                      {/* Loop 설정 */}
                      {node.node_type === "loop" && (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-[var(--muted)]">
                            되돌아갈 스텝:
                          </span>
                          <Select
                            value={node.loop_back_to ?? ""}
                            onChange={(e) =>
                              updateNode(i, {
                                loop_back_to: e.target.value
                                  ? Number(e.target.value)
                                  : null,
                              })
                            }
                            className="h-9 w-56"
                          >
                            <option value="">-- 선택 --</option>
                            {nodes.map((_, j) => (
                              <option key={j} value={j + 1}>
                                Step {j + 1}
                                {nodes[j].title ? `: ${nodes[j].title}` : ""}
                              </option>
                            ))}
                          </Select>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* 파이프라인 미리보기 */}
      {nodes.length > 1 && (
        <Card className="mt-6">
          <CardContent className="p-5">
            <p className="mb-2 text-xs text-[var(--muted)]">
              파이프라인 미리보기
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {nodes.map((node, i) => {
                const Icon =
                  node.node_type === "gate"
                    ? MessageSquare
                    : node.node_type === "loop"
                      ? Repeat
                      : Zap;

                return (
                  <div key={node.key} className="flex items-center gap-2">
                    <Badge className={TYPE_BADGE[node.node_type]}>
                      <Icon className="h-3.5 w-3.5" />
                      {i + 1}. {node.title || "(제목 없음)"}
                    </Badge>
                    {i < nodes.length - 1 && (
                      <ArrowRight
                        className={`h-4 w-4 ${
                          node.auto_advance
                            ? "text-[var(--accent)]"
                            : "text-[var(--muted)]"
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 저장 */}
      <div className="mt-8 flex gap-3">
        <Button
          type="button"
          onClick={handleSave}
          disabled={!title.trim() || saving}
        >
          {saving ? "저장 중..." : chainId ? "수정" : "생성"}
        </Button>
        <Button
          type="button"
          onClick={() => router.push("/chains")}
          variant="secondary"
        >
          취소
        </Button>
      </div>
    </main>
  );
}
