import { pool } from './db';

export interface ReconciliationView {
  status: string;
  forecastGpMyr: string;
  realizedGpMyr: string;
  gmvDeliveredMyr: string;
  gmvThresholdMyr: string;
  gpThresholdMyr: string;
  openingBufferMyr: string;
  closingBufferMyr: string;
  sortieCostMyr: string;
  collectedMyr: string;
  cashPaidMyr: string;
  deliveredCostMyr: string;
  netCashFlowMyr: string;
  identityResidualMyr: string;
  headroomPct: string | null;
  gateVerdict: string;
}

export async function loadReconciliation(
  routeBatchId: string,
): Promise<ReconciliationView | null> {
  const result = await pool.query<ReconciliationView>(
    `SELECT status,
            forecast_gp_myr::text          AS "forecastGpMyr",
            realized_gp_myr::text          AS "realizedGpMyr",
            gmv_delivered_myr::text        AS "gmvDeliveredMyr",
            gmv_threshold_myr::text        AS "gmvThresholdMyr",
            gp_threshold_myr::text         AS "gpThresholdMyr",
            opening_buffer_cost_myr::text  AS "openingBufferMyr",
            closing_buffer_cost_myr::text  AS "closingBufferMyr",
            sortie_cost_myr::text          AS "sortieCostMyr",
            collected_myr::text            AS "collectedMyr",
            cash_paid_myr::text            AS "cashPaidMyr",
            delivered_cost_myr::text       AS "deliveredCostMyr",
            net_batch_cash_flow_myr::text  AS "netCashFlowMyr",
            identity_residual_myr::text    AS "identityResidualMyr",
            headroom_pct::text             AS "headroomPct",
            gate_verdict                   AS "gateVerdict"
     FROM v_route_batch_reconciliation
     WHERE route_batch_id = $1`,
    [routeBatchId],
  );
  return result.rows[0] ?? null;
}
