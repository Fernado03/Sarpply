# No ASR output may commit an order without a read-back

Voice notes are accepted, but every voice-derived order passes through an explicit read-back — Sarpply replies with the parsed SKUs and quantities and the Stall confirms — before it becomes a Preorder. Open transcription of Kuching Hokkien was rejected outright: no commercial provider accepts a Southern Min language code, the codes that look closest (`zh-TW`, `cmn-Hant-TW`) select Taiwanese *Mandarin*, and unmodified Whisper retains roughly 3 characters in 100 on Hokkien (96.6% CER). That failure mode is not silence but fluent-looking Chinese containing the wrong SKU and a real number, which a regex parser accepts.

## Considered Options

- **Auto-commit on high-confidence transcripts** — rejected: no published measurement exists for any Malaysian Hokkien variety, so no confidence threshold can be calibrated.
- **Text-only ordering** — rejected by `ADR-0004`.
- **Manual transcription of every voice note by the Founder** — kept as the fallback tier, but it does not scale past a handful of Stalls.

## Consequences

The voice path costs one extra round-trip per order and the read-back is the safety mechanism, not the transcript. Sarawak Malay is the tractable half — universally supported as `ms-MY` — but dialect-transfer research reports ~69% WER, so it gets a read-back too. `preferred_language` admitting `nan-TW-kuching-hokkien` is not an ISO code any vendor accepts and must be replaced by an internal label that never reaches an ASR API. The `ORDER_CONFIRMED` reply is therefore a required state transition, not a courtesy.
