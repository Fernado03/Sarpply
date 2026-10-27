---
project: Sarpply
pillar: 01_business_ops
doc: carton-payload-estimates
version: 1.0-MVP
purpose: Judge whether 20 or 25 Master Cartons fit one MPV
method: Published supplier carton specs where available; derived figures marked "EST."
---

# Sarpply — Master Carton Payload & Vehicle-Fit Estimates

Approximate packed **Master Carton** (MC) dimensions, volume and gross weight for the six
"Golden 6" SKUs defined in [PRD §4](../02_product_eng/05_PRD.md), plus the usable cargo
volume of the four runner vehicles with seats folded, so we can judge whether **20 vs 25
Master Cartons** fits one MPV.

> **Read this first.** Only `E1` has a *fully* published carton (dimensions **and** that it
> holds 4 bottles). `A1`/`A2` have published 500-set cartons but with the lids packed in a
> *separate* carton, so the combined figure is derived. `D1` is scaled from a published
> 397 g carton. `B1` and `C1` have **no publisher carton data** — those rows are estimates.
> Every derived row is marked **EST.** and says what it was derived from. No figure below is
> presented as published when it is not.

## 1. Per-SKU Master Carton Specification

Carton dimensions are **external**, in cm, as packed. "Bundles / MC" is the PRD's
`bundles_per_carton` ratio; "Units / MC" is that ratio × the vendor unit.

| SKU | Product | Unit / MC | Bundles / MC | Carton L×W×H (cm) | Volume (L) | Gross wt (kg) | Basis and source |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`A1`** | PP Microwave Box 650 ml + Lid | 500 sets | 10 | 60 × 36 × 30 | 64.8 | 15.0 | **EST.** 500-set container carton is published at 60×36×25 cm / 9 kg ([Stanley Packaging](https://www.stanleypackaging.com.au/product/650ml-plastic-takeaway-food-container-500-per-carton/)); matching lids are a separate 62×38×22 cm / 6 kg carton ([Stanley lids](https://www.stanleypackaging.com.au/product/500pcs-plastic-rectangle-container-lids/)). Footprint of the larger carton, height raised to 30 cm, weights summed. |
| **`A2`** | PP Microwave Box 750 ml + Lid | 500 sets | 10 | 60 × 36 × 31 | 67.0 | 15.5 | **EST.** Published 750 ml carton is 60×36×25 cm / 9 kg ([Stanley](https://www.stanleypackaging.com.au/product/750ml-plastic-takeaway-food-container-500-per-carton/)); same lid carton as A1. Taller body ⇒ +1 cm height, +0.5 kg vs A1. |
| **`B1`** | Brown Waxed Paper, pack of 250 sheets | 12 packs (3,000 sheets) | 12 | 30 × 26 × 18 | 14.0 | 8.0 | **EST. — no carton dimensions published.** Weight scaled from Marcal Eco-Pac 12-pack deli-wrap carton (33 lb ≈ 15 kg for 6,000 sheets, [Source Supply](https://www.sourcesupplycompany.com/product/11235/marcal-mcd-5293-eco-pac-interfolded-dry-wax-paper-12-x-10-3-4-white-500-pack-12-packs-carton-mcd5293)) ⇒ ~7.5 kg for 3,000 sheets incl. board. Dimensions inferred from pack format, not published. |
| **`C1`** | HM Singlet Bag, 9×11 in, bundle of 5 packs | 50 packs | 10 | 52 × 36 × 18 | 33.7 | 7.5 | **EST. — no carton dimensions published.** Assuming 100 bags/pack at ~1.5 g each (typical HDPE 9×11), 5,000 bags ≈ 7.5 kg net. Supplier pages publish size and pack UOM only ([Wakim Packaging](https://www.plasticcontainer.com.my/product/eco-tree-bright-color-singlet-bag-d2w-biodegradable/), [Unipack](https://www.unipack.sg/index.php?route=product/product&path=143_253&product_id=511)). |
| **`D1`** | Sweetened Condensed Creamer 500 g | 48 tins (2 × 24-tin half-cartons) | 2 | 47 × 32 × 19 | 28.6 | 26.5 | **EST.** Scaled from published Rainbow 48×397 g carton: 46×31×17.5 cm / 21.8 kg gross ([Rainbow catalogue](https://www.rainbowcatalogue.com/product-details/rainbow-sweetened-condensed-milk/)). 500 g tins are larger in diameter/height ⇒ +1 cm each dimension; weight reflects 24 kg net product + tins + board. |
| **`E1`** | Commercial Dishwashing Liquid 5 L | 4 bottles (1×4) | 4 | 40 × 25 × 30.5 | 30.5 | 21.4 | **Dimensions published:** "Net: 5L, Quantity: 1*4, Size: 40*25*30.5cm" ([Huiji Group product brochure, dishwashing page](https://huiji-group.com/wp-content/uploads/2026/05/HUIJI-Product-Brochure-3.pdf)). **Gross weight EST.** = 20 kg liquid + ~1.4 kg bottles/carton (brochure gives no gross weight). |

### What is actually sourced vs estimated

- **Fully published (dimensions + fill quantity):** `E1` only.
- **Published container carton, derived set carton:** `A1`, `A2`.
- **Published analogue, scaled:** `D1` (397 g → 500 g).
- **Not published at all — modelled from pack format and unit weights:** `B1`, `C1`.

If exact figures matter for a purchase order, request the wholesaler's packing list for
`A1`, `A2`, `B1`, `C1`, `D1`. The estimated rows above are planning-grade only.

## 2. Basket Totals

Basket A is computed with **fractional cartons** (no rounding), per the assignment. Load
volumes assume **80 % packing efficiency** — real car boots never take a carton's geometric
volume in full, because of wheel arches, seat shoulders and stacking gaps.

### Basket A — A1 35 · A2 14 · B1 14 · C1 16 · D1 4 · E1 8

| SKU | Bundles | Cartons (= bundles ÷ per MC) | Volume (L) | Gross (kg) |
| :--- | ---: | ---: | ---: | ---: |
| A1 | 35 | 3.500 | 226.8 | 52.5 |
| A2 | 14 | 1.400 | 93.8 | 22.1 |
| B1 | 14 | 1.167 | 16.4 | 9.3 |
| C1 | 16 | 1.600 | 53.9 | 12.0 |
| D1 | 4 | 2.000 | 57.2 | 53.0 |
| E1 | 8 | 2.000 | 61.0 | 42.8 |
| **Total** | **91** | **11.67 cartons** | **509.1 L = 0.509 m³** | **191.7 kg** |

Because cartons ship whole, the *order* is **14 Master Cartons** (round each SKU up:
4 + 2 + 2 + 2 + 2 + 2), which is **0.607 m³ / 218 kg** — the same load as Basket B, because
Basket A's fractional bundles are exactly what the rounding already absorbs. That is the real
risk in Basket A: the no-rounding total understates the vehicle load by ~16 % (509 L → 607 L).

### Basket B — A1 40 · A2 20 · B1 24 · C1 20 · D1 4 · E1 8

| SKU | Bundles | Cartons | Volume (L) | Gross (kg) |
| :--- | ---: | ---: | ---: | ---: |
| A1 | 40 | 4.000 | 259.2 | 60.0 |
| A2 | 20 | 2.000 | 133.9 | 31.0 |
| B1 | 24 | 2.000 | 28.1 | 16.0 |
| C1 | 20 | 2.000 | 67.4 | 15.0 |
| D1 | 4 | 2.000 | 57.2 | 53.0 |
| E1 | 8 | 2.000 | 61.0 | 42.8 |
| **Total** | **116** | **14.00 cartons** | **606.7 L = 0.607 m³** | **218.3 kg** |

Basket B lands on a clean **14 Master Cartons**, **0.607 m³**, **218 kg** — and is fully
whole-number (no rounding needed).

### Scaling to the 20 vs 25 carton question

At the Basket-B mix the average carton is **43.3 L / 15.6 kg**. Mixed-carton scenarios:

| Cartons | Est. geometric volume | Est. weight | Fits Alza (498 L)? |
| ---: | ---: | ---: | :--- |
| 14 (Basket B) | 0.607 m³ (607 L) | 218 kg | No at 80 % efficiency (needs 758 L) |
| 20 | 0.867 m³ (867 L) | ~312 kg | No |
| 25 | 1.083 m³ (1,083 L) | ~390 kg | No |

Weight is **not** the binding constraint at any of these counts: MPV payloads are in the
450–550 kg range and even 25 cartons only reach ~390 kg. This problem is **volume-bound,
not weight-bound** — which matters, because it means a heavier-but-denser mix (more `D1`,
`E1`) is easier to fit than the same carton count of bulky `A1`/`A2`.

## 3. Usable Cargo Volume, Rear Seats Folded

| Vehicle | Usable volume, seats folded | Source | Status |
| :--- | :--- | :--- | :--- |
| **Perodua Alza** (D27A, 2022+) | **498 L** (third row folded) | [paultan.org review](https://paultan.org/2022/08/18/review-2022-perodua-alza-av-the-best-family-car-below-100k-in-malaysia-not-just-among-7-seater-mpvs/) — "With the third row bench folded (50:50), cargo space is now 498 litres"; corroborated by [Carz](https://www.carz.com.my/cars/perodua/perodua-alza) and [CarSifu](https://www.carsifu.my/car-reviews/new-perodua-alza-in-new-orbit) | Published |
| **Perodua Myvi** (D51A, 2022+) | **800 L** (rear seats folded); 277 L seats up | [Carz](https://www.carz.com.my/cars/perodua/perodua-myvi) — "277 liters and up to 800 litres with the rear seats folded down"; 277 L also in [Perodua's own brochure](https://www.perodua.com.my/files/Myvi_Brochure.pdf) | Published |
| **Toyota Avanza** (previous gen, as sold in MY) | **~500 L** (third row folded); "over 1,000 L" with both rear rows folded | [Zigwheels.ph](https://www.zigwheels.ph/new-cars/toyota/avanza) — "With the third-row seats folded down, the capacity increases to 500 litres… over 1,000 litres of flat storage" | Credible review figure, not a manufacturer spec sheet |
| **Proton Exora** (RC, 2019–2023) | **Not published.** 132 L with **all seven seats up** is published ([paultan.org research](https://www.paultan.org/research/proton/exora/)); no folded-seat litre figure could be sourced from Proton, paultan, or carbase | — | **Cannot be sourced** |

**On the Exora:** I could not find a published folded-seat volume. It is the largest body of
the four (4,610 mm long, 1,809 mm wide) and reviews describe a "big and voluminous load area
that is completely flat" with both rows folded
([OneShift](https://www.oneshift.com/articles/car-reviews/proton-exora-cps-16-review-a-practical-mpv-that-is-beyond-your-expectations)),
so it will comfortably exceed the Avanza's ~500 L — but I am not going to invent a number.
**Treat the Exora as ≥500 L and unquantified.**

## 4. Verdict

**Neither 20 nor 25 Master Cartons fits the smallest vehicle.** The smallest documented
folded-seat volume is the **Perodua Alza at 498 L**; 20 cartons need ~867 L and 25 need
~1,083 L, so 20 cartons overflows the Alza by ~1.7× and 25 by ~2.2× — even the 14-carton
Basket B (607 L) exceeds it.

### Practical ceiling

- **Alza: ~9–10 cartons** (498 L × 80 % ÷ 43.3 L per carton) — below even Basket A's 11.7,
  so Basket A also does not fit an Alza in one trip.
- **Myvi: ~14–15 cartons** (800 L × 80 % ÷ 43.3 L).
- **Avanza: ~9 cartons** on the third-row-folded figure, but **~19 cartons** if the second
  row is folded too ("over 1,000 L") — this vehicle's answer depends entirely on whether the
  runner is willing to give up the second row.
- **Exora: unquantified**, expected to be the most capable of the four.

### Implications for the plan

1. **20 vs 25 is not a vehicle question for an Alza or Myvi** — both are out of reach at
   either count. The PRD's "~15–25 Master Cartons per week" (and the 120–180 kg batch weight
   in the runner persona) is only achievable with the **second row folded** in an Avanza-class
   MPV, or with **two vehicles**.
2. **The 120–180 kg figure is already validated** — Basket B is 218 kg and 14 cartons, so the
   weight assumption holds while the volume assumption does not. The risk is a volume
   surprise on the first batch, not a weight one.
3. **D1 and E1 are the efficient cartons** (927 and 702 kg/m³); `A1`/`A2` at ~230 kg/m³ are
   the space hogs. For a fixed carton budget, substituting `D1`/`E1` for `A1`/`A2` buys
   meaningful volume headroom.
4. **Before locking a 20-carton batch**, get the wholesaler's packing list to replace the
   `B1`/`C1`/`D1` estimates, and measure the Alza's boot with cartons in it. The 498 L figure
   is a manufacturer/road-test measurement of *volume*, not a guarantee of carton fit.
