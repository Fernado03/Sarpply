import { commitDraft, saveTextDraft } from './actions';
import { loadConsole, nextAction, statusLabel } from '@/lib/console';
import { loadOpenDrafts } from '@/lib/intake';

export const dynamic = 'force-dynamic';

function rm(value: string | null): string {
  return value === null ? '—' : `RM ${Number(value).toFixed(2)}`;
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const view = await loadConsole();

  const intakeError = typeof params.intakeError === 'string' ? params.intakeError : null;
  const notice = typeof params.notice === 'string' ? params.notice : null;

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
  const drafts = await loadOpenDrafts(batch.id);

  return (
    <main>
      <p className="brand">Sarpply</p>
      <p className="route">{batch.routeName}</p>

      {intakeError ? (
        <p className="notice error" role="alert">
          {intakeError}
        </p>
      ) : null}
      {notice === 'saved' ? (
        <p className="notice">Draft saved. Review the lines, then commit.</p>
      ) : null}
      {notice === 'committed' ? (
        <p className="notice">Preorder committed to the batch.</p>
      ) : null}

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

      <section>
        <h2>Order intake</h2>
        {open ? (
          <form action={saveTextDraft} className="card intake-form">
            <input type="hidden" name="batchId" value={batch.id} />
            <label className="field">
              <span>Stall</span>
              <select name="stallId" defaultValue="" required>
                <option value="" disabled>
                  Choose the Stall
                </option>
                {stalls.map((stall) => (
                  <option key={stall.stallCode} value={stall.id}>
                    {stall.stallCode} · {stall.stallName}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Pasted WhatsApp reply</span>
              <textarea
                name="body"
                rows={4}
                required
                placeholder={'A1 x 3, C1 2\n3 kotak B1'}
              />
            </label>
            <button type="submit" className="primary">
              Parse and save draft
            </button>
          </form>
        ) : (
          <p className="empty">Intake accepts Preorders only while the batch is open.</p>
        )}

        {drafts.length === 0 ? (
          <p className="empty">No unconfirmed drafts.</p>
        ) : (
          drafts.map((draft) => (
            <form key={draft.id} action={commitDraft} className="card draft">
              <input type="hidden" name="draftId" value={draft.id} />
              <div className="card-head">
                <strong>
                  {draft.stallCode} · {draft.stallName}
                </strong>
                <span className="stall-meta">Unconfirmed · {draft.createdAt}</span>
              </div>
              <p className="draft-body">{draft.body}</p>
              <ul className="draft-lines">
                {draft.lines.map((line) => (
                  <li key={line.lineNo} className="draft-line">
                    <span className="draft-raw">{line.rawText || '—'}</span>
                    <select
                      name={`sku-${line.lineNo}`}
                      defaultValue={line.skuCode ?? ''}
                      aria-label={`SKU for line ${line.lineNo}`}
                    >
                      <option value="">Unresolved</option>
                      {catalogue.map((sku) => (
                        <option key={sku.skuCode} value={sku.skuCode}>
                          {sku.skuCode} · {sku.nameEn}
                        </option>
                      ))}
                    </select>
                    <input
                      name={`bundles-${line.lineNo}`}
                      defaultValue={line.orderedBundles ?? ''}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="Bundles"
                      aria-label={`Bundles for line ${line.lineNo}`}
                    />
                  </li>
                ))}
              </ul>
              <button type="submit" className="primary">
                Commit Preorder
              </button>
            </form>
          ))
        )}
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
