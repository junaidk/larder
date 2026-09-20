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

The app reads and writes `./recipes`. To use another folder, set `RECIPES_DIR`:

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

## Tests

```bash
npm test     # unit tests
npm run e2e  # one end-to-end test
```

The most important tests are the round trip tests in
`lib/recipe/serialize.test.ts`. They prove that a file survives a parse and a
serialize with no change to its bytes.
