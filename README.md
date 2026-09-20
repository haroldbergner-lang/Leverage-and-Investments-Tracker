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
**`--live-reads` mode**: real-time reads via Copilot's own GraphQL API,
authenticated using the Firebase session from a browser already logged in
to app.copilot.money on your Mac. No manual token capture, no credentials
handled by this project's code — `copilot-money-mcp` reads the session
itself from your browser's local storage.

That login only exists on your Mac, so the job has to run there too — it
can't run in GitHub Actions or any other cloud runner.

**Why not the tool's default cache-only mode** (which would be zero
network requests, not even this)? Because on this database, its local
decoder doesn't recognize the `securities` or `transactions` collections
at all — confirmed via its own `get_cache_info` diagnostic, which showed
0 documents decoded for either, not attempted at all — so every holding's
ticker symbol came back empty no matter what Copilot itself had synced.
`--live-reads` sidesteps that local-decode bug entirely. If you hit this
tool's decode issue too, consider filing it at
[its issue tracker](https://github.com/ignaciohermosillacornejo/copilot-money-mcp/issues)
with your own `get_cache_info` output as evidence.

The only other network call this project makes is the one at the very
end: sending the email via Gmail SMTP.

Your holdings data never passes through an AI model as part of the
recurring job. The script talks to `copilot-money-mcp` directly over the
[MCP](https://modelcontextprotocol.io/) protocol (the same protocol an AI
chat client would use), formats the result, and emails it — no LLM
inference happens on your portfolio data during a scheduled run.

## Handling gaps in Copilot's live holdings data

`copilot-money-mcp`'s `get_holdings_live` tool has a confirmed gap: for at
least one investment account (a UTMA, observed directly), it returns zero
holding rows even though that same account has a real, current, non-hidden
balance in `get_accounts_live` — on the same connection as sibling accounts
whose holdings resolve fine. If this project trusted `get_holdings_live`
alone, that account's entire value would silently disappear from your
portfolio total.

Instead, `src/copilot.js` reconciles: for every non-hidden, non-closed
investment account, it compares the account's live balance to the sum of
its returned holdings. Any unaccounted-for balance is added as a synthetic
**"Unclassified holdings"** line, counted at 1x (unleveraged, since its
real composition is unknown), and flagged with a warning in both the
console output and the email. This keeps the total accurate without
pretending to know something the API didn't return. If you see this
warning, it's worth checking that account directly in Copilot, and
consider filing the gap with
[`copilot-money-mcp`'s issue tracker](https://github.com/ignaciohermosillacornejo/copilot-money-mcp/issues).

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

3. **Log in to Copilot Money in a browser on this Mac**, at
   app.copilot.money — Chrome, Arc, Edge, Brave, Vivaldi, Chromium, Opera,
   Safari, and Firefox are all supported. `copilot-money-mcp` reads that
   session to make live, authenticated reads; the desktop app alone isn't
   enough for `--live-reads` mode. The first `npm install` also pulls down
   `copilot-money-mcp` itself.

4. **Test it:**
   ```
   npm start
   ```
   This should print your positions and blended leverage to the console
   and send you the email. If it says you're not logged in, log in to
   Copilot Money at app.copilot.money in one of the supported browsers and
   try again.

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
1. Calls `copilot-money-mcp`'s `get_holdings_live` and `get_accounts_live`
   tools (`--live-reads` mode) via `src/copilot.js`, and joins account
   names onto each holding.
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
- **Needs a logged-in browser session.** If you log out of Copilot Money
  everywhere, or your browser session expires, `npm start` will fail until
  you log back in at app.copilot.money.
- **Whatever Copilot Money itself can see.** If an account isn't linked in
  Copilot, or hasn't synced recently, its holdings won't show up here
  either.
- `copilot-money-mcp` is an independent, community-maintained project, not
  officially affiliated with Copilot Money. It could break if Copilot
  changes its GraphQL API — if `npm start` starts failing, check for an
  update: `npm update copilot-money-mcp`.
