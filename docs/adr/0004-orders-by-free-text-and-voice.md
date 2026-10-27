# Stalls order by free text and voice note; there is no order form

Stalls place Preorders by replying to the weekly broadcast in ordinary language — typed or as a WhatsApp voice note in Sarawak Malay, Mandarin or Kuching Hokkien — and the system extracts SKU codes and quantities from that message. No structured order form, catalog button, or numbered reply menu is offered. A form would be more reliable to parse, but it asks a hawker working a 7am–1:30pm rush to learn Sarpply's vocabulary in a language they may not write; voice notes meet them where they already are, and Hokkien has no practical written form for this audience.

## Considered Options

- **WhatsApp catalog buttons** — rejected: the channel's interactive surfaces require a template the Stall must first navigate, and they cannot carry "3 bundles of the small box, and 2 of the plastic".
- **Text-only parsing with voice rejected** — rejected: it silently excludes the cohort least likely to type.

## Consequences

Every inbound message — audio or text — must be retained with its extraction result, because the raw message is the only evidence of what a Stall asked for. Parsing latency sits on the ordering path, and clarification replies are a normal part of the flow rather than an error path.
