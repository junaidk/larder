# Recipe Register — Design

Date: 2026-09-20
Status: approved for planning

## 1. Purpose

The recipe register keeps cooking recipes as markdown files. A web UI creates and
edits the recipes. The user adds a dated note each time the user cooks a recipe.
The app converts amounts between metric and imperial units. The app scales a
recipe up or down.

The work is complete when the app meets these criteria:

| # | Criterion |
|---|---|
| 1 | The user creates a recipe in the UI. The app writes a markdown file. |
| 2 | The user edits a markdown file in a text editor. The app shows the change. |
| 3 | The app keeps every part of a file that the user did not change. |
| 4 | The user finds a recipe by text, by tag or by rating. |
| 5 | The user reads amounts in metric or in imperial units. |
| 6 | The user scales a recipe to a different number of servings. |
| 7 | The user adds a dated note with a rating to a recipe. |

## 2. Constraints

- Markdown files are the only store. There is no database.
- The app runs on macOS and on a VPS. One command starts the app.
- The app has no authentication. The app has one user.
- The recipe files stay readable and editable in a plain text editor.

## 3. Storage approach

The markdown files are the correct source of data. The app reads the recipe
folder on each request. The app parses the files that the request needs. The app
holds no index and no cache.

Reason: the files and the app never disagree. The user edits a file in another
editor. The app shows the change on the next page load. There is no
synchronisation step and no second copy of the data.

Cost: the app parses files on each request. A folder of 500 recipes takes a few
milliseconds on an SSD. This cost becomes important only in the thousands.

An SQLite index is a possible later change. The storage module hides the
filesystem from the rest of the app. The index goes behind that module. No other
code changes.

## 4. File format

One file holds one recipe. The path is `recipes/<slug>.md`.

```markdown
---
title: Focaccia
tags: [bread, italian]
serves: 8
prep_time: 20m
cook_time: 25m
source: https://example.com/focaccia
created: 2026-09-20
updated: 2026-09-20
---

# Focaccia

Dimpled, oily, and best on the day. A slow cold rise does most of the work.

## Ingredients

- 500 g strong white flour
- 350 ml warm water
- 7 g instant yeast
- 10 g fine salt
- a good pinch of sea salt

### For the topping

- 3 tbsp olive oil
- 2 sprigs rosemary

## Method

1. Mix the flour, water, and yeast. Rest for 30 minutes.
2. Add the salt and fold the dough four times.
3. Cold rise overnight, at least 12 hours.
4. Dimple into an oiled tray. Bake at 220C for 25 minutes.

## Notes

Use a metal tray, not glass. The base browns much better.

## Cook Log

### 2026-09-14 — ★★★★☆

Too salty. Next time 1 tsp salt, not 2. Oven ran hot; 190C was plenty.

### 2026-08-02 — ★★★☆☆

First attempt. Dough was slack. Hold back 20 g of the water.
```

### 4.1 Structural rules

Four items have a structural function:

1. The YAML frontmatter block.
2. The `## Ingredients` heading.
3. The `## Method` heading.
4. The `## Cook Log` heading.

The parser matches the heading names without regard to case. All other content
is free text. The app keeps the free text as written.

### 4.2 Frontmatter fields

| Field | Required | Notes |
|---|---|---|
| `title` | yes | The display name. |
| `tags` | no | A list of strings. The index page filters on these. |
| `serves` | no | The number of servings. Scale to servings needs this field. |
| `prep_time` | no | A duration, such as `20m` or `1h30m`. |
| `cook_time` | no | A duration, in the same form. |
| `source` | no | Free text. A URL, a book and page, or a person. |
| `created` | no | The app sets this field. |
| `updated` | no | The app sets this field. |

### 4.3 Sections

`## Notes` holds facts that are always true for the recipe. An example is "use a
metal tray". `## Cook Log` holds what happened on one day. The two sections have
different purposes. The app keeps them apart.

A `###` heading inside `## Ingredients` starts a named group. The example above
uses `For the topping`. Groups are optional. Groups do not nest more deeply.
Scale and unit conversion apply to all groups at the same time.

### 4.4 Cook log entries

Each entry is a `###` heading with the date. The date uses the form
`YYYY-MM-DD`. An optional rating follows an em dash. The rating uses five stars,
filled and empty, such as `★★★★☆`. The note text follows the heading. The app
puts a new entry at the top of the section, so the newest entry is first.

### 4.5 Filename

The app makes the filename once, from a slug of the title. The app never renames
the file after that. A change of title does not change the path. The path stays
a stable link.

## 5. Architecture

Next.js with the App Router, TypeScript and Tailwind CSS. One process serves the
UI and the file operations.

```
app/
  page.tsx                 recipe index: search and filters
  r/[slug]/page.tsx        recipe view, with scale and unit controls
  r/[slug]/edit/page.tsx   the two-pane editor
  new/page.tsx             the same editor, with no content
lib/
  storage/index.ts       the only module that reads or writes the filesystem
  recipe/parse.ts        markdown text to a Recipe object
  recipe/serialize.ts    a Recipe object to markdown text
  recipe/ingredient.ts   one ingredient line to and from a structured amount
  units/convert.ts       metric and imperial conversion, pure functions
  units/scale.ts         scale factors and fraction format, pure functions
components/              form rows, preview pane, cook log dialog
recipes/                 the markdown files
```

The `storage` module is the only code that knows about the filesystem. All code
above it uses `Recipe` objects. All code below it uses strings. This boundary
lets the parser tests run with no files. It also keeps the SQLite index of
section 3 to one module.

The environment variable `RECIPES_DIR` sets the recipe folder. The default is
`./recipes`. On a VPS the variable points to a mounted volume.

Writes use Next.js server actions. Every write is atomic. The app writes a
temporary file in the target directory. The app then renames the temporary file
over the target. A crash cannot leave a part of a recipe.

The `storage` module has two guards:

- A slug must match `^[a-z0-9-]+$`. This guard stops a path escape.
- A new slug that already exists gets a numeric suffix. This guard stops an
  overwrite.

## 6. The editor

The editor screen has two panes. The form is on the left. The markdown file is
on the right. The right pane updates as the user types.

Rules:

1. **One text box holds one ingredient line.** The user types
   `500 g strong white flour` as one line. The app parses the line as the user
   types. Small grey text below the box shows the result: `500 · g · strong
   white flour`. Three separate boxes are slower to fill and handle irregular
   lines badly.
2. **A line that the parser cannot read is a normal result.** The line `a good
   pinch of sea salt` gets the grey label `text only — will not scale`. The
   label is not an error. The app saves the line as typed.
3. **The right pane shows the file.** It shows the exact bytes that the app
   writes, with the frontmatter. The user checks the result before the save.
4. **An existing recipe makes a round trip.** The app parses the file into the
   form. A line that the parser cannot read becomes a plain row. The app
   rewrites only the sections that it owns. The app never reorders ingredients,
   changes units or changes words.
5. **The cook log is not part of this form.** The recipe page has an "I cooked
   this" button. The button opens a small dialog with a date, a rating and a
   note. The dialog adds one entry at the top of `## Cook Log`.

On a phone the right pane collapses behind a tab. A phone is for reading a
recipe and for adding a note.

## 7. The ingredient parser

Each ingredient line has one of three classes. The class controls what the app
can do with the line.

| Class | Example | Scales | Converts |
|---|---|---|---|
| Measured | `500 g strong white flour` | yes | yes |
| Counted | `3 cloves garlic, minced` and `2 eggs` | yes | no |
| Text | `a good pinch of sea salt` | no | no |

The parser reads a line as `quantity unit item, prep`.

- The quantity accepts whole numbers, decimals, `1/2`, `1 1/2`, unicode
  fractions such as `½`, and ranges such as `2-3`.
- The parser matches the unit against a table of units and aliases. The forms
  `g`, `gram` and `grams` are one unit. The forms `tbsp`, `tablespoon` and `T`
  are one unit.
- A word after the quantity that is not a known unit is part of the item. This
  rule makes `2 eggs` a Counted line with no unit.
- A line with no quantity at the start is a Text line. The app leaves the line
  alone.
- Text after the first comma is the prep. The app keeps the prep and never
  scales it.

Count units are `clove`, `sprig`, `slice`, `tin` and similar words. These units
scale but never convert. There is no imperial clove. A scaled count keeps a
fraction. One half of `3 eggs` shows as `1 1/2 eggs`.

This table is the contract of the parser. The tests in section 10 enforce it.

## 8. Unit conversion

Conversion changes the display only. The app never writes a converted value to a
file.

The control has two positions: Metric and Imperial. The app keeps the choice in
`localStorage`. The choice is also in the URL as `?units=imperial`. A converted
view is therefore a link.

The app converts inside one dimension only:

| Dimension | Metric | Imperial |
|---|---|---|
| Mass | g, kg | oz, lb |
| Volume | ml, l | fl oz, cup, pint |
| Temperature | C | F |
| Length | cm | inch |

**The app does not convert mass to volume.** That conversion needs the density
of the ingredient. A cup of flour and a cup of sugar differ by about 40 percent.
A cup of flour also differs from itself with the method of filling. A user who
wants cups types cups. The app converts those cups to fl oz and to pints.

Oven temperatures are in the method text, not in the ingredients. Conversion
therefore also reads the method text. It finds `220C`, `220°C` and
`220 degrees`. It shows `425F` in place of `220C`. The parser accepts a gas mark
as an input. The app does not produce a gas mark as an output.

The app rounds a converted number to a useful precision. `500 g` shows as
`17.6 oz`, not `17.63698 oz`. Spoon and cup volumes round to a useful fraction,
so the user reads `1/4 cup`, not `0.26 cup`. Each unit has its own rounding
rule.

## 9. Scale

Scale changes the display only. The app never writes a scaled value to a file.

The user sets the factor in three ways:

1. The preset buttons `1/2`, `2x` and `3x`.
2. A free text factor box.
3. A "scale to N servings" box. This box needs the `serves` field.

The factor is in the URL as `?scale=0.5`.

The app shows a scaled amount as a fraction, not as a decimal. The formatter
prefers halves, thirds, quarters and eighths. These are the marks on real
measuring spoons. One half of `1 tsp` is `1/2 tsp`. Double `3/4 cup` is
`1 1/2 cups`. A value with no tidy fraction falls back to two significant
figures.

A unit promotes itself when the number becomes awkward. Three times `500 g` is
`1.5 kg`, not `1500 g`. The same rule applies to ml and litres.

**Scale applies to the ingredient list only.** The app does not change the
method text. Double a recipe and the bake time stays the same. An app that
changed `bake for 25 minutes` into `50 minutes` would be dangerous.

The cost of this rule: a step that reads `divide the dough into 2` keeps the
number 2 at double scale. This cost is much smaller than the risk of a wrong
time or a wrong temperature.

A reset control shows when a scale or a conversion is active. It sits with the
other controls. The control going away is how the user reads that the view now
matches the file.

An earlier version of this design also put a banner above the recipe, which
said that the view was not the file. The user asked for the banner to go. The
buttons already show which system and which scale are active, so the banner
repeated what the controls said.

## 10. Tests

The first guarantee is the round trip. A file survives parse and serialize
without a change. The tests for this guarantee come first.

**Round trip tests.** A set of fixture files goes through `parse` and then
`serialize`. The output must equal the input byte for byte. The fixture set
holds the difficult cases:

- a file with no frontmatter
- a file with ingredient groups
- a file with ingredient lines that the parser cannot read
- a file with a long cook log
- a file with unicode fractions
- a file with Windows line endings
- a file with sub-headings inside `## Notes`

A file that fails the round trip shows a fault in the serializer. It does not
show a bad file.

**Ingredient parser tests.** A table maps an input line to the expected class,
quantity, unit, item and prep. The table holds these lines:

- `2 eggs`
- `3 cloves garlic, minced`
- `1 1/2 tbsp olive oil`
- `½ lemon, juiced`
- `2-3 sprigs thyme`
- `a good pinch of sea salt`

**Conversion and scale tests.** Known pairs convert in both directions. The
result returns to the original value inside the rounding tolerance. Separate
tests cover the fraction formatter and the unit promotion limits.

**Storage tests.** These tests use a temporary directory. They check three
results:

- An atomic write leaves no temporary file.
- A repeated slug gets a numeric suffix.
- The module rejects a slug that holds `../`.

**One end-to-end test** with Playwright. It covers this path:

1. Create a recipe in the editor and save it.
2. Read the new file from disk.
3. Open the recipe and add a cook log entry.
4. Confirm that the app adds the entry at the top of the cook log.
5. Confirm that the rest of the file has no change.

Vitest runs the unit tests. Development follows test-first order. The parser
gains the most from this order.

## 11. Out of scope for version 1

| Item | Note |
|---|---|
| Import from a URL | The largest item. It also depends on other websites. |
| Photos | A later frontmatter field and a display block. It breaks no file. |
| Authentication and multiple users | The app has one user. |
| Print view, shopping lists, meal plans, nutrition | Not needed for the register. |
| The SQLite index | Add it when the index page becomes slow. |

## 12. Risks

| Risk | Response |
|---|---|
| The app has no authentication. A public VPS address exposes the data. | Bind the app to localhost. Reach it through an SSH tunnel or a private network. |
| A serializer fault could damage a file. | Atomic writes and the round trip tests of section 10. Keep the recipe folder in git for a history. |
| The parser reads an ingredient line in the wrong way. | The three classes of section 7. An unreadable line stays as text and never changes. |
