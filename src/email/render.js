const fmt = (n) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

const fmtDelta = (n) => {
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${sign}${fmt(Math.abs(n))}`;
};

function positionRow(p) {
  const tag = p.leveraged
    ? `<span style="display:inline-block;margin-left:6px;padding:1px 6px;border-radius:4px;background:#fee2e2;color:#991b1b;font-size:11px;font-weight:600;">${p.factor > 0 ? p.factor + 'x' : p.factor + 'x inverse'}</span>`
    : '';
  return `
    <tr>
      <td style="padding:8px 0;color:#374151;">
        <div style="font-weight:600;">${p.symbol}${tag}</div>
        <div style="font-size:12px;color:#9ca3af;">${p.account ?? 'Unknown account'}</div>
      </td>
      <td style="padding:8px 0;text-align:right;color:#111827;font-variant-numeric:tabular-nums;">${fmt(p.value)}</td>
    </tr>`;
}

export function renderEmail({ portfolio, previousEntry, date }) {
  const { positions, cashValue, totalValue, leverageRatio, leveragedValue, leveragedShare } =
    portfolio;

  const deltaHtml =
    previousEntry != null
      ? `<p style="margin:4px 0 0;color:${totalValue - previousEntry.totalValue >= 0 ? '#059669' : '#dc2626'};font-size:14px;">
           ${fmtDelta(totalValue - previousEntry.totalValue)} since ${new Date(previousEntry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
         </p>`
      : '';

  const sortedPositions = [...positions].sort((a, b) => b.value - a.value);
  const rows = sortedPositions.map(positionRow).join('');

  const cashRow =
    cashValue > 0
      ? `<tr><td style="padding:8px 0;color:#374151;">Cash</td><td style="padding:8px 0;text-align:right;color:#111827;font-variant-numeric:tabular-nums;">${fmt(cashValue)}</td></tr>`
      : '';

  const noPositionsWarning =
    positions.length === 0
      ? `<p style="margin:16px 0 0;padding:12px;background:#fef3c7;border-radius:6px;color:#92400e;font-size:13px;">
           No investment positions found in Copilot's local cache. Open the Copilot Money app,
           browse to the Investments tab, and make sure it has synced.
         </p>`
      : '';

  const html = `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111827;">
    <h2 style="margin:0 0 4px;font-size:15px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">
      Portfolio Snapshot
    </h2>
    <p style="margin:0;font-size:32px;font-weight:700;">${fmt(totalValue)}</p>
    ${deltaHtml}

    <div style="margin-top:20px;padding:16px;background:#f9fafb;border-radius:8px;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;">
        <span style="font-size:13px;color:#6b7280;">Blended leverage</span>
        <span style="font-size:20px;font-weight:700;color:${leverageRatio > 1 ? '#dc2626' : '#111827'};">${leverageRatio.toFixed(2)}x</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:8px;">
        <span style="font-size:13px;color:#6b7280;">In leveraged products</span>
        <span style="font-size:13px;color:#111827;">${fmt(leveragedValue)} (${(leveragedShare * 100).toFixed(1)}%)</span>
      </div>
    </div>

    <table style="width:100%;margin-top:24px;border-collapse:collapse;font-size:14px;">
      ${rows}
      ${cashRow}
    </table>
    ${noPositionsWarning}
    <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;">${date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
  </div>`;

  return html;
}
