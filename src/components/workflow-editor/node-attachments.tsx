"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Download,
  File,
  FileText,
  Image,
  Paperclip,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n/context";
import { translateServerError } from "@/lib/i18n/server-errors";

interface NodeAttachment {
  id: number;
  filename: string;
  mime_type: string;
  size_bytes: number;
  created_at?: string;
}

interface AttachmentListResponse {
  data?: NodeAttachment[];
}

interface AttachmentDownloadResponse {
  data?: {
    id: number;
    filename: string;
    mime_type: string;
    size_bytes: number;
    content: string;
  };
}

interface NodeAttachmentsProps {
  workflowId: number;
  nodeId: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return Image;
  if (
    mimeType.startsWith("text/") ||
    mimeType.includes("json") ||
    mimeType.includes("xml") ||
    mimeType.includes("yaml") ||
    mimeType.includes("javascript") ||
    mimeType.includes("typescript")
  ) {
    return FileText;
  }
  return File;
}

export default function NodeAttachments({
  workflowId,
  nodeId,
}: NodeAttachmentsProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [attachments, setAttachments] = useState<NodeAttachment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NodeAttachment | null>(null);
  const basePath = `/api/workflows/${workflowId}/nodes/${nodeId}/attachments`;

  const loadAttachments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(basePath);
      if (!res.ok) {
        let body: { error?: Parameters<typeof translateServerError>[0] } = {};
        try {
          body = await res.json();
        } catch {
          /* ignore non-JSON body */
        }
        toast.error(
          translateServerError(
            body.error,
            t,
            "Failed to load attachments",
          ),
        );
        return;
      }

      const json = (await res.json()) as AttachmentListResponse;
      setAttachments(json.data ?? []);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [basePath, t]);

  useEffect(() => {
    setAttachments([]);
    setLoaded(false);
    setExpanded(false);
    setDeleteTarget(null);
  }, [nodeId, workflowId]);

  useEffect(() => {
    if (!expanded || loaded) return;
    void loadAttachments();
  }, [expanded, loaded, loadAttachments]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    setUploading(true);
    try {
      const res = await fetch(basePath, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        let body: { error?: Parameters<typeof translateServerError>[0] } = {};
        try {
          body = await res.json();
        } catch {
          /* ignore non-JSON body */
        }
        toast.error(
          translateServerError(body.error, t, "Failed to upload attachment"),
        );
        return;
      }

      toast.success("File uploaded");
      setExpanded(true);
      await loadAttachments();
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (attachment: NodeAttachment) => {
    setDownloadingId(attachment.id);
    try {
      const res = await fetch(`${basePath}/${attachment.id}`);
      if (!res.ok) {
        let body: { error?: Parameters<typeof translateServerError>[0] } = {};
        try {
          body = await res.json();
        } catch {
          /* ignore non-JSON body */
        }
        toast.error(
          translateServerError(body.error, t, "Failed to download attachment"),
        );
        return;
      }

      let blob: Blob;
      const contentType = res.headers.get("content-type") ?? "";

      if (contentType.includes("application/json")) {
        const json = (await res.json()) as AttachmentDownloadResponse;
        const content = json.data?.content ?? "";
        blob = new Blob([content], {
          type: json.data?.mime_type ?? attachment.mime_type,
        });
      } else {
        blob = await res.blob();
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    const res = await fetch(`${basePath}/${deleteTarget.id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      let body: { error?: Parameters<typeof translateServerError>[0] } = {};
      try {
        body = await res.json();
      } catch {
        /* ignore non-JSON body */
      }
      toast.error(
        translateServerError(body.error, t, "Failed to delete attachment"),
      );
      setDeleteTarget(null);
      return;
    }

    setDeleteTarget(null);
    toast.success("File deleted");
    await loadAttachments();
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          onClick={() => setExpanded((prev) => !prev)}
        >
          <Paperclip className="h-4 w-4 text-[var(--muted-foreground)]" />
          <span className="text-sm font-medium">{t("editor.attachments")}</span>
          {attachments.length > 0 && (
            <span className="rounded-full bg-brand-blue-100 px-2 py-0.5 text-xs font-medium text-brand-blue-700">
              {attachments.length}
            </span>
          )}
        </button>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleUploadClick}
          disabled={uploading}
        >
          <Upload className="h-4 w-4" />
          {uploading ? t("common.loading") : t("editor.uploadFile")}
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {expanded && (
        <div className="border-t border-[var(--border)] px-4 py-3">
          {loading ? (
            <p className="text-sm text-[var(--muted-foreground)]">
              {t("common.loading")}
            </p>
          ) : attachments.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">-</p>
          ) : (
            <div className="space-y-2">
              {attachments.map((attachment) => {
                const Icon = getFileIcon(attachment.mime_type);
                const isDownloading = downloadingId === attachment.id;

                return (
                  <div
                    key={attachment.id}
                    className="flex items-center gap-3 rounded-lg border border-[var(--border)] px-3 py-2"
                  >
                    <div className="rounded-full bg-surface-soft p-2 text-[var(--muted-foreground)]">
                      <Icon className="h-4 w-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {attachment.filename}
                      </p>
                      <p className="truncate text-xs text-[var(--muted-foreground)]">
                        {formatBytes(attachment.size_bytes)} ·{" "}
                        {attachment.mime_type}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Download"
                        title="Download"
                        disabled={isDownloading}
                        onClick={() => void handleDownload(attachment)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label={t("common.delete")}
                        onClick={() => setDeleteTarget(attachment)}
                      >
                        <Trash2 className="h-4 w-4 text-[var(--destructive)]" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <DeleteConfirmDialog
        target={deleteTarget}
        title={t("common.delete")}
        description={
          deleteTarget
            ? `Delete "${deleteTarget.filename}"?`
            : t("common.confirm")
        }
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
