---
project: Sarpply
pillar: 02_Go_To_Market_Strategy
version: 1.1-MVP
beachhead_zone: Premier 101 + Gala City, Kuching
onboarding_window: "14:15 - 16:00 MYT (Off-Peak Hawker Break)"
supported_languages_mvp: ["en", "ms-MY"]
future_languages_phase2: ["zh-CN"]
written_language_codes: ["ms-MY", "en", "zh-CN"]
supersedes: v1.0 (20% penetration / 8-stall cluster / nan-TW-kuching-hokkien / catalog-button ordering)
---

# Sarpply — Pillar 2: Go-To-Market (GTM) Strategy & Localisation Playbook

> **Terminology.** Canonical vocabulary lives in `GLOSSARY.md`. **Stall** is the buyer, **Wholesaler** the supplier, **Bundle** the sell unit, **Master Carton** the buy unit, **Cluster** a geographic group (~6–7 Stalls), **Route** the paid operating unit (2 Clusters, 12–14 Stalls).

## 1. Strategic Beachhead: Why Premier 101 and Gala City?

1. **Extreme Stall Density:** Premier 101 and Gala City are two dense food centres, each housing **40+ independent hawker Stalls**, roughly 6–8 minutes apart by road.
2. **Proximity to Wholesale Supply:** Roughly **12–15 minutes (6–8 km)** from **Pending Industrial Estate**.
3. **High Packaging Velocity:** High-footfall breakfast, lunch, and supper Stalls turn over *tapau* containers, *kertas bungkus*, and singlet bags weekly.

### 1.1 The Penetration Arithmetic Changed (read this before planning headcount)

v1.0 assumed 20% penetration of a 40-Stall zone — 8 Stalls — and called that a viable batch. It is not. An 8-Stall Cluster produces **RM 1,466.20 GMV and RM 143.50 GP**, failing the RM 1,500 / RM 150 gate *before* any Runner is paid (`03_Unit_Economics.md` §4).

**Measured over two weeks: 26 Stalls approached, 10 buying — 38% conversion.** Nine Preorder Stalls per Route is what actually clears the gate.

| Penetration of a 40-Stall zone | Stalls | GMV | Realized GP | Gate |
| :--- | ---: | ---: | ---: | :--- |
| 20% (v1.0 assumption) | 8 | RM 1,466.20 | RM 143.50 | ✗ fails |
| **22.5% — measured** | **9** | **RM 1,776.50** | **RM 177.25** | ✓ **passes** |
| 30% `[EST]` | 12 | RM 2,369.00 | RM 236.00 | ✓ passes |

**The two-zone question is now answered by the field.** Reading (a) won: one Route = Premier 101 (Cluster A) + Gala City (Cluster B), ~26 Stalls of combined catchment worked in two weeks. The two Clusters are 6–8 minutes apart, which is what makes a single Route shift possible at all.

**The binding constraint is the vehicle, not the catchment.** At 9 Stalls the Route loads 12–13 Master Cartons into a Myvi with the front seat occupied — 980 L packed at the measured 92% efficiency. Two further Stalls would require a second Sortie. Recruiting beyond 10 Stalls is therefore a **vehicle decision** before it is a sales decision.

---

## 2. Three-Phase GTM Rollout

### Phase 1: Wholesaler Lock-In (Days 1–2)
Contact 3 packaging/consumable Wholesalers in Pending Industrial Estate via WhatsApp to lock Master Carton pricing for the **Golden 6** SKUs. Terms: self-pickup, instant DuitNow on collection.

**One question must be answered before any number in these docs is final** — see Script A, Question 1. Whether `A1`/`A2` ship nested or as separate base-and-lid cartons changes every Route's physical carton count by 10–16 boxes (`ADR-0015`).

### Phase 2: Off-Peak Walk-In Onboarding (Days 3–7)
* **Strict Timing Rule:** Never approach Stalls during peak cooking hours (7:00 AM–1:30 PM or 5:30 PM–8:30 PM). Field onboarding runs strictly **2:15 PM–4:00 PM**.
* **The Physical Hook:** One physical sample of `A1` (650 ml PP box + lid) and a laminated **1-Page Bilingual Pool Price Card** with a WhatsApp Business QR code.
* **The Anchor Stall Strategy:** Onboard the kopitiam drink Stall first (it anchors `D1` and is the highest-basket Tier 3 buyer), then tell neighbours: *"Stall #3 dah join pool Khamis ni — join sama-sama supaya semua dapat harga karton."*
* **Sequencing matters more than in v1.0.** Because a Route needs 12–14 Stalls, count Clusters as complete-or-not: **do not open Cluster B until Cluster A has 6 committed Stalls.** A half-filled Cluster B still costs a sortie.

### Phase 3: Weekly WhatsApp Loop (Weeks 1–4)
| When | Action |
| :--- | :--- |
| **Tuesday 14:00** | Send "Pool Open" broadcast (`Script B`) with the week's locked Pool Prices. |
| Tue 14:00 – Wed 12:00 | Collect orders by free text or voice note. Voice notes get a read-back (`Script D`). |
| **Wednesday 12:00** | Cutoff. Aggregate to Master Cartons, submit the PO to the Wholesaler, echo confirmations (`Script C`). |
| **Thursday 13:15 / 14:40** | Two collection-and-delivery sorties (see Pillar 4 §1). |
| **Thursday ~16:00** | Reconcile: attest payments, record Buffer Stock, close the batch. |

---

## 3. Ready-to-Use WhatsApp Scripts

### Script A: Wholesaler Price Inquiry (Pending Industrial Estate)
```text
Hi Boss, Selamat Petang. I run Sarpply — we consolidate weekly packaging orders
for food court stalls in Kuching (self-pickup every Thursday, instant DuitNow/Cash
on pickup). Kami ambil ~20-25 karton setiap minggu.

Sebelum saya hantar PO, saya perlu confirm beberapa benda:

1. PP Rectangular Microwave Box 650ml + Lid (500 sets/ctn):
   - 500 sets tu datang dalam SATU karton (10 sleeve x 50 set, tapak & penutup
     dah siap pasang), atau DUA karton berasingan (satu tapak, satu penutup)?
   - Sama juga untuk 750ml.
2. Kertas Bungkus Coklat Besar — 1 karton isi berapa pack, dan saiz karton (cm)?
3. Plastik Tapau HM Singlet 9x11 — 1 guni/karton isi berapa bundle, saiz (cm)?
4. Susu Krimer Manis 500g — 48 tin/karton? Saiz karton (cm)?
5. Sabun Cuci Pinggan 5L — 4 botol/karton? Saiz karton (cm)?

Boleh share harga borong untuk 6 item ni? Kami bayar cash/DuitNow masa pickup.
Terima kasih Boss!
```

> **Question 1 is the load-bearing one.** A nested carton means 10 price units = 10 physical boxes. Separate lids mean 20. Across a 14-Stall Route that is the difference between 22 and 32 physical boxes in the vehicle — the difference between one trip and two (`ADR-0015`).

### Script B: Tuesday 14:00 "Pool Open" Broadcast
```text
📦 SARPPLY: POOL BORONG MINGGU NI DAH BUKA! 📦

Hi Boss! Order berkumpulan minggu ni dibuka sekarang, tutup esok
(Rabu, 12:00 tengah hari).

✅ Harga karton — beli 1 bundle pun dapat harga borong
✅ Hantar terus ke gerai hari Khamis petang, PERCUMA
✅ Bayar cash atau scan DuitNow QR masa barang sampai saja
✅ Tak perlu bayar apa-apa hari ni

HARGA POOL MINGGU NI:
[A1] Bekas Tapau 22oz + Penutup Rata (10 bungkus)  = RM 15.00
[A2] Bekas Tapau 16oz + Penutup Dome (10 bungkus)  = RM 13.50
[B1] Bekas Makanan 750ml + Penutup (10 bungkus)    = RM 12.50
[C1] Kotak Makanan Kertas (12 bungkus)             = RM 13.50
[D1] Susu Sejat / Pekat (6 tin sekotak)            = RM 21.00
[E1] Beg Plastik Tapau + Straw (10 bungkus)        = RM 10.50

👇 Cara order: balas mesej ni dengan kod & kuantiti saja.
Contoh: "A1 x 3, C1 x 2, E1 x 1"
Atau hantar voice note — kami akan baca balik untuk confirm.
🔒 Voice note disimpan 7 hari sahaja untuk semakan pesanan, lepas tu dipadam.
```

### Script C: Wednesday 12:30 Order Confirmation
```text
✅ ORDER DISAHKAN — [Stall Name]
Route: [Cluster] | Khamis, [window]

- [A1] Bekas Tapau 650ml x 3 bundle = RM 45.00
- [C1] Plastik Tapau 9x11 x 2 bundle = RM 24.40
-----------------------------
JUMLAH: RM 69.40  (Cash / DuitNow QR masa hantar)

Nota: Buffer Stock minggu lepas tiada untuk item ni, jadi kuantiti
dah disahkan. Jumpa Khamis petang!
```

### Script D: Voice-Note Read-Back (mandatory before any voice order commits)
```text
🎤 Saya dengar: A1 tiga bundle, C1 dua bundle.
Jumlah RM 69.40.

Betul? Balas "OK" kalau betul, atau taip semula kalau salah.
```

> A voice note **never** creates a committed order on its own. Hokkien ASR is the weakest link in the stack — 96.6% character error rate at best in published evaluation, and 8 of 9 commercial providers' "Taiwanese" locale is Taiwanese *Mandarin*, not Hokkien (`docs/02_product_eng/asr-feasibility-kuching.md`). A misheard quantity on a 500-set carton is a RM 135 mistake. The read-back costs one message and removes the entire class of failure (`ADR-0014`).

**Confirmation tokens accepted:** `OK`, `YA`, `YES`, `1`, `好`, `对`. Anything else — including silence — leaves the order as an uncommitted draft and triggers a Founder call-back.

---

## 4. Language Model

| Field | Allowed values | Notes |
| :--- | :--- | :--- |
| `written_language` | `ms-MY`, `en`, `zh-CN` | The language Sarpply *writes* to the Stall. Drives every outbound template. |
| Spoken input | Any | Voice notes are transcribed, then read back in the Stall's `written_language`. |

**No ASR language is stored per Stall.** There is no `nan-TW-kuching-hokkien` code: it is not a valid IETF tag, no provider supports it, and the previous document's claim that it did was wrong. Hokkien speakers are served by the read-back loop, not by an ASR locale setting.

---

## 5. Coding Agent Reference: Synonym Dictionary (Phase 2)

Hawkers reply in mixed **English, Bahasa Melayu, Sarawak Malay, Mandarin, and Kuching Hokkien**. Map to canonical `sku_code`:

| `sku_code` | English | BM / Sarawak Malay | Mandarin / Hokkien (transcribed) |
| :--- | :--- | :--- | :--- |
| **`A1`** | `a1`, `650ml`, `small box`, `normal box`, `mee box` | `bekas kecil`, `bekas biasa`, `tapau 650`, `kotak mee` | `小盒`, `普通打包盒`, `面盒`, `650盒`, `tah-pau-ah` |
| **`A2`** | `a2`, `750ml`, `big box`, `large box`, `rice box` | `bekas besar`, `tapau besar`, `tapau 750`, `kotak nasi` | `大盒`, `大号打包盒`, `饭盒`, `750盒` |
| **`B1`** | `b1`, `brown paper`, `wax paper`, `wrapper` | `kertas bungkus`, `kertas coklat`, `kertas minyak`, `kertas nasi` | `油纸`, `打包纸`, `饭纸` |
| **`C1`** | `c1`, `plastic bag`, `singlet bag`, `9x11` | `plastik tapau`, `plastik tangkai`, `plastik 9x11`, `beg plastik` | `塑胶袋`, `手提袋`, `打包袋`, `9x11袋` |
| **`D1`** | `d1`, `creamer`, `condensed milk`, `milk tin` | `susu manis`, `krimer`, `susu tin`, `susu pekat` | `炼奶`, `甜奶`, `奶水`, `茶水奶` |
| **`E1`** | `e1`, `dish soap`, `detergent`, `5l soap` | `sabun pinggan`, `sabun cuci`, `sabun 5l`, `pencuci pinggan` | `洗碗精`, `洗碗水`, `大桶肥皂` |

Hokkien tokens appear only after transcription — they are matched on the transcript, never used to select an ASR model.
