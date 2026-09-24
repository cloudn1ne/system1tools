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
and would otherwise enter this repo as a gitlink/submodule. Verify at any time:

```bash
git ls-files | grep -c '^system1/'   # must be 0
git check-ignore -v system1/         # .gitignore:5:system1/
```

### Deploy key

This machine authenticates with a dedicated **deploy key**, not an
account-wide key:

| | |
|---|---|
| Private key | `~/.ssh/system1tools_deploy` (mode 600, outside the repo) |
| Public key | `~/.ssh/system1tools_deploy.pub` |
| Fingerprint | `SHA256:5AGElsn7c/W+itdzkf7qVu3xaQbZTWdMS5WylO3XMMQ` (ED25519) |

**Install it** at `https://github.com/cloudn1ne/system1tools/settings/keys` →
*Add deploy key*, paste `~/.ssh/system1tools_deploy.pub`, and tick **Allow write
access** to enable pushing. One deploy key is bound to one repository, so
rotating it affects nothing else.

Rotate with:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/system1tools_deploy -N '' \
  -C 'deploy-key:system1tools (github.com/cloudn1ne/system1tools)'
```

### Forcing git to use *only* this key

`~/.ssh/config` on this box pins `github.com` to an older identity
(`IdentityFile ~/.ssh/github`, `IdentitiesOnly yes`). Because that config line
counts as an explicitly named identity, plain `-i <key> -o IdentitiesOnly=yes`
still **offers both keys** and GitHub accepts the older one — so a push can
silently succeed as the wrong identity while appearing to use the deploy key.

The repo therefore ignores the user ssh config entirely (`-F /dev/null`), which
leaves the deploy key as the only candidate:

```bash
git config core.sshCommand \
  "ssh -F /dev/null -i ~/.ssh/system1tools_deploy -o IdentitiesOnly=yes"
```

Check *which* identity is actually being used — the greeting names the key's
owner, and `-v` shows what was offered and accepted:

```bash
ssh -F /dev/null -i ~/.ssh/system1tools_deploy -o IdentitiesOnly=yes -T git@github.com
git ls-remote origin            # empty output + exit 0 = authenticated, repo empty
ssh -v -T git@github.com 2>&1 | grep -E 'Offering|Server accepts'
```

Until the deploy key is installed the last two commands fail with
`Permission denied (publickey)` — that is the pin working, not a misconfiguration.

Then push:

```bash
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
