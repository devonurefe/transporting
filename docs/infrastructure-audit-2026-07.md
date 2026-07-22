# HuurGo — Infrastructure, Security, Deployment & Reliability Audit

**Date:** 2026-07-22
**Scope:** Everything committed to this repo that defines production infrastructure —
`Dockerfile`, `docker-compose.yml`, `nginx.conf` / `nginx-init.conf`,
`.github/workflows/deploy.yml`, `scripts/vps-setup.sh`, `server.ts` security
middleware, `server/utils/env.ts`, `prisma/schema.prisma`.

**Method & limitation — read this first:** this audit was produced by an
agent with **repository access only** — no SSH/console access to the actual
production VPS, no GitHub Actions secrets, no live shell. Every finding below
is derived from the **infra-as-code checked into git** (Dockerfile, compose
file, nginx config, the VPS bootstrap script, the deploy workflow) plus what
`CLAUDE.md`/`README.md` document. Anything about the *live* server's actual
CPU/RAM/disk usage, real firewall (`ufw`/`iptables`) state, `sshd_config`,
`crontab -l`, running processes, or DNS records is **not directly observable**
from here and is marked "unverified — repo has no visibility" rather than
guessed. Someone with SSH access should confirm those items against Phase 1/2
below before acting on them.

---

## 1. Infrastructure Map

| Layer | Value | Source |
|---|---|---|
| VPS provider | TransIP | README.md, CLAUDE.md |
| Region | Amsterdam | README.md |
| OS | Ubuntu Server (Debian-based) | README.md, `vps-setup.sh` uses `apt-get`/`systemctl` |
| App dir on host | `/opt/huurgo` | `scripts/vps-setup.sh`, `deploy.yml` |
| CPU / RAM / disk | **unverified — repo has no visibility** | — |
| Container runtime | Docker + Docker Compose v3.8 (`docker-compose.yml`) | — |
| Reverse proxy | nginx:alpine | `docker-compose.yml` |
| SSL | Let's Encrypt via `certbot/certbot`, 12h renew loop | `docker-compose.yml` |
| DNS | huurgo.nl / www.huurgo.nl — **unverified**, no zone file in repo | — |
| Database | PostgreSQL 16-alpine, single container, `postgres_data` named volume | `docker-compose.yml` |
| App runtime | Node 20-alpine, Express, single process, port 3000 (127.0.0.1 only) | `Dockerfile`, `docker-compose.yml` |
| Firewall (ufw/iptables) | **unverified — no setup step in repo** | — |
| Fail2ban | **unverified — not installed by `vps-setup.sh`** | — |
| SSH config | **unverified**; CI deploys as `root` with a **password** (see §2) | `deploy.yml` |
| Cron | Only the in-app 07:00 Europe/Amsterdam reminder job (`node-cron` inside the app process, per CLAUDE.md) + certbot's internal 12h renewal loop. No OS-level `crontab` entries found in the repo. | `server.ts` (per CLAUDE.md), `docker-compose.yml` |
| Backups | **None found anywhere in the repo** — no backup script, no scheduled job, no offsite target | — |
| Uploads storage | Host bind mount `./uploads:/app/uploads` (uid 1000) | `docker-compose.yml` |
| CI/CD | GitHub Actions: `test` → `build` (GHCR) → `deploy` (SSH) on push to `main` | `.github/workflows/deploy.yml` |

### Container topology (as declared in `docker-compose.yml`)

```
Internet
   │
   ├─ :80  ──► nginx (redirects → 443, serves ACME challenge)
   └─ :443 ──► nginx ──► app:3000 (127.0.0.1-bound, container-internal)
                              │
                              └─► postgres:5432 (127.0.0.1-bound, container-internal)

certbot: sidecar, shares /etc/letsencrypt + /var/www/certbot with nginx, renews every 12h
```

Only ports **80** and **443** are published to `0.0.0.0` by the stack itself.
`postgres` and `app` publish to `127.0.0.1` only — not reachable from outside
the host through Docker's port mapping. Whatever else is open (22/SSH, and
anything not managed by this compose file) is **outside the repo's
visibility** — that's the biggest blind spot in this audit and worth a real
`ss -tlnp` / `ufw status` check on the box itself.

---

## 2. Network Security — Vulnerabilities Found

### 🔴 P0 — CI/CD deploys as `root` over SSH using a **password**, not a key
`.github/workflows/deploy.yml`:
```yaml
sshpass -p "${{ secrets.VPS_PASSWORD }}" ssh \
  -o StrictHostKeyChecking=no \
  -o ConnectTimeout=30 \
  root@${{ secrets.VPS_HOST }} \
  "..."
```
Three stacked problems in one block:
1. **Root login over SSH with a password.** If `VPS_PASSWORD` (a GitHub
   Actions secret) ever leaks — a compromised runner, a misconfigured log, a
   dependency in the `test`/`build` jobs exfiltrating env — it's a direct,
   unrestricted root shell on the production box. Key-based auth with a
   dedicated non-root deploy user (`sudo`-scoped to `docker compose` in
   `/opt/huurgo` only) removes this entire class of risk.
2. **`StrictHostKeyChecking=no`** disables host-key verification, i.e. no
   protection against a MITM on that SSH connection. Combined with password
   auth, a network-position attacker between the GitHub-hosted runner and the
   VPS could intercept credentials.
3. **README.md says the opposite of what's happening**: it documents
   "deployed to the VPS over key-based SSH" in the Testing section, but the
   actual workflow is password-based root. Docs and reality have drifted —
   worth fixing both the process and the doc.

**Fix:** create a dedicated `deploy` user on the VPS, give it an SSH key pair
(private half as a GitHub secret, `ssh-agent`/`webfactory/ssh-agent` action or
just `ssh -i`), grant it passwordless `sudo` scoped to the exact commands the
workflow needs (or add it to the `docker` group so no `sudo` is needed for
`docker compose` at all), and pin the host key (`ssh-keyscan` once, store as
a secret, feed to `known_hosts`) instead of `StrictHostKeyChecking=no`.

### 🟠 P1 — No firewall / fail2ban visible in the provisioning script
`scripts/vps-setup.sh` installs Docker and Git and nothing else — no `ufw`,
no `fail2ban`, no SSH hardening (`PermitRootLogin`, `PasswordAuthentication`).
Given TransIP VPS images ship with a default sshd config (password auth
usually enabled by default on a fresh Ubuntu image), and given the deploy
workflow itself depends on password auth being enabled, **SSH is very likely
open to password brute-force from the entire internet on port 22** right now.
Unverified without box access, but the repo gives no evidence it was ever
locked down.

**Fix (target state):**
- `ufw default deny incoming`, `ufw allow 22,80,443/tcp`, `ufw enable` (order
  matters — allow 22 before enabling, or you lock yourself out).
- Install `fail2ban` with the sshd jail enabled.
- Move to key-only SSH (`PasswordAuthentication no`, `PermitRootLogin
  prohibit-password` or `no` once the dedicated deploy user exists) — but
  only *after* the CI deploy workflow no longer needs root+password.

### 🟡 P2 — No WAF/CDN in front of the origin
DNS presumably points straight at the VPS IP (unverified, no zone data in
repo). There's no Cloudflare/similar in the request path — origin IP is
directly exposed. The only DDoS mitigation is `express-rate-limit`
(300 req/min global, 10/15min on auth) at the *application* layer, which
does nothing against volumetric L3/L4 floods and costs the box CPU to even
evaluate. A free-tier Cloudflare (proxy mode, orange-cloud) in front would
hide the origin IP and absorb most volumetric attacks before they reach the
VPS — cheap, no app changes needed beyond trusting `CF-Connecting-IP` /
updating `trust proxy`.

### ✅ What's good here
- `postgres` (5432) and `app` (3000) are bound to `127.0.0.1` in
  `docker-compose.yml` — not reachable from outside the host via Docker's
  port publishing, regardless of the host firewall state.
- TLS: modern-only (`TLSv1.2`/`TLSv1.3`), strong cipher list, HSTS with
  `preload`, session tickets off (forward secrecy).
- Helmet headers (CSP, frameguard deny, noSniff, HSTS) are also enforced at
  the **app** layer, not just nginx — defense in depth if nginx is ever
  bypassed (e.g., direct `:3000` access from inside the docker network).
- express-rate-limit is a sane app-level second line even with a WAF/CDN.

---

## 3. Docker Audit

| Check | Finding | Severity |
|---|---|---|
| Container user | `app` runs as non-root `node` (uid 1000) — explicit `USER node` in Dockerfile | ✅ good |
| Container user | `nginx`, `postgres`, `certbot` run their images' defaults (nginx/postgres already drop to non-root internally for the worker/postmaster processes) | ✅ fine |
| Base image pinning | `node:20-alpine`, `postgres:16-alpine`, `nginx:alpine`, `certbot/certbot` are all **floating tags**, no digest pin (`@sha256:...`) | 🟠 P1 |
| Secrets in image | None found — `.env` is never copied into the image (`.dockerignore` not present but `Dockerfile` only `COPY`s explicit paths, never `.env`) | ✅ good |
| Secrets in env | Passed at container-start via `docker-compose.yml` `environment:` block, sourced from host `.env` — not baked into the image | ✅ good |
| Health checks | Only `postgres` has a `HEALTHCHECK`/compose `healthcheck:`. **`app` and `nginx` have none.** | 🟠 P1 |
| Restart policy | `restart: always` on all three main services — reasonable | ✅ good |
| Resource limits | **No `mem_limit`/`cpus`/`deploy.resources` anywhere.** A runaway Node process or a bad query can OOM the whole VPS (single box, no cgroup ceiling) | 🟠 P1 |
| Networking | Default compose bridge network, no custom network segmentation between services — acceptable at this scale (3 app-tier containers) | 🟡 P3 |
| Multi-stage build | Yes — builder stage discarded, runner only ships `dist/`, prod `node_modules`, and the generated Prisma client. Keeps the final image lean. | ✅ good |
| `npm ci` vs `npm install` | Uses `npm ci` in both stages — reproducible installs from lockfile | ✅ good |

**Fixes:**
- Add `HEALTHCHECK` to the app image (`curl -f http://localhost:3000/api/health || exit 1`) and a compose `healthcheck:` for `nginx` (e.g. `wget --spider http://localhost/`). Right now Docker has no way to know the app process is wedged — `restart: always` only fires on a hard crash/exit, not a hang.
- Pin base images to a digest (or at minimum a specific version like
  `node:20.18-alpine` instead of the rolling `20-alpine`) so a rebuild six
  months from now doesn't silently pull a different Alpine/Node patch with a
  regression.
- Add `mem_limit`/`cpus` to the `app` service in compose — a single
  under-provisioned VPS with an unbounded Node process is one memory leak
  away from taking Postgres down with it via OOM-killer roulette.

---

## 4. Deployment

**How code reaches production:** merge to `main` → GitHub Actions `test` job
(lint + vitest against an ephemeral Postgres service, 10-min timeout) → if
green, `build` job builds the Docker image and pushes `ghcr.io/devonurefe/transporting:latest`
→ `deploy` job SSHes into the VPS as root (see §2 for why that's a problem),
`git reset --hard origin/main`, `docker compose pull app`, recreates only the
`app` container (`--no-deps`), reloads nginx.

- **CI/CD exists** — yes, fully automated on merge to `main`, no manual step
  required (the "deploy manually" note in `CLAUDE.md` is a documented
  fallback for when CI is down, not the normal path).
- **Rollback:** none automated. `:latest` is the only tag pushed — there's no
  previous-version tag to roll back to via the pipeline. Recovery today means
  either `git revert` + re-push through the full pipeline, or manually
  SSHing in and running an older image tag if one happens to still be cached
  locally on the VPS (`docker image prune -f` runs right after pull, though,
  which actively works against that).
- **DB migrations:** `prisma db push` (no migration history), run
  automatically as part of the `app` container's `npm run start` **on every
  deploy, directly against production**, with no manual approval gate. This
  is a deliberate CLAUDE.md-documented choice for this project's stage, but
  it means any accidental destructive schema change (a renamed/removed
  required column, a type change Prisma can't do losslessly) applies
  immediately with no review step, no dry-run, no rollback path. There's
  already a `docs/P0-schema-migratie-plan.md` in the repo, suggesting this
  has been flagged internally before.
- **Zero-downtime:** not quite. `docker compose up -d --force-recreate
  --no-deps app` stops the old app container and starts a new one — there's
  a window (typically a few seconds) where the `app` container is down and
  nginx's upstream returns 502s, since there's no second `app` replica to
  fail over to during the swap. `nginx -s reload` itself is graceful, but it
  reloads *config*, not the missing upstream.
- **Frontend/backend version skew:** low risk here because it's a single
  SPA build served by the same container as the API (`dist/` + `dist/server.js`
  from one image) — there's no separately-deployed frontend that could drift
  from the API version. Not a concern for this architecture as long as it
  stays monolithic.

**Recommended deployment strategy (proportionate to a single-VPS app, not
overengineered):**
1. Tag images with the Git SHA in addition to `:latest`
   (`ghcr.io/.../transporting:${{ github.sha }}`) so a rollback is
   `docker compose up -d app` against a pinned tag — no rebuild needed, no
   dependency on `docker image prune` not having deleted the old one.
   Keep the last 3–5 tags; prune older ones on a schedule instead of
   immediately after every deploy.
2. Run `prisma db push` as a **separate step before** swapping the app
   container, not folded silently into every container boot — makes schema
   changes visible in deploy logs as their own step, and is a natural place
   to later add a `--dry-run`/confirmation gate before this app has real
   revenue-critical data volume to lose.
3. If actual zero-downtime start matters (currently: brief 502 window on
   every deploy, low-traffic app so likely low practical impact) — run two
   `app` replicas behind nginx `upstream` with a rolling recreate, or accept
   the few-seconds gap as-is given the traffic profile. Don't add a
   blue-green/K8s-style setup for a single-VPS Dutch equipment rental site;
   that's solving a problem this app doesn't have yet.

---

## 5. Environment Separation

- **Production:** TransIP VPS, PostgreSQL in Docker, real secrets in `.env` on
  the host (generated once by `vps-setup.sh` via `openssl rand`).
- **Development:** local `docker compose up postgres` only, `DATABASE_URL`
  pointing at `huurgo`/`huurgo_dev_pass` (throwaway local creds, documented in
  `.env.example` and `CLAUDE.md`) — separate database, separate credentials
  from prod. Good.
- **CI:** ephemeral `postgres:16-alpine` GitHub Actions *service* container,
  `huurgo_ci_pass`, `DATABASE_URL` scoped to that job only, destroyed after
  the run. Fully isolated from prod. Good.
- **Staging:** **does not exist.** There is no intermediate environment
  between "merged to `main`" and "live in production," and — per §4 — the
  DB schema push happens directly against prod as part of every deploy.

**Payment credentials:** there is no payment gateway integration in this app
at all (per `CLAUDE.md`: WhatsApp → manual Tikkie/iDEAL link sent by an
admin, no deposit/refund flow, no PSP API keys anywhere) — so there's no
payment-credential separation concern to audit; it's out of scope by design.

**Recommendation:** given the size of this operation (single VPS, one
Postgres instance, no PSP integration), a full staging *environment* is
probably overkill. The cheaper, proportionate fix is what's already
recommended in §4: gate schema-affecting deploys with a visible step and a
tag-based rollback, rather than building a parallel staging stack that then
itself needs maintaining. Revisit a real staging tier only if order volume
or team size grows enough that a bad prod deploy becomes existentially
costly rather than an evening's `git revert`.

---

## 6. Secrets Management

Checked: `.env*` git history (`git log -p -- '.env*'` across all branches),
`.gitignore`, `Dockerfile` `COPY` statements, `docker-compose.yml`.

- **`.gitignore`** correctly excludes `.env*` while allowlisting `.env.example`
  (`!.env.example`) — the example file only, never a real secret.
- **Git history**: only `.env.example` (placeholder values, no real secrets)
  has ever been committed, across every commit on both `main` and this
  branch. No `JWT_SECRET`, DB password, or API key found in history.
- **Docker images**: `Dockerfile` never `COPY`s `.env` — secrets only enter
  the running container via `docker-compose.yml`'s `environment:` block,
  populated from the host's `.env` at `docker compose up` time. Nothing
  secret is baked into the GHCR image layers.
- **Frontend build**: Vite only exposes `VITE_*`-prefixed env vars to the
  client bundle (`VITE_WHATSAPP_NUMBER`, `VITE_CLARITY_ID`) — both are
  non-secret, public-by-design values (a phone number, an analytics project
  ID). No `JWT_SECRET`/`DATABASE_URL`/`RESEND_API_KEY` risk of leaking into
  client JS, since Vite simply doesn't expose non-`VITE_`-prefixed vars.
- **Logs**: `buildAuditRow` (per `CLAUDE.md`) explicitly avoids logging raw
  request bodies for endpoints that carry secrets/base64 payloads. Request
  logger middleware wasn't re-audited line-by-line here, but the documented
  discipline is sound.
- **Reset/verification tokens**: stored as sha256 hashes, not raw — a DB leak
  alone doesn't yield usable tokens.
- **The one real secret-handling gap** is the one already flagged in §2:
  `VPS_PASSWORD` is a **password**, sitting in GitHub Actions secrets,
  granting **root** access if it ever leaks. Every other secret in this
  system is scoped (JWT only signs app tokens, DB password only reaches
  Postgres bound to localhost, `REMINDER_SECRET`/`CALENDAR_FEED_TOKEN` are
  narrow-purpose app tokens) — this one is the odd one out because it's a
  skeleton key to the whole box.

**Recommendation:** switch to SSH-key-based deploy (see §2 fix) and this
section has no outstanding findings. Optionally, move `JWT_SECRET`/
`POSTGRES_PASSWORD`/etc. off a plain host `.env` file into a proper secrets
manager (Doppler, 1Password Secrets Automation, or even just `docker
secrets`) — but for a single-VPS deployment of this size, a root-owned
`600`-permission `.env` file is a reasonable, proportionate choice as long as
file permissions are actually `600` (unverified — can't check host file
perms from here).

---

## 7. Database Reliability

- **Location:** single `postgres:16-alpine` container, same VPS as the app —
  no read replica, no managed DB service, no separate DB host.
- **Persistence:** named Docker volume `postgres_data` — survives container
  recreation, does **not** survive `docker compose down -v`, host disk
  failure, or `rm -rf` of the Docker data root.
- **Backups: none found.** No `pg_dump` script, no `pg_basebackup`/WAL
  archiving, no cron job, no S3/offsite upload step, anywhere in this
  repository. `scripts/` contains only `vps-setup.sh` (provisioning) and
  `cleanup-demo-data.sh` (a data-cleanup utility, not a backup tool).
- **Uploads:** `./uploads` host bind mount — also not covered by any backup
  mechanism in the repo. (Most machine images are stored as base64 in
  Postgres per `CLAUDE.md`, so a DB backup would cover *those* — but the
  `/app/uploads` directory itself is a separate, unbacked-up store.)

### "If the VPS dies today, how fast can HuurGo be restored?"

**Answer, honestly: it can't be, beyond an empty re-seed.** The `Dockerfile`
comment even documents this behavior — *"de server seedt een lege database
automatisch (autoSeedIfEmpty)"* — meaning a fresh VPS boots back up to a
**demo/seed catalog with zero real orders, zero real customers, zero
machine-price customizations the owner made in the admin panel.** Every order,
every customer record, every admin-edited price/discount/image, every
audit-log entry — gone, unrecoverable, if the VPS disk is lost. Current
**RPO is effectively infinite** (no backup means no recovery point at all)
and current **RTO is "however long it takes to re-provision a VPS and run
`vps-setup.sh`"** (roughly 15–30 minutes technically) **but the data itself
never comes back.**

This is the single highest-impact finding in this entire audit — worse than
the SSH password issue, because a leaked password is *preventable* damage and
a dead disk with no backup is *guaranteed, total* data loss the day it
happens, with no mitigation available after the fact.

**Recommended target:**
- **RPO target: ≤24h** (nightly `pg_dump`), tightenable to ≤1h later with WAL
  archiving if the business needs it — not necessary yet for this app's
  volume.
- **RTO target: ≤2h** (spin up a fresh VPS, run `vps-setup.sh`, restore the
  latest dump, point DNS if needed).
- **Backup strategy (minimum viable, cheap, proportionate):**
  1. A nightly cron job on the host (or a `postgres`-sidecar container) doing
     `docker compose exec -T postgres pg_dump -U huurgo huurgo | gzip >
     /opt/huurgo/backups/huurgo-$(date +%F).sql.gz`.
  2. Push that file **off the VPS** immediately after — `rclone`/`rsync` to
     TransIP's own object storage, Backblaze B2, or even a private S3 bucket.
     A local-only backup on the same disk that might die is not a backup.
  3. Retention: keep 14 daily + 6 monthly, delete older automatically.
  4. Also back up `./uploads` (tarball, same offsite target, same schedule).
  5. **Actually test a restore** at least once (spin up a scratch VPS or
     local docker-compose, restore the dump, verify the app boots against
     it) — an untested backup is a hypothesis, not a backup.
- Point-in-time recovery (WAL-based) is not warranted yet at this traffic/data
  volume — nightly dumps are the right first step; revisit PITR only if the
  business can no longer tolerate losing up to a day of orders.

---

## 8. Monitoring

**Current state:** `AdminDiagnostics.tsx` is an **in-app, human-must-be-looking-at-it**
panel (DB connectivity, API response time, Node uptime/memory) — useful for a
manual glance, not alerting. There is no Prometheus/Grafana, no external
uptime monitor, no log aggregation, no SSL-expiry check, and (per §7) no
backup-success signal at all, anywhere in this repo.

**Recommended monitoring, proportionate to a single-VPS Node/Postgres app**
(no need for a full Prometheus/Grafana stack at this scale — a lightweight
combination is enough):

| Signal | Suggested tool | Alert level |
|---|---|---|
| VPS down / unreachable | External uptime check (UptimeRobot/Better Stack/Healthchecks.io, free tier) hitting `/api/health` | **CRITICAL** |
| SSL certificate expiring <14 days | Same uptime tool's cert-expiry check, or `certbot`'s own renewal-failure alerting (mail hook) | **CRITICAL** |
| Backup job failed / didn't run | Healthchecks.io dead-man's-switch pinged at the end of the nightly backup script | **CRITICAL** |
| Disk >85% full | Simple cron `df` check emailing/webhooking on threshold (Postgres volume + Docker image layers can fill a small VPS fast) | **HIGH** |
| CPU/RAM sustained high | `docker stats` scraped periodically, or a lightweight agent (Netdata, free, self-hosted, one-line install) | **HIGH** |
| HTTP 5xx rate spike | nginx access log → simple log-based alert, or Sentry if added to the Express error handler | **HIGH** |
| Container restart looping | `docker events` or Netdata container monitoring | **HIGH** |
| API latency (p95) | Netdata / existing `requestLogger` response-time field aggregated | **MEDIUM** |
| Postgres connection pool near limit | Log-based check against the `connection_limit=10` ceiling documented in CLAUDE.md | **MEDIUM** |
| Failed login lockouts spiking (brute-force signal) | Query the existing `AuditLog` table for a burst of failed logins | **MEDIUM** |
| Reminder-cron didn't fire at 07:00 | Same dead-man's-switch pattern as backups | **MEDIUM** |
| Slow individual queries | Postgres `log_min_duration_statement` | **LOW** |
| Dependency vulnerabilities | `npm audit` in CI (see §10) / Dependabot | **LOW** |

Netdata (self-hosted, free, one install command) + Healthchecks.io
(free tier, dead-man's-switch pattern) + UptimeRobot (free tier, external
HTTP+SSL check) covers essentially everything CRITICAL/HIGH above without
adding a single new paid service or a Kubernetes-shaped amount of complexity
to a one-VPS app.

---

## 9. Performance

Per `CLAUDE.md`, a real PageSpeed/Lighthouse pass already happened
(2026-07, PRs #215–#220): mobile Performance 58→81, Desktop→97, CLS
0.513→0, LCP 4.3s→~4.1s mobile/0.9s desktop. That work is documented as
**load-bearing** — don't re-litigate it here. What's left to check at the
infra layer specifically:

- **Nginx:** gzip on (level 6, 256B min, sensible MIME list), keepalive 65s,
  `client_max_body_size 10m` matching the app's base64-image upload limit,
  TLS session cache/1-day timeout for faster repeat-handshake performance.
  **Not present: HTTP/2.** The `listen 443 ssl;` directives don't include
  `http2` — adding `listen 443 ssl http2;` (nginx ≥1.25 syntax, or the older
  `listen 443 ssl; http2 on;` form depending on version) is a one-line,
  zero-risk win: multiplexed requests over a single connection instead of
  nginx's default HTTP/1.1 to the browser, meaningful for a page loading many
  small assets (catalog images, chunked JS).
- **Compression:** double-covered (nginx gzip + Express `compression()`) —
  intentional per `CLAUDE.md`'s own comment, correct for direct `:3000`
  access/dev parity, no real cost.
- **Static assets/cache headers:** per `CLAUDE.md`, `/assets` 1yr immutable,
  images/proxies 30d minimum — already tuned to satisfy Lighthouse's cache
  audit; don't regress this.
- **CDN:** not present. Given no WAF/CDN in front of origin either (§2), a
  Cloudflare free tier would serve two goals at once — DDoS/WAF *and* edge
  caching of the image proxies/static assets, reducing origin load. This is
  the one genuinely proportionate infra-performance recommendation here — it
  solves a real gap (§2) and gets a performance benefit for free, rather than
  adding complexity for its own sake.
- **Database connections:** `connection_limit=10, pool_timeout=20` documented
  and applied — correctly bounds Prisma's pool so a traffic spike degrades
  gracefully (queued/timeout) rather than exhausting Postgres's `max_connections`.
- **Image delivery:** sharp-based resize/WebP re-encode with a `?w=`
  whitelist, dynamic-import fallback if the native binary is missing — solid,
  already covered exhaustively in `CLAUDE.md`.

**Don't blindly add:** a CDN beyond Cloudflare's free tier, a separate cache
layer (Redis) for a catalog of ~40 SKUs, or horizontal app scaling — none of
that is justified by anything observed here. The bottlenecks that mattered
were already fixed in the July PageSpeed work; the only actionable *new* item
is HTTP/2 on the nginx listener.

---

## 10. Security Hardening Checklist

- [ ] **P0** — Replace root+password SSH deploy with a dedicated key-only
      deploy user (§2, §4).
- [ ] **P0** — Stand up nightly offsite Postgres + uploads backups with a
      tested restore path (§7). This is the single most consequential gap.
- [ ] **P1** — `ufw` + `fail2ban` on the VPS; confirm current `sshd_config`
      (`PasswordAuthentication`, `PermitRootLogin`) and lock down once the
      deploy user no longer needs password root.
- [ ] **P1** — Pin base images to specific versions/digests
      (`node:20.x-alpine`, `postgres:16.x-alpine`, `nginx:1.x-alpine`).
- [ ] **P1** — Add `HEALTHCHECK`/compose `healthcheck:` to `app` and `nginx`.
- [ ] **P1** — Add `mem_limit`/`cpus` to the `app` and `postgres` services.
- [ ] **P2** — Cloudflare (or similar) in front of the origin for WAF +
      DDoS absorption + edge caching (§2, §9).
- [ ] **P2** — Tag deploy images with Git SHA (not just `:latest`) for fast
      rollback (§4).
- [ ] **P2** — External uptime + SSL-expiry + backup dead-man's-switch
      monitoring (§8).
- [ ] **P2** — `npm audit`/Dependabot in CI — no dependency-vulnerability
      scanning currently exists anywhere in the pipeline.
- [ ] **P3** — Confirm host `.env` file permissions are `600`, owned by the
      deploy user, not world-readable.
- [ ] **P3** — Correct `README.md`'s "key-based SSH" claim once §2 is fixed
      (or now, since it's currently inaccurate either way).
- [ ] **P3** — HTTP/2 on the nginx HTTPS listener (§9).

Everything **not** on this list — Helmet headers, HSTS, TLS 1.2/1.3-only,
bcrypt+2FA+audit-log admin security, rate limiting, JWT tokenVersion
revocation, sha256-hashed reset tokens, Prisma parameterized queries,
non-root app container, localhost-bound DB/app ports — is already in good
shape per this audit and needs no action.

---

## 11. Incident Response

| Scenario | Detection | Containment | Recovery | Post-incident |
|---|---|---|---|---|
| **Server compromise** | Unexpected outbound traffic, unfamiliar processes/cron entries, GitHub Actions deploy failing unexpectedly, unfamiliar admin accounts in the app | Rotate `VPS_PASSWORD`/SSH key immediately, revoke via provider console if root is suspected lost, isolate via TransIP's network/firewall panel if available | Rebuild VPS from scratch (`vps-setup.sh` on a fresh image), restore DB from latest offsite backup (§7), rotate **all** secrets (`JWT_SECRET`, `POSTGRES_PASSWORD`, `RESEND_API_KEY`, `REMINDER_SECRET`, `CALENDAR_FEED_TOKEN`) — a compromised box means every secret it held is burned | Review how entry occurred (this audit's §2 items are the most likely vector today), close that gap before redeploying |
| **Database corruption** | App errors, Prisma exceptions, `pg_isready` healthcheck failing | Stop the `app` container to prevent further writes against a corrupt state | Restore latest offsite `pg_dump` (§7) into a fresh `postgres_data` volume | Once backups exist, this becomes routine; today it's identical to total loss (§7) |
| **Ransomware** | Files unexpectedly encrypted, backup job failures, unusual disk I/O | Power off / isolate the VPS at the provider level to stop lateral spread | Do **not** pay; rebuild VPS from scratch + restore from offsite backup (only viable once §7 is fixed) | Confirm the entry vector, patch it; verify offsite backups themselves weren't reachable/encrypted (keep them on a separate credential/account) |
| **DDoS** | Uptime monitor alerts, nginx/`docker stats` showing saturated CPU/connections | If Cloudflare (§9) is in front: enable "I'm Under Attack" mode there. If not: this is currently very hard to contain from the origin alone | Wait it out / engage TransIP support for upstream filtering | This is the strongest argument for adding Cloudflare before it's needed, not after |
| **Secret leakage** (e.g. `VPS_PASSWORD` or `JWT_SECRET` exposed) | GitHub secret-scanning alert, unexpected admin logins in `AuditLog`, unfamiliar SSH sessions | Rotate the specific leaked secret immediately; `JWT_SECRET` rotation invalidates all sessions instantly (by design) | Re-issue the secret, redeploy, force all admin password resets if `JWT_SECRET` was the one leaked | Add secret-scanning (GitHub's is free for public-visibility patterns) if not already enabled on the repo |
| **Payment failure** | N/A — no PSP integration exists. Payment is a manual WhatsApp→Tikkie/iDEAL-link flow between admin and customer (per `CLAUDE.md`) | — | An admin resolves it directly with the customer over WhatsApp | Not an infra incident class for this app |
| **Full server outage** (VPS provider issue, hardware failure) | Uptime monitor alert | Provision a replacement VPS (TransIP or otherwise) | Run `vps-setup.sh`, restore DB + uploads from offsite backup, update DNS A record if the IP changed | Confirms whether §7's RTO target is realistic in practice — worth a fire drill once backups exist |
| **Accidental bad deploy** (e.g. destructive `prisma db push`) | CI `test` job should catch most logic regressions before merge; a schema footgun (§4) would only surface once live | Revert the merge commit immediately, which re-triggers the pipeline | Restore DB from the most recent backup taken before the bad push, if data was destructively altered | This is the concrete reason §4's "make schema push a visible, separate deploy step" recommendation matters |

---

## 12. Recommended Target Infrastructure

Given HuurGo's actual scale (one Dutch regional equipment-rental business,
~40 SKUs, no PSP integration, single-region traffic), the target here is
**"harden what exists," not "replatform."** Nothing about this audit suggests
Kubernetes, multi-region, or a managed-DB migration is warranted yet.

```
Cloudflare (DNS proxy, free tier)
   │  WAF + DDoS absorption + edge cache for static/image assets
   ▼
TransIP VPS (same as today)
   ├─ nginx (HTTP/2 added, otherwise unchanged)
   ├─ app (Node/Express) — health-checked, resource-limited, image-pinned
   ├─ postgres — health-checked (already), resource-limited, image-pinned
   ├─ certbot — unchanged
   └─ new: nightly backup job (pg_dump + uploads tarball → offsite object storage)
   + ufw + fail2ban on the host
   + dedicated key-only deploy user (no more root+password SSH)

External (free/cheap, no new infra to run):
   - Healthchecks.io: backup + reminder-cron dead-man's-switches
   - UptimeRobot: HTTP + SSL-expiry checks
   - Netdata (self-hosted on the VPS): CPU/RAM/disk/container dashboards
```

This is deliberately *not* a bigger architecture than the business needs —
same single VPS, same Docker Compose stack, same monolithic app. The changes
are entirely about closing the backup/access gaps, not about scaling out.

---

## 13. Prioritized Roadmap

**P0 — do these first, this week:**
1. Nightly offsite Postgres + uploads backup, with one test restore performed
   manually to confirm it actually works. (§7)
2. Replace root+password CI/CD SSH with a key-only dedicated deploy user;
   remove `StrictHostKeyChecking=no`. (§2, §4)

**P1 — do these this month:**
3. `ufw` + `fail2ban` on the VPS; verify/harden `sshd_config` once #2 lands.
4. Pin Docker base images to specific versions.
5. Add health checks to `app`/`nginx` containers; add `mem_limit`/`cpus`.
6. Tag deployed images by Git SHA for fast rollback capability.

**P2 — do these this quarter:**
7. Cloudflare in front of the origin (WAF + DDoS + edge cache).
8. External uptime/SSL-expiry/backup-heartbeat monitoring (Healthchecks.io +
   UptimeRobot).
9. Dependency vulnerability scanning (Dependabot or `npm audit` in CI).
10. Make the deploy pipeline's `prisma db push` a visible, separate,
    reviewable step rather than folded into container boot.

**P3 — future optimization, no urgency:**
11. HTTP/2 on the nginx HTTPS listener.
12. Correct README's SSH-method claim (moot once #2 ships).
13. Confirm host `.env` file permissions.
14. Self-hosted Netdata for CPU/RAM/container dashboards.

---

## Summary

The **application-layer** security work already done here (Helmet, CSP, HSTS,
rate limiting, bcrypt+2FA, audit logging, JWT tokenVersion revocation,
sha256-hashed tokens, serializable order transactions, non-root app
container, localhost-bound DB/app ports) is genuinely solid — better than
most projects this size. The gaps are almost entirely at the **infrastructure
operations** layer, and they cluster around two things: **how the deploy
pipeline authenticates to the VPS** (root + password, no host-key pinning),
and **the total absence of a database backup** anywhere in the system. Fix
those two — both are days-of-work, not weeks — and the remaining findings
here (image pinning, health checks, resource limits, a CDN/WAF, monitoring)
are meaningful but not urgent hardening on top of an already-reasonable
foundation.
