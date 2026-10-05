import { App, Editor, Menu, MenuItem } from "obsidian";

export interface Coords {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

export type EnhancedMenu = Menu & { dom: HTMLElement };

export type EnhancedMenuItem = MenuItem & { dom: HTMLElement };

// Obsidian's command registry, which the public typings leave out.
interface AppCommands {
  executeCommandById(id: string): boolean;
  removeCommand(id: string): void;
}

export type EnhancedApp = App & {
  commands: AppCommands;
};

// Editor internals the public typings leave out: CodeMirror 5 (legacy editor) and CodeMirror 6.
export type EnhancedEditor = Editor & {
  cursorCoords?: (where: boolean, mode: string) => Coords;
  coordsAtPos?: (offset: number) => Coords;
  cm: { coordsAtPos?: (offset: number) => Coords | null };
};

// Constructable stylesheets, missing from the TypeScript DOM library this project builds with.
declare global {
  interface CSSStyleSheet {
    replaceSync(text: string): void;
  }
  interface Document {
    adoptedStyleSheets: CSSStyleSheet[];
  }
}

// Obsidian awaits a plugin's onload; newer typings say so, the 0.16 typings this project builds with
// still say void.
declare module "obsidian" {
  interface Plugin_2 {
    onload(): Promise<void> | void;
  }
}
