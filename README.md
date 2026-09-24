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

Everything actionable lives in **[`webapp/`](webapp/README.md)**. Its README is
the detailed reference (usage, Laya feature coverage, import/export format,
endpoint notes). This file covers the repository itself: layout, git, deploy.

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
portable as JSON. See [`webapp/README.md`](webapp/README.md).

## Git

Remote: `git@github.com:cloudn1ne/system1tools.git` (SSH deploy key).

The repo root is this directory, but only `webapp/` is tracked. `system1/` is
listed in `.gitignore` and is itself a separate clone — it has its own `.git`
and would otherwise enter this repo as a gitlink/submodule.

### Deploy key

This machine authenticates with a dedicated **read/write deploy key**, not a
account-wide key:

| | |
|---|---|
| Private key | `~/.ssh/system1tools_deploy` (mode 600, outside the repo) |
| Public key | `~/.ssh/system1tools_deploy.pub` |
| Fingerprint | `SHA256:5AGElsn7c/W+itdzkf7qVu3xaQbZTWdMS5WylO3XMMQ` (ED25519) |

Install the public key at
`https://github.com/cloudn1ne/system1tools/settings/keys`
(**Add a deploy key**, tick *Allow write access* to enable pushing). One deploy
key is bound to exactly one repository, so rotating it affects nothing else.

This repo is configured to use only that key, so no other identity is offered
to GitHub on push:

```bash
git config core.sshCommand "ssh -i ~/.ssh/system1tools_deploy -o IdentitiesOnly=yes"
```

Verify the key is accepted, then push:

```bash
git ls-remote origin                 # proves the deploy key works
git push -u origin main
```

## Credentials policy

Nothing secret is tracked, and nothing secret is in the existing history — it
was audited with a full blob scan plus a pickaxe search for both keys seen in
this project:

```bash
# every blob in every commit, grepped for key-like material  -> 0 matches
git rev-list --objects --all | awk '{print $1}' | git cat-file --batch \
  | grep -c -E 'sk-[A-Za-z0-9]{16,}'
```

The rules that keep it that way:

- **`.env` is ignored** — it holds the real `LITELLM_API_KEY`. Only
  `.env.example` (placeholder key, real base URL/model) is tracked.
- Do not widen the ignore patterns to `.env*`; that would drop
  `.env.example` from the repo.
- `id_*`, `*.pem`, `*.key`, `*.p12` are ignored so a key file cannot be
  committed by accident from inside the tree.
- The `README` files show the key only as `sk-...`.
- The LiteLLM key is read at dev-server start from `.env` by
  `webapp/vite.config.ts`, which parses that file directly — a `LITELLM_*`
  variable in the process environment does **not** override it, and the key is
  not baked into any committed file.

Before any first push to a shared remote, re-run the blob scan above and
confirm `git ls-files | grep -E '(^|/)\.env$|\.pem$|\.key$'` returns nothing.
