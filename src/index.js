import 'dotenv/config';
import { computePortfolio } from './portfolio.js';
import { loadHistory, appendHistory, lastEntry } from './history.js';
import { renderEmail } from './email/render.js';
import { sendEmail } from './email/send.js';

async function main() {
  const portfolio = await computePortfolio();

  const history = loadHistory();
  const previousEntry = lastEntry(history);

  const date = new Date();
  const html = renderEmail({ portfolio, previousEntry, date });

  console.log(`Portfolio value: $${portfolio.totalValue.toFixed(2)}`);
  console.log(`Blended leverage: ${portfolio.leverageRatio.toFixed(2)}x`);
  console.log(
    `In leveraged products: $${portfolio.leveragedValue.toFixed(2)} (${(portfolio.leveragedShare * 100).toFixed(1)}%)`
  );
  for (const p of portfolio.positions) {
    console.log(`  ${p.symbol} (${p.account}): $${p.value.toFixed(2)}${p.leveraged ? ` [${p.factor}x]` : ''}`);
  }

  await sendEmail({
    subject: `Portfolio: $${portfolio.totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 })} · ${portfolio.leverageRatio.toFixed(2)}x leverage`,
    html,
  });

  appendHistory({
    date: date.toISOString(),
    totalValue: portfolio.totalValue,
    totalNotional: portfolio.totalNotional,
    leverageRatio: portfolio.leverageRatio,
    leveragedValue: portfolio.leveragedValue,
    leveragedShare: portfolio.leveragedShare,
    positions: Object.fromEntries(portfolio.positions.map((p) => [p.symbol, p.value])),
  });

  console.log('Email sent and history updated.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
