# Recipe Register

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

A markdown file directly inside `recipes/` is not a recipe location. The index
names such a file so that it is never hidden.

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
| `make -C deploy seed` | Copy `my-recipes` to the server. Never part of a deploy. |

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
