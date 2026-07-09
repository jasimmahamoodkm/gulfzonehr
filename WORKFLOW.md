# Development Workflow & Safety Guardrails

This project uses a protected workflow so that **nothing reaches `main` until it
is fully tested**, and the **client (production) database can never be touched
from a developer machine**.

---

## Environments

| Environment | Where | Supabase project | Who uses it |
|-------------|-------|------------------|-------------|
| **Local** | Your machine (`npm run dev`) | **DEV** project | Developers — experiment freely |
| **Staging** *(optional)* | A temporary Supabase project | A restore of the prod backup | Rehearse migrations before prod |
| **Production** | Client Windows Server (IIS + PM2) | **CLIENT** project | Live users only |

- A developer's `.env.local` must point at the **DEV** project only.
- Production Supabase config lives **only on the client server**, never in this repo.

---

## One-time setup (each developer, after cloning)

```bash
npm install
npm run setup-hooks          # activates the shared git hooks (.githooks)
cp .env.example .env.local   # then fill in your DEV Supabase keys
```

`setup-hooks` runs `git config core.hooksPath .githooks` so the commit/push
guards below are active on your machine.

---

## Branch model

```
feature/<name>  ──►  develop  ──►  (tested & final)  ──►  main  ──►  release tag ──► deploy
```

- **`main`** — always deployable. Receives **merges of tested code only**.
- **`develop`** — integration branch; day-to-day work lands here.
- **`feature/<name>`** — one branch per change.

### Rules (enforced by git hooks in `.githooks/`)

| Hook | Rule |
|------|------|
| `pre-commit` | **Rejects direct commits on `main`/`master`.** Work on a branch; `main` only receives merges. |
| `pre-push` | Runs the **Supabase guard** on every push. Pushes to `main` are **blocked outright** unless explicitly unlocked with `ALLOW_MAIN_PUSH=1` (release time), and even then must pass **`type-check` + production `build`**. |

So a change can only reach `main` after type-check and the production build pass.

---

## The client-database guard

`scripts/guard-supabase.js` runs automatically before `npm run dev` and
`npm run build` (via `predev` / `prebuild`), and on every `git push`.

- If `NEXT_PUBLIC_SUPABASE_URL` points at a **blocked production ref**
  (listed in `BLOCKED_REFS`), the command is **aborted**.
- The only escape hatch — for the **production server only** — is to set
  `ALLOW_PROD_DB=YES_I_AM_THE_PRODUCTION_SERVER`. Never set this on a dev machine.

To protect another production project, add its ref to `BLOCKED_REFS` in that file.

```bash
npm run guard     # check what project you're pointing at, any time
```

---

## Day-to-day flow

```bash
git checkout develop && git pull
git checkout -b feature/leave-export      # start work

# ...code...
npm run dev                                # guard confirms DEV project
git add -p && git commit -m "Add leave export"

git checkout develop && git merge feature/leave-export
npm run verify                             # guard + type-check + build
git push origin develop
```

### Promoting to production
```bash
# When develop is fully tested and approved:
git checkout main
git merge --no-ff develop                  # merge commit is allowed on main
ALLOW_MAIN_PUSH=1 git push origin main     # explicit unlock + full verification
git tag v1.3.0 && git push origin v1.3.0   # tag the release
```
Then deploy that tag to the client server with `deploy\windows\deploy.bat`.

---

## GitHub branch protection (enable on github.com — server-side, do this once)

Local hooks protect your machine; **branch protection protects the remote** even
if someone bypasses hooks (`--no-verify`). As the repo owner:

**Repo → Settings → Branches → Add rule** for `main`:
- ✅ Require a pull request before merging
- ✅ Require status checks to pass before merging (add your CI build check)
- ✅ Require branches to be up to date before merging
- ✅ Do not allow bypassing the above settings
- ✅ (optional) Require linear history

With this on, **direct pushes to `main` are refused by GitHub itself** — code can
only land via a reviewed, green-checks PR.

---

## Summary of what's enforced

| Guarantee | Mechanism |
|-----------|-----------|
| No direct commits to `main` | `.githooks/pre-commit` |
| `main` only gets tested code | `.githooks/pre-push` (type-check + build) + GitHub branch protection |
| Client DB never used locally | `scripts/guard-supabase.js` on `predev`/`prebuild`/`pre-push` |
| Secrets never committed | `.gitignore` (`.env*.local`), prod keys only on the server |
