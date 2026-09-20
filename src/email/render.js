const fmt = (n) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

const fmtDelta = (n) => {
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${sign}${fmt(Math.abs(n))}`;
};

function tagFor(p) {
  if (p.unclassified) {
    return `<span style="display:inline-block;margin-left:6px;padding:2px 6px;border-radius:4px;background:#fef3c7;color:#92400e;font-size:10px;font-weight:700;letter-spacing:0.02em;text-transform:uppercase;">unclassified</span>`;
  }
  if (p.leveraged) {
    return `<span style="display:inline-block;margin-left:6px;padding:2px 6px;border-radius:4px;background:#fee2e2;color:#991b1b;font-size:10px;font-weight:700;">${p.factor > 0 ? p.factor + 'x' : Math.abs(p.factor) + 'x inverse'}</span>`;
  }
  return '';
}

// Table-based markup throughout (no flexbox) — this gets rendered by mail
// clients like Outlook and the Gmail app that don't support flexbox, so a
// flex layout here silently collapses into stacked, misaligned blocks.
function positionRow(p, isLast) {
  const border = isLast ? '' : 'border-bottom:1px solid #f3f4f6;';
  return `
    <tr>
      <td style="padding:8px 14px 8px 20px;${border}color:#374151;font-size:13px;">${p.symbol}${tagFor(p)}</td>
      <td style="padding:8px 20px 8px 14px;${border}text-align:right;color:#111827;font-size:13px;font-variant-numeric:tabular-nums;white-space:nowrap;">${fmt(p.value)}</td>
    </tr>`;
}

function accountSection(name, groupPositions) {
  const subtotal = groupPositions.reduce((sum, p) => sum + p.value, 0);
  const rows = groupPositions.map((p, i) => positionRow(p, i === groupPositions.length - 1)).join('');
  return `
    <tr>
      <td colspan="2" style="padding:14px 20px 6px;background:#f9fafb;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em;">${name ?? 'Unknown account'}</td>
            <td style="text-align:right;font-size:11px;font-weight:700;color:#6b7280;">${fmt(subtotal)}</td>
          </tr>
        </table>
      </td>
    </tr>
    ${rows}`;
}

function groupByAccount(positions) {
  const order = [];
  const byAccount = new Map();
  for (const p of positions) {
    const key = p.account ?? 'Unknown account';
    if (!byAccount.has(key)) {
      byAccount.set(key, []);
      order.push(key);
    }
    byAccount.get(key).push(p);
  }
  const subtotalOf = (key) => byAccount.get(key).reduce((sum, p) => sum + p.value, 0);
  order.sort((a, b) => subtotalOf(b) - subtotalOf(a));
  return order.map((name) => ({
    name,
    positions: [...byAccount.get(name)].sort((a, b) => b.value - a.value),
  }));
}

export function renderEmail({ portfolio, previousEntry, date }) {
  const {
    positions,
    cashValue,
    totalValue,
    leverageRatio,
    leveragedValue,
    leveragedShare,
    unclassifiedValue,
  } = portfolio;

  const deltaHtml =
    previousEntry != null
      ? `<div style="margin-top:4px;font-size:14px;color:${totalValue - previousEntry.totalValue >= 0 ? '#059669' : '#dc2626'};">
           ${fmtDelta(totalValue - previousEntry.totalValue)} since ${new Date(previousEntry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
         </div>`
      : '';

  const groups = groupByAccount(positions);
  const accountRows = groups.map((g) => accountSection(g.name, g.positions)).join('');

  const cashRow =
    cashValue > 0
      ? `
    <tr>
      <td colspan="2" style="padding:14px 20px 6px;background:#f9fafb;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em;">Cash</td>
            <td style="text-align:right;font-size:11px;font-weight:700;color:#6b7280;">${fmt(cashValue)}</td>
          </tr>
        </table>
      </td>
    </tr>`
      : '';

  const noPositionsWarning =
    positions.length === 0
      ? `<p style="margin:16px 0 0;padding:12px;background:#fef3c7;border-radius:6px;color:#92400e;font-size:13px;">
           No investment positions found in Copilot's local cache. Open the Copilot Money app,
           browse to the Investments tab, and make sure it has synced.
         </p>`
      : '';

  const unclassifiedWarning =
    unclassifiedValue > 0
      ? `<p style="margin:16px 0 0;padding:12px;background:#fef3c7;border-radius:6px;color:#92400e;font-size:13px;">
           ${fmt(unclassifiedValue)} of this total is from an account where Copilot's live API
           reports a balance but no per-holding detail. It's counted at 1x (unleveraged) above
           since its actual composition is unknown — check that account directly if it might
           hold leveraged funds.
         </p>`
      : '';

  const html = `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111827;background:#ffffff;">
    <div style="font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">Portfolio Snapshot</div>
    <div style="margin-top:4px;font-size:34px;font-weight:700;line-height:1.15;">${fmt(totalValue)}</div>
    ${deltaHtml}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;background:#f9fafb;border-radius:8px;">
      <tr>
        <td style="padding:14px 16px 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="font-size:13px;color:#6b7280;">Blended leverage</td>
              <td style="text-align:right;font-size:20px;font-weight:700;color:${leverageRatio > 1 ? '#dc2626' : '#111827'};">${leverageRatio.toFixed(2)}x</td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:0 16px 14px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="font-size:13px;color:#6b7280;">In leveraged products</td>
              <td style="text-align:right;font-size:13px;color:#111827;">${fmt(leveragedValue)} (${(leveragedShare * 100).toFixed(1)}%)</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;border:1px solid #f3f4f6;border-radius:8px;">
      ${accountRows}
      ${cashRow}
    </table>
    ${noPositionsWarning}
    ${unclassifiedWarning}
    <p style="margin:20px 0 0;font-size:11px;color:#9ca3af;text-align:center;">${date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
  </div>`;

  return html;
}
