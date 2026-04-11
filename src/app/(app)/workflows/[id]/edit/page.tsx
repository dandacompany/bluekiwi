"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import WorkflowEditor from "@/components/workflow-editor/editor";

interface MeResponse {
  id: number;
  role: "viewer" | "editor" | "admin" | "superuser";
}

interface WorkflowOwnerInfo {
  owner_id: number;
}

export default function EditWorkflowPage() {
  const params = useParams<{ id: string }>();
  const workflowId = Number(params.id);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [workflow, setWorkflow] = useState<WorkflowOwnerInfo | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.user) setMe(j.user as MeResponse);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!Number.isFinite(workflowId)) return;
    fetch(`/api/workflows/${workflowId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.data) setWorkflow(j.data as WorkflowOwnerInfo);
      })
      .catch(() => {});
  }, [workflowId]);

  if (!Number.isFinite(workflowId)) {
    return null;
  }

  const canEdit =
    !!me &&
    !!workflow &&
    (me.id === workflow.owner_id || me.role === "superuser");

  return <WorkflowEditor workflowId={workflowId} canEdit={canEdit} />;
}
