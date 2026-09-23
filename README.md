# System1 Analyzer

React + TypeScript + Material UI tool that feeds each line of an input file
into the Laya `/v1/systemone` endpoint (MITRE ATT&CK classifier, triage,
phishing preanalysis — the templates from `system1` SAMPLES.md), then
aggregates and visualizes the answers with chart.js.

Runs on **port 8019** (vite dev server).

## Run

```bash
cp .env.example .env    # then put your real LiteLLM key in .env
npm install
npm run dev             # http://localhost:8019
```

Endpoint settings are editable live in the UI (base URL, API key, model,
endpoint path) and default from `.env`:

```env
LITELLM_API_KEY=sk-...
LITELLM_BASE_URL=https://ai.warp.at
LITELLM_MODEL=laya
```

`.env` is gitignored (it holds the key). Vite injects those three keys into
`import.meta.env` directly (see `vite.config.ts`) — process-environment
`LITELLM_*` vars do **not** override `.env`.

To reach the dev server through a hostname other than localhost, list it in
`server.allowedHosts` in `vite.config.ts`.

## Layout

```
src/App.tsx                  orchestration: read file -> fan out requests -> aggregate
src/api.ts                   questionsPayload() + sendSystemOne() (POST {model,state,questions})
src/parser.ts                defensive parser for the /v1/systemone answers shape
src/aggregate.ts             per-question stats (counts, mean prob, mean confidence, avg probs)
src/templates.ts             the SAMPLES.md question templates (MITRE analyzer is default)
src/components/
  ConfigPanel.tsx            endpoint / key / model / path + connectivity ping
  TemplatesPanel.tsx         template selector
  UploadPanel.tsx            file picker (<=10 MB), line count, progress
  Charts.tsx                 chart.js: noul doughnut+scatter, choice/score bar distributions
  ResultsTable.tsx           filterable, sortable, paginated table + per-line detail dialog
```

## Usage

1. Pick a questions template (MITRE analyzer is the default).
2. Upload a file ≤ 10 MB. Each non-empty line becomes one `state`;
   JSON lines are sent as structured events.
3. Hit **Analyze all lines** (concurrency 4, progress bar).
4. Per-line results table + per-question charts: choice/score → bar
   distribution; `noul` → yes/no doughnut + probability scatter.

## Connectivity findings (important)

- `https://ai.warp.at` is a LiteLLM proxy; it is reachable and lists `laya`
  as a model. But **it does not expose `/v1/systemone`** (404), and
  `/v1/chat/completions` with model `laya` fails (404) because the upstream
  Laya server is **not** OpenAI-compatible — it only serves `/v1/systemone`.
- The proxy's `model/info` shows laya's upstream `api_base` is
  `http://ai1.warp.at:8003/v1`, which is **not reachable** from this
  environment (TCP closed).
- So the proxy currently has **no working path to the System 1 model**.
  To use this app end-to-end, either:
  - configure the proxy to expose a `/v1/systemone` route for `laya`, or
  - point the app at a reachable host that serves `/v1/systemone`
    (edit the Endpoint path / Base URL in the UI).
