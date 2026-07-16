/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from "react";

type Block =
  | { kind: "h2"; text: string }
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] };

// Parse the lightweight Markdown body (## headings, blank-line paragraphs,
// `- ` bullets). Kept intentionally minimal — see prisma/blogSeed.ts for the
// format. Shared by BlogArticlePage (kenniscentrum) and LegalPage
// (privacy/voorwaarden, admin-edited via AdminContent → Juridisch).
function parseBlocks(content: string): Block[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: string[] = [];
  const flushPara = () => { if (para.length) { blocks.push({ kind: "p", text: para.join(" ") }); para = []; } };
  const flushList = () => { if (list.length) { blocks.push({ kind: "ul", items: [...list] }); list = []; } };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flushPara(); flushList(); continue; }
    if (line.startsWith("## ")) { flushPara(); flushList(); blocks.push({ kind: "h2", text: line.slice(3).trim() }); continue; }
    if (line.startsWith("- ")) { flushPara(); list.push(line.slice(2).trim()); continue; }
    flushList();
    para.push(line);
  }
  flushPara(); flushList();
  return blocks;
}

// Render **bold** spans; everything else is plain text.
function renderInline(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
    const m = part.match(/^\*\*([^*]+)\*\*$/);
    return m
      ? <strong key={i} className="font-bold text-slate-900">{m[1]}</strong>
      : <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

export default function MarkdownBody({ content }: { content: string }) {
  const blocks = useMemo(() => parseBlocks(content), [content]);
  return (
    <div className="space-y-4">
      {blocks.map((b, i) => {
        if (b.kind === "h2") {
          return <h2 key={i} className="text-lg sm:text-xl font-extrabold text-slate-900 pt-4">{b.text}</h2>;
        }
        if (b.kind === "ul") {
          return (
            <ul key={i} className="space-y-2 pl-1">
              {b.items.map((it, j) => (
                <li key={j} className="flex gap-2.5 text-sm sm:text-[15px] text-slate-600 leading-relaxed">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-orange-400 shrink-0" />
                  <span>{renderInline(it)}</span>
                </li>
              ))}
            </ul>
          );
        }
        return <p key={i} className="text-sm sm:text-[15px] text-slate-600 leading-relaxed">{renderInline(b.text)}</p>;
      })}
    </div>
  );
}
