import type HighlightrPlugin from "src/plugin/main";
import {
  App,
  Setting,
  PluginSettingTab,
  Notice,
  TextComponent,
} from "obsidian";
import Sortable from "sortablejs";
import { HIGHLIGHTER_METHODS, HIGHLIGHTER_STYLES } from "./settingsData";
import { setAttributes } from "src/utils/setAttributes";

export class HighlightrSettingTab extends PluginSettingTab {
  // The colour being edited, when Edit was pressed on it (#58)
  editing: string | null = null;
  plugin: HighlightrPlugin;
  appendMethod: string;

  constructor(app: App, plugin: HighlightrPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    const credit = containerEl.createEl("p", { text: "By " });
    credit.createEl("a", { text: "Fuad Laguda", href: "https://github.com/lagudafuadtosin/tinted-highlights" });
    credit.appendText(". Built on Highlightr, created by ");
    credit.createEl("a", { text: "Chetachi Ezikeuzor", href: "https://github.com/chetachiezikeuzor/Highlightr-Plugin" });
    credit.appendText(".");

    new Setting(containerEl)
      .setName("Choose highlight method")
      .setDesc(
        `Choose between highlighting with inline CSS or CSS classes. Please note that there are pros and cons to both choices. Inline CSS will keep you from being reliant on external CSS files if you choose to export your notes. CSS classes are more flexible and easier to customize.`
      )
      .addDropdown((dropdown) => {
        let methods: Record<string, string> = {};
        HIGHLIGHTER_METHODS.map((method) => (methods[method] = method));
        dropdown.addOptions(methods);
        dropdown
          .setValue(this.plugin.settings.highlighterMethods)
          .onChange((highlightrMethod) => {
            this.plugin.settings.highlighterMethods = highlightrMethod;
            window.setTimeout(() => {
              dispatchEvent(new Event("Highlightr-NewCommand"));
            }, 100);
            void this.plugin.saveSettings();
            void this.plugin.saveData(this.plugin.settings);
            this.display();
          });
      });

    new Setting(containerEl)
      .setName("Readable text on highlights")
      .setDesc(
        "Picks dark or light text for each highlight colour so it stays easy to read on your theme, in light and dark mode. Turn off to keep your theme's own text colour."
      )
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.readableText).onChange(async (on) => {
          this.plugin.settings.readableText = on;
          await this.plugin.saveSettings();
          this.plugin.reloadStyles(this.plugin.settings);
        })
      );

    const stylesSetting = new Setting(containerEl);

    stylesSetting
      .setName("Choose highlight style")
      .setDesc(
        `Depending on your design aesthetic, you may want to customize the style of your highlights. Choose from an assortment of different highlighter styles by using the dropdown. Depending on your theme, this plugin's CSS may be overriden.`
      )
      .addDropdown((dropdown) => {
        let styles: Record<string, string> = {};
        HIGHLIGHTER_STYLES.map((style) => (styles[style] = style));
        dropdown.addOptions(styles);
        dropdown
          .setValue(this.plugin.settings.highlighterStyle)
          .onChange((highlighterStyle) => {
            this.plugin.settings.highlighterStyle = highlighterStyle;
            void this.plugin.saveSettings();
            void this.plugin.saveData(this.plugin.settings);
            this.plugin.refresh();
          });
      });

    const styleDemo = () => {
      // The look of each style lives in styles.css (.highlightr-style-demo-*)
      const d = createEl("p", { cls: "highlightr-style-demo" });
      ["lowlight", "floating", "realistic", "rounded"].forEach((style, i) => {
        if (i > 0) d.appendText(" ");
        d.createSpan({
          cls: `highlightr-style-demo-${style}`,
          text: style.charAt(0).toUpperCase() + style.slice(1),
        });
      });
      return d;
    };

    stylesSetting.infoEl.appendChild(styleDemo());

    const highlighterSetting = new Setting(containerEl);

    highlighterSetting
      .setName("Choose highlight colors")
      .setClass("highlighterplugin-setting-item")
      .setDesc(
        `Create new highlight colors by providing a color name and using the color picker to set the hex code value. Don't forget to save the color before exiting the color picker. Drag and drop the highlight color to change the order for your highlighter component.`
      );

    const colorInput = new TextComponent(highlighterSetting.controlEl);
    colorInput.setPlaceholder("Color name");
    colorInput.inputEl.addClass("highlighter-settings-color");

    const valueInput = new TextComponent(highlighterSetting.controlEl);
    valueInput.setPlaceholder("Color hex code");
    valueInput.inputEl.addClass("highlighter-settings-value");

    // Obsidian's own colour picker. Obsidian 1.13 can open settings in their own window, and the
    // previous picker (Pickr) checked "instanceof Element" against the main window, so the button in
    // the settings window counted as missing, the picker threw, and the Save button never rendered
    // (#112). Obsidian's component works in any window. A colour without transparency gets the same
    // A6 (65%) the old picker added, and the hex box still takes any value typed by hand.
    highlighterSetting
      .addColorPicker((picker) => {
        picker.onChange((hex) => {
          const newColor = hex.length === 7 ? `${hex}A6` : hex;
          colorInput.inputEl.setAttribute(
            "style",
            `background-color: ${newColor}; color: var(--text-normal);`
          );
          setAttributes(valueInput.inputEl, {
            value: newColor,
            style: `background-color: ${newColor}; color: var(--text-normal);`,
          });
          valueInput.setValue(newColor);
        });
      })
      .addButton((button) => {
        button
          .setClass("HighlightrSettingsButton")
          .setClass("HighlightrSettingsButtonAdd")
          .setIcon("highlightr-save")
          .setTooltip("Save")
          .onClick(async (buttonEl: MouseEvent) => {
            const color = colorInput.inputEl.value.trim().replace(/\s+/g, "-");
            const value = valueInput.inputEl.value.trim();
            if (!color || !value) {
              new Notice(
                color ? "Highlighter hex code missing" : value ? "Highlighter name missing" : "Highlighter values missing"
              );
              return;
            }
            const settings = this.plugin.settings;
            const editing = this.editing;
            if (editing && settings.highlighters[editing] !== undefined) {
              // Editing a colour (#58): same place in the list, new name and/or value
              if (color !== editing && settings.highlighters[color] !== undefined) {
                new Notice("This color already exists");
                return;
              }
              if (color !== editing) {
                this.plugin.app.commands.removeCommand(`${this.plugin.manifest.id}:${editing}`);
                delete settings.highlighters[editing];
                settings.highlighterOrder = settings.highlighterOrder.map((k) => (k === editing ? color : k));
              }
              settings.highlighters[color] = value;
              this.editing = null;
              new Notice(`${color} highlight updated`);
            } else {
              if (settings.highlighterOrder.includes(color)) {
                buttonEl.stopImmediatePropagation();
                new Notice("This color already exists");
                return;
              }
              settings.highlighterOrder.push(color);
              settings.highlighters[color] = value;
            }
            window.setTimeout(() => {
              dispatchEvent(new Event("Highlightr-NewCommand"));
            }, 100);
            await this.plugin.saveSettings();
            this.display();
          });
      });

    const highlightersContainer = containerEl.createDiv({
      cls: "HighlightrSettingsTabsContainer",
    });

    Sortable.create(highlightersContainer, {
      animation: 500,
      ghostClass: "highlighter-sortable-ghost",
      chosenClass: "highlighter-sortable-chosen",
      dragClass: "highlighter-sortable-drag",
      dragoverBubble: true,
      forceFallback: true,
      fallbackClass: "highlighter-sortable-fallback",
      easing: "cubic-bezier(1, 0, 0, 1)",
      onSort: (command: { oldIndex: number; newIndex: number }) => {
        const arrayResult = this.plugin.settings.highlighterOrder;
        const [removed] = arrayResult.splice(command.oldIndex, 1);
        arrayResult.splice(command.newIndex, 0, removed);
        this.plugin.settings.highlighterOrder = arrayResult;
        void this.plugin.saveSettings();
      },
    });

    this.plugin.settings.highlighterOrder.forEach((highlighter) => {
      const settingItem = highlightersContainer.createDiv();
      settingItem.addClass("highlighter-item-draggable");
      const colorIcon = settingItem.createSpan();
      colorIcon.addClass("highlighter-setting-icon");
      colorIcon.appendChild(penIcon(colorIcon.ownerDocument, this.plugin.settings.highlighters[highlighter]));

      new Setting(settingItem)
        .setClass("highlighter-setting-item")
        .setName(highlighter)
        .setDesc(this.plugin.settings.highlighters[highlighter])
        .addButton((button) => {
          button
            .setClass("HighlightrSettingsButton")
            .setClass("HighlightrSettingsButtonEdit")
            .setIcon("pencil")
            .setTooltip("Edit")
            .onClick(() => {
              this.editing = highlighter;
              colorInput.setValue(highlighter);
              valueInput.setValue(this.plugin.settings.highlighters[highlighter]);
              colorInput.inputEl.focus();
              colorInput.inputEl.scrollIntoView({ block: "center" });
              new Notice(`Editing ${highlighter}: change the name or colour, then press Save`);
            });
        })
        .addButton((button) => {
          button
            .setClass("HighlightrSettingsButton")
            .setClass("HighlightrSettingsButtonDelete")
            .setIcon("highlightr-delete")
            .setTooltip("Remove")
            .onClick(async () => {
              new Notice(`${highlighter} highlight deleted`);
              this.plugin.app.commands.removeCommand(
                `${this.plugin.manifest.id}:${highlighter}`
              );
              delete this.plugin.settings.highlighters[highlighter];
              this.plugin.settings.highlighterOrder.remove(highlighter);
              window.setTimeout(() => {
                dispatchEvent(new Event("Highlightr-NewCommand"));
              }, 100);
              await this.plugin.saveSettings();
              this.display();
            });
        });

      const a = createEl("a");
      a.setAttribute("href", "");
    });
  }
}

// The pen icon in a colour, built as SVG nodes (the same drawing the list always showed).
const SVG_NS = "http://www.w3.org/2000/svg";
const PEN_PATH =
  "M20.707 5.826l-3.535-3.533a.999.999 0 0 0-1.408-.006L7.096 10.82a1.01 1.01 0 0 0-.273.488l-1.024 4.437L4 18h2.828l1.142-1.129l3.588-.828c.18-.042.345-.133.477-.262l8.667-8.535a1 1 0 0 0 .005-1.42zm-9.369 7.833l-2.121-2.12l7.243-7.131l2.12 2.12l-7.242 7.131zM4 20h16v2H4z";

function penIcon(doc: Document, colour: string): SVGSVGElement {
  const svg = doc.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", colour);
  svg.setAttribute("stroke", colour);
  svg.setAttribute("stroke-width", "0");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  const path = doc.createElementNS(SVG_NS, "path");
  path.setAttribute("d", PEN_PATH);
  svg.appendChild(path);
  return svg;
}
