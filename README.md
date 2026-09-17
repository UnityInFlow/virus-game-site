# virus-game-site

The public face of [Virus Game](https://github.com/UnityInFlow/virus-game): the map, the
leaderboard and the tick history, at
**<https://unityinflow.github.io/virus-game-site/>**.

## What is here

| file | written by |
|---|---|
| `index.html`, `app.js`, `style.css` | people, in pull requests against this repository |
| `data/*.json` | **the tick**, automatically, after every successful tick |

**Everything under `data/` is generated.** The `publish` job of `tick.yml` in the game
repository pushes it here once a tick has committed its state. Do not edit those files and
do not open pull requests against them: the next tick overwrites the directory whole, so an
edit survives at most three hours and is never read by anything in between.

The engine, the rules, the game state and the player strains live in the game repository,
which is private. Nothing here decides anything — this is a projection.

## The five documents

The frontend reads only these (spec §47), and they are a deliberately narrow public API:

| file | what it carries |
|---|---|
| `map.json` | `width`, `height`, `tick`, `players`, and one `[id, ownerIndex \| null, health, energy]` row per cell |
| `leaderboard.json` | rank, player, cells, percentage of living cells, change since the last tick |
| `players.json` | per player: cells, kills, and each strain's cells, kills, enabled/suspended, last failure kind |
| `history.json` | `players`, `columns`, and one compact row per tick — cells per player, totals, actions, durations, failures |
| `latest-tick.json` | the tick number, its id, the state hash, per-stage durations, and this tick's strain failures |

`ownerIndex` is an index into `map.json`'s `players`; the same order is used by
`history.json`'s per-tick `cells` array.

## No build step

There is none, and that is a requirement rather than an omission. `index.html` loads
`app.js` and `style.css` as written — no bundler, no framework, no CDN, no dependency, and
no workflow in this repository. A page that shows a game's standings should not be able to
fetch new instructions from a third party between one tick and the next.

To work on it, serve the directory and open it:

```bash
python3 -m http.server 8000     # then http://127.0.0.1:8000
```

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
