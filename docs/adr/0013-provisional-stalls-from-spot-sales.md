# A Spot Sale to an unregistered Stall creates a Provisional Stall, not an anonymous order

`stall_orders.stall_id` is never null. Selling to a Stall that has not onboarded creates a `stalls` row with `onboarding_status = 'PROVISIONAL_SPOT'`, a Runner-supplied label, and a nullable `whatsapp_phone` guarded by `CHECK (onboarding_status = 'PROVISIONAL_SPOT' OR whatsapp_phone IS NOT NULL)`. Rejecting the sale was never an option — it turns away cash to protect a foreign key — and a nullable `stall_id` was rejected because every downstream report would then need two buyer paths.

## Consequences

The Founder gets a Friday list of Stalls that already bought and paid but have not Preordered: the warmest onboarding lead the business will ever have, produced by the delivery run itself. Provisional Stalls cannot receive WhatsApp order broadcasts or payment receipt echoes until they have a phone number, so the anti-fraud control in `ADR-0012` does not cover their Spot Sales.
