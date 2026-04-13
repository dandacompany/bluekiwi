"use client";

import "@blocknote/react/style.css";

import { useEffect, useRef } from "react";
import { BlockNoteViewRaw, useCreateBlockNote } from "@blocknote/react";

interface Props {
  initialContent: string; // markdown string
  onChange: (markdown: string) => void;
}

export default function BlocknoteEditor({ initialContent, onChange }: Props) {
  const editor = useCreateBlockNote();
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    if (!initialContent.trim()) return;
    const blocks = editor.tryParseMarkdownToBlocks(initialContent);
    if (blocks.length > 0) {
      editor.replaceBlocks(editor.document, blocks);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = () => {
    const markdown = editor.blocksToMarkdownLossy(editor.document);
    onChange(markdown);
  };

  return (
    <div className="blocknote-wrapper min-h-[22rem] overflow-hidden rounded-[1.25rem] border border-border bg-background">
      <BlockNoteViewRaw
        editor={editor}
        onChange={handleChange}
        theme="light"
        sideMenu={false}
        formattingToolbar={false}
        slashMenu={false}
        linkToolbar={false}
        filePanel={false}
        tableHandles={false}
      />
    </div>
  );
}
