import { loadConsole, nextAction, statusLabel } from '@/lib/console';

export const dynamic = 'force-dynamic';

function rm(value: string | null): string {
  return value === null ? '—' : `RM ${Number(value).toFixed(2)}`;
}

export default async function Page() {
  const view = await loadConsole();

  if (!view) {
    return (
      <main>
        <p className="brand">Sarpply</p>
        <h1>No open Route Batch</h1>
        <p className="stall-meta">Run `npm run db:reset` to load the seeded week.</p>
      </main>
    );
  }

  const { batch, stalls, orders, catalogue } = view;
  const clusters = new Map<string, typeof stalls>();
  for (const stall of stalls) {
    clusters.set(stall.cluster, [...(clusters.get(stall.cluster) ?? []), stall]);
  }
  const open = batch.status === 'OPEN_FOR_ORDERS';

  return (
    <main>
      <p className="brand">Sarpply</p>
      <p className="route">{batch.routeName}</p>

      <section className="card">
        <div className="card-head">
          <span className={`badge${open ? '' : ' closed'}`}>{statusLabel(batch.status)}</span>
          <span className="stall-meta">Delivery {batch.deliveryDate}</span>
        </div>
        <h1 className="next-action">{nextAction(batch.status)}</h1>
        <dl className="facts">
          <div>
            <dt>Cutoff</dt>
            <dd>{batch.cutoffAt}</dd>
          </div>
          <div>
            <dt>Vehicle</dt>
            <dd>{batch.vehicleLabel}</dd>
          </div>
          <div>
            <dt>Sorties</dt>
            <dd>{batch.sortieCount}</dd>
          </div>
        </dl>
      </section>

      {[...clusters.entries()].map(([cluster, clusterStalls]) => (
        <section className="cluster" key={cluster}>
          <h2>{cluster}</h2>
          <ul className="stall-list">
            {clusterStalls.map((stall) => (
              <li key={stall.stallCode}>
                <span className="stall-code">{stall.stallCode}</span>
                <span>{stall.stallName}</span>
                <span className="stall-meta">
                  {stall.stallNumber} · {stall.trustTier.toLowerCase().replaceAll('_', ' ')} ·{' '}
                  {stall.writtenLanguage}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section>
        <h2>Orders</h2>
        {orders.length === 0 ? (
          <p className="empty">No orders recorded for this batch yet.</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Stall</th>
                  <th>SKU</th>
                  <th>Type</th>
                  <th>Ordered</th>
                  <th>Delivered</th>
                  <th>Price</th>
                  <th>Payment</th>
                  <th>Fulfilment</th>
                  <th>Channel</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>{order.stallCode}</td>
                    <td>{order.skuCode}</td>
                    <td>{statusLabel(order.orderType)}</td>
                    <td>{order.orderedBundles}</td>
                    <td>{order.deliveredBundles}</td>
                    <td>{rm(order.unitPrice)}</td>
                    <td>{statusLabel(order.paymentStatus)}</td>
                    <td>{statusLabel(order.fulfilmentStatus)}</td>
                    <td>{statusLabel(order.sourceChannel)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2>Golden 6 catalogue</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Item</th>
                <th>Bundle</th>
                <th>Bundles / carton</th>
                <th>Pool price</th>
              </tr>
            </thead>
            <tbody>
              {catalogue.map((sku) => (
                <tr key={sku.skuCode}>
                  <td>{sku.skuCode}</td>
                  <td>{sku.nameEn}</td>
                  <td>{sku.bundleUnitName}</td>
                  <td>{sku.bundlesPerMasterCarton}</td>
                  <td>{rm(sku.poolBundlePrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer>
        State, prices and stock are read from PostgreSQL. This screen renders; it does not compute
        GP, Buffer Stock value or the reconciliation identity.
      </footer>
    </main>
  );
}
