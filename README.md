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
npm test                # logic checks + live endpoint checks (needs LITELLM_API_KEY)
npm run test:offline    # logic checks only
```

`.env` holds `LITELLM_API_KEY`, `LITELLM_BASE_URL`, `LITELLM_MODEL` and is
gitignored. `vite.config.ts` parses that file directly, so a `LITELLM_*`
variable already present in the **process environment does not override it**.
To reach the dev server via a hostname other than localhost, add it to
`server.allowedHosts` in `vite.config.ts`.

## Usage

1. Pick a predefined question set (MITRE ATT&CK analyzer is first).
2. Edit it, or **New question set**, to build your own from the three Laya primitives.
3. Upload a file ≤ 10 MB. Each non-empty line becomes one `state`; enable
   *JSON input* on a template to send JSON lines as structured events.
4. **Analyze all lines** — concurrency 4, live progress.
5. Read the per-question charts, then the results table: filter by text or
   status, sort any column, click a row for that line's full answer + raw JSON.

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
src/api.ts                  questionsPayload() per primitive + sendSystemOne()
src/parser.ts               parses noul/choice/score answers (score = numeric level + legend)
src/aggregate.ts            mean P(true), mean level, distributions, avg prob, mean confidence
src/components/
  ConfigPanel.tsx           endpoint / key / model / path, confidence gate, ping
  TemplatesPanel.tsx        select / edit / duplicate / delete / new
  QuestionsEditor.tsx       the CRUD editor: questions, criteria, labels, checkpoint
  UploadPanel.tsx           file picker (<=10 MB), line count, progress
  Charts.tsx                chart.js: noul doughnut+scatter, choice/score bars
  ResultsTable.tsx          filter, sort, paginate, per-line detail dialog
tests/logic.test.mts        payload/parse/aggregate/validation + live endpoint checks
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
