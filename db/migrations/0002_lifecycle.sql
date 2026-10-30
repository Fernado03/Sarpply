-- 0002_lifecycle.sql — lifecycle records the later tickets write to.
-- Tables only: behaviour arrives with the ticket that owns it.

-- ─── WhatsApp transport: provider-keyed message records ────────────────────
CREATE TABLE inbound_messages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider            VARCHAR(20) NOT NULL DEFAULT 'whatsapp',
  provider_message_id VARCHAR(160) NOT NULL UNIQUE,
  from_phone          VARCHAR(30) NOT NULL,
  body                TEXT,
  route_batch_id      UUID REFERENCES route_batches(id) ON DELETE SET NULL,
  stall_id            UUID REFERENCES stalls(id) ON DELETE SET NULL,
  received_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw                 JSONB
);

CREATE TABLE outbound_messages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider            VARCHAR(20) NOT NULL DEFAULT 'whatsapp',
  -- Assigned by the provider after sending; NULL while queued.
  provider_message_id VARCHAR(160) UNIQUE,
  to_phone            VARCHAR(30) NOT NULL,
  body                TEXT NOT NULL,
  status              VARCHAR(12) NOT NULL DEFAULT 'QUEUED'
                        CHECK (status IN ('QUEUED','SENT','FAILED')),
  -- Makes a retried receipt echo a no-op instead of a second message.
  dedupe_key          VARCHAR(160) UNIQUE,
  route_batch_id      UUID REFERENCES route_batches(id) ON DELETE SET NULL,
  stall_id            UUID REFERENCES stalls(id) ON DELETE SET NULL,
  queued_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at             TIMESTAMPTZ,
  failure_reason      TEXT
);

-- ─── Voice order lifecycle (ADR-0014) ──────────────────────────────────────
-- A voice note produces an unconfirmed draft. Nothing commits an order until
-- an explicit token or Founder approval is recorded as an event.
CREATE TABLE voice_order_drafts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_batch_id  UUID NOT NULL REFERENCES route_batches(id) ON DELETE CASCADE,
  stall_id        UUID NOT NULL REFERENCES stalls(id) ON DELETE RESTRICT,
  state           VARCHAR(24) NOT NULL DEFAULT 'UNCONFIRMED_VOICE_DRAFT'
                    CHECK (state IN (
                      'UNCONFIRMED_VOICE_DRAFT','READBACK_SENT','CONFIRMED',
                      'FOUNDER_APPROVED','REJECTED'
                    )),
  transcript      TEXT,
  audio_ref       VARCHAR(255),
  written_language VARCHAR(10) NOT NULL DEFAULT 'ms-MY'
                    CHECK (written_language IN ('ms-MY', 'en', 'zh-CN')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Candidate lines. A parse gap is a row with a NULL sku or quantity so the
-- Founder can fill it, never a silently dropped line.
CREATE TABLE voice_draft_lines (
  draft_id         UUID NOT NULL REFERENCES voice_order_drafts(id) ON DELETE CASCADE,
  line_no          SMALLINT NOT NULL CHECK (line_no > 0),
  sku_code         VARCHAR(10) REFERENCES skus(sku_code) ON DELETE RESTRICT,
  ordered_bundles  INT CHECK (ordered_bundles IS NULL OR ordered_bundles > 0),
  raw_text         TEXT,
  PRIMARY KEY (draft_id, line_no)
);

CREATE TABLE voice_draft_events (
  id            BIGSERIAL PRIMARY KEY,
  draft_id      UUID NOT NULL REFERENCES voice_order_drafts(id) ON DELETE CASCADE,
  event_type    VARCHAR(32) NOT NULL
                  CHECK (event_type IN (
                    'DRAFTED','READBACK_SENT','CONFIRMATION_RECEIVED',
                    'FOUNDER_APPROVED','REJECTED'
                  )),
  token         VARCHAR(20),
  readback_text TEXT,
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Corrections: audited field changes before reconciliation ──────────────
CREATE TABLE corrections (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   VARCHAR(32) NOT NULL
                  CHECK (entity_type IN (
                    'STALL_ORDER','WHOLESALER_PO_LINE','PAYMENT_ATTESTATION'
                  )),
  entity_id     UUID NOT NULL,
  field_name    VARCHAR(80) NOT NULL,
  old_value     TEXT,
  new_value     TEXT,
  actor         VARCHAR(120) NOT NULL,
  reason        TEXT,
  corrected_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_corrections_entity ON corrections (entity_type, entity_id);

-- ─── Voice-note retention (ADR-0017) ───────────────────────────────────────
CREATE TABLE voice_note_deletions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id      UUID NOT NULL UNIQUE REFERENCES voice_order_drafts(id) ON DELETE RESTRICT,
  audio_ref     VARCHAR(255) NOT NULL,
  due_at        TIMESTAMPTZ NOT NULL,
  deleted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note          TEXT
);

-- ─── Runner sessions (ADR-0012) ────────────────────────────────────────────
-- The shift-scoped identity the Runner least-privilege policy will read.
-- RLS itself is ticket #13; this ticket only owns the table.
CREATE TABLE runner_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  runner_identity  VARCHAR(120) NOT NULL,
  route_batch_id   UUID NOT NULL REFERENCES route_batches(id) ON DELETE CASCADE,
  shift_starts_at  TIMESTAMPTZ NOT NULL,
  shift_ends_at    TIMESTAMPTZ NOT NULL,
  expires_at       TIMESTAMPTZ NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (shift_ends_at > shift_starts_at),
  CHECK (expires_at >= shift_starts_at)
);
CREATE INDEX idx_runner_sessions_batch ON runner_sessions (route_batch_id);
