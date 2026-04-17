"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";

import {
  AlertTriangle,
  MessageSquare,
  Plus,
  Repeat,
  Rocket,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import NodeCard from "./node-card";
import NodeAttachments from "./node-attachments";
import StepMinimap from "./step-minimap";
import NodePicker, { type PickerResult } from "./node-picker";
import { InstructionPicker } from "./instruction-picker";
import { useTranslation } from "@/lib/i18n/context";

/* ── 타입 ── */

interface InstructionOption {
  id: number;
  title: string;
  content: string;
}

interface CredentialOption {
  id: number;
  service_name: string;
}

interface CredentialRequirement {
  service_name: string;
  keys: Array<{ name: string; required: boolean }>;
}

interface NodeDraft {
  key: string;
  dbNodeId: number | null; // DB id — null for unsaved new nodes
  title: string;
  node_type: "action" | "gate" | "loop";
  source: "inline" | "reference";
  instruction: string;
  instruction_id: number | null;
  credential_id: number | null;
  credential_requirement: CredentialRequirement | null;
  loop_back_to: number | null;
  hitl: boolean;
  visual_selection: boolean;
}

const NODE_TYPES = [
  { value: "action", labelKey: "editor.action", descKey: "editor.actionDesc" },
  { value: "gate", labelKey: "editor.gate", descKey: "editor.gateDesc" },
  { value: "loop", labelKey: "editor.loop", descKey: "editor.loopDesc" },
] as const;

import { NODE_TYPE_CONFIG, type NodeType } from "@/lib/node-type-config";

function newKey() {
  return crypto.randomUUID().slice(0, 8);
}

/* ── 에디터 ── */

export default function WorkflowEditor({
  workflowId,
  folderId: folderIdProp,
  canEdit = true,
}: {
  workflowId: number | null;
  folderId?: number | null;
  canEdit?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();

  // folder_id: prop takes priority, then URL query param
  const folderId =
    folderIdProp ??
    (searchParams.get("folder_id")
      ? Number(searchParams.get("folder_id"))
      : null);
  const readOnly = !canEdit;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [nodes, setNodes] = useState<NodeDraft[]>([]);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [instructions, setInstructions] = useState<InstructionOption[]>([]);
  const [credentials, setCredentials] = useState<CredentialOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [currentVersion, setCurrentVersion] = useState<string>("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [instPickerFor, setInstPickerFor] = useState<number | null>(null);
  const [creatingInstructionFor, setCreatingInstructionFor] = useState<
    number | null
  >(null);
  const [newInstTitle, setNewInstTitle] = useState("");
  const [newInstContent, setNewInstContent] = useState("");
  const [savingInst, setSavingInst] = useState(false);

  const instructionMap = useMemo(
    () => new Map(instructions.map((i) => [i.id, i])),
    [instructions],
  );

  /* ── DnD sensors ── */

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  /* ── 데이터 로드 ── */

  useEffect(() => {
    fetch("/api/instructions")
      .then((r) => r.json())
      .then((json) => setInstructions(json.data ?? []));
    fetch("/api/credentials")
      .then((r) => r.json())
      .then((json) => setCredentials(json.data ?? []));
  }, []);

  useEffect(() => {
    if (!workflowId) return;
    let cancelled = false;

    async function loadWorkflow() {
      const res = await fetch(`/api/workflows/${workflowId}`);
      if (!res.ok) return;
      const json = await res.json();
      const workflow = json.data;
      if (cancelled) return;
      setTitle(workflow.title);
      setDescription(workflow.description);
      setIsActive(Boolean(workflow.is_active));
      setCurrentVersion(String(workflow.version ?? ""));
      setNodes(
        workflow.nodes.map(
          (n: {
            id: number;
            title: string;
            node_type: string;
            instruction: string;
            instruction_id: number | null;
            credential_id: number | null;
            credential_requirement_parsed?: CredentialRequirement | null;
            loop_back_to: number | null;
            hitl: boolean;
            visual_selection: boolean;
          }) => ({
            key: newKey(),
            dbNodeId: n.id,
            title: n.title,
            node_type: n.node_type as NodeDraft["node_type"],
            source: n.instruction_id ? "reference" : "inline",
            instruction: n.instruction,
            instruction_id: n.instruction_id,
            credential_id: n.credential_id,
            credential_requirement: n.credential_requirement_parsed ?? null,
            loop_back_to: n.loop_back_to,
            hitl: n.hitl ?? false,
            visual_selection: n.visual_selection ?? false,
          }),
        ),
      );
    }

    void loadWorkflow();
    return () => {
      cancelled = true;
    };
  }, [workflowId]);

  /* ── 노드 조작 ── */

  const addNode = (overrides?: Partial<NodeDraft>) => {
    setNodes([
      ...nodes,
      {
        key: newKey(),
        dbNodeId: null,
        title: "",
        node_type: "action",
        source: "inline",
        instruction: "",
        instruction_id: null,
        credential_id: null,
        credential_requirement: null,
        loop_back_to: null,
        hitl: false,
        visual_selection: false,
        ...overrides,
      },
    ]);
    setExpandedIndex(nodes.length);
  };

  const removeNode = (index: number) => {
    setNodes(nodes.filter((_, i) => i !== index));
    if (expandedIndex === index) setExpandedIndex(null);
  };

  const updateNode = (index: number, updates: Partial<NodeDraft>) => {
    setNodes(nodes.map((n, i) => (i === index ? { ...n, ...updates } : n)));
  };

  /* ── DnD handler ── */

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setNodes((prev) => {
      const oldIndex = prev.findIndex((n) => n.key === active.id);
      const newIndex = prev.findIndex((n) => n.key === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });

    // 확장된 노드 인덱스도 추적
    setExpandedIndex(null);
  };

  /* ── NodePicker handler ── */

  const handlePickerSelect = (result: PickerResult) => {
    addNode({
      node_type: result.node_type,
      title: result.title ?? "",
      instruction: result.instruction ?? "",
      instruction_id: result.instruction_id ?? null,
      source: result.instruction_id ? "reference" : "inline",
    });
  };

  /* ── 인라인 지침 생성 ── */

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

  /* ── 저장 ── */

  const buildPayload = () => ({
    title,
    description,
    ...(folderId ? { folder_id: folderId } : {}),
    nodes: nodes.map((n) => ({
      title: n.title,
      node_type: n.node_type,
      instruction: n.source === "inline" ? n.instruction : "",
      instruction_id: n.source === "reference" ? n.instruction_id : null,
      credential_id: n.credential_id,
      credential_requirement: n.credential_requirement,
      loop_back_to: n.node_type === "loop" ? n.loop_back_to : null,
      hitl: n.hitl,
      visual_selection: n.node_type === "gate" ? n.visual_selection : false,
    })),
  });

  // Create brand-new workflow (only used when workflowId is null).
  const handleCreate = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      if (!res.ok) {
        toast.error(t("workflows.publishFailed"));
        return;
      }
      toast.success(t("workflows.saved"));
      router.push(folderId ? `/workflows?folder_id=${folderId}` : "/workflows");
    } finally {
      setSaving(false);
    }
  };

  // In-place save — only offered for archived/inactive versions. Does not
  // bump the version number; the caller is knowingly editing a draft.
  const handleSaveInPlace = async () => {
    if (!workflowId || !title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/workflows/${workflowId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      if (!res.ok) {
        toast.error(t("workflows.publishFailed"));
        return;
      }
      toast.success(t("workflows.saved"));
      router.push(`/workflows/${workflowId}`);
    } finally {
      setSaving(false);
    }
  };

  // Publish a new version — creates a new workflow row in the family,
  // auto-deactivates the current active sibling, and navigates to the
  // new row's detail page. This is the only save path for active versions.
  const handlePublishNewVersion = async () => {
    if (!workflowId || !title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/workflows/${workflowId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...buildPayload(), create_new_version: true }),
      });
      if (!res.ok) {
        toast.error(t("workflows.publishFailed"));
        return;
      }
      const json = await res.json();
      const nextId = json?.data?.id;
      const nextVersion = json?.data?.version;
      toast.success(
        t("workflows.publishedVersion", { version: nextVersion ?? "" }),
      );
      router.push(
        typeof nextId === "number" ? `/workflows/${nextId}` : "/workflows",
      );
    } finally {
      setSaving(false);
    }
  };

  // Activate an archived version directly from the editor so the author
  // can promote a saved draft without jumping back to the detail page.
  const handleActivateCurrent = async () => {
    if (!workflowId) return;
    const res = await fetch(`/api/workflows/${workflowId}/activate`, {
      method: "POST",
    });
    if (!res.ok) {
      toast.error(t("workflows.activateFailed"));
      return;
    }
    toast.success(t("workflows.activated"));
    setIsActive(true);
  };

  /* ── 렌더 ── */

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">
        {workflowId ? t("editor.editWorkflow") : t("editor.newWorkflow")}
      </h1>

      {readOnly && (
        <div className="mb-6 rounded border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-900 dark:text-yellow-200">
          {t("ownership.readOnlyPreview")}
        </div>
      )}

      {/* 기본 정보 */}
      <Card className="mb-8">
        <CardHeader className="p-5 pb-0">
          <CardTitle className="text-sm">{t("editor.basicInfo")}</CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <div className="grid gap-4">
            <Input
              placeholder={t("editor.workflowTitlePlaceholder")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-base font-medium"
              required
            />
            <Input
              placeholder={t("editor.descriptionPlaceholder")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* 스텝 미니맵 */}
      {nodes.length > 0 && (
        <StepMinimap nodes={nodes} onAddClick={() => setPickerOpen(true)} />
      )}

      {/* 노드 목록 헤더 */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {t("editor.nodes")} ({nodes.length})
        </h2>
        <Button onClick={() => setPickerOpen(true)} size="sm">
          <Plus className="h-4 w-4" />
          {t("editor.addNode")}
        </Button>
      </div>

      {/* 노드 목록 (DnD) */}
      {nodes.length === 0 ? (
        <Card className="border-dashed shadow-none">
          <CardContent className="py-12 text-center">
            <p className="mb-4 text-sm text-[var(--muted-foreground)]">
              {t("editor.noNodes")}
            </p>
            <Button onClick={() => setPickerOpen(true)} size="sm">
              <Plus className="h-4 w-4" />
              {t("editor.addFirstNode")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={nodes.map((n) => n.key)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {nodes.map((node, i) => (
                <div key={node.key}>
                  {/* 접힌 카드 */}
                  <NodeCard
                    node={node}
                    index={i}
                    isExpanded={expandedIndex === i}
                    onClick={() =>
                      setExpandedIndex(expandedIndex === i ? null : i)
                    }
                    onRemove={() => removeNode(i)}
                  />

                  {/* 펼쳐진 인라인 편집 영역 */}
                  {expandedIndex === i && (
                    <Card
                      className={`mt-1 ml-6 border-2 ${NODE_TYPE_CONFIG[node.node_type as NodeType]?.border ?? "border-border"}`}
                    >
                      <CardContent className="p-5">
                        <div className="flex flex-col gap-4">
                          {/* 노드 헤더 */}
                          <div className="flex flex-wrap items-center gap-2">
                            <Input
                              placeholder={t("editor.nodeTitle")}
                              value={node.title}
                              onChange={(e) =>
                                updateNode(i, { title: e.target.value })
                              }
                              className="h-9 min-w-[220px] flex-1"
                            />

                            {node.node_type === "action" && (
                              <label className="flex cursor-pointer select-none items-center gap-1.5 text-sm">
                                <input
                                  type="checkbox"
                                  checked={node.hitl}
                                  onChange={(e) =>
                                    updateNode(i, {
                                      hitl: e.target.checked,
                                    })
                                  }
                                  className="h-4 w-4 accent-brand-blue-600"
                                />
                                <span>HITL</span>
                              </label>
                            )}

                            {node.node_type === "gate" && (
                              <label className="flex cursor-pointer select-none items-center gap-1.5 text-sm">
                                <input
                                  type="checkbox"
                                  checked={node.visual_selection}
                                  onChange={(e) =>
                                    updateNode(i, {
                                      visual_selection: e.target.checked,
                                    })
                                  }
                                  className="h-4 w-4 accent-amber-500"
                                />
                                <span>Visual</span>
                              </label>
                            )}

                            <select
                              value={node.credential_id ?? ""}
                              onChange={(e) =>
                                updateNode(i, {
                                  credential_id: e.target.value
                                    ? Number(e.target.value)
                                    : null,
                                })
                              }
                              className="h-9 w-48 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-2 text-sm"
                              title={t("editor.credentialTitle")}
                            >
                              <option value="">
                                {t("editor.noCredential")}
                              </option>
                              {credentials.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.service_name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* 노드 설정 */}
                          <div className="grid gap-3">
                            {/* 타입 선택 */}
                            <div className="flex flex-wrap gap-2">
                              {NODE_TYPES.map((nt) => {
                                const Icon =
                                  nt.value === "gate"
                                    ? MessageSquare
                                    : nt.value === "loop"
                                      ? Repeat
                                      : Zap;

                                const selected = node.node_type === nt.value;
                                const selectedClass =
                                  NODE_TYPE_CONFIG[nt.value as NodeType]
                                    ?.badge ?? "";

                                return (
                                  <Button
                                    key={nt.value}
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      updateNode(i, { node_type: nt.value })
                                    }
                                    className={
                                      selected ? selectedClass : undefined
                                    }
                                    title={t(nt.descKey)}
                                  >
                                    <Icon className="h-4 w-4" />
                                    {t(nt.labelKey)}
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
                                    ? "border-brand-blue-600 bg-brand-blue-100 text-brand-blue-700"
                                    : undefined
                                }
                              >
                                {t("editor.inlineWrite")}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  updateNode(i, { source: "reference" })
                                }
                                className={
                                  node.source === "reference"
                                    ? "border-brand-blue-600 bg-brand-blue-100 text-brand-blue-700"
                                    : undefined
                                }
                              >
                                {t("editor.referenceInstruction")}
                              </Button>
                            </div>

                            {/* 인라인 또는 참조 */}
                            {node.source === "inline" ? (
                              <Textarea
                                placeholder={t("editor.instructionPlaceholder")}
                                value={node.instruction}
                                onChange={(e) =>
                                  updateNode(i, {
                                    instruction: e.target.value,
                                  })
                                }
                                rows={4}
                                className="font-mono"
                              />
                            ) : (
                              <div className="grid gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full justify-start text-left font-normal"
                                  onClick={() => setInstPickerFor(i)}
                                >
                                  {node.instruction_id
                                    ? `#${node.instruction_id} ${instructionMap.get(node.instruction_id)?.title ?? ""}`
                                    : t("editor.selectInstruction")}
                                </Button>
                                <InstructionPicker
                                  open={instPickerFor === i}
                                  onOpenChange={(open) => {
                                    if (!open) setInstPickerFor(null);
                                  }}
                                  instructions={instructions}
                                  onSelect={(id) => {
                                    setCreatingInstructionFor(null);
                                    updateNode(i, { instruction_id: id });
                                  }}
                                  onCreateNew={() => {
                                    setCreatingInstructionFor(i);
                                    setNewInstTitle("");
                                    setNewInstContent("");
                                  }}
                                />

                                {creatingInstructionFor === i && (
                                  <Card className="border-brand-blue-600 shadow-none">
                                    <CardContent className="grid gap-3 p-4">
                                      <Input
                                        placeholder={t(
                                          "editor.instructionTitle",
                                        )}
                                        value={newInstTitle}
                                        onChange={(e) =>
                                          setNewInstTitle(e.target.value)
                                        }
                                      />
                                      <Textarea
                                        placeholder={t(
                                          "editor.instructionContent",
                                        )}
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
                                          onClick={() =>
                                            handleCreateInstruction(i)
                                          }
                                          disabled={
                                            !newInstTitle.trim() || savingInst
                                          }
                                        >
                                          {savingInst
                                            ? t("editor.saving")
                                            : t("common.create")}
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="secondary"
                                          type="button"
                                          onClick={() =>
                                            setCreatingInstructionFor(null)
                                          }
                                        >
                                          {t("common.cancel")}
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
                                <span className="text-xs text-[var(--muted-foreground)]">
                                  {t("editor.loopBackTo")}
                                </span>
                                <select
                                  value={node.loop_back_to ?? ""}
                                  onChange={(e) =>
                                    updateNode(i, {
                                      loop_back_to: e.target.value
                                        ? Number(e.target.value)
                                        : null,
                                    })
                                  }
                                  className="h-9 w-56 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-2 text-sm"
                                >
                                  <option value="">
                                    {t("editor.selectStep")}
                                  </option>
                                  {nodes.map((_, j) => (
                                    <option key={j} value={j + 1}>
                                      {t("editor.loopStepOption", {
                                        step: j + 1,
                                        title: nodes[j].title
                                          ? `: ${nodes[j].title}`
                                          : "",
                                      })}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}

                            {/* Attachments */}
                            {workflowId && node.dbNodeId && (
                              <NodeAttachments
                                workflowId={workflowId}
                                nodeId={node.dbNodeId}
                              />
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* 저장 버튼 그룹 — workflowId가 없으면 신규 생성, 있으면 버전 상태에 따라 분기 */}
      <div className="mt-8 space-y-3">
        {workflowId && !isActive && (
          <div className="flex items-start gap-2 rounded-lg border border-[var(--border)] bg-surface-soft p-3 text-xs text-[var(--muted-foreground)]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <div className="space-y-1">
              <p className="font-medium text-foreground">
                {t("workflows.inactiveBadge")} · v{currentVersion}
              </p>
              <p>{t("workflows.inactiveEditWarning")}</p>
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          {!workflowId && (
            <Button
              type="button"
              onClick={handleCreate}
              disabled={!title.trim() || saving || readOnly}
              title={readOnly ? t("ownership.cantEdit") : undefined}
            >
              {saving ? t("editor.saving") : t("common.create")}
            </Button>
          )}
          {workflowId && isActive && (
            <>
              <Button
                type="button"
                onClick={handlePublishNewVersion}
                disabled={!title.trim() || saving || readOnly}
                title={readOnly ? t("ownership.cantEdit") : undefined}
              >
                <Rocket className="mr-2 h-4 w-4" />
                {saving ? t("editor.saving") : t("workflows.publishNewVersion")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleSaveInPlace}
                disabled={!title.trim() || saving || readOnly}
                title={
                  readOnly
                    ? t("ownership.cantEdit")
                    : t("workflows.saveToThisVersionHint")
                }
              >
                {saving ? t("editor.saving") : t("workflows.saveToThisVersion")}
              </Button>
              <Badge
                variant="outline"
                className="inline-flex items-center self-center text-[11px]"
              >
                {t("workflows.activeBadge")} · v{currentVersion}
              </Badge>
            </>
          )}
          {workflowId && !isActive && (
            <>
              <Button
                type="button"
                onClick={handleSaveInPlace}
                disabled={!title.trim() || saving || readOnly}
                title={readOnly ? t("ownership.cantEdit") : undefined}
              >
                {saving ? t("editor.saving") : t("common.save")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleActivateCurrent}
                disabled={saving || readOnly}
                title={readOnly ? t("ownership.cantEdit") : undefined}
              >
                {t("workflows.activate")}
              </Button>
            </>
          )}
          <Button
            type="button"
            onClick={() =>
              router.push(
                workflowId ? `/workflows/${workflowId}` : "/workflows",
              )
            }
            variant="secondary"
          >
            {t("editor.cancel")}
          </Button>
        </div>
      </div>

      {/* NodePicker 모달 */}
      <NodePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={handlePickerSelect}
      />
    </main>
  );
}
