# system1tools

Tools for working with [Laya](https://huggingface.co/convaiinnovations/laya),
the multilingual non-autoregressive System 1 decision model, served behind a
LiteLLM proxy.

## Layout

```
system1tools/
├── webapp/       ← THE PROJECT: React + TS + MUI + chart.js analysis tool
└── system1/      ← NOT PART OF THIS REPO (ignored): a local clone of
                    github.com/cloudn1ne/system1, kept only for reference —
                    its Dockerfile, docker-compose.yml and SAMPLES.md describe
                    the server this tool talks to.
```

Everything actionable lives in **[`webapp/`](webapp/README.md)** — its README is
the detailed reference (usage, Laya feature coverage, import/export format,
proxy/relay setup, endpoint notes).

Quick start:

```bash
cd webapp
cp .env.example .env     # add your LiteLLM API key
npm install
npm run dev              # http://localhost:8019
npm test                 # logic + live endpoint checks
```

## What the webapp does

Uploads a file, sends every line (or a bounded prefix of them) as a `state` to
the Jev-compatible `POST /v1/systemone` endpoint with a set of typed questions
(`noul`, `choice`, `score`), then aggregates the answers statistically and
charts them with chart.js. Question sets are editable in the browser and
portable as JSON. Requests can go straight from the browser or through the dev
server's relay, which is how a proxy-only endpoint is reached. See
[`webapp/README.md`](webapp/README.md).
