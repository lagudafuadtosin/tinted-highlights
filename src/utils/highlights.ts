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

// The highlights as a Markdown list, grouped by colour, ready to paste anywhere (#70).
export function asMarkdown(file: string, found: Found[]): string {
  const groups = new Map<string, Found[]>();
  for (const f of found) groups.set(f.colour, [...(groups.get(f.colour) ?? []), f]);
  const parts = [`# Highlights from [[${file}]]`, ""];
  for (const [colour, list] of groups) {
    parts.push(`## ${colour}`, ...list.map((f) => `- ${f.text}`), "");
  }
  return parts.join("\n").trim() + "\n";
}

