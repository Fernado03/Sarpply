# Voice notes are deleted 7 days after their batch reconciles

A Stall's voice note is kept for **7 days after the Route Batch it belongs to reaches `RECONCILED`**, then deleted along with any unconfirmed draft. The transcript, the confirmed order row and the WhatsApp read-back thread are kept as the audit trail; the audio itself is not.

## Considered Options

- **Delete 24 hours after reconciliation** — disputes in practice surface same-day, but the Stall has no way to re-check a contested order later in the week.
- **Keep for the life of the account** — maximum auditability, maximum liability. Every stored clip is personal data that must be secured, disclosed and deleted on request.
- **Never store; transcribe and discard immediately** — safest legally, but destroys the ability to re-verify a misheard order, which is precisely the failure mode the read-back exists to catch (`ADR-0014`).
- **7 days after reconciliation** — accepted.

## Consequences

Seven days covers the realistic dispute window: a Stall notices a wrong delivery at handover or within a day or two, and the following Tuesday's broadcast is the natural moment to raise it. Beyond that, the batch is closed, Buffer Stock has moved, and the audio cannot resolve anything the written record does not already show.

Retention is a scheduled deletion per batch, not a manual chore, and it must be enforced in code — a policy nobody executes is just a paragraph. Deletion covers expired `UNCONFIRMED_VOICE_DRAFT` rows too, so a Stall that never confirmed leaves no audio behind.

**Disclosure is permanent, not one-off.** The Tuesday `OPEN_FOR_ORDERS` broadcast carries one line stating that voice notes are stored for 7 days for order verification. It sits in the same message that invites the voice reply, so no Stall can record without having been told, and a Stall onboarded months ago is reminded every week. A one-off notice at onboarding was rejected for exactly that reason.

This is not legal advice, and Sarawak/Malaysian PDPA obligations should be confirmed by someone qualified before Phase 2 stores a single clip. What this ADR fixes is the *default behaviour*: collect the minimum, say so every week, delete on a timer.
