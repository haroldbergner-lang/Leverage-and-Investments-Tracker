# Leverage and Investments Tracker

Reads your real portfolio holdings from Copilot Money's local cache on your
Mac and emails you a snapshot twice a week: total portfolio value, and how
much leverage you're carrying — the dollar value and % of your portfolio
sitting in leveraged/inverse ETFs (TQQQ, SOXL, UPRO, etc.), plus a blended
leverage multiple across everything you hold.

## Why this runs locally, not in the cloud

Copilot Money has no public API. This project uses
[`copilot-money-mcp`](https://github.com/ignaciohermosillacornejo/copilot-money-mcp)
(MIT-licensed, independent, not affiliated with Copilot Money) in its
**default, cache-only mode**: it reads the local LevelDB cache the Copilot
Money Mac app already writes to disk during normal use —
**zero network requests, no login, no captured tokens.** That cache only
exists on your Mac, so the job has to run there too — it can't run in
GitHub Actions or any other cloud runner. There is no credential or secret
involved in reading your holdings at all.

The only network call this project makes is the one at the very end:
sending the email via Gmail SMTP.

Your holdings data never passes through an AI model as part of the
recurring job. The script talks to `copilot-money-mcp` directly over the
[MCP](https://modelcontextprotocol.io/) protocol (the same protocol an AI
chat client would use), formats the result, and emails it — no LLM
inference happens on your portfolio data during a scheduled run.

## What "leverage" means here

You don't use margin — the leverage here comes from **leveraged ETFs**
(2x/3x funds like TQQQ, SOXL, UPRO). For each holding:

- **Leverage factor**: looked up in `src/leverage.js`, a curated table of
  common leveraged/inverse ETFs. Anything not in the table defaults to 1x
  (unleveraged) — this covers ordinary stocks and most ETFs/mutual funds.
- **Notional exposure** = position value × |factor|. A $10,000 position in
  TQQQ (3x) represents $30,000 of effective Nasdaq-100 exposure.
- **Blended leverage ratio** = (sum of notional exposure across everything)
  ÷ (total portfolio value). 1.00x means no leverage; 1.50x means your
  portfolio moves like 1.5x your actual capital.
- **In leveraged products** = the dollar amount and % of your portfolio
  sitting in positions with |factor| > 1.

Inverse funds (e.g. SQQQ, -3x) count toward leverage using their absolute
factor — they carry the same magnified-move risk, just in the opposite
direction.

If you hold a leveraged ETF not in the table, add it to
`LEVERAGED_ETFS` in `src/leverage.js` — it's a plain object, no build step
needed.

## One-time setup

1. **Install dependencies:**
   ```
   npm install
   cp .env.example .env
   # fill in .env (Gmail credentials — see below)
   ```

2. **Gmail setup** (for sending the email): Google Account → Security →
   2-Step Verification → App Passwords, generate one for this project.
   That's `GMAIL_APP_PASSWORD` (16 characters, not your regular Gmail
   password). `GMAIL_USER` is the full Gmail address that password
   belongs to.

3. **Make sure Copilot Money has cached your investment data.** Open the
   Copilot Money app on your Mac and browse to the Investments tab — this
   ensures your holdings are fetched and cached locally. The first
   `npm install` also pulls down `copilot-money-mcp`, which is what reads
   that cache.

4. **Test it:**
   ```
   npm start
   ```
   This should print your positions and blended leverage to the console
   and send you the email. If it says "Database not available", open the
   Copilot Money app and let it sync, then try again.

5. **Schedule it twice a week with launchd** (macOS's native scheduler —
   more reliable than cron for this, since it survives sleep/wake better):
   ```
   cp launchd/com.leverage-tracker.plist.example launchd/com.leverage-tracker.plist
   ```
   Edit `launchd/com.leverage-tracker.plist`:
   - Replace `/usr/local/bin/node` with the output of `which node`.
   - Replace both `/Users/yourname/Leverage-and-Investments-Tracker` paths
     with this repo's actual absolute path on your Mac.

   Then load it:
   ```
   launchctl load ~/Library/LaunchAgents/com.leverage-tracker.plist
   ```
   (You'll need to copy or symlink the plist into
   `~/Library/LaunchAgents/` — launchd only looks there.)

   **This only runs while your Mac is on and awake at the scheduled time**
   (Mon/Thu 9:00 AM by default — edit `StartCalendarInterval` in the plist
   to change it). If your Mac is asleep or off, launchd does not
   automatically catch up on the missed run.

   Logs land at `/tmp/leverage-tracker.log` and
   `/tmp/leverage-tracker.error.log`.

## How it works

Each run (`src/index.js`):
1. Calls `copilot-money-mcp`'s `get_holdings` tool (local cache, no
   network) via `src/copilot.js`.
2. Classifies each position's leverage factor and computes totals
   (`src/portfolio.js`, `src/leverage.js`).
3. Compares the total to the last recorded value in `data/history.json`
   to show a delta, and emails the summary via Gmail SMTP.
4. Appends the new snapshot to `data/history.json` (gitignored by
   default — it's your real portfolio value on disk; remove it from
   `.gitignore` if you want it tracked in git).

## Known limitations

- **Mac-only, and only while the Mac is awake.** Unlike a GitHub
  Actions-based tracker, a missed run (Mac asleep/off) doesn't
  automatically retry.
- **Whatever Copilot Money itself can see.** If an account isn't linked in
  Copilot, or hasn't synced recently, its holdings won't show up here
  either. Open the app periodically to keep the cache fresh.
- `copilot-money-mcp` is an independent, community-maintained project, not
  officially affiliated with Copilot Money. It could break if Copilot
  changes its local cache format — if `npm start` starts failing, check
  for an update: `npm update copilot-money-mcp`.
