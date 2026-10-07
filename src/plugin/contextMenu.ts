import type HighlightrPlugin from "src/plugin/main";
import { Menu } from "obsidian";
import { HighlightrSettings } from "src/settings/settingsData";
import highlighterMenu from "src/ui/highlighterMenu";
import { markAt } from "src/utils/highlights";
import { EnhancedApp, EnhancedEditor, EnhancedMenuItem } from "src/settings/types";

export default function contextMenu(
  app: EnhancedApp,
  menu: Menu,
  editor: EnhancedEditor,
  plugin: HighlightrPlugin,
  settings: HighlightrSettings
): void {
  const selection = editor.getSelection();

  menu.addItem((item) => {
    const itemDom = (item as EnhancedMenuItem).dom;
    itemDom.addClass("highlighter-button");
    item.setTitle("Highlight").setIcon("highlightr-pen");
    // The colours open straight from the right-click menu, no second click (Obsidian's submenus).
    // An Obsidian without submenus keeps the old way: click Highlight to open the colour menu.
    const sub = (item as EnhancedMenuItem).setSubmenu?.();
    if (!sub) {
      item.onClick(() => highlighterMenu(app, settings, editor));
      return;
    }
    for (const name of settings.highlighterOrder) {
      sub.addItem((colour) =>
        colour
          .setTitle(name)
          .setIcon(`highlightr-pen-${name}`.toLowerCase())
          .onClick(() => app.commands.executeCommandById(`tinted-highlights:${name}`))
      );
    }
  });

  // Erase shows for a selection, and for the cursor inside a highlight (#1) when that setting is on.
  const cursor = editor.getCursor();
  const inside = settings.cursorInHighlight && !selection && markAt(editor.getLine(cursor.line), cursor.ch) !== null;
  if (selection || inside) {
    menu.addItem((item) => {
      item
        .setTitle("Erase highlight")
        .setIcon("highlightr-eraser")
        .onClick(() => plugin.eraseHighlight(editor));
    });
  }
}
