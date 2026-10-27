# Runners get least privilege, and every handover echoes a receipt to the Stall

Runners authenticate by WhatsApp OTP against `runners.whatsapp_phone` and receive a session scoped to one `route_batch_id` for the shift window; they may write `cartons_received`, `delivered_bundles`, fulfilment status, attested payment status and Spot Sales, and may never alter a Preorder quantity, `unit_price_locked`, or void an order. Every confirmed handover immediately sends the Stall a one-line WhatsApp receipt naming the amount and the recorded payment method, and `PAID_DUITNOW` additionally requires a photo of the hawker's DuitNow screen.

## Considered Options

- **Trust the Runner, reconcile at 15:30** — rejected: a Runner can take RM 84 cash, tap `PAID_DUITNOW`, and the discrepancy only surfaces after they have left, with no way to tell which Stall.
- **Dynamic DuitNow QR with callbacks** — would remove the whole surface, but costs 0.5%–1.0% of GMV against a ~10% spread (`ADR-0001`).

## Consequences

The Stall becomes the control, not the Founder: a mis-recorded payment invites an immediate complaint from the person who paid. The echo needs the Stall's phone number, so it cannot protect a Spot Sale to an unregistered Stall (`ADR-0013`) — that residual gap is accepted for now. `payment_attested_at` and `attested_by` stay on the record because an attestation is evidence about a person, not a statement about the money.
