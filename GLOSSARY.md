# Sarpply

Hyper-local B2B group purchasing for independent hawker stalls in Kuching. Sarpply aggregates weekly stall orders for back-of-house consumables into Master Carton quantities from Wholesalers, then breaks them down and delivers Bundles stall-side.

## Participants

**Stall**:
An independent hawker or kopitiam outlet that buys Bundles from Sarpply, identified within its Cluster by a stall number.
_Avoid_: Vendor, hawker, merchant, tenant, outlet, customer, client

**Wholesaler**:
The packaging and dry-goods distributor in Pending Industrial Estate or Demak Laut that sells Master Cartons to Sarpply.
_Avoid_: Supplier, vendor, distributor, partner

**Runner**:
The part-time driver who collects Master Cartons, breaks them down, delivers Bundles to Stalls, and records payment at handover.
_Avoid_: Driver, courier, delivery partner, logistics partner

**Founder**:
Sarpply's operator, who negotiates Wholesaler pricing, runs the Pool, and settles each batch against the bank account.
_Avoid_: Admin, operator, owner, pool manager

**Cluster**:
A geographic buying group of six to seven Stalls — a single kopitiam, food court, or row of adjacent outlets — served by one Sortie.
_Avoid_: Zone, area, hub, region

**Route**:
Two adjacent Clusters, twelve to fourteen Stalls, served in one delivery shift by one Vehicle in two Sorties; the unit Sarpply buys for, dispatches, prices, and is judged against.
_Avoid_: Trip, run, loop, shift, zone

**Vehicle**:
The car a Runner loads Master Cartons into and holds Buffer Stock in; the boundary within which Buffer Stock is counted, set by cargo litres rather than weight.
_Avoid_: Van, lorry, truck, boot

**Sortie**:
One collection-and-delivery pass within a Route shift, serving a single Cluster; a Route is two Sorties because its Master Cartons exceed one vehicle load.
_Avoid_: Trip, run, drop, leg, route

## Commercial units

**Bundle**:
The sub-carton unit Sarpply sells and delivers to a Stall: fifty takeaway boxes, 250 sheets of paper, a half-carton of tins, a 5-litre bottle.
_Avoid_: Unit, pack, loose bundle, carton, block

**Master Carton**:
The factory wholesale unit Sarpply buys from a Wholesaler, and never sells to a Stall intact.
_Avoid_: Carton, box, case

**Master Carton Ratio**:
How many Bundles one Master Carton of a SKU contains — the divisor that turns stall demand into cartons to buy.
_Avoid_: Carton size, pack ratio, bundles per carton

**Pool Price**:
The per-Bundle price a Stall pays Sarpply, fixed for a Route Batch.
_Avoid_: Bundle price, selling price, our price, wholesale price

**Street Retail Price**:
What a Stall would pay for one Bundle at a cash-and-carry shop; the figure Sarpply's saving is measured against.
_Avoid_: Market price, retail, RRP

**Golden 6**:
Sarpply's fixed MVP catalogue of six non-perishable, fully fungible back-of-house SKUs.
_Avoid_: Catalogue, SKU list, product range

## Ordering and fulfilment

**Route Batch**:
One week's buying cycle for one Route: orders open, orders cut off, Master Cartons aggregated across both Clusters, Bundles delivered in two Sorties.
_Avoid_: Pool, pool batch, cycle, run, week, order

**Cutoff**:
The moment a Route Batch stops accepting Preorders and its Ordered Bundles are frozen.
_Avoid_: Deadline, close, lock time

**Preorder**:
A Stall's committed order placed before Cutoff, payable on delivery.
_Avoid_: Order, standing order, booking

**Spot Sale**:
A Bundle sold on delivery day to a Stall that did not Preorder it — the buyer of an uncollected Preorder's Bundles, or a Stall clearing Buffer Stock.
_Avoid_: Upsell, extra sale, buffer sale, walk-up

**Ordered Bundles**:
What a Stall committed to before Cutoff; never revised by anything that happens on delivery day.
_Avoid_: Order quantity, demand, requested

**Delivered Bundles**:
What a Stall actually received on delivery day; zero for an uncollected Preorder.
_Avoid_: Fulfilled quantity, actuals, given

**Written Language**:
The language Sarpply writes to a Stall in — Malay, English, or Chinese. Spoken Sarawak Malay and Kuching Hokkien are handled by voice only, never written.
_Avoid_: Preferred language, locale, language setting

## Stock and money

**Buffer Stock**:
Bundles Sarpply already owns but has not yet delivered, held in the Runner's vehicle between batches.
_Avoid_: Carryover, surplus, leftovers, float, safety stock, inventory

**Wholesaler PO**:
The consolidated order Sarpply places with a Wholesaler, expressed in Master Cartons, for the Master Cartons a week's Route Batch requires.
_Avoid_: Purchase order, PO sheet, carton order

**Attested Payment**:
A payment a Runner records at the stall as received, by cash or DuitNow QR, and which the Stall is sent a receipt for immediately; the receipt echo is the audit trail, since a static QR produces no bank-matchable transaction feed.
_Avoid_: Reconciliation, verified payment, confirmed payment, auto-reconciled

**DuitNow QR**:
Malaysia's instant bank-transfer rail. Phase 1 and Phase 2 use a static corporate QR card, which produces no automatic payment callback.
_Avoid_: DuitNow, QR pay, e-wallet

**Trust Tier**:
A Stall's standing, which decides who is served first when a Wholesaler shortfall leaves the Route short: `ANCHOR_PRIORITY`, then `COD_APPROVED`, then `PROVISIONAL`; `SUSPENDED` stalls are not served.
_Avoid_: Credit score, rating, tier, prepay tier

**Forecast GP**:
A Route Batch's accrual margin as known at Cutoff, from Ordered Bundles.
_Avoid_: Projected profit, expected margin, estimated GP

**Realized GP**:
A Route Batch's accrual margin after delivery, from Delivered Bundles including Spot Sales; the figure the business is judged on.
_Avoid_: Actual profit, net profit, final margin

**Net Batch Cash Flow**:
Cash collected minus cartons purchased minus logistics for one Route Batch; what leaves and re-enters the Founder's account.
_Avoid_: Net profit, cash profit, NCM

**Provisional Stall**:
A Stall created from a Spot Sale, which has bought but never Preordered, holds the `PROVISIONAL` Trust Tier, and cannot receive broadcasts until it has a phone number.
_Avoid_: Walk-in, lead, unregistered buyer, prospect
