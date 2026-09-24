# System1 Analyzer

React + TypeScript + Material UI tool for [Laya](https://huggingface.co/convaiinnovations/laya),
the non-autoregressive System 1 decision model. Upload a file, send each line as a
`state` to the Jev-compatible `POST /v1/systemone` endpoint with a set of typed
questions, then aggregate and visualize the answers with chart.js.

Runs on **port 8019** (vite dev server).

## Run

```bash
cp .env.example .env    # put your real LiteLLM key in .env
npm install
npm run dev             # http://localhost:8019
npm run build           # typecheck + production bundle in dist/
npm run preview         # serve dist/ - keeps the relay, unlike static hosting
npm test                # logic checks + live endpoint checks (needs LITELLM_API_KEY)
npm run test:offline    # logic checks only
```

`.env` holds `LITELLM_API_KEY`, `LITELLM_BASE_URL`, `LITELLM_MODEL` and is
gitignored. `vite.config.ts` parses that file directly, so a `LITELLM_*`
variable already present in the **process environment does not override it**.
To reach the dev server via a hostname other than localhost, add it to
`server.allowedHosts` in `vite.config.ts`.

## Reaching the endpoint (proxy)

A browser cannot route a single `fetch()` through a proxy, so the app offers two
network paths (bottom of the **LiteLLM endpoint** panel):

| Path | What happens | Use when |
|---|---|---|
| **direct from browser** | browser POSTs to the base URL | the endpoint is reachable from the workstation, and its CORS lets this origin |
| **dev-server relay** (default) | browser POSTs to `/__relay`; the vite server forwards from node | the endpoint needs a proxy, or you want CORS out of the way |

In relay mode, three proxy choices are offered:

- **from server environment** (default) — the dev server uses `HTTPS_PROXY` /
  `ALL_PROXY` / `HTTP_PROXY` (or the same keys in `.env`). The value is never
  sent to the browser, so a proxy password stays server-side.
- **custom URL** — typed in the UI, e.g. `http://user:pass@proxy.internal:3128`.
  Sent per request as `X-Relay-Proxy`; it overrides the environment.
- **no proxy** — relayed, but the dev server connects directly.

The relay will only forward to `LITELLM_BASE_URL`'s origin. Anything else gets
`403`, which stops the dev server being turned into an open proxy; list extra
hosts with `RELAY_ALLOWED_ORIGINS=https://a,https://b` if you point the UI at
another endpoint at runtime. Startup logs the proxy it picked, with credentials
redacted.

The relay is mounted on both `npm run dev` and `npm run preview`, so it works
when the built bundle is served by vite. If you serve `dist/` from something
else (nginx, object storage), there is no node in the loop: choose *direct from
browser*, or mount `createRelayHandler` from `dev/relay.ts` in your own node
server - it is plain connect-style middleware taking `allowedOrigins` and
`defaultProxy`. The relay is request-body limited (4 MB) with a 60 s upstream
timeout.

## Usage

1. Pick a predefined question set (MITRE ATT&CK analyzer is first).
2. Edit it, or **New question set**, to build your own from the three Laya primitives.
3. Upload a file ≤ 10 MB. Each non-empty line becomes one `state`; enable
   *JSON input* on a template to send JSON lines as structured events.
4. Optionally set **limit lines** (default: *all lines*). Tick it and pick a
   preset (10/50/100/500) or type any count — the panel then tells you how
   many lines will be analysed and how many are skipped. The limit slices the
   loaded lines; it never discards them, so you can raise it and re-run.
5. **Analyse N lines** — concurrency 4, live progress.
6. Read the per-question charts, then the results table: filter by text or
   status, sort any column, click a row for that line's full answer + raw JSON.

## Import / export

Everything is plain JSON, so question sets move between browsers, repos and
curl examples without this app involved.

| Action | Where | Result |
|---|---|---|
| Export **all** sets in one file | ⤓ icon in the *Predefined questions* header | `system1-questions-N-sets.json` |
| Export **one** set | ⤓ icon on a set's row, or *Export this set* in the editor | `<set-name>.json` |
| Export **one question** | copy icon on a question row in the editor | that question as JSON on the clipboard |
| Import | ⤒ icon in the header, or *Import* | merges, reports added/replaced/skipped |

Import is deliberately tolerant — it accepts any of:

```jsonc
{ "system1-analyzer": 1, "templates": [ … ] }   // anything this app exported
[ { "label": "…", "questions": { … } } ]         // a bare array of sets
{ "questions": { … }, "checkpoint": "english" }  // a wrapped set with metadata
{ "dept": { "type": "choice", … } }              // a raw Laya questions map
{ "type": "noul", "instructions": "…" }          // one lone question
```

That means you can save the `-d '{…}'` body of any Laya or Jev `curl` example —
including the four in `system1/SAMPLES.md` — and import it directly: the
imported set re-sends byte-identical `questions`. Entries that are not a
`noul`/`choice`/`score` question are skipped and named in the result notice,
never silently dropped. Importing a set whose `id` already exists **replaces**
it, so an edited export round-trips; new ids are appended.

## Laya feature coverage

Request: `{ state, questions }` POSTed to `${LITELLM_BASE_URL}/v1/systemone`
with `Authorization: Bearer ${LITELLM_API_KEY}`.

| Laya feature | In the app |
|---|---|
| `noul` — calibrated P(true) | editor + doughnut/scatter, mean P(true) |
| `choice` — `{key: description}` map **or** plain list | editor map/list toggle, distribution + avg probability per option |
| `score` — ordinal levels, expected level + legend | editor level list with reorder, mean level / max level, distribution |
| `noul` `criteria` keyed only `true`/`false` | editor rejects any other key (the server answers 422) |
| `noul` `labels` override (`false`/`true`, distinct) | editor fields + "must differ" validation |
| Checkpoint pin: `english` / `multilingual` / `typed-decisions` | per-template `checkpoint` select |
| Auto routing (omit `model`) | `checkpoint: auto` — Router picks by script/language |
| Empty option descriptions (`{"coding": null}`) | supported, as in Laya's own presets |
| `confidence` per answer | shown everywhere; confidence-gate slider flags low-confidence answers |
| Routing metadata (`model`, `repo`, `reason`, `detection`) | per-line detail dialog + connectivity ping |
| Structured JSON states | per-template *JSON input* switch |
| ≤ 10 MB input files | enforced in the uploader |
| Analyse a bounded prefix of the file | **limit lines** control, default *all lines* |
| Portable question sets | JSON import/export, per set and all-in-one (`src/io.ts`) |

Client-side validation also warns about the two documented model pitfalls before
you burn a run: boolean-word `choice` keys (`true`/`false`/`yes`/`no` — the
checkpoints can follow the label instead of the state, #156) and > 20 options in
one question (options share a fixed `head_max_len` token budget).

Laya's own workflow presets from
[`laya/presets.py`](https://github.com/NandhaKishorM/laya/blob/main/laya/presets.py)
ship as editable question sets: ticket triage, email triage, prompt guardrails,
content moderation, model router. The four `SAMPLES.md` shapes from the
[`cloudn1ne/system1`](https://github.com/cloudn1ne/system1) repo ship alongside them.

### Known model caveats (from the model card)

- Probabilities ship **over-confident**; refit a temperature per (type, option
  count) on your own data before treating them as calibrated.
- `action.act_probability` carries no usable signal (#185) — gate on
  `confidence` instead. The app surfaces confidence and ignores `act_probability`.
- Ordinal `score` is the weakest primitive, and `laya-multilingual` has a
  position bias on score levels (#131). For English score questions pin
  `checkpoint: english`.

## Layout

```
src/presets.ts              built-in question sets (SAMPLES + Laya presets)
src/templatesStore.ts       localStorage CRUD for predefined question sets
src/validation.ts           Laya's question rules, checked before any request
src/io.ts                   JSON export + tolerant multi-shape import
src/api.ts                  questionsPayload() per primitive + sendSystemOne()
src/parser.ts               parses noul/choice/score answers (score = numeric level + legend)
src/aggregate.ts            mean P(true), mean level, distributions, avg prob, mean confidence
src/components/
  ConfigPanel.tsx           endpoint / key / model / path, confidence gate, ping
  TemplatesPanel.tsx        select / edit / duplicate / delete / new / import / export
  QuestionsEditor.tsx       the CRUD editor: questions, criteria, labels, checkpoint,
                            per-question copy-as-JSON, export this set
  UploadPanel.tsx           file picker (<=10 MB), limit-lines control, progress
  Charts.tsx                chart.js: noul doughnut+scatter, choice/score bars
  ResultsTable.tsx          filter, sort, paginate, per-line detail dialog
tests/logic.test.mts        payload/parse/aggregate/validation/io + live endpoint checks
```

## Endpoint note

`https://ai.warp.at` is a LiteLLM proxy. `POST /v1/systemone` only works because
the proxy is configured with a passthrough route for it:

```yaml
litellm_settings:
  passthrough_routes:
    - path: "/v1/systemone"
      target: "http://ai1.warp.at:8001"
```

The proxy's standard `/v1/chat/completions` route **cannot** serve `laya`: the
upstream is not OpenAI-compatible, so it 404s. `GET /v1/models` does list
`laya`, which makes the failure easy to misread as a bad key.
