---
project: Sarpply
pillar: 07_UI_UX_Design
version: 1.1-MVP-to-Phase2
primary_stall_interface: WhatsApp Business + laminated physical cards
secondary_interfaces: Runner web app (mobile-first) + Founder Admin Console
design_philosophy: Zero-install for Stalls, high-contrast for kitchens, one-thumb for Runners
supersedes: v1.0 (2:30 PM single drop, RM 45 shift, 8-stall console, "Verified on Hawker Screen" DuitNow claim)
---

# Sarpply — Pillar 7: UI/UX Design

> Terminology per `GLOSSARY.md`. Times are MYT. Numbers match `03_Unit_Economics.md`.

## 1. Principles

1. **Zero-install for Stalls.** No app, no password, no catalogue to browse with greasy hands. Everything happens in WhatsApp, by text or voice note.
2. **Physical touchpoints are water- and oil-resistant.** Laminated A5 cards survive a wok kitchen.
3. **One-thumb for Runners.** The Runner is standing in a carpark at 13:15 with the sun behind the screen. Minimum tap target **56 px**, status conveyed by colour *and* text (never colour alone).
4. **Never show the Runner a number they can change.** Order quantities and prices are read-only in the Runner app. It records what happened; it does not decide anything.

---

## 2. Physical touchpoints

### 2.1 Pool Price Card (A5, front — left at the Stall)

```
┌───────────────────────────────────────────────────────────────┐
│  📦 SARPPLY KUCHING — POOL BORONG                             │
│  Harga Karton • Beli ikut bundle, bayar harga borong          │
├───────────────────────────────────────────────────────────────┤
│  KOD │ BARANG                        │ KEDAI   │ POOL         │
│ ─────┼───────────────────────────────┼─────────┼────────────  │
│ [A1] │ Bekas Tapau PP 650ml (50 set) │ RM16.50 │ RM15.00  9%  │
│ [A2] │ Bekas Tapau PP 750ml (50 set) │ RM18.00 │ RM16.50  8%  │
│ [B1] │ Kertas Bungkus Besar (250)    │ RM10.80 │ RM 9.50 12%  │
│ [C1] │ Plastik Tapau 9x11 (5 pek)    │ RM13.50 │ RM12.20 10%  │
│ [D1] │ Susu Krimer Manis 500g (24)   │ RM73.00 │ RM69.50  5%  │
│ [E1] │ Sabun Cuci Pinggan 5L         │ RM15.00 │ RM13.00 13%  │
├───────────────────────────────────────────────────────────────┤
│  ⏰ Order tutup : RABU 12:00 tengah hari                      │
│  🚚 Hantar      : KHAMIS petang (PERCUMA ke gerai)            │
│  💵 Bayar       : Cash atau DuitNow QR masa barang sampai     │
│  ❌ Tak perlu bayar apa-apa hari ni                           │
├───────────────────────────────────────────────────────────────┤
│   ┌────────────┐                                              │
│   │  WHATSAPP  │  Balas: "A1 x 3, C1 x 2"                     │
│   │  QR CODE   │  Atau hantar voice note — kami baca balik.   │
│   └────────────┘                                              │
└───────────────────────────────────────────────────────────────┘
```

The card carries **only** prices, schedule and the QR. No "8 stalls", no "RM 2,000", no penetration targets — a Stall does not need Sarpply's internal economics and printing them invites the wrong question.

### 2.2 Payment Card (A5, back — handover tool)

```
┌───────────────────────────────────────────────────────────────┐
│  💳 BAYARAN SARPPLY                                           │
│  Bayar masa barang sampai di gerai                            │
├───────────────────────────────────────────────────────────────┤
│                 ┌─────────────────────────┐                   │
│                 │     [ DUITNOW QR ]      │                   │
│                 │   Akaun Korporat Sarpply│                   │
│                 └─────────────────────────┘                   │
│                                                               │
│  1. Semak bilangan bundle di gerai anda                       │
│  2. Scan DuitNow QR di atas ATAU bayar Tunai                  │
│  3. Tunggu resit WhatsApp daripada Sarpply                    │
│                                                               │
│  ⚠️ Resit WhatsApp ialah bukti bayaran anda.                  │
│     Kalau resit tak betul, balas terus mesej itu.             │
└───────────────────────────────────────────────────────────────┘
```

Step 3 changed from v1.0's "show the screen to the Runner". The Runner cannot verify a DuitNow payment — there is no feed to verify it against (`ADR-0001`). What protects the Stall is the receipt echo, so the card says so and tells them how to dispute it.

---

## 3. Conversational UI

### 3.1 Tuesday 14:00 broadcast (`OPEN_FOR_ORDERS`)

Script B. Emoji hierarchy, bracketed SKU tags, one copy-paste example. Ends with the voice instruction so the option is visible to a Stall that cannot type comfortably.

### 3.2 Ambiguity prompt

```text
Boss, untuk bekas tapau 4 bundle — saiz mana satu?
👉 A1 = 650ml (RM 15.00)
👉 A2 = 750ml (RM 16.50)
Balas A1 atau A2 sahaja.
```

### 3.3 Voice read-back (Script D) — the most important message in the product

```text
🎤 Saya dengar: A1 tiga bundle, C1 dua bundle. Jumlah RM 69.40.
Betul? Balas OK. Kalau salah, taip semula.
```

Rules the UI must enforce:

* Read-back is **one message**, never a form.
* Sent in the Stall's `written_language`, even when the note was spoken in Hokkien.
* Only `OK`, `YA`, `YES`, `1`, `好`, `对` commit. A reply of `"ok kot"` or `"ya ya"` followed by other text does **not** auto-commit — it goes to the Founder queue.

### 3.4 Wednesday 12:30 confirmation

Script C. Shows itemised Bundles, total, payment method, and — new — the **delivery window for that Stall's Cluster**, because a Route now has two Sorties and a Gala City Stall must not expect a Premier 101 time.

---

## 4. Runner web app

### 4.1 Sortie selector (new — v1.0 had none)

```
┌───────────────────────────────────────────────────────────┐
│ 🚐 SARPPLY RUNNER — Route: Premier 101 + Gala City        │
│ Shift: Thu 13:15–16:00 · RM 42.50/Sortie (RM 85.00)       │
├───────────────────────────────────────────────────────────┤
│  [ SORTIE 1 ]  Premier 101 · 7 Stalls · 869 L             │
│  [ SORTIE 2 ]  Gala City   · 7 Stalls · 778 L             │
│                                                           │
│  Vehicle: Avanza (max 1,000 L) · both Sorties ✅ fit       │
├───────────────────────────────────────────────────────────┤
│  [ START SORTIE 1 ]                                       │
└───────────────────────────────────────────────────────────┘
```

The load figures are computed, not typed, and the screen **refuses to start a Sortie that exceeds `max_cargo_liters`**. This is the visible face of `ADR-0015`.

Note the two Sorties are **not** equal: 22 cartons split 11/11 still differ in volume because the cartons are different sizes. The average is 824 L, but the real loads are 869 L and 778 L. A Myvi (800 L) cannot take the 869 L Sortie; an Avanza can take both.

### 4.2 Pickup — count what arrived

```
┌───────────────────────────────────────────────────────────┐
│ 📦 PENDING PICKUP — verify before Founder pays            │
├───────────────────────────────────────────────────────────┤
│  [A1]  7 cartons  (14 boxes: 7 bodies + 7 lids)  [ − ][ + ]│
│  [A2]  3 cartons  ( 6 boxes)                      [ − ][ + ]│
│  [B1]  3 cartons                                  [ − ][ + ]│
│  [C1]  3 cartons                                  [ − ][ + ]│
│  [D1]  4 cartons                                  [ − ][ + ]│
│  [E1]  4 cartons                                  [ − ][ + ]│
├───────────────────────────────────────────────────────────┤
│  Ordered: 22 cartons · Received: 21 ⚠️                     │
│  [ CONFIRM COUNT & REQUEST PAYMENT ]                      │
└───────────────────────────────────────────────────────────┘
```

A mismatch does not block the Runner; it records `cartons_received` and alerts the Founder, who then rations the shortfall by trust tier (`ADR-0011`).

### 4.3 Sort manifest

```
┌───────────────────────────────────────────────────────────┐
│ 🔪 SORTIE 1 — SORT LIST (write Stall # on each bundle)    │
├───────────────────────────────────────────────────────────┤
│ 📦 [A1] 7 cartons opened → 70 bundles                     │
│    Stall #03  ×5   [ ✓ ]      Stall #07  ×5   [ ✓ ]       │
│    Stall #11  ×6   [   ]      Stall #12  ×5   [   ]       │
│    Stall #15  ×4   [   ]                                  │
│    📥 12 surplus → Buffer Stock (do not deliver)          │
├───────────────────────────────────────────────────────────┤
│  [ DELIVER TO STALLS ]                                    │
└───────────────────────────────────────────────────────────┘
```

### 4.4 Stall handover

```
┌───────────────────────────────────────────────────────────┐
│ 📍 STALL #03 — Ah Seng Kolok Mee                          │
├───────────────────────────────────────────────────────────┤
│ Ordered  · [A1] ×5 = RM 75.00 · [C1] ×2 = RM 24.40        │
│                                                           │
│ Delivered:   A1 [ 5 ]   C1 [ 2 ]      (read-only orders,  │
│                                        editable delivery) │
├───────────────────────────────────────────────────────────┤
│ TOTAL: RM 99.40                                           │
│                                                           │
│ ( ) 📲 DuitNow  → attach proof [ 📷 ]                     │
│ ( ) 💵 Cash                                               │
│ ( ) ⚠️ Uncollected → return to Buffer Stock               │
├───────────────────────────────────────────────────────────┤
│  [ CONFIRM — sends WhatsApp receipt ]                     │
└───────────────────────────────────────────────────────────┘
```

`PAID_DUITNOW` cannot be selected without a proof upload. The old "Verified on Hawker Screen" option is gone: it claimed a verification that does not exist.

---

## 5. Founder Admin Console

```
┌───────────────────────────────────────────────────────────────────────┐
│ 📊 SARPPLY ADMIN — Route: Premier 101 + Gala City                     │
│ Batch: Thu 29 Oct · State: CLOSED_AT_CUTOFF                           │
├───────────────────────────────────────────────────────────────────────┤
│ Active Stalls: 14 / 14   Sorties: 2                                    │
│ GMV RM 2,603.60 · Forecast GP RM 253.40 · Net cash RM 119.60 ⚠️        │
│ Gate: ✅ GP ≥ RM 150 (headroom +4.16% on carton cost)                  │
├───────────────────────────────────────────────────────────────────────┤
│ SKU │ Ordered │ S_prev │ Cartons │ Boxes │ S_end │ Cash    │ GMV       │
│ ────┼─────────┼────────┼─────────┼───────┼───────┼─────────┼────────── │
│ A1  │   60    │   0    │    6    │  12   │   0   │ RM 810  │ RM 900.00 │
│ A2  │   24    │   0    │    3    │   6   │   6   │ RM 444  │ RM 396.00 │
│ B1  │   24    │   0    │    2    │   2   │   0   │ RM 204  │ RM 228.00 │
│ C1  │   28    │   0    │    3    │   3   │   2   │ RM 330  │ RM 341.60 │
│ D1  │    8    │   0    │    4    │   4   │   0   │ RM 512  │ RM 556.00 │
│ E1  │   14    │   0    │    4    │   4   │   2   │ RM 184  │ RM 182.00 │
│ ────┼─────────┼────────┼─────────┼───────┼───────┼─────────┼────────── │
│ TOT │  158    │        │   22    │  31   │  10   │ RM2,484 │ RM2,603.60│
│     │         │        │         │       │       │         │ Buffer RM 133.80 │
├───────────────────────────────────────────────────────────────────────┤
│ Sortie 1 (Premier 101): 869 L / 1,000 L ✅  (11 cartons)              │
│ Sortie 2 (Gala City):   778 L / 1,000 L ✅  (11 cartons)              │
├───────────────────────────────────────────────────────────────────────┤
│ [ 📤 Send receipts ]  [ 📋 Copy Wholesaler PO ]  [ 🎧 Voice queue: 11 ]│
└───────────────────────────────────────────────────────────────────────┘
```

Three deliberate differences from v1.0: the header shows **Realized/forecast GP and the gate**, not a net-margin figure that hid the cash problem; **Net cash can be lower than GP** and is shown as such; and the **voice queue** is a first-class control, because 11 unreviewed drafts silently expiring is a real failure mode.
