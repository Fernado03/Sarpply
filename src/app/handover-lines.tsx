'use client';

import { useState } from 'react';
import type { HandoverStallView } from '@/lib/handover';

function money(value: number): string {
  return `RM ${value.toFixed(2)}`;
}

export function HandoverLines({ stall }: { stall: HandoverStallView }) {
  const [delivered, setDelivered] = useState<Record<string, string>>({});
  const total = stall.lines.reduce((sum, line) => {
    const count = Number.parseInt(delivered[line.orderId] ?? '', 10);
    return sum + (Number.isFinite(count) ? Math.max(0, count) * Number(line.unitPrice) : 0);
  }, 0);

  return (
    <>
      <ul className="receipt-lines">
        {stall.lines.map((line) => (
          <li key={line.orderId} className="receipt-line">
            <span className="stall-code">{line.skuCode}</span>
            <span className="stall-meta">
              {line.nameEn} · ordered {line.orderedBundles} · {money(Number(line.unitPrice))}{' '}
              per {line.bundleUnitName.toLowerCase()}
            </span>
            <input
              name={`delivered-${line.orderId}`}
              type="number"
              min="0"
              max={line.orderedBundles}
              inputMode="numeric"
              required
              value={delivered[line.orderId] ?? ''}
              onChange={(event) =>
                setDelivered((current) => ({ ...current, [line.orderId]: event.target.value }))
              }
              placeholder={`Ordered ${line.orderedBundles}`}
              aria-label={`Delivered Bundles for ${line.skuCode}`}
            />
          </li>
        ))}
      </ul>
      <p className="handover-total" aria-live="polite">
        Handover total {money(total)}
      </p>
    </>
  );
}
