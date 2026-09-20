import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// Uses copilot-money-mcp's --live-reads mode: real-time reads via Copilot's
// GraphQL API, authenticated with the Firebase session from a browser
// already logged in to app.copilot.money on this Mac — no manual token
// capture, no credentials handled by this code.
//
// The default (no-flags) cache mode would be lower-risk still (zero network
// requests, pure local-file reads), but it's unusable here: on this
// database, copilot-money-mcp's local decoder doesn't recognize the
// `securities` or `transactions` collections at all (confirmed via its own
// get_cache_info diagnostic — 0 documents decoded for either, not even
// attempted), so every holding's ticker symbol comes back as undefined no
// matter what data Copilot itself has synced. --live-reads bypasses that
// local decode path entirely.
async function callLive(client, name, args) {
  const result = await client.callTool({ name, arguments: args });
  const text = result.content?.[0]?.text;
  if (!text) {
    throw new Error(`copilot-money-mcp returned no content for ${name}.`);
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Error responses from copilot-money-mcp are plain text, not JSON
    // (e.g. "get_holdings_live is only available when the server runs
    // with --live-reads.", or a login-required message) — surface that
    // message directly instead of a confusing JSON parse error.
    throw new Error(`copilot-money-mcp ${name}: ${text}`);
  }
  return parsed;
}

export async function getHoldingsFromCopilot() {
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['--no-install', 'copilot-money-mcp', '--live-reads'],
  });

  const client = new Client({ name: 'leverage-and-investments-tracker', version: '1.0.0' }, {
    capabilities: {},
  });

  await client.connect(transport);

  try {
    const [holdingsResult, accountsResult] = await Promise.all([
      callLive(client, 'get_holdings_live', { include_hidden: true, limit: 10000 }),
      callLive(client, 'get_accounts_live', { include_hidden: true, limit: 10000 }),
    ]);

    if (!Array.isArray(holdingsResult.holdings)) {
      throw new Error(
        `Unexpected response from Copilot get_holdings_live (is the app installed, synced, and are you logged in at app.copilot.money in a browser on this Mac?): ${JSON.stringify(holdingsResult).slice(0, 300)}`
      );
    }

    const accounts = accountsResult.accounts ?? [];

    // get_accounts_live rows key on `id`, not `account_id` (unlike
    // get_holdings_live, which uses `account_id` for the same account) —
    // the two live tools don't share field naming here.
    const accountNameById = new Map(accounts.map((a) => [a.id, a.name]));

    const holdings = holdingsResult.holdings.map((h) => ({
      ...h,
      account_name: accountNameById.get(h.account_id) ?? h.account_id,
    }));

    return [...holdings, ...unaccountedBalanceHoldings(accounts, holdings)];
  } finally {
    await client.close();
  }
}

// get_holdings_live has a confirmed gap: for at least one investment account
// (a UTMA, observed directly), it returns zero rows even though that same
// account has a real, current, non-hidden balance in get_accounts_live,
// synced on the same connection as sibling accounts whose holdings resolve
// fine. Silently trusting get_holdings_live alone would under-report the
// portfolio by the full value of any account it fails on.
//
// To avoid that, reconcile: for every non-hidden, non-closed investment
// account, compare its live balance to the sum of institution_value across
// the holdings returned for it. Any unaccounted balance becomes a
// synthetic "Unclassified holdings" line so it's included in totals and
// clearly flagged, instead of silently dropped. It defaults to 1x
// (unleveraged) — its true composition is unknown.
function unaccountedBalanceHoldings(accounts, holdings) {
  const holdingsValueByAccountId = new Map();
  for (const h of holdings) {
    const value = h.institution_value ?? 0;
    holdingsValueByAccountId.set(
      h.account_id,
      (holdingsValueByAccountId.get(h.account_id) ?? 0) + value
    );
  }

  const UNACCOUNTED_THRESHOLD = 1; // ignore sub-dollar rounding noise

  return accounts
    .filter((a) => (a.type ?? '').toLowerCase() === 'investment')
    .filter((a) => !a.isUserHidden && !a.isUserClosed)
    .map((a) => {
      const balance = a.balance ?? 0;
      const accounted = holdingsValueByAccountId.get(a.id) ?? 0;
      return { account: a, gap: balance - accounted };
    })
    .filter(({ gap }) => gap > UNACCOUNTED_THRESHOLD)
    .map(({ account, gap }) => ({
      ticker_symbol: null,
      name: 'Unclassified holdings',
      account_id: account.id,
      account_name: account.name,
      quantity: null,
      institution_price: null,
      institution_value: gap,
      is_cash_equivalent: false,
      unclassified: true,
    }));
}
