# scripts — Data import & validation (OWNER: Developer 2)

| Planned script | Issue | Purpose |
|---|---|---|
| `build-db.ts` (`npm run db:build`) | DATA-01 | Load `$COSTAR_KIT_DIR/data/*.jsonl` into `$DUCKDB_PATH`; build normalized tables (`properties`, `spaces`, `tenants_current`, `comps`, `matterport_models`, `sale_listings`) |
| `verify-matches.ts` | DATA-06 | Check CoStar ↔ Matterport ↔ Vexcel links for the demo properties |

Scripts read the kit from outside the repo and write only to gitignored paths (`data/`, `.cache/`).
