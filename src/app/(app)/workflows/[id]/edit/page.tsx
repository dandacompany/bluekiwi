"use client";

import { useParams } from "next/navigation";
import WorkflowEditor from "@/components/workflow-editor/editor";

export default function EditWorkflowPage() {
  const params = useParams<{ id: string }>();
  const workflowId = Number(params.id);

  if (!Number.isFinite(workflowId)) {
    return null;
  }

  return <WorkflowEditor workflowId={workflowId} />;
}
