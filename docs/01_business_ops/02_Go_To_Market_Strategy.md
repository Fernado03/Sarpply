---
project: Sarpply
pillar: 02_Go_To_Market_Strategy
version: 1.0-MVP
beachhead_zone: Premier 101 / Jalan Tun Jugah, Kuching
onboarding_window: "14:15 - 16:00 MYT (Off-Peak Hawker Break)"
supported_languages_mvp: ["en", "ms-MY"]
future_languages_phase2: ["zh-CN", "nan-TW-kuching-hokkien"]
---

# Sarpply — Pillar 2: Go-To-Market (GTM) Strategy & Localization Playbook

## 1. Strategic Beachhead: Why Premier 101 / Jalan Tun Jugah?
1. **Extreme Stall Density:** Premier 101 and its adjacent Jalan Tun Jugah food centers house **40+ independent hawker stalls** across contiguous commercial blocks. Onboarding just 20% of the zone yields an 8-stall cluster treated as a **single delivery stop**.
2. **Proximity to Wholesale Supply:** Located roughly **12–15 minutes (6–8 km)** from **Pending Industrial Estate**, minimizing cross-dock transport time and fuel cost.
3. **High Packaging Velocity:** High-footfall breakfast, lunch, and supper stalls generate massive weekly turnover of *tapau* containers, *kertas bungkus*, and singlet bags.

---

## 2. Three-Phase GTM Rollout

### Phase 1: Supplier Lock-In (Days 1–2)
* Contact 3 packaging/consumable wholesalers in Pending Industrial Estate via WhatsApp to lock in Master Carton pricing for the **Golden 6 SKUs** (self-pickup, instant DuitNow payment on collection).

### Phase 2: "Off-Peak Walk-In" Onboarding at Premier 101 (Days 3–5)
* **Strict Timing Rule:** Never approach hawkers during peak cooking hours (7:00 AM–1:30 PM or 5:30 PM–8:30 PM). Execute field onboarding strictly between **2:15 PM and 4:00 PM**.
* **The Physical Hook:** Carry one physical sample of SKU `A1` (650ml PP box) and a laminated **1-Page Bilingual Pool Price Card** featuring a WhatsApp Business QR code.
* **The Anchor Stall Strategy:** Onboard 1 friendly stall owner first (or the kopitiam drink stall for SKU `D1`), then tell the neighboring 7 stalls: *"Stall #3 is already in this Thursday's Premier 101 pool—join together so everyone gets the Master Carton discount."*

### Phase 3: Weekly WhatsApp Broadcast Loop (Weeks 1–4)
* **Tuesday 2:00 PM:** Send bilingual "Pool Open" broadcast to the Premier 101 vendor list.
* **Wednesday 12:00 PM:** Close pool, send automated/template order confirmations, and submit consolidated Master Carton PO to Pending wholesaler.
* **Thursday 2:30 PM:** Deliver goods stall-side during the afternoon lull and collect Cash or DuitNow QR payment.

---

## 3. Ready-to-Use Bilingual WhatsApp Scripts (English + BM / Sarawak Malay)

### Script A: Wholesaler Price Inquiry (To Pending Industrial Estate Suppliers)
```text
Hi Boss, Selamat Petang. I run Sarpply—we consolidate weekly packaging orders for food court stalls in Premier 101, Kuching (self-pickup every Thursday, instant DuitNow/Cash payment on pickup).

Boleh share harga borong Master Carton (kami ambil ~15-25 karton setiap minggu) untuk 6 item ini?
1. PP Rectangular Microwave Box 650ml + Lid (500 sets/ctn)
2. PP Rectangular Microwave Box 750ml + Lid (500 sets/ctn)
3. Kertas Bungkus Coklat Besar (1 ctn)
4. Plastik Tapau HM Singlet 9x11 (1 guni/sack)
5. Susu Krimer Manis 500g (48 tin/ctn)
6. Sabun Cuci Pinggan 5L (4 botol/ctn)

Kami akan hantar consolidated PO setiap hari Rabu pagi. Terima kasih Boss!
```

### Script B: Tuesday 2:00 PM "Pool Open" Broadcast (To Premier 101 Hawkers)
```text
📦 SARPPLY: POOL BORONG PREMIER 101 DAH BUKA! 📦

Hi Boss! Order berkumpulan (Group Pool) Premier 101 minggu ini dibuka sekarang & tutup esok (Rabu, 12:00 PM).
✅ Harga Kilang/Karton — tak perlu beli banyak, beli 1 bundle pun dapat harga borong!
✅ Penghantaran PERCUMA terus ke gerai Khamis ini (2:30 PM).
✅ Bayar Cash atau scan DuitNow QR masa barang sampai sahaja.

HARGA POOL MINGGU INI (PREMIER 101):
[A1] Bekas Tapau 650ml + Penutup (50 set) = RM 15.00
[A2] Bekas Tapau 750ml + Penutup (50 set) = RM 16.50
[B1] Kertas Bungkus Besar (250 keping) = RM 9.50
[C1] Plastik Tapau 9x11 (1 bundle / 5 pek) = RM 12.20
[D1] Susu Krimer Manis 500g (24 tin) = RM 69.50
[E1] Sabun Cuci Pinggan 5L (1 botol) = RM 13.00

👇 Cara Order: Balas mesej ini dengan Kod & Kuantiti sahaja!
Contoh reply: "A1 x 3, C1 x 2, E1 x 1"
```

### Script C: Wednesday 12:30 PM Order Confirmation Receipt
```text
✅ ORDER DISAHKAN (CONFIRMED) — [Stall Name]
Lokasi: Pool Premier 101 (Khamis, 2:30 PM)

Senarai barang Boss untuk esok:
- [A1] Bekas Tapau 650ml x 3 bundle = RM 45.00
- [C1] Plastik Tapau 9x11 x 2 bundle = RM 24.40
- Penghantaran (Delivery) = PERCUMA (Premier 101 Pool)
-------------------------
JUMLAH PERLU DIBAYAR ESOK: RM 69.40 (Cash / DuitNow QR)

Terima kasih Boss! Kita jumpa di gerai esok jam 2:30 petang.
```

---

## 4. Coding Agent Reference: Trilingual NLP & Synonym Dictionary (Phase 2 Integration)
When building the automated WhatsApp webhook parser, hawkers will reply in mixed **English, Bahasa Melayu, Sarawak Malay, Mandarin, or Kuching Hokkien**. The coding agent must map natural-language synonyms to canonical `sku_code` values:

| Canonical `sku_code` | English Tokens | BM / Sarawak Malay Tokens | Mandarin / Kuching Hokkien Tokens (Future Integration) |
| :--- | :--- | :--- | :--- |
| **`A1`** | `a1`, `650ml`, `small box`, `normal box`, `mee box` | `bekas kecil`, `bekas biasa`, `tapau 650`, `kotak mee` | `小盒`, `普通打包盒`, `面盒`, `650盒`, `tah-pau-ah` |
| **`A2`** | `a2`, `750ml`, `big box`, `large box`, `rice box` | `bekas besar`, `tapau besar`, `tapau 750`, `kotak nasi` | `大盒`, `大号打包盒`, `饭盒`, `750盒` |
| **`B1`** | `b1`, `brown paper`, `wax paper`, `wrapper` | `kertas bungkus`, `kertas coklat`, `kertas minyak`, `kertas nasi` | `油纸`, `打包纸`, `饭纸`, `brown paper` |
| **`C1`** | `c1`, `plastic bag`, `singlet bag`, `9x11` | `plastik tapau`, `plastik tangkai`, `plastik 9x11`, `beg plastik` | `塑胶袋`, `手提袋`, `打包袋`, `9x11袋` |
| **`D1`** | `d1`, `creamer`, `condensed milk`, `milk tin` | `susu manis`, `krimer`, `susu tin`, `susu pekat` | `炼奶`, `甜奶`, `奶水`, `茶水奶` |
| **`E1`** | `e1`, `dish soap`, `detergent`, `5l soap` | `sabun pinggan`, `sabun cuci`, `sabun 5l`, `pencuci pinggan` | `洗碗精`, `洗碗水`, `大桶肥皂` |
