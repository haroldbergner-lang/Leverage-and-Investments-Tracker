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
      callLive(client, 'get_holdings_live', { limit: 10000 }),
      callLive(client, 'get_accounts_live', { limit: 10000 }),
    ]);

    if (!Array.isArray(holdingsResult.holdings)) {
      throw new Error(
        `Unexpected response from Copilot get_holdings_live (is the app installed, synced, and are you logged in at app.copilot.money in a browser on this Mac?): ${JSON.stringify(holdingsResult).slice(0, 300)}`
      );
    }

    const accountNameById = new Map(
      (accountsResult.accounts ?? []).map((a) => [a.account_id, a.name])
    );

    return holdingsResult.holdings.map((h) => ({
      ...h,
      account_name: accountNameById.get(h.account_id) ?? h.account_id,
    }));
  } finally {
    await client.close();
  }
}
