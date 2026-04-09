"use client";

import { useEffect, useState, useCallback } from "react";

interface Instruction {
  id: number;
  title: string;
  content: string;
  agent_type: string;
  tags: string;
  priority: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

const AGENT_TYPES = [
  "general",
  "coding",
  "research",
  "writing",
  "data",
] as const;

export default function InstructionsPage() {
  const [instructions, setInstructions] = useState<Instruction[]>([]);
  const [editing, setEditing] = useState<Instruction | null>(null);
  const [form, setForm] = useState({
    title: "",
    content: "",
    agent_type: "general",
    tags: "",
    priority: 0,
  });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    const res = await fetch(`/api/instructions?${params}`);
    const json = await res.json();
    setInstructions(json.data ?? []);
    setLoading(false);
  }, [search]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const resetForm = () => {
    setForm({
      title: "",
      content: "",
      agent_type: "general",
      tags: "",
      priority: 0,
    });
    setEditing(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;

    const payload = {
      title: form.title,
      content: form.content,
      agent_type: form.agent_type,
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      priority: form.priority,
    };

    if (editing) {
      await fetch(`/api/instructions/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/instructions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    resetForm();
    fetchAll();
  };

  const handleEdit = (inst: Instruction) => {
    const tags = JSON.parse(inst.tags || "[]") as string[];
    setEditing(inst);
    setForm({
      title: inst.title,
      content: inst.content,
      agent_type: inst.agent_type,
      tags: tags.join(", "),
      priority: inst.priority,
    });
  };

  const handleDelete = async (id: number) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    await fetch(`/api/instructions/${id}`, { method: "DELETE" });
    fetchAll();
  };

  const handleToggle = async (inst: Instruction) => {
    await fetch(`/api/instructions/${inst.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !inst.is_active }),
    });
    fetchAll();
  };

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">에이전트 지침 관리</h1>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="지침 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        className="mb-8 p-5 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900"
      >
        <div className="grid gap-4">
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="지침 제목"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <select
              value={form.agent_type}
              onChange={(e) => setForm({ ...form, agent_type: e.target.value })}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {AGENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <textarea
            placeholder="지침 내용을 입력하세요..."
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            rows={6}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
          />
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="태그 (쉼표 구분: 보안, 필수)"
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="number"
              placeholder="우선순위"
              value={form.priority}
              onChange={(e) =>
                setForm({ ...form, priority: Number(e.target.value) })
              }
              className="w-28 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              {editing ? "수정" : "추가"}
            </button>
            {editing && (
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                취소
              </button>
            )}
          </div>
        </div>
      </form>

      {/* List */}
      {loading ? (
        <p className="text-gray-500">로딩 중...</p>
      ) : instructions.length === 0 ? (
        <p className="text-gray-500">등록된 지침이 없습니다.</p>
      ) : (
        <div className="space-y-3">
          {instructions.map((inst) => {
            const tags = JSON.parse(inst.tags || "[]") as string[];
            return (
              <div
                key={inst.id}
                className={`p-4 border rounded-lg transition-colors ${
                  inst.is_active
                    ? "border-gray-200 dark:border-gray-700"
                    : "border-gray-100 dark:border-gray-800 opacity-50"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold truncate">{inst.title}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 shrink-0">
                        {inst.agent_type}
                      </span>
                      {inst.priority > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 shrink-0">
                          P{inst.priority}
                        </span>
                      )}
                      {!inst.is_active && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 shrink-0">
                          비활성
                        </span>
                      )}
                    </div>
                    {tags.length > 0 && (
                      <div className="flex gap-1 mb-1 flex-wrap">
                        {tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {inst.content && (
                      <pre className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap font-mono mt-1 max-h-40 overflow-y-auto">
                        {inst.content}
                      </pre>
                    )}
                    <p className="text-xs text-gray-400 mt-2">
                      수정: {inst.updated_at}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => handleToggle(inst)}
                      className="px-2 py-1 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      title={inst.is_active ? "비활성화" : "활성화"}
                    >
                      {inst.is_active ? "ON" : "OFF"}
                    </button>
                    <button
                      onClick={() => handleEdit(inst)}
                      className="px-2 py-1 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      편집
                    </button>
                    <button
                      onClick={() => handleDelete(inst.id)}
                      className="px-2 py-1 text-xs rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
