"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

interface Group {
  id: number;
  name: string;
  description: string;
}

interface Member {
  id: number;
  username: string;
}

export default function GroupsSettingsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selected, setSelected] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [newName, setNewName] = useState("");
  const [addUserId, setAddUserId] = useState("");

  const loadGroups = () =>
    fetch("/api/settings/groups")
      .then((r) => r.json())
      .then((j: { data: Group[] }) => setGroups(j.data ?? []));

  const loadMembers = (g: Group) =>
    fetch(`/api/settings/groups/${g.id}/members`)
      .then((r) => r.json())
      .then((j: { data: Member[] }) => setMembers(j.data ?? []));

  useEffect(() => {
    loadGroups();
  }, []);

  useEffect(() => {
    if (selected) loadMembers(selected);
  }, [selected]);

  const createGroup = async () => {
    if (!newName.trim()) return;
    await fetch("/api/settings/groups", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    setNewName("");
    loadGroups();
  };

  const addMember = async () => {
    if (!selected || !addUserId) return;
    await fetch(`/api/settings/groups/${selected.id}/members`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user_id: Number(addUserId) }),
    });
    setAddUserId("");
    loadMembers(selected);
  };

  const removeMember = async (userId: number) => {
    if (!selected) return;
    await fetch(`/api/settings/groups/${selected.id}/members`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    });
    loadMembers(selected);
  };

  return (
    <div className="grid grid-cols-[260px_1fr] gap-6 p-6">
      <aside>
        <h2 className="mb-2 text-sm font-semibold">Groups</h2>
        <ul className="mb-4 space-y-1">
          {groups.map((g) => (
            <li
              key={g.id}
              className={`cursor-pointer rounded px-2 py-1 hover:bg-accent ${selected?.id === g.id ? "bg-accent" : ""}`}
              onClick={() => setSelected(g)}
            >
              {g.name}
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="new group"
          />
          <Button onClick={createGroup}>Create</Button>
        </div>
      </aside>
      <main>
        {selected ? (
          <Card className="p-4">
            <h1 className="mb-4 text-lg font-semibold">{selected.name}</h1>
            <ul className="mb-4 space-y-1">
              {members.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span>@{m.username}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeMember(m.id)}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Input
                value={addUserId}
                onChange={(e) => setAddUserId(e.target.value)}
                placeholder="user id"
              />
              <Button onClick={addMember}>Add</Button>
            </div>
          </Card>
        ) : (
          <div className="text-muted-foreground">Select a group</div>
        )}
      </main>
    </div>
  );
}
