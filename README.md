# Larder

A web app that keeps cooking recipes as markdown files. It adds dated cook
notes, converts amounts between metric and imperial units, and scales a recipe.

## Requirements

Node 22 or later.

## Run it on a Mac

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Where the recipes live

The app reads and writes `./recipes`. Every recipe sits inside a folder, and
the folder name is the group:

```
recipes/
  breads/
    focaccia.md
  desserts/
    lemon-tart.md
```

The index shows a heading for each folder. To regroup a recipe, change the
Group box in the editor, or move the file yourself.

### Which files the index shows

The app shows a file only when the folder name and the file name both hold
lowercase letters, numbers and hyphens, and nothing else. That rule is what
keeps a name from reaching a path outside the recipes folder.

The app shows nothing and says nothing about:

| Left out | Example |
|---|---|
| A markdown file directly inside the recipes folder | `recipes/notes.md` |
| A folder whose name breaks the rule | `recipes/Main Courses/`, `recipes/.obsidian/` |
| A file whose name breaks the rule | `recipes/breads/Sourdough Loaf.md` |
| A file nested deeper than one folder | `recipes/breads/old/loaf.md` |
| A file that is not markdown | `recipes/breads/photo.jpg` |

So a recipe that does not appear has a name to fix. Rename the folder or the
file to lowercase letters, numbers and hyphens, and it appears on the next
page load. The app never renames anything on its own.

To use another folder, set `RECIPES_DIR`:

```bash
RECIPES_DIR=~/Documents/recipes npm run dev
```

Keep that folder in git. You then have a history of every change, and a way
back if a file becomes wrong.

## Run it on a VPS

```bash
npm install
npm run build
RECIPES_DIR=/srv/recipes npm start -- --hostname 127.0.0.1
```

The app has no authentication. Do not give it a public address. Bind it to
127.0.0.1 and reach it through an SSH tunnel:

```bash
ssh -L 3000:127.0.0.1:3000 user@your-vps
```

## The theme

The app opens in the dark theme. The control in the header, and in the
controls row of a recipe, switches between dark and light.

The choice belongs to the browser, not to the recipe files. It sits in
browser storage under `larder:theme`, beside the unit and layout choices. So
each device keeps its own theme, and a shared server holds none of them.

A printed recipe is always black on white, whichever theme the screen shows.

## The file format

See `docs/superpowers/specs/2026-09-20-recipe-register-design.md`, section 4.
A recipe file stays readable and editable in any text editor. The app keeps
every part of a file that you did not change.

## Deploying

`make deploy` sends this checkout to the server, builds the image there and
starts it. The build runs on the server because that machine is amd64 while a
Mac is arm64.

The settings live in `deploy/Makefile`, which git ignores because it holds the
host address and the paths. Without that file `make deploy` stops and says so.

| Target | What it does |
|---|---|
| `make -C deploy deploy` | Send the code, build, start, then check the container answers |
| `make -C deploy status` | Show the container |
| `make -C deploy logs` | Follow the log |
| `make -C deploy down` | Stop the container |
| `make -C deploy seed` | Copy `my-recipes` to the server. Stops when a file on the server differs. |
| `make -C deploy seed-new` | Copy only the recipes the server does not hold yet |

The app writes to the recipe files on the server: a cook log entry or an edit
made in the browser lives only there. So `seed` compares first and stops when
a file differs, and names each one. `seed-new` adds the files the server does
not have and touches nothing else. `seed FORCE=1` copies everything and loses
those edits, which is almost never what you want.

The app has no authentication. Anyone who reaches the port can read and change
the recipes, so put it only on a network you trust.

## Tests

```bash
npm test     # unit tests
npm run e2e  # four end-to-end tests
```

The most important tests are the round trip tests in
`lib/recipe/serialize.test.ts`. They prove that a file survives a parse and a
serialize with no change to its bytes.
