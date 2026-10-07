// The two pieces of logic the plugin depends on most, with no Obsidian needed:
// which text colour reads best on a highlight, and finding highlights in a note.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readableTextOn } from "../src/utils/createStyles.ts";
import { findHighlights, asMarkdown, markAt, inNoteOrder } from "../src/utils/highlights.ts";

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

test("#1: finds the highlight the cursor is in, tags included", () => {
  const line = 'Some <mark style="background: #FFF3A3A6;">yellow words</mark> and more';
  const open = '<mark style="background: #FFF3A3A6;">';
  const span = markAt(line, line.indexOf("words"));
  assert.ok(span);
  assert.equal(span.open, open);
  assert.equal(line.slice(span.textStart, span.textEnd), "yellow words");
  assert.equal(span.openStart, 5);
  assert.equal(line.slice(span.openStart, span.closeEnd), `${open}yellow words</mark>`);
  // On either edge of the tags still counts; outside does not.
  assert.ok(markAt(line, span.openStart));
  assert.ok(markAt(line, span.closeEnd));
  assert.equal(markAt(line, 2), null);
  assert.equal(markAt(line, line.length), null);
});

test("#1: with two highlights on a line, picks the one under the cursor", () => {
  const line = '<mark class="hltr-blue">one</mark> gap <mark class="hltr-red">two</mark>';
  const span = markAt(line, line.indexOf("two"));
  assert.equal(span?.open, '<mark class="hltr-red">');
  assert.equal(markAt(line, line.indexOf("gap") + 1), null);
});

test("#2: note order is top to bottom, left to right, whatever the colour", () => {
  const note = ['<mark style="background: #ADCCFFA6;">b1</mark> <mark style="background: #FFF3A3A6;">y1</mark>', "==plain==", '<mark style="background: #FFF3A3A6;">y2</mark>'].join("\n");
  assert.deepEqual(inNoteOrder(findHighlights(note, colours)).map((f) => f.text), ["b1", "y1", "plain", "y2"]);
});

test("#2: copy all in note order lists each highlight with its colour", () => {
  const found = findHighlights('<mark style="background: #FFF3A3A6;">a</mark> <mark style="background: #ADCCFFA6;">b</mark> <mark style="background: #FFF3A3A6;">c</mark>', colours);
  assert.equal(asMarkdown("My note", found, "note"), "# Highlights from [[My note]]\n\n- a (Yellow)\n- b (Blue)\n- c (Yellow)\n");
});
