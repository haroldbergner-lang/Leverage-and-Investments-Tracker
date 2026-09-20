import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// Spawns copilot-money-mcp with no flags — its default mode, which reads
// Copilot Money's local LevelDB cache directly and makes zero network
// requests. `--no-install` keeps npx from ever reaching out to the registry:
// if the local dependency isn't there, this fails loudly instead of quietly
// fetching from the network.
export async function getHoldingsFromCopilot() {
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['--no-install', 'copilot-money-mcp'],
  });

  const client = new Client({ name: 'leverage-and-investments-tracker', version: '1.0.0' }, {
    capabilities: {},
  });

  await client.connect(transport);

  try {
    const result = await client.callTool({
      name: 'get_holdings',
      arguments: { limit: 10000 },
    });

    const text = result.content?.[0]?.text;
    if (!text) {
      throw new Error('copilot-money-mcp returned no content for get_holdings.');
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Error responses from copilot-money-mcp are plain text, not JSON
      // (e.g. "Database not available. Please ensure Copilot Money is
      // installed and has created local data.") — surface that message
      // directly instead of a confusing JSON parse error.
      throw new Error(`copilot-money-mcp: ${text}`);
    }

    if (!Array.isArray(parsed.holdings)) {
      throw new Error(
        `Unexpected response from Copilot (is the app installed and synced?): ${text.slice(0, 300)}`
      );
    }

    return parsed.holdings;
  } finally {
    await client.close();
  }
}
