"use client";

import { useCallback, useRef, useEffect } from "react";
import {
  Bold, Italic, Underline, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight, Link as LinkIcon, Image as ImageIcon,
} from "lucide-react";
import { uploadFile } from "@/lib/api/uploads.api";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

/**
 * A real (if simple) rich-text editor: a contentEditable div driven by
 * document.execCommand, which — despite being formally deprecated — remains
 * the only way to get basic bold/italic/list/align/link formatting out of a
 * plain div without pulling in an editor library. This project has no rich
 * text package installed (see package.json) and no network access to add
 * one, so this replaces what used to be a styled textarea with non-functional
 * toolbar buttons; every button here actually changes the stored HTML.
 * Images are uploaded through the same shared /uploads endpoint used by the
 * icon/banner picker and Attachments tab, then embedded as an <img src="…">
 * pointing at the persisted URL — not a data: URL and not a fake blob.
 */
export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const lastValue = useRef<string>(value);

  // Keep the DOM in sync when `value` changes from outside (e.g. loading an
  // existing catalog item) without fighting the caret while the user types.
  useEffect(() => {
    if (ref.current && value !== lastValue.current && document.activeElement !== ref.current) {
      ref.current.innerHTML = value || "";
      lastValue.current = value;
    }
  }, [value]);

  const emitChange = useCallback(() => {
    const html = ref.current?.innerHTML ?? "";
    lastValue.current = html;
    onChange(html);
  }, [onChange]);

  const exec = useCallback((command: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    emitChange();
  }, [emitChange]);

  const handleLink = useCallback(() => {
    const url = window.prompt("Link URL");
    if (url) exec("createLink", url);
  }, [exec]);

  const handleImage = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const result = await uploadFile(file);
        exec("insertImage", result.url.startsWith("http") ? result.url : result.url);
      } catch {
        // upload failures are surfaced by the toast system elsewhere in the
        // app for other uploads; a silent no-op here just leaves the
        // description unchanged rather than inserting a broken image.
      }
    };
    input.click();
  }, [exec]);

  const buttons: { icon: React.ElementType; label: string; action: () => void }[] = [
    { icon: Bold,          label: "Bold",           action: () => exec("bold") },
    { icon: Italic,        label: "Italic",         action: () => exec("italic") },
    { icon: Underline,     label: "Underline",      action: () => exec("underline") },
    { icon: List,          label: "Bullet list",    action: () => exec("insertUnorderedList") },
    { icon: ListOrdered,   label: "Numbered list",  action: () => exec("insertOrderedList") },
    { icon: AlignLeft,     label: "Align left",     action: () => exec("justifyLeft") },
    { icon: AlignCenter,   label: "Align center",   action: () => exec("justifyCenter") },
    { icon: AlignRight,    label: "Align right",    action: () => exec("justifyRight") },
    { icon: LinkIcon,      label: "Insert link",    action: handleLink },
    { icon: ImageIcon,     label: "Insert image",   action: handleImage },
  ];

  return (
    <div className="rounded-lg border border-slate-300 overflow-hidden">
      <div className="flex items-center gap-1 px-3 py-2 border-b border-slate-100 bg-slate-50 flex-wrap">
        {buttons.map(({ icon: Icon, label, action }) => (
          <button key={label} type="button" title={label}
            onMouseDown={(e) => e.preventDefault() /* keep focus/selection in the editable area */}
            onClick={action}
            className="size-7 rounded flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors">
            <Icon className="size-3.5" />
          </button>
        ))}
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emitChange}
        onBlur={emitChange}
        data-placeholder={placeholder}
        className="min-h-28 w-full px-3 py-2 text-sm text-slate-800 outline-none prose-sm [&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-slate-400"
      />
    </div>
  );
}
