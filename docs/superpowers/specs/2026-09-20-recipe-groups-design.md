# Recipe Groups by Folder — Design

Date: 2026-09-20
Status: approved for planning
Extends: `docs/superpowers/specs/2026-09-20-recipe-register-design.md`

## 1. Purpose

The recipe register keeps every recipe in one flat folder. The user wants to
group the recipes, for example into breads and desserts. A folder on disk
carries the group. The index shows a heading for each folder.

The work is complete when the app meets these criteria:

| # | Criterion |
|---|---|
| 1 | A recipe lives at `recipes/<group>/<slug>.md`. |
| 2 | The index groups the recipes under a heading for each folder. |
| 3 | The user creates a recipe into a group from the editor. |
| 4 | The user changes the group of a recipe. The app moves the file. |
| 5 | The app names a folder whose name it cannot use, and a file inside a group whose name it cannot use. It does not hide those. |
| 6 | A group name or a slug cannot reach a path outside the recipe folder. |

## 2. Constraints

- Markdown files stay the only store. There is no database.
- The folder structure is exactly one level deep.
- Every recipe belongs to a group.
- The content of a recipe file does not change. This design moves files only.
- `lib/storage/index.ts` stays the only module that reads or writes the
  filesystem.
- Every write stays atomic.

## 3. Data model

The path of a recipe is `recipes/<group>/<slug>.md`.

The identity of a recipe becomes the pair of `group` and `slug`. A single slug
is no longer enough, because two groups may hold the same slug.

A new type carries the pair:

```ts
export interface RecipeRef {
  group: string
  slug: string
}
```

`RecipeSummary` gains a `group` field. The storage module builds that type,
so the parser is not involved.

`Recipe` gains an OPTIONAL `group` field. The field must be optional, because
`parseRecipe` builds a `Recipe` and section 11 keeps the parser untouched. The
parser leaves the field unset. `readRecipe` sets it after the parse.

A function that writes a recipe therefore takes the reference as its own
argument. It does not read the group off the recipe, because an optional field
may be missing:

```ts
saveRecipe(ref: RecipeRef, recipe: Recipe): Promise<void>
```

Both `group` and `slug` must match `^[a-z0-9-]+$`. The app checks each part
before it joins the part into a path. This rule stops a path escape. The
existing function `isSafeSlug` becomes `isSafeName`, because it now checks a
group name as well as a slug.

Two groups may hold the same slug. Inside one group a repeated slug gets a
numeric suffix, as it does today.

## 4. A file outside a folder

A markdown file directly inside `recipes/` is not a valid recipe location
after this change. The app must not hide such a file.

`listRecipes` returns the loose file names beside the recipes:

```ts
listRecipes(): Promise<{ recipes: RecipeSummary[]; looseFiles: string[] }>
```

`listRecipes` still returns `looseFiles`, and the storage tests still cover
it, but the index does not show a notice for it. The user asked for that
notice to go, because the one file sitting outside a folder is there on
purpose. The cost: a file that lands outside a folder by accident now does
not appear and nothing says so.

`listRecipes` also reports the names it had to reject, in `unusableNames`:

```ts
listRecipes(): Promise<{
  recipes: RecipeSummary[]
  looseFiles: string[]
  unusableNames: string[]
}>
```

A folder name or a file name that fails `^[a-z0-9-]+$` goes in that list. A
folder called `Main Courses` would otherwise hide every recipe inside it with
no message. The index names these in their own notice, with different wording,
because a name the app cannot use and a file outside a folder are different
problems with different fixes.

## 5. The storage module

| Function | Change |
|---|---|
| `listGroups()` | New. Returns the folder names, sorted. |
| `listRecipes()` | Returns `{ recipes, looseFiles }`. |
| `readRecipe(ref)` | Takes a `RecipeRef`. |
| `saveRecipe(ref, recipe)` | Takes the reference. Writes to that group. |
| `createRecipe(group, title, markdown)` | Takes a group. Returns a `RecipeRef`. |
| `moveRecipe(from, to)` | New. Moves a file between groups. |
| `addLogEntry(ref, entry)` | Takes a `RecipeRef`. |
| `deleteLogEntry(ref, index)` | Takes a `RecipeRef`. |
| `isSafeName(name)` | Replaces `isSafeSlug`. Checks a group or a slug. |

`createRecipe` makes the group directory when the directory is absent.

Writes stay atomic. The temporary file goes into the group directory, so the
`link` call stays on one filesystem. `moveRecipe` uses the same pattern: it
links the new path, then unlinks the old path. The link fails with `EEXIST`
when a file already holds the target path, so a move never overwrites a
recipe.

## 6. Routing

| Route | Purpose |
|---|---|
| `/r/<group>/<slug>` | The recipe view. |
| `/r/<group>/<slug>/edit` | The editor. |

The old route `/r/<slug>` goes away. A link made before this change returns
404. The user accepted this cost.

## 7. The index

The index shows a heading for each group. The headings are in alphabetical
order. Each heading shows the number of recipes below it.

The search box, the tag filter and the rating filter work as they do today.
They apply inside the groups. A group whose recipes all fail a filter does not
appear.

The grid view and the list view both keep working.

## 8. The editor

The editor gains a Group box. The box lists the groups that already exist. The
box also accepts a new name. The field is required.

The app slugifies what the user types, so `Main Courses` becomes
`main-courses`.

On a save of an existing recipe:

1. The app compares the group in the form against the group of the file.
2. The groups match: the app saves the file where it is.
3. The groups differ: the app moves the file, then sends the user to the new
   URL.

### 8.1 The server actions

The server actions in `app/actions.ts` take a slug today. Each one now takes a
`RecipeRef`, because a slug alone no longer names a recipe.

| Action | Change |
|---|---|
| `addLogEntryAction(ref, form)` | Takes a `RecipeRef`. |
| `deleteLogEntryAction(ref, index)` | Takes a `RecipeRef`. |
| `saveRecipeAction(ref, group, markdown, title)` | Takes the current `RecipeRef` or `null` for a new recipe, and the group from the form. |

Each action checks both parts of the ref with `isSafeName` before it calls the
storage module.

### 8.2 The slug does not change

Section 4.5 of the main design states that the app names a file once and never
renames it. That rule still holds. A change of the title does not change the
slug. A change of the group moves the file into another directory, and the
slug goes with it.

## 9. Error handling

| Case | Result |
|---|---|
| A group or a slug fails `^[a-z0-9-]+$` | The app throws before it joins a path. |
| A move finds a file at the target path | The app reports the clash. It keeps both files. |
| A save names a recipe that no longer exists | The app reports that the recipe is gone. |
| A group directory is absent on a create | The app makes the directory. |
| A recipe is absent | The page returns 404. |

## 10. Tests

New tests for the storage module:

- The module reads and writes a recipe inside a group.
- A group name that holds `../` is rejected.
- A slug that holds `../` is rejected.
- Two groups may hold the same slug.
- A repeated slug inside one group gets a numeric suffix.
- `moveRecipe` moves the file and leaves the content without a change.
- `moveRecipe` refuses to overwrite a file at the target path.
- `listRecipes` reports a loose file and leaves it out of the recipes.
- A failed create leaves no temporary file.

One end-to-end test:

1. Create a recipe into a group from the editor.
2. Read the file at `recipes/<group>/<slug>.md`.
3. Open the recipe at `/r/<group>/<slug>`.
4. Change the group and save.
5. Confirm the file moved and the content did not change.
6. Confirm the browser is at the new URL.

## 11. What does not change

`lib/recipe/parse.ts` and `lib/recipe/serialize.ts` are not touched. The
round trip over the seven fixture files is the core guarantee of the project,
and this design does not go near it. This change moves files. It never edits
the content of a recipe.

The markdown format of section 4 of the main design does not change.

## 12. Migration

The app moves `recipes/focaccia.md` to `recipes/breads/focaccia.md`, as one
step of the work.

The app leaves `recipes/x.md` where it is. The index names that file in the
notice of section 4. The user files it later.

## 13. Risks

| Risk | Response |
|---|---|
| A move could lose a recipe. | `moveRecipe` links the new path before it unlinks the old path. The content exists at one path or at both paths, never at neither. |
| A group name could reach outside the recipe folder. | Section 3 checks each part of the path against `^[a-z0-9-]+$` before any join. A test covers `../` in each part. |
| A link saved before this change breaks. | The user accepted this cost. Section 6 records the decision. |
| A loose file could become invisible. | Section 4 names every loose file on the index. |
