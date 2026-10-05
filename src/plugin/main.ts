import { Editor, Menu, Notice, Plugin, PluginManifest } from "obsidian";
import { wait } from "src/utils/util";
import addIcons from "src/icons/customIcons";
import { HighlightrSettingTab } from "../settings/settingsTab";
import { HighlightrSettings } from "../settings/settingsData";
import DEFAULT_SETTINGS from "../settings/settingsData";
import contextMenu from "src/plugin/contextMenu";
import highlighterMenu from "src/ui/highlighterMenu";
import { createHighlighterIcons } from "src/icons/customIcons";
import { HighlightsView, HIGHLIGHTS_VIEW } from "src/ui/highlightsView";

import { createStyles } from "src/utils/createStyles";
import { EnhancedApp, EnhancedEditor } from "src/settings/types";

export default class HighlightrPlugin extends Plugin {
  app: EnhancedApp;
  editor: EnhancedEditor;
  manifest: PluginManifest;
  settings: HighlightrSettings;

  // The colour CSS, and the stylesheet holding it in each open window (main and popouts).
  private styleText = "";
  private styleSheets = new Map<Document, CSSStyleSheet>();

  async onload() {
    addIcons();

    await this.loadSettings();

    // The colour CSS in popout windows too: a sheet of their own when one opens, gone when it closes
    this.registerEvent(
      this.app.workspace.on("window-open", (win) => this.adoptStyles(win.doc))
    );
    this.registerEvent(
      this.app.workspace.on("window-close", (win) => this.dropStyles(win.doc))
    );

    this.app.workspace.onLayoutReady(() => {
      this.reloadStyles(this.settings);
      createHighlighterIcons(this.settings, this);
    });

    this.registerEvent(
      this.app.workspace.on("editor-menu", this.handleHighlighterInContextMenu)
    );

    // Theme or light/dark switch: work the readable text colours out again for the new background
    this.registerEvent(
      this.app.workspace.on("css-change", () => this.reloadStyles(this.settings))
    );

    this.addSettingTab(new HighlightrSettingTab(this.app, this));

    // The Highlights panel (#102, #70): every highlight in the open note, by colour
    this.registerView(HIGHLIGHTS_VIEW, (leaf) => new HighlightsView(leaf, this));
    this.addRibbonIcon("highlightr-pen", "Show highlights", () => this.showHighlights());
    this.addCommand({
      id: "show-highlights",
      name: "Show highlights panel",
      callback: () => this.showHighlights(),
    });

    this.addCommand({
      id: "highlighter-plugin-menu",
      name: "Open highlight menu",
      icon: "highlightr-pen",
      editorCallback: (editor: EnhancedEditor) => {
        if (!document.querySelector(".menu.highlighterContainer")) {
          highlighterMenu(this.app, this.settings, editor);
        }
      },
    });

    addEventListener("Highlightr-NewCommand", () => {
      this.reloadStyles(this.settings);
      this.generateCommands(this.editor);
      createHighlighterIcons(this.settings, this);
    });
    this.generateCommands(this.editor);
    this.refresh();
  }

  // Builds the colour CSS again and puts it in every open window: the main one, any popout already
  // open, and any popout seen opening.
  reloadStyles(settings: HighlightrSettings) {
    this.styleText = createStyles(settings);
    const docs = new Set<Document>([document, ...this.styleSheets.keys()]);
    this.app.workspace.iterateAllLeaves((leaf) => {
      docs.add(leaf.view.containerEl.ownerDocument);
    });
    docs.forEach((doc) => this.adoptStyles(doc));
  }

  adoptStyles(doc: Document) {
    let sheet = this.styleSheets.get(doc);
    if (!sheet) {
      // A constructable sheet can only be adopted by the document whose window made it
      const SheetClass = doc.defaultView?.CSSStyleSheet;
      if (!SheetClass) return;
      sheet = new SheetClass();
      this.styleSheets.set(doc, sheet);
    }
    sheet.replaceSync(this.styleText);
    if (!doc.adoptedStyleSheets.includes(sheet)) {
      doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, sheet];
    }
  }

  dropStyles(doc: Document) {
    const sheet = this.styleSheets.get(doc);
    if (!sheet) return;
    doc.adoptedStyleSheets = doc.adoptedStyleSheets.filter((s) => s !== sheet);
    this.styleSheets.delete(doc);
  }

  eraseHighlight = (editor: Editor) => {
    const currentStr = editor.getSelection();
    const newStr = currentStr
      .replace(/<mark style.*?[^>]>/g, "")
      .replace(/<mark class.*?[^>]>/g, "")
      .replace(/<\/mark>/g, "");
    editor.replaceSelection(newStr);
    editor.focus();
  };

  generateCommands(editor: Editor) {
    this.settings.highlighterOrder.forEach((highlighterKey: string) => {
      const applyCommand = (command: CommandPlot, editor: Editor) => {
        const selectedText = editor.getSelection();

        // Recolour (#63). A selection that already holds highlights gets this colour instead of a
        // highlight nested inside another one.
        if (/<mark\b[^>]*>/i.test(selectedText)) {
          const plain = selectedText.replace(/<mark\b[^>]*>/gi, "").replace(/<\/mark>/gi, "");
          editor.replaceSelection(`${command.prefix}${plain}${command.suffix || command.prefix}`);
          return;
        }

        // The selection is the text inside one highlight: same colour removes it (as before), another
        // colour swaps the colour and keeps the text and the selection where they were.
        if (selectedText) {
          const from = editor.getCursor("from");
          const to = editor.getCursor("to");
          if (from.line === to.line) {
            const line = editor.getLine(from.line);
            const before = line.slice(0, from.ch);
            const open = /<mark\b[^>]*>$/i.exec(before);
            if (open && line.slice(to.ch).startsWith("</mark>")) {
              const openStart = from.ch - open[0].length;
              if (open[0] === command.prefix) {
                editor.replaceRange(selectedText, { line: from.line, ch: openStart }, { line: to.line, ch: to.ch + 7 });
                editor.setSelection({ line: from.line, ch: openStart }, { line: from.line, ch: openStart + selectedText.length });
              } else {
                editor.replaceRange(command.prefix, { line: from.line, ch: openStart }, { line: from.line, ch: from.ch });
                const shift = command.prefix.length - open[0].length;
                editor.setSelection({ line: from.line, ch: from.ch + shift }, { line: to.line, ch: to.ch + shift });
              }
              return;
            }
          }
        }

        const curserStart = editor.getCursor("from");
        const curserEnd = editor.getCursor("to");
        const prefix = command.prefix;
        const suffix = command.suffix || prefix;
        const setCursor = (mode: number) => {
          editor.setCursor(
            curserStart.line + command.line * mode,
            curserEnd.ch + cursorPos * mode
          );
        };
        const cursorPos =
          selectedText.length > 0
            ? prefix.length + suffix.length + 1
            : prefix.length;
        const preStart = {
          line: curserStart.line - command.line,
          ch: curserStart.ch - prefix.length,
        };
        const pre = editor.getRange(preStart, curserStart);

        const sufEnd = {
          line: curserStart.line + command.line,
          ch: curserEnd.ch + suffix.length,
        };

        const suf = editor.getRange(curserEnd, sufEnd);

        const preLast = pre.slice(-1);
        const prefixLast = prefix.trimStart().slice(-1);

        if (suf === suffix.trimEnd()) {
          if (preLast === prefixLast && selectedText) {
            editor.replaceRange(selectedText, preStart, sufEnd);
            const changeCursor = (mode: number) => {
              editor.setCursor(
                curserStart.line + command.line * mode,
                curserEnd.ch + (cursorPos * mode + 8)
              );
            };
            return changeCursor(-1);
          }
        }

        editor.replaceSelection(`${prefix}${selectedText}${suffix}`);

        return setCursor(1);
      };

      type CommandPlot = {
        char: number;
        line: number;
        prefix: string;
        suffix: string;
      };

      type commandsPlot = {
        [key: string]: CommandPlot;
      };

      const commandsMap: commandsPlot = {
        highlight: {
          char: 34,
          line: 0,
          prefix:
            this.settings.highlighterMethods === "css-classes"
              ? `<mark class="hltr-${highlighterKey.toLowerCase()}">`
              : `<mark style="background: ${this.settings.highlighters[highlighterKey]};">`,
          suffix: "</mark>",
        },
      };

      Object.keys(commandsMap).forEach((type) => {
        let highlighterpen = `highlightr-pen-${highlighterKey}`.toLowerCase();
        this.addCommand({
          id: highlighterKey,
          name: highlighterKey,
          icon: highlighterpen,
          editorCallback: async (editor: Editor) => {
            applyCommand(commandsMap[type], editor);
            await wait(10);
            editor.focus();
          },
        });
      });

      this.addCommand({
        id: "unhighlight",
        name: "Remove highlight",
        icon: "highlightr-eraser",
        editorCallback: async (editor: Editor) => {
          this.eraseHighlight(editor);
          editor.focus();
        },
      });
    });
  }

  refresh = () => {
    this.updateStyle();
  };

  updateStyle = () => {
    document.body.classList.toggle(
      "highlightr-lowlight",
      this.settings.highlighterStyle === "lowlight"
    );
    document.body.classList.toggle(
      "highlightr-floating",
      this.settings.highlighterStyle === "floating"
    );
    document.body.classList.toggle(
      "highlightr-rounded",
      this.settings.highlighterStyle === "rounded"
    );
    document.body.classList.toggle(
      "highlightr-realistic",
      this.settings.highlighterStyle === "realistic"
    );
  };

  async showHighlights() {
    const open = this.app.workspace.getLeavesOfType(HIGHLIGHTS_VIEW)[0];
    if (open) {
      this.app.workspace.revealLeaf(open);
      return;
    }
    const leaf = this.app.workspace.getRightLeaf(false);
    if (!leaf) return;
    await leaf.setViewState({ type: HIGHLIGHTS_VIEW, active: true });
    this.app.workspace.revealLeaf(leaf);
  }

  onunload() {
    [...this.styleSheets.keys()].forEach((doc) => this.dropStyles(doc));
  }

  handleHighlighterInContextMenu = (
    menu: Menu,
    editor: EnhancedEditor
  ): void => {
    contextMenu(this.app, menu, editor, this, this.settings);
  };

  async loadSettings() {
    let saved = (await this.loadData()) as Partial<HighlightrSettings> | null;
    // First run: bring over the colours and choices from the original Highlightr, so switching
    // keeps everything people set up there. Their notes need nothing: the highlights are the same.
    if (!saved) {
      saved = await this.importFromHighlightr();
    }
    this.settings = Object.assign({}, DEFAULT_SETTINGS, saved);
    if (saved) await this.saveSettings();
  }

  async importFromHighlightr(): Promise<Partial<HighlightrSettings> | null> {
    const path = `${this.app.vault.configDir}/plugins/highlightr-plugin/data.json`;
    try {
      if (!(await this.app.vault.adapter.exists(path))) return null;
      const old: unknown = JSON.parse(await this.app.vault.adapter.read(path));
      if (!isOldSettings(old)) return null;
      new Notice("Tinted Highlights brought over your colours from Highlightr.");
      return old;
    } catch {
      return null;
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

// Old Highlightr data.json: anything holding a highlighters object.
function isOldSettings(value: unknown): value is Partial<HighlightrSettings> {
  return !!value && typeof (value as { highlighters?: unknown }).highlighters === "object";
}
