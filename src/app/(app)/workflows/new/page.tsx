import WorkflowEditor from "@/components/workflow-editor/editor";

export default async function NewWorkflowPage({
  searchParams,
}: {
  searchParams: Promise<{ folder_id?: string }>;
}) {
  const params = await searchParams;
  const folderId = params.folder_id ? Number(params.folder_id) : null;
  return <WorkflowEditor workflowId={null} folderId={folderId} />;
}
