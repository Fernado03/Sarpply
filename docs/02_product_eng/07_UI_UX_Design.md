---
project: Sarpply
pillar: 07_UI_UX_Design
version: 1.0-MVP-to-Phase2
primary_vendor_interface: WhatsApp Business + Physical Laminated Cards
secondary_interfaces: Mobile-First Runner Web App + Founder Admin Console
design_philosophy: Zero-App-Install Hawker UX, High-Contrast Kitchen Readability
---

# Sarpply — Pillar 7: UI/UX Design Specification

## 1. UX Design Principles for Kuching Kopitiam Environments

1. **Zero-Install Conversational UX for Hawkers:** Independent hawkers operating 8x8ft stalls will not download new apps, remember passwords, or browse complex e-commerce catalogs with wet or greasy hands. 100% of vendor interactions happen inside **WhatsApp** using 2-character SKU codes (`A1`–`E1`) or voice/text natural language.
2. **Tactile & Laminated Physical Touchpoints:** Field onboarding (2:15 PM–4:00 PM) and Thursday delivery (2:30 PM) rely on physical samples (SKU `A1` 650ml box) and water/oil-resistant laminated A5 cards.
3. **One-Thumb Runner Ergonomics:** The Phase 2 Runner Web App is designed for high-glare outdoor carpark conditions at Pending Industrial Estate (1:30 PM) and Premier 101 (2:15 PM), featuring oversized tap targets (minimum `56px` height) and high-contrast status badges.

---

## 2. Physical Touchpoint Wireframes (MVP Weeks 1–4)

### 2.1 Laminated 1-Page Bilingual Pool Price Card (A5 Front — Left at Stall)

```
+-----------------------------------------------------------------------+
|  📦 SARPPLY KUCHING — POOL BORONG PREMIER 101                         |
|  Harga Kilang / Master Carton • Beli 1 Bundle Pun Dapat Harga Borong! |
+-----------------------------------------------------------------------+
|  KOD | BARANG (6 SKU UTAMA)                | HARGA KEDAI | HARGA POOL |
| -----+-------------------------------------+-------------+----------- |
| [A1] | Bekas Tapau PP 650ml (50 set)       |  RM 16.50   |  RM 15.00  |
|      | 650ml 塑料打包盒 (四方)               |             | (Jimat 9%) |
| [A2] | Bekas Tapau PP 750ml Besar (50 set) |  RM 18.00   |  RM 16.50  |
|      | 750ml 大号打包盒                      |             | (Jimat 8%) |
| [B1] | Kertas Bungkus Coklat Besar (250s)  |  RM 10.80   |  RM  9.50  |
|      | 大号打包油纸                          |             |(Jimat 12%) |
| [C1] | Plastik Tapau HM 9x11 (5 pek)       |  RM 13.50   |  RM 12.20  |
|      | 9x11 手提塑胶袋                       |             |(Jimat 10%) |
| [D1] | Susu Krimer Manis 500g (24 tin)     |  RM 73.00   |  RM 69.50  |
|      | 500g 炼奶 (茶水档专用)                 |             | (Jimat 5%) |
| [E1] | Sabun Cuci Pinggan Pekat 5L (1 btl) |  RM 15.00   |  RM 13.00  |
|      | 5L 大桶洗碗精                         |             |(Jimat 13%) |
+-----------------------------------------------------------------------+
|  ⏰ JADUAL POOL PREMIER 101:                                          |
|  • Order Tutup : Setiap RABU, 12:00 Tengah Hari                       |
|  • Hantar Terus: Setiap KHAMIS, 2:30 Petang (PERCUMA ke gerai!)       |
|  • Bayaran     : Cash atau Scan DuitNow QR masa barang sampai sahaja  |
|                                                                       |
|  +---------------+  👈 IMBAS QR UNTUK MASUK POOL WHATSAPP PREMIER 101 |
|  |  [WHATSAPP]   |     Atau WhatsApp terus: "A1 x 3, C1 x 2"          |
|  |  [ QR CODE]   |     Gerai #3 dah join — jom kumpul order bersama!  |
|  +---------------+                                                    |
+-----------------------------------------------------------------------+
```

*Design references:* Pricing, SKUs, trilingual names, savings percentages, schedule, and Anchor Stall hook derived directly from the catalog and GTM playbook.

### 2.2 Laminated Runner Corporate DuitNow QR Card (A5 Back — Handover Tool)

```
+-----------------------------------------------------------------------+
|  💳 BAYARAN RASMI SARPPLY (PREMIER 101 POOL)                          |
|  Sila bayar semasa barang sampai di gerai (Khamis 2:30 PM)            |
+-----------------------------------------------------------------------+
|                                                                       |
|                     +---------------------------+                     |
|                     |                           |                     |
|                     |     [ DUITNOW QR CODE ]   |                     |
|                     |   Akaun Korporat Sarpply  |                     |
|                     |                           |                     |
|                     +---------------------------+                     |
|                                                                       |
|   ✅ Langkah 1: Semak bilangan bundle di gerai anda.                  |
|   ✅ Langkah 2: Scan DuitNow QR di atas ATAU bayar Tunai (Cash).      |
|   ✅ Langkah 3: Tunjuk skrin resit kepada Runner Sarpply.             |
+-----------------------------------------------------------------------+
```

*Design references:* Supports the zero-leakage financial control protocol where stalls scan a laminated Corporate DuitNow QR linked directly to the founder's bank account.

---

## 3. Conversational UI Specifications (WhatsApp Flows)

### 3.1 Tuesday 14:00 Broadcast UI (`POOL_OPEN`)

* Uses `Script B` with clear emoji visual hierarchy (`📦`, `✅`, `👇`), explicit SKU bracket tags (`[A1]`–`[E1]`), and a single copy-pasteable reply example (`"A1 x 3, C1 x 2, E1 x 1"`).

### 3.2 Instant Automated Clarification Prompt (Phase 2 Bot UI)

When a hawker sends an ambiguous message (e.g., *"Boss besok hantar bekas tapau 4 bundle"*), the bot responds within 2 seconds:

```text
Hi Boss! Untuk Bekas Tapau 4 bundle, Boss nak saiz yang mana satu?
👉 Balas *A1* untuk 650ml Biasa (RM 15.00/bundle)
👉 Balas *A2* untuk 750ml Besar (RM 16.50/bundle)
```

*Design references:* Maps ambiguous natural language back to canonical SKUs `A1` and `A2`.

### 3.3 Wednesday 12:30 Confirmation Receipt UI (`PO_SUBMITTED`)

* Uses `Script C` displaying `✅ ORDER DISAHKAN (CONFIRMED)`, itemized bundle counts and subtotals, `Penghantaran (Delivery) = PERCUMA (Premier 101 Pool)`, and bold `JUMLAH PERLU DIBAYAR ESOK` via `Cash / DuitNow QR`.

---

## 4. Phase 2 Web Interfaces (Wireframes)

### 4.1 Mobile-First MPV Runner Web App (Thursday 1:30 PM – 3:30 PM Shift)

```
+-------------------------------------------------------------------+
| 🚐 SARPPLY RUNNER • Batch #04 (Premier 101)         Thu 14:15 MYT |
| Shift Payout: RM 45.00 | Status: [2. CROSS-DOCK SORT]             |
+-------------------------------------------------------------------+
| [Step 1: Pickup ✅]  [Step 2: Boot Sort 🔵]  [Step 3: Deliver ⚪]  |
+-------------------------------------------------------------------+
| 🔪 CAR BOOT CARTON SPLITTING CHECKLIST (Mark Stall # with Marker) |
|                                                                   |
| 📦 [A1] PP Box 650ml (Opened: 3 Cartons = 30 Bundles)             |
|    ├── Write "STALL #03" on 4 bundles                      [ ✓ ]  |
|    ├── Write "STALL #07" on 3 bundles                      [ ✓ ]  |
|    ├── Write "STALL #12" on 5 bundles                      [   ]  |
|    └── 📥 Keep 2 surplus bundles in boot (Buffer Stock)           |
|                                                                   |
| 📦 [C1] Singlet Bag 9x11 (Opened: 2 Cartons = 20 Bundles)         |
|    ├── Write "STALL #03" on 2 bundles                      [ ✓ ]  |
|    └── Write "STALL #15" on 3 bundles                      [   ]  |
+-------------------------------------------------------------------+
|        [ PROCEED TO STALL DELIVERY (14:30 MYT) -> ]               |
+-------------------------------------------------------------------+
```

### 4.2 Runner Stall-Side Handover Modal (Step 3: 14:30 MYT)

```
+-------------------------------------------------------------------+
| 📍 STALL #03 — Ah Seng Kolok Mee (Premier 101)                    |
+-------------------------------------------------------------------+
| Deliver Items:                                                    |
| • [A1] Bekas Tapau 650ml x 4 bundles                   RM 60.00   |
| • [C1] Plastik Tapau 9x11 x 2 bundles                  RM 24.40   |
| ----------------------------------------------------------------- |
| TOTAL TO COLLECT:                                      RM 84.40   |
|                                                                   |
| Select Payment Received:                                          |
|  ( • ) 📲 Paid via DuitNow QR (Verified on Hawker Screen)         |
|  (   ) 💵 Paid via Cash (Runner holds RM 84.40 cash)              |
|  (   ) ⚠️ Stall Closed / Uncollected (Return to Car Boot Buffer)  |
|                                                                   |
|              [ ✅ CONFIRM HANDOVER & NEXT STALL ]                 |
+-------------------------------------------------------------------+
```

*Design references:* Directly implements the Thursday 13:30–15:30 operational state machine, black-marker bundle sorting, DuitNow/Cash collection, and uncollected buffer return.

### 4.3 Founder / Admin Batch Aggregation Console

```
+-----------------------------------------------------------------------------------+
| 📊 SARPPLY ADMIN — Premier 101 Pool (Delivery: Thu, Oct 29)  State: [POOL_LOCKED] |
+-----------------------------------------------------------------------------------+
| Active Stalls: 8 / 8 Target | Batch GMV: RM 2,000.00 | Est. Net Margin: RM 155.00 |
+-----------------------------------------------------------------------------------+
| SKU | Total Ordered | Boot Buffer | Cartons to Buy | New Buffer | Wholesale Cost  |
|     |   (Q_b,i)     |  (S_prev)   |    (C_b,i)     |  (S_end)   |   (Pending PO)  |
|-----+---------------+-------------+----------------+------------+-----------------|
| A1  |  28 bundles   |  2 bundles  |   3 Cartons    | 4 bundles  |   RM 405.00     |
| A2  |  19 bundles   |  1 bundle   |   2 Cartons    | 2 bundles  |   RM 296.00     |
| B1  |  22 packs     |  0 packs    |   2 Cartons    | 2 packs    |   RM 204.00     |
| C1  |  30 bundles   |  0 bundles  |   3 Cartons    | 0 bundles  |   RM 330.00     |
| D1  |   6 half-ctns |  0 half-ctn |   3 Cartons    | 0 half-ctn |   RM 384.00     |
| E1  |  14 bottles   |  0 bottles  |   4 Cartons    | 2 bottles  |   RM 184.00     |
+-----------------------------------------------------------------------------------+
| [ 📤 Send WhatsApp Receipts (Script C) ]   [ 📋 Copy Pending Wholesaler PO Text ] |
+-----------------------------------------------------------------------------------+
```

*Design references:* Implements the exact `Wholesaler_Aggregator` columns and unit economics metrics.
