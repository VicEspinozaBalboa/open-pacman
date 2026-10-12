# AGENTS.md

Vanilla JS/HTML/CSS Pac-Man clone. No build system, no dependencies, no package manager, no tests, no linter.

## Run

There is nothing to build. Open `src/index.html` directly in a browser, or serve `src/` statically (e.g. `python3 -m http.server -d src`). Verify changes by playing the game; there is no test or typecheck command.

## Architecture

- `src/index.html` is the only entrypoint. It loads classic (non-module) scripts in strict order: `maze.js` → `game.js` → `render.js` → `main.js`. There is no bundler and no `type="module"`.
- Cross-file symbols are shared as globals attached to `window`, not via imports. Adding a new JS file requires a `<script>` tag in `index.html` at the correct position.
- Global API contract:
  - `maze.js` → `MAZE`, `TUNNEL_ROW`, `PACMAN_START`, `GHOST_STARTS`
  - `game.js` → `createGame`, `update`, `DIRS`
  - `render.js` → `draw`
  - `main.js` runs the `requestAnimationFrame` loop, keyboard handling, and overlay screens (start/win/lose).
- `game.js` is pure state/logic; `render.js` only draws. Keep that split.

## Game internals

- Maze is a 28x31 numeric grid: `1` wall, `2` dot, `0` empty, `3` ghost-pen door. Encoded as 31 strings in `maze.js`, parsed once. `MAZE` is pristine; `createGame()` copies it into `game.grid` so dots can be eaten and reset.
- Coordinates are cells `(x,y)`, origin top-left, `x∈[0,27]`, `y∈[0,30]`.
- Actors move in fractional cell units with speed in cells/frame (`PACMAN_SPEED`, `GHOST_SPEED`). Direction changes only apply when `aligned()` on an integer cell. The tunnel wraps at `TUNNEL_ROW` (14).

## Code style

- 2-space indent, single quotes, semicolons, spaces inside parens/brackets: `foo( x )`, `arr[ i ]`. Match this; it is consistent across all files.
- Comments are in Spanish. Keep new comments in Spanish.

## Spec-driven workflow

This repo is a teaching project for spec-driven development. Features are designed before coding:

- Specs live in `specs/` (not created yet; `/spec` starts numbering at `01`). Design one with the `spec` skill, which reads `README.md`/`AGENTS.md` for context and writes `specs/NN-slug.md` with a `**Status:**` header.
- Implement with the `spec-impl` skill. It refuses to run unless the spec state means "Approved" / "Aprobado". It creates and switches to a branch named `spec-NN-slug` (governed by `specs/.spec-config.yml` `AutoCreateBranch`, default `true`).
- Never commit on the user's behalf; the skills and this file both treat commits as the user's decision.
- Skills are pinned by `skills-lock.json` (source `klerith/fernando-skills`) and live in `.agents/skills/`.
