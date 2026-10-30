import { pool } from './db';

export interface PurchaseLineView {
  skuCode: string;
  nameEn: string;
  bundleUnitName: string;
  bundlesPerMasterCarton: number;
  orderedBundles: number;
  bufferBundles: number;
  cartons: number;
  physicalBoxes: number;
  geometricLiters: string;
  cartonCost: string | null;
  cashMyr: string | null;
}

export interface SortieLoadView {
  tripNumber: number;
  cartons: number;
  packedLiters: string;
  maxCargoLiters: number;
  packingEfficiency: string;
  fits: boolean;
}

export interface VehicleView {
  id: string;
  label: string;
  maxCargoLiters: number;
  packingEfficiency: string;
}

export interface WholesalerView {
  id: string;
  name: string;
}

export interface PoLineView {
  skuCode: string;
  cartonsOrdered: number;
  cartonsReceived: number | null;
  cartonsShort: number | null;
  cartonCost: string;
}

export interface PurchaseOrderView {
  id: string;
  wholesalerName: string;
  submittedAt: string;
  receivedAt: string | null;
  cashRequired: string | null;
  lines: PoLineView[];
}

export interface PurchaseTotalsView {
  cartons: number;
  physicalBoxes: number;
  geometricLiters: string;
  cashMyr: string;
}

export interface PurchaseView {
  lines: PurchaseLineView[];
  totals: PurchaseTotalsView;
  sorties: SortieLoadView[];
  vehicles: VehicleView[];
  wholesalers: WholesalerView[];
  vehicleId: string;
  vehicleConfirmed: boolean;
  vehicleConfirmedAt: string | null;
  po: PurchaseOrderView | null;
}

export async function loadPurchase(routeBatchId: string): Promise<PurchaseView> {
  const lines = await pool.query<PurchaseLineView>(
    `SELECT p.sku_code AS "skuCode",
            p.name_en AS "nameEn",
            p.bundle_unit_name AS "bundleUnitName",
            p.bundles_per_master_carton AS "bundlesPerMasterCarton",
            p.ordered_bundles AS "orderedBundles",
            p.buffer_bundles AS "bufferBundles",
            p.cartons,
            p.physical_boxes AS "physicalBoxes",
            p.geometric_liters::text AS "geometricLiters",
            p.locked_carton_cost::text AS "cartonCost",
            p.cash_myr::text AS "cashMyr"
     FROM v_purchase_plan p
     WHERE p.route_batch_id = $1
     ORDER BY p.sku_code`,
    [routeBatchId],
  );

  const totals = await pool.query<PurchaseTotalsView>(
    `SELECT cartons,
            physical_boxes AS "physicalBoxes",
            geometric_liters::text AS "geometricLiters",
            cash_myr::text AS "cashMyr"
     FROM v_purchase_plan_total
     WHERE route_batch_id = $1`,
    [routeBatchId],
  );

  const sorties = await pool.query<SortieLoadView>(
    `SELECT trip_number AS "tripNumber",
            cartons,
            packed_liters::text AS "packedLiters",
            max_cargo_liters AS "maxCargoLiters",
            packing_efficiency::text AS "packingEfficiency",
            fits
     FROM v_sortie_load
     WHERE route_batch_id = $1
     ORDER BY trip_number`,
    [routeBatchId],
  );

  const vehicles = await pool.query<VehicleView>(
    `SELECT id, label,
            max_cargo_liters AS "maxCargoLiters",
            packing_efficiency::text AS "packingEfficiency"
     FROM vehicles
     ORDER BY label`,
  );

  const wholesalers = await pool.query<WholesalerView>(
    'SELECT id, name FROM wholesalers WHERE is_active ORDER BY name',
  );

  const [batch] = (
    await pool.query<{
      vehicleId: string;
      vehicleConfirmed: boolean;
      vehicleConfirmedAt: string | null;
    }>(
      `SELECT vehicle_id AS "vehicleId",
              vehicle_confirmed_at IS NOT NULL AS "vehicleConfirmed",
              TO_CHAR(vehicle_confirmed_at AT TIME ZONE 'Asia/Kuching', 'Dy DD Mon, HH24:MI')
                AS "vehicleConfirmedAt"
       FROM route_batches
       WHERE id = $1`,
      [routeBatchId],
    )
  ).rows;

  const poResult = await pool.query<{
    id: string;
    wholesalerName: string;
    submittedAt: string;
    receivedAt: string | null;
    cashRequired: string | null;
  }>(
    `SELECT p.id,
            w.name AS "wholesalerName",
            TO_CHAR(p.submitted_at AT TIME ZONE 'Asia/Kuching', 'Dy DD Mon, HH24:MI') AS "submittedAt",
            TO_CHAR(p.received_at AT TIME ZONE 'Asia/Kuching', 'Dy DD Mon, HH24:MI') AS "receivedAt",
            p.cash_required_myr::text AS "cashRequired"
     FROM wholesaler_pos p
     JOIN wholesalers w ON w.id = p.wholesaler_id
     WHERE p.route_batch_id = $1`,
    [routeBatchId],
  );
  const poRow = poResult.rows[0];

  return {
    lines: lines.rows,
    totals: totals.rows[0],
    sorties: sorties.rows,
    vehicles: vehicles.rows,
    wholesalers: wholesalers.rows,
    vehicleId: batch.vehicleId,
    vehicleConfirmed: batch.vehicleConfirmed,
    vehicleConfirmedAt: batch.vehicleConfirmedAt,
    po: poRow
      ? {
          ...poRow,
          lines: await loadPoLines(poRow.id),
        }
      : null,
  };
}

export async function loadPoLines(poId: string): Promise<PoLineView[]> {
  const { rows } = await pool.query<PoLineView>(
    `SELECT sku_code AS "skuCode",
            cartons_ordered AS "cartonsOrdered",
            cartons_received AS "cartonsReceived",
            CASE WHEN cartons_received IS NULL THEN NULL
                 ELSE cartons_ordered - cartons_received END AS "cartonsShort",
            carton_cost::text AS "cartonCost"
     FROM wholesaler_po_lines
     WHERE po_id = $1
     ORDER BY sku_code`,
    [poId],
  );
  return rows;
}

export async function confirmBatchVehicle(
  routeBatchId: string,
  vehicleId: string,
): Promise<void> {
  await pool.query('SELECT fn_confirm_batch_vehicle($1, $2)', [routeBatchId, vehicleId]);
}

export async function submitWholesalerPo(
  routeBatchId: string,
  wholesalerId: string,
): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    'SELECT fn_submit_wholesaler_po($1, $2) AS id',
    [routeBatchId, wholesalerId],
  );
  return rows[0].id;
}

export interface ReceiptLine {
  skuCode: string;
  cartonsReceived: number;
}

export async function receiveWholesalerPo(
  poId: string,
  lines: ReceiptLine[],
): Promise<number> {
  const { rows } = await pool.query<{ written: number }>(
    'SELECT fn_receive_po($1, $2::jsonb) AS written',
    [poId, JSON.stringify(lines)],
  );
  return rows[0].written;
}

// Renderer-only formatting. Every number and money figure above comes from SQL.
export function purchaseListText(
  routeName: string,
  deliveryDate: string,
  vehicleLabel: string,
  sortieCount: number,
  lines: PurchaseLineView[],
  totals: PurchaseTotalsView,
): string {
  const buying = lines.filter((line) => line.cartons > 0);

  const body = buying.map((line) =>
    [
      line.skuCode,
      line.nameEn,
      `ordered ${line.orderedBundles}, buffer ${line.bufferBundles}`,
      `${line.cartons} cartons, ${line.physicalBoxes} boxes, ${line.geometricLiters} L`,
      `RM ${Number(line.cartonCost).toFixed(2)}/carton`,
      `RM ${Number(line.cashMyr).toFixed(2)}`,
    ].join(' | '),
  );

  return [
    'Sarpply purchase list',
    `${routeName} · delivery ${deliveryDate} · ${sortieCount} Sortie${sortieCount === 1 ? '' : 's'}`,
    `Vehicle ${vehicleLabel}`,
    '',
    ...body,
    '',
    `TOTAL | ${totals.cartons} cartons, ${totals.physicalBoxes} boxes, ${totals.geometricLiters} L | RM ${Number(totals.cashMyr).toFixed(2)}`,
  ].join('\n');
}
