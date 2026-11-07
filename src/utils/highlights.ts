// Finding highlights in a note and listing them. No Obsidian imports, so the tests can run in Node.

export type Found = { text: string; colour: string; line: number; ch: number };

const OTHER = "Other";
export const MARKDOWN = "Highlight (==)";

// Every highlight in a note: <mark style="background: ..."> and <mark class="hltr-..."> made by this
// plugin, and Obsidian's own ==text==. Colours are named from the plugin's settings where they match.
export function findHighlights(content: string, highlighters: Record<string, string>): Found[] {
  const byValue = new Map(Object.entries(highlighters).map(([name, value]) => [value.toLowerCase(), name]));
  const byClass = new Map(Object.keys(highlighters).map((name) => [`hltr-${name.toLowerCase()}`, name]));
  const found: Found[] = [];
  let inCode = false;
  content.split("\n").forEach((line, lineNo) => {
    if (/^\s*(```|~~~)/.test(line)) {
      inCode = !inCode;
      return;
    }
    if (inCode) return;
    const mark = /<mark\b([^>]*)>([\s\S]*?)<\/mark>/gi;
    let m: RegExpExecArray | null;
    while ((m = mark.exec(line))) {
      const attrs = m[1];
      const style = /background(?:-color)?\s*:\s*([^;"']+)/i.exec(attrs);
      const cls = /class\s*=\s*["']([^"']+)["']/i.exec(attrs);
      let colour = OTHER;
      if (style) colour = byValue.get(style[1].trim().toLowerCase()) ?? style[1].trim();
      else if (cls) colour = cls[1].split(/\s+/).map((c) => byClass.get(c)).find(Boolean) ?? OTHER;
      const text = m[2].replace(/<[^>]+>/g, "").trim();
      if (text) found.push({ text, colour, line: lineNo, ch: m.index });
    }
    const eq = /(?<!=)==(?!=)([^=\n]+?)==(?!=)/g;
    while ((m = eq.exec(line))) {
      const text = m[1].trim();
      if (text) found.push({ text, colour: MARKDOWN, line: lineNo, ch: m.index });
    }
  });
  return found;
}

// A footnote in a note: [^label]: text written as a definition, or ^[text] written inline (#4).
export type Footnote = { label: string; text: string; line: number; ch: number };

// Every footnote in a note, in note order. A definition's indented lines after it belong to it, as in
// Obsidian. Inline footnotes have no label of their own, so they are numbered "inline 1", "inline 2".
export function findFootnotes(content: string): Footnote[] {
  const notes: Footnote[] = [];
  let inCode = false;
  let last: Footnote | null = null;
  let inline = 0;
  content.split("\n").forEach((line, lineNo) => {
    if (/^\s*(```|~~~)/.test(line)) {
      inCode = !inCode;
      last = null;
      return;
    }
    if (inCode) return;
    const def = /^\[\^([^\]\s]+)\]:\s*(.*)$/.exec(line);
    if (def) {
      last = { label: def[1], text: def[2].trim(), line: lineNo, ch: 0 };
      notes.push(last);
      return;
    }
    // An indented line straight after a definition carries on its text
    if (last && /^(\t| {2,})\S/.test(line)) {
      last.text = `${last.text} ${line.trim()}`.trim();
      return;
    }
    last = null;
    const re = /\^\[([^\]]+)\]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line))) {
      const text = m[1].trim();
      if (text) notes.push({ label: `inline ${++inline}`, text, line: lineNo, ch: m.index });
    }
  });
  return notes;
}

// The <mark ...>...</mark> on a line that the cursor (column ch) is inside, counting the tags themselves.
// Returns where its opening tag and its text start and end, or null when the cursor is not in one (#1).
export type MarkSpan = { open: string; openStart: number; textStart: number; textEnd: number; closeEnd: number };
export function markAt(line: string, ch: number): MarkSpan | null {
  const mark = /<mark\b[^>]*>([\s\S]*?)<\/mark>/gi;
  let m: RegExpExecArray | null;
  while ((m = mark.exec(line))) {
    const openStart = m.index;
    const closeEnd = m.index + m[0].length;
    if (ch < openStart || ch > closeEnd) continue;
    const open = m[0].slice(0, m[0].indexOf(">") + 1);
    const textStart = openStart + open.length;
    return { open, openStart, textStart, textEnd: closeEnd - "</mark>".length, closeEnd };
  }
  return null;
}

// Highlights in the order they appear in the note: top to bottom, left to right (#2).
export function inNoteOrder(found: Found[]): Found[] {
  return found.slice().sort((a, b) => a.line - b.line || a.ch - b.ch);
}

// The highlights as a Markdown list, ready to paste anywhere (#70): grouped by colour, or in note order
// with each line's colour after it (#2).
export function asMarkdown(file: string, found: Found[], order: "colour" | "note" = "colour"): string {
  if (order === "note") {
    const lines = inNoteOrder(found).map((f) => `- ${f.text} (${f.colour})`);
    return [`# Highlights from [[${file}]]`, "", ...lines].join("\n").trim() + "\n";
  }
  const groups = new Map<string, Found[]>();
  for (const f of found) groups.set(f.colour, [...(groups.get(f.colour) ?? []), f]);
  const parts = [`# Highlights from [[${file}]]`, ""];
  for (const [colour, list] of groups) {
    parts.push(`## ${colour}`, ...list.map((f) => `- ${f.text}`), "");
  }
  return parts.join("\n").trim() + "\n";
}

