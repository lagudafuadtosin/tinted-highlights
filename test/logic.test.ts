// The two pieces of logic the plugin depends on most, with no Obsidian needed:
// which text colour reads best on a highlight, and finding highlights in a note.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readableTextOn } from "../src/utils/createStyles.ts";
import { findHighlights, asMarkdown } from "../src/utils/highlights.ts";

const DARK = "#1a1a1a";
const LIGHT = "#f5f5f5";

test("pale highlights get dark text on a dark theme", () => {
  assert.equal(readableTextOn("#FFF3A3A6", "#1e1e1e"), DARK); // yellow
  assert.equal(readableTextOn("#ADCCFFA6", "#1e1e1e"), DARK); // blue
});

test("a strong colour on a dark theme gets light text", () => {
  assert.equal(readableTextOn("#FF5582A6", "#1e1e1e"), LIGHT); // red at 65%
});

test("on a light theme every default colour gets dark text", () => {
  for (const c of ["#FFB8EBA6", "#FF5582A6", "#FFB86CA6", "#FFF3A3A6", "#BBFABBA6", "#ABF7F7A6", "#ADCCFFA6", "#D2B3FFA6", "#CACFD9A6"]) {
    assert.equal(readableTextOn(c, "#ffffff"), DARK, c);
  }
});

test("rgb() theme backgrounds and short hex colours are understood", () => {
  assert.equal(readableTextOn("#000", "rgb(255, 255, 255)"), LIGHT);
  assert.equal(readableTextOn("#fff", "rgb(30, 30, 30)"), DARK);
});

test("an unreadable colour value gives no rule", () => {
  assert.equal(readableTextOn("not a colour", "#ffffff"), null);
});

const colours = { Yellow: "#FFF3A3A6", Blue: "#ADCCFFA6" };

test("finds inline-style, class and ==native== highlights with their positions", () => {
  const note = [
    'Intro <mark style="background: #FFF3A3A6;">first idea</mark> and <mark class="hltr-blue">a fact</mark>.',
    "A ==plain one== here.",
  ].join("\n");
  const found = findHighlights(note, colours);
  assert.deepEqual(
    found.map((f) => [f.colour, f.text, f.line]),
    [["Yellow", "first idea", 0], ["Blue", "a fact", 0], ["Highlight (==)", "plain one", 1]]
  );
  assert.equal(found[0].ch, 6);
});

test("skips highlights inside code blocks", () => {
  const note = ["```", '<mark style="background: #FFF3A3A6;">in code</mark>', "```", '<mark style="background: #FFF3A3A6;">real</mark>'].join("\n");
  assert.deepEqual(findHighlights(note, colours).map((f) => f.text), ["real"]);
});

test("a colour not in settings is kept by its value", () => {
  const found = findHighlights('<mark style="background: #123456A6;">odd</mark>', colours);
  assert.equal(found[0].colour, "#123456A6");
});

test("copy all groups by colour under the note's name", () => {
  const found = findHighlights('<mark style="background: #FFF3A3A6;">a</mark> <mark style="background: #ADCCFFA6;">b</mark> <mark style="background: #FFF3A3A6;">c</mark>', colours);
  assert.equal(asMarkdown("My note", found), "# Highlights from [[My note]]\n\n## Yellow\n- a\n- c\n\n## Blue\n- b\n");
});
