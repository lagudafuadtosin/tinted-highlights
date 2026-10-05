import { ItemView, MarkdownView, Notice, TFile, WorkspaceLeaf, debounce } from "obsidian";
import type HighlightrPlugin from "src/plugin/main";
import { asMarkdown, findHighlights, MARKDOWN } from "src/utils/highlights";
import type { Found } from "src/utils/highlights";

export const HIGHLIGHTS_VIEW = "tinted-highlights-panel";

// One highlight found in a note: its text, its colour name, and where it starts.
// The Highlights panel (#102): every highlight in the open note, grouped by colour in the order of
// the plugin's colours, click one to jump to it, and copy them all as a list.
export class HighlightsView extends ItemView {
  plugin: HighlightrPlugin;
  file: TFile | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: HighlightrPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() {
    return HIGHLIGHTS_VIEW;
  }

  getDisplayText() {
    return "Highlights";
  }

  getIcon() {
    return "highlightr-pen";
  }

  async onOpen() {
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.refresh()));
    this.registerEvent(this.app.workspace.on("file-open", () => this.refresh()));
    const soon = debounce(() => this.refresh(), 400, true);
    this.registerEvent(
      this.app.vault.on("modify", (f) => {
        if (f === this.file) soon();
      })
    );
    await this.refresh();
  }

  async refresh() {
    const active = this.app.workspace.getActiveFile();
    if (active && active.extension === "md") this.file = active;
    const root = this.contentEl;
    root.empty();
    root.addClass("tinted-panel");
    if (!this.file) {
      root.createEl("p", { text: "Open a note to see its highlights.", cls: "tinted-empty" });
      return;
    }
    const file = this.file;
    const content = await this.app.vault.cachedRead(file);
    const found = findHighlights(content, this.plugin.settings.highlighters);

    const head = root.createDiv({ cls: "tinted-head" });
    head.createDiv({ text: `${found.length} highlight${found.length === 1 ? "" : "s"} in ${file.basename}`, cls: "tinted-count" });
    const copy = head.createEl("button", { text: "Copy all" });
    copy.disabled = found.length === 0;
    copy.onclick = async () => {
      await navigator.clipboard.writeText(asMarkdown(file.basename, found));
      new Notice("Highlights copied as a list");
    };

    if (found.length === 0) {
      root.createEl("p", { text: "No highlights in this note yet.", cls: "tinted-empty" });
      return;
    }

    const order = [...this.plugin.settings.highlighterOrder, MARKDOWN];
    const groups = new Map<string, Found[]>();
    for (const f of found) groups.set(f.colour, [...(groups.get(f.colour) ?? []), f]);
    const names = [...groups.keys()].sort((a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
    });

    for (const name of names) {
      const list = groups.get(name);
      const group = root.createDiv({ cls: "tinted-group" });
      const title = group.createDiv({ cls: "tinted-group-title" });
      const swatch = title.createSpan({ cls: "tinted-swatch" });
      const value = this.plugin.settings.highlighters[name];
      if (value) swatch.style.background = value;
      title.createSpan({ text: `${name} (${list.length})` });
      for (const f of list) {
        const item = group.createDiv({ cls: "tinted-item", text: f.text });
        if (value) item.style.borderLeftColor = value;
        item.onclick = () => this.jump(file, f);
      }
    }
  }

  // Opens the note (or uses the open one) and puts the cursor on the highlight.
  async jump(file: TFile, f: Found) {
    let leaf = this.app.workspace.getLeavesOfType("markdown").find((l) => (l.view as MarkdownView).file === file);
    if (!leaf) {
      leaf = this.app.workspace.getLeaf(false);
      await leaf.openFile(file);
    }
    this.app.workspace.setActiveLeaf(leaf, { focus: true });
    const view = leaf.view as MarkdownView;
    const pos = { line: f.line, ch: f.ch };
    if (view.getMode() === "source") {
      view.editor.setCursor(pos);
      view.editor.scrollIntoView({ from: pos, to: pos }, true);
    } else {
      view.setEphemeralState({ line: f.line });
    }
  }
}
