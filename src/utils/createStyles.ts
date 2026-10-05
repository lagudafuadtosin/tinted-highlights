import type { HighlightrSettings } from "src/settings/settingsData";

function addNewStyle(selector: string, style: string, sheet: { text: string }) {
  sheet.text += selector + `{\n ${style}\n}\n\n`;
}

type RGB = [number, number, number];

// "#RRGGBB", "#RRGGBBAA", "#RGB" or "rgb(a)(...)" to colour and alpha. Null when it is none of those.
function parseColour(value: string): { rgb: RGB; alpha: number } | null {
  const v = value.trim();
  let m = /^#([0-9a-f]{3})$/i.exec(v);
  if (m) {
    const [r, g, b] = m[1].split("").map((c) => parseInt(c + c, 16));
    return { rgb: [r, g, b], alpha: 1 };
  }
  m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(v);
  if (m) {
    const n = m[1];
    const rgb = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16)) as RGB;
    return { rgb, alpha: m[2] ? parseInt(m[2], 16) / 255 : 1 };
  }
  m = /^rgba?\(([^)]+)\)$/i.exec(v);
  if (m) {
    const parts = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    if (parts.length >= 3 && parts.slice(0, 3).every((x) => !isNaN(x))) {
      return { rgb: [parts[0], parts[1], parts[2]], alpha: parts.length > 3 && !isNaN(parts[3]) ? parts[3] : 1 };
    }
  }
  return null;
}

function luminance([r, g, b]: RGB): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

const DARK_TEXT = "#1a1a1a";
const LIGHT_TEXT = "#f5f5f5";

// The text colour that reads best on a highlight, judged on what the highlight actually looks like:
// its colour laid over the theme's background at its own transparency.
export function readableTextOn(highlight: string, background: string): string | null {
  const hl = parseColour(highlight);
  const bg = parseColour(background) ?? { rgb: [255, 255, 255] as RGB, alpha: 1 };
  if (!hl) return null;
  const shown = hl.rgb.map((c, i) => Math.round(c * hl.alpha + bg.rgb[i] * (1 - hl.alpha))) as RGB;
  const l = luminance(shown);
  return contrast(l, luminance([26, 26, 26])) >= contrast(l, luminance([245, 245, 245])) ? DARK_TEXT : LIGHT_TEXT;
}

// The theme's main background, read from the page so it follows theme and light/dark changes.
function themeBackground(): string {
  const value = getComputedStyle(document.body).getPropertyValue("--background-primary").trim();
  return value || getComputedStyle(document.body).backgroundColor || "#ffffff";
}

// The colour rules as CSS text. The plugin puts them in a constructable stylesheet on every window.
export function createStyles(settings: HighlightrSettings): string {
  const styleSheet = { text: "" };

  const background = themeBackground();

  Object.keys(settings.highlighters).forEach((highlighter) => {
    const colorLowercase = highlighter.toLowerCase();
    const value = settings.highlighters[highlighter];
    addNewStyle(
      `.hltr-${colorLowercase},\nmark.hltr-${colorLowercase},\n.markdown-preview-view mark.hltr-${colorLowercase}`,
      `background: ${value};`,
      styleSheet
    );

    // Readable text on any theme (#59, #60, #100, #22, #31): the class and the inline-style form of
    // this colour both get the text colour that contrasts best with it on the current theme.
    if (settings.readableText) {
      const text = readableTextOn(value, background);
      if (text) {
        const inline = value.replace(/"/g, "");
        addNewStyle(
          `mark.hltr-${colorLowercase},\n.hltr-${colorLowercase},\nmark[style*="${inline}" i]`,
          `color: ${text};`,
          styleSheet
        );
      }
    }
  });

  return styleSheet.text;
}
