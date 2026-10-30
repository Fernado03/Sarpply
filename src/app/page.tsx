import { commitDraft, retryMessages, saveTextDraft, sendBroadcast } from './actions';
import { confirmVehicle, receivePurchaseOrder, submitPurchaseOrder } from './purchase-actions';
import { loadConsole, nextAction, statusLabel } from '@/lib/console';
import { loadOpenDrafts } from '@/lib/intake';
import { loadPurchase, purchaseListText } from '@/lib/purchase';

export const dynamic = 'force-dynamic';

function rm(value: string | null): string {
  return value === null ? '—' : `RM ${Number(value).toFixed(2)}`;
}

function firstLine(body: string): string {
  return body.split('\n').find((line) => line.trim() !== '') ?? body;
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const view = await loadConsole();

  const intakeError = typeof params.intakeError === 'string' ? params.intakeError : null;
  const purchaseError = typeof params.purchaseError === 'string' ? params.purchaseError : null;
  const notice = typeof params.notice === 'string' ? params.notice : null;
  const sentCount = typeof params.sent === 'string' ? params.sent : '0';
  const failedCount = typeof params.failed === 'string' ? params.failed : '0';

  if (!view) {
    return (
      <main>
        <p className="brand">Sarpply</p>
        <h1>No open Route Batch</h1>
        <p className="stall-meta">Run `npm run db:reset` to load the seeded week.</p>
      </main>
    );
  }

  const {
    batch,
    stalls,
    orders,
    catalogue,
    frozenPrices,
    missingPreorders,
    outboundMessages,
    inboundMessages,
  } = view;
  const clusters = new Map<string, typeof stalls>();
  for (const stall of stalls) {
    clusters.set(stall.cluster, [...(clusters.get(stall.cluster) ?? []), stall]);
  }
  const open = batch.status === 'OPEN_FOR_ORDERS';
  const failedOutbound = outboundMessages.filter((message) => message.status === 'FAILED').length;
  const drafts = await loadOpenDrafts(batch.id);
  const purchase = await loadPurchase(batch.id);
  const frozen = batch.status !== 'OPEN_FOR_ORDERS';
  const canConfirmVehicle =
    !purchase.vehicleConfirmed &&
    (batch.status === 'OPEN_FOR_ORDERS' || batch.status === 'CLOSED_AT_CUTOFF');
  const shortLines = purchase.po?.lines.filter((line) => (line.cartonsShort ?? 0) > 0) ?? [];
  const purchaseText = frozen
    ? purchaseListText(
        batch.routeName,
        batch.deliveryDate,
        batch.vehicleLabel,
        batch.sortieCount,
        purchase.lines,
        purchase.totals,
      )
    : '';

  return (
    <main>
      <p className="brand">Sarpply</p>
      <p className="route">{batch.routeName}</p>

      {intakeError ? (
        <p className="notice error" role="alert">
          {intakeError}
        </p>
      ) : null}
      {purchaseError ? (
        <p className="notice error" role="alert">
          {purchaseError}
        </p>
      ) : null}
      {notice === 'vehicle' ? <p className="notice">Vehicle confirmed for the batch.</p> : null}
      {notice === 'po' ? <p className="notice">Wholesaler PO submitted.</p> : null}
      {notice === 'received' ? (
        <p className="notice">Receipt recorded. Cash follows the cartons received.</p>
      ) : null}
      {notice === 'saved' ? (
        <p className="notice">Draft saved. Review the lines, then commit.</p>
      ) : null}
      {notice === 'committed' ? (
        <p className="notice">Preorder committed to the batch.</p>
      ) : null}
      {notice === 'broadcast' || notice === 'retried' ? (
        <p className={`notice${failedCount !== '0' ? ' error' : ''}`}>
          {notice === 'broadcast' ? 'Broadcast queued. ' : 'Retry finished. '}
          {sentCount} sent, {failedCount} failed.
        </p>
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
          {batch.cutoffFiredAt ? (
            <div>
              <dt>Cutoff fired</dt>
              <dd>{batch.cutoffFiredAt}</dd>
            </div>
          ) : null}
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
        <h2>Frozen prices</h2>
        {frozenPrices.length === 0 ? (
          <p className="empty">Prices freeze at Cutoff; nothing is locked yet.</p>
        ) : (
          <>
            <p className="stall-meta">
              Locked at Cutoff
              {batch.cutoffFiredAt ? ` · fired ${batch.cutoffFiredAt}` : ''}
            </p>
            <ul className="stall-list">
              {frozenPrices.map((price) => (
                <li key={price.skuCode}>
                  <span className="stall-code">{price.skuCode}</span>
                  <span>{price.nameEn}</span>
                  <span className="stall-meta">
                    {rm(price.cartonCost)} per carton · {rm(price.poolBundlePrice)} per{' '}
                    {price.bundleUnitName.toLowerCase()}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section>
        <h2>Purchase plan</h2>
        {!frozen ? (
          <p className="empty">The purchase list appears once Cutoff freezes the prices.</p>
        ) : (
          <>
            <div className="card">
              <div className="card-head">
                <strong>Vehicle {batch.vehicleLabel}</strong>
                <span className={purchase.vehicleConfirmed ? 'badge' : 'badge closed'}>
                  {purchase.vehicleConfirmed ? 'Confirmed' : 'Not confirmed'}
                </span>
              </div>
              <p className="stall-meta">
                {purchase.vehicleConfirmed
                  ? `Confirmed ${purchase.vehicleConfirmedAt}`
                  : 'Confirm the Vehicle before the Wholesaler PO.'}
              </p>
              {canConfirmVehicle ? (
                <form action={confirmVehicle} className="vehicle-form">
                  <input type="hidden" name="batchId" value={batch.id} />
                  <select
                    name="vehicleId"
                    defaultValue={purchase.vehicleId}
                    aria-label="Vehicle"
                  >
                    {purchase.vehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.label} · {vehicle.maxCargoLiters} L · {vehicle.packingEfficiency}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="secondary">
                    Confirm Vehicle
                  </button>
                </form>
              ) : null}
            </div>

            <h3>Sortie load</h3>
            {purchase.sorties.length === 0 ? (
              <p className="empty">No cartons to load: Buffer Stock covers every Preorder.</p>
            ) : (
              <ul className="stall-list">
                {purchase.sorties.map((sortie) => (
                  <li key={sortie.tripNumber}>
                    <span className="stall-code">Sortie {sortie.tripNumber}</span>
                    <span>{sortie.cartons} cartons</span>
                    <span className="stall-meta">
                      {sortie.packedLiters} L of {sortie.maxCargoLiters} L ·{' '}
                      {sortie.packingEfficiency} packing
                    </span>
                    <span className={sortie.fits ? 'badge' : 'badge closed'}>
                      {sortie.fits ? 'Fits' : 'Over capacity'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {purchase.sorties.some((sortie) => !sortie.fits) ? (
              <p className="notice error">
                A Sortie exceeds the Vehicle. The Wholesaler PO is refused until the plan fits.
              </p>
            ) : null}

            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Item</th>
                    <th>Ordered</th>
                    <th>Buffer</th>
                    <th>Cartons</th>
                    <th>Boxes</th>
                    <th>Litres</th>
                    <th>Carton cost</th>
                    <th>Cash</th>
                  </tr>
                </thead>
                <tbody>
                  {purchase.lines.map((line) => (
                    <tr key={line.skuCode}>
                      <td>{line.skuCode}</td>
                      <td>{line.nameEn}</td>
                      <td>{line.orderedBundles}</td>
                      <td>{line.bufferBundles}</td>
                      <td>{line.cartons}</td>
                      <td>{line.physicalBoxes}</td>
                      <td>{line.geometricLiters}</td>
                      <td>{rm(line.cartonCost)}</td>
                      <td>{rm(line.cashMyr)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4}>Total</td>
                    <td>{purchase.totals.cartons}</td>
                    <td>{purchase.totals.physicalBoxes}</td>
                    <td>{purchase.totals.geometricLiters}</td>
                    <td></td>
                    <td>{rm(purchase.totals.cashMyr)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <details className="copy-list">
              <summary>Copyable purchase list</summary>
              <textarea
                readOnly
                defaultValue={purchaseText}
                rows={Math.max(6, purchaseText.split('\n').length)}
                aria-label="Copyable purchase list"
              />
            </details>

            {batch.status === 'CLOSED_AT_CUTOFF' && !purchase.po ? (
              <form action={submitPurchaseOrder} className="card intake-form">
                <input type="hidden" name="batchId" value={batch.id} />
                <label className="field">
                  <span>Wholesaler</span>
                  <select
                    name="wholesalerId"
                    defaultValue={purchase.wholesalers[0]?.id ?? ''}
                    required
                  >
                    {purchase.wholesalers.map((wholesaler) => (
                      <option key={wholesaler.id} value={wholesaler.id}>
                        {wholesaler.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="primary">
                  Submit Wholesaler PO
                </button>
              </form>
            ) : null}

            {purchase.po ? (
              <div className="card">
                <div className="card-head">
                  <strong>Wholesaler PO · {purchase.po.wholesalerName}</strong>
                  <span className={purchase.po.receivedAt ? 'badge' : 'badge closed'}>
                    {purchase.po.receivedAt ? 'Received' : 'Submitted'}
                  </span>
                </div>
                <dl className="facts">
                  <div>
                    <dt>Submitted</dt>
                    <dd>{purchase.po.submittedAt}</dd>
                  </div>
                  {purchase.po.receivedAt ? (
                    <div>
                      <dt>Received</dt>
                      <dd>{purchase.po.receivedAt}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt>Cash required</dt>
                    <dd>
                      {purchase.po.receivedAt
                        ? rm(purchase.po.cashRequired)
                        : 'Set by received cartons'}
                    </dd>
                  </div>
                </dl>

                {shortLines.length > 0 ? (
                  <p className="notice error">
                    Short receipt: {shortLines
                      .map((line) => `${line.skuCode} short ${line.cartonsShort}`)
                      .join(', ')}
                    . Cash uses what arrived; nothing is corrected silently.
                  </p>
                ) : null}

                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>SKU</th>
                        <th>Ordered</th>
                        <th>Received</th>
                        <th>Short</th>
                        <th>Carton cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchase.po.lines.map((line) => (
                        <tr key={line.skuCode}>
                          <td>{line.skuCode}</td>
                          <td>{line.cartonsOrdered}</td>
                          <td>{line.cartonsReceived ?? '—'}</td>
                          <td>{line.cartonsShort ?? '—'}</td>
                          <td>{rm(line.cartonCost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {batch.status === 'PO_SUBMITTED' ? (
                  <form action={receivePurchaseOrder} className="card intake-form">
                    <input type="hidden" name="poId" value={purchase.po.id} />
                    <p className="stall-meta">
                      Record what arrived at the loading bay. Re-submitting the same counts
                      writes nothing.
                    </p>
                    <ul className="receipt-lines">
                      {purchase.po.lines.map((line) => (
                        <li key={line.skuCode} className="receipt-line">
                          <span className="stall-code">{line.skuCode}</span>
                          <span className="stall-meta">Ordered {line.cartonsOrdered}</span>
                          <input
                            name={`received-${line.skuCode}`}
                            type="number"
                            min="0"
                            max={line.cartonsOrdered}
                            placeholder={`Ordered ${line.cartonsOrdered}`}
                            inputMode="numeric"
                            required
                            aria-label={`Cartons received for ${line.skuCode}`}
                          />
                        </li>
                      ))}
                    </ul>
                    <button type="submit" className="primary">
                      Record received cartons
                    </button>
                  </form>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </section>

      {!open ? (
        <section>
          <h2>Stalls with no Preorder</h2>
          {missingPreorders.length === 0 ? (
            <p className="empty">Every active Stall ordered before Cutoff.</p>
          ) : (
            <ul className="stall-list">
              {missingPreorders.map((stall) => (
                <li key={stall.stallCode}>
                  <span className="stall-code">{stall.stallCode}</span>
                  <span>{stall.stallName}</span>
                  <span className="stall-meta">{stall.cluster}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

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
        <h2>Message log</h2>
        {open ? (
          <div className="message-actions">
            <form action={sendBroadcast}>
              <input type="hidden" name="batchId" value={batch.id} />
              <button type="submit" className="primary">
                Queue and send Tuesday broadcast
              </button>
            </form>
            {failedOutbound > 0 ? (
              <form action={retryMessages}>
                <input type="hidden" name="batchId" value={batch.id} />
                <button type="submit" className="secondary">
                  Retry failed ({failedOutbound})
                </button>
              </form>
            ) : null}
          </div>
        ) : (
          <p className="empty">The broadcast belongs to an open Route Batch.</p>
        )}

        <h3>Outbound</h3>
        {outboundMessages.length === 0 ? (
          <p className="empty">No outbound messages for this batch.</p>
        ) : (
          <ul className="message-list">
            {outboundMessages.map((message) => (
              <li key={message.id} className="message">
                <div className="message-head">
                  <span className="stall-code">{message.stallCode ?? '—'}</span>
                  <span className={`message-status ${message.status.toLowerCase()}`}>
                    {statusLabel(message.status)}
                  </span>
                  <span className="stall-meta">
                    {message.toPhone} · {message.sentAt ?? message.queuedAt}
                  </span>
                </div>
                {message.failureReason ? (
                  <p className="message-failure">{message.failureReason}</p>
                ) : null}
                <details>
                  <summary>{firstLine(message.body)}</summary>
                  <p className="message-body">{message.body}</p>
                </details>
              </li>
            ))}
          </ul>
        )}

        <h3>Inbound</h3>
        {inboundMessages.length === 0 ? (
          <p className="empty">No inbound messages for this batch.</p>
        ) : (
          <ul className="message-list">
            {inboundMessages.map((message) => (
              <li key={message.id} className="message">
                <div className="message-head">
                  <span className="stall-code">{message.stallCode ?? '—'}</span>
                  <span className="message-status received">
                    {message.isVoiceNote ? 'Voice note' : statusLabel(message.messageType)}
                  </span>
                  <span className="stall-meta">
                    {message.fromPhone} · {message.receivedAt}
                  </span>
                </div>
                {message.messageType === 'AUDIO' ? (
                  <p className="message-body">
                    Audio metadata stored; transcription is not enabled.
                    {message.mediaDurationSeconds === null
                      ? ''
                      : ` ${message.mediaDurationSeconds}s`}
                    {message.mediaMimeType ? ` · ${message.mediaMimeType}` : ''}
                  </p>
                ) : (
                  <p className="message-body">{message.body ?? 'No text body.'}</p>
                )}
              </li>
            ))}
          </ul>
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
