# virus-game-site

The public face of [Virus Game](https://github.com/UnityInFlow/virus-game): the map, the
leaderboard and the tick history, at
**<https://unityinflow.github.io/virus-game-site/>**.

## What is here

| file                                  | written by                                               |
| ------------------------------------- | -------------------------------------------------------- |
| `index.html`, `src/*.js`, `style.css` | people, in pull requests against this repository         |
| `data/*.json`                         | **the tick**, automatically, after every successful tick |

**Everything under `data/` is generated.** The `publish` job of `tick.yml` in the game
repository pushes it here once a tick has committed its state. Do not edit those files and
do not open pull requests against them: the next tick overwrites the directory whole, so an
edit survives only until a later publication and is never read by anything in between.

The engine, the rules, the game state and the player strains live in the game repository,
which is private. Nothing here decides anything — this is a projection.

## The six documents

The frontend reads only these (spec §47), and they are a deliberately narrow public API:

| file               | what it carries                                                                                             |
| ------------------ | ----------------------------------------------------------------------------------------------------------- |
| `map.json`         | `width`, `height`, `tick`, `players`, and one `[id, ownerIndex \| null, health, energy]` row per cell       |
| `leaderboard.json` | rank, player, cells, percentage of living cells, change since the last tick                                 |
| `players.json`     | per player: cells, kills, and each strain's cells, kills, enabled/suspended, last failure kind              |
| `history.json`     | `players`, `columns`, and one compact row per tick — cells per player, totals, actions, durations, failures |
| `latest-tick.json` | the tick number, its id, the state hash, per-stage durations, and this tick's strain failures               |
| `strains.json`     | current strain runtime/API/hash/state and the exact active entrypoint source, when available                |

`ownerIndex` is an index into `map.json`'s `players`; the same order is used by
`history.json`'s per-tick `cells` array. The browser validates every document and their
shared tick/player relationships before it replaces the map on screen. A failed refresh
keeps the last verified tick visible and reports that the data is temporarily degraded.

`strains.json` is an intentional public-strategy API. Once an enabled, non-suspended
submission is active, the entrypoint it executes is published verbatim for opponents and
spectators. It never includes a path, manifest, helper file, runtime output, environment
value or secret. Players must therefore keep credentials and private material out of their
entrypoint source.

## No build step

There is none, and that is a requirement rather than an omission. `index.html` loads native
browser modules from `src/` and `style.css` as written — no bundler, no framework and no
runtime CDN. A page that shows a game's standings should not be able to fetch new instructions
from a third party between one tick and the next.

Development-only Node packages provide formatting, linting and browser tests. They are never
part of the Pages deployment.

## Develop and verify

```bash
npm ci
npx playwright install chromium
npm test
node tests/server.js                 # then http://127.0.0.1:4173
```

`npm test` runs Prettier, ESLint, pure contract/store tests and Playwright checks at desktop
and mobile viewports. The browser suite intercepts `data/*.json` with checked-in fixtures, so
it never depends on a live tick. CI runs the same command for every pull request and `main`
push.

Fixtures live in `tests/fixtures/`. They cover a normal game, a bootstrap/empty game, ten
players, malformed data, a mixed tick, invalid ownership and a later refresh failure. Keep
generated production files under `data/` out of tests and out of human-authored PRs.

With an empty `data/` the page says so and stops. To see it with real data, run a game in
the game repository and copy the output in:

```bash
./gamectl init --out /tmp/demo --width 24 --height 14 --players alice,bob,carol --seed 42
./gamectl tick --state-dir /tmp/demo --root . --include-samples --executor process --ticks 12
./gamectl generate-site --state-dir /tmp/demo --out path/to/virus-game-site/data
```

## Dates, and why the page is careful about them

`latest-tick.json.generatedAt` is the tick's id, not a timestamp. Tick output must be
byte-identical for the same tick, so the engine reads no clock (spec §12) — and on the
runner the id is the workflow run number. The page therefore takes the age of the data from
the `Last-Modified` header of the response, falls back to `generatedAt` when that parses as
an ISO-8601 instant (which it does for a game ticked locally), and says `run <id>` with no
staleness claim when neither answers. An unknown age is not the same as a fresh one.

## Deployment and rollback

GitHub Pages serves the repository's static files. The game repository's trusted `publish`
job is the only writer of `data/`; a source change here is deployed by merging it to `main`.
If a frontend release needs rollback, revert its source commit in this repository. If a data
publication is missing or stale, investigate the tick/publish workflow in `virus-game`; do
not repair `data/` by hand.
