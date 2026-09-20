---
version: 1
slug: "frontend-src-components-bookingflow-tsx"
primary_target: "frontend/src/components/BookingFlow.tsx"
related_targets: ["frontend/src/App.tsx"]
---

## Direction contract

THESIS: The client booking flow proves it's the best-run barbería in the neighborhood before a single service is picked — every screen carries the weight of a real trade (headshot cards, a real calendar, a stamped confirmation), refusing the generic "form wizard" arrangement of flat list rows and prev/next arrows that reads as a template, not a business.

OWN-WORLD: Inherits the shipped system entirely — ink #14161A ground, bone #EDE9E2 cards, brass #F5B93F accent (committed, not scattered: every primary action and selection state), Bricolage Grotesque display / Inter body / JetBrains Mono for numbers-as-data (prices, times, codes), rounded-card/pill radii, card/float shadows, the hand-drawn 1.8-stroke icon set. No new tokens. Structural upgrade only: a real calendar grid replaces the horizontal day-scroller, barber selection becomes photo-forward trading cards instead of small circle+text rows, service rows gain per-type iconography, the confirm summary and success screen gain the ceremony of a receipt (icon-labeled rows, barber avatar, a stamped code card).

STORY: A client lands on their barbershop's own link (no search, no marketplace — direct slug), picks services, picks a barber they can actually see, picks a real date off a real calendar, picks a time, confirms with a receipt-like summary, and leaves with a stamped confirmation code worth screenshotting.

FIRST VIEWPORT (per step, mobile-first ~390px):
- Service step: existing cover/logo header unchanged; service rows get a per-type icon (scissors/beard/combo/tint by keyword match on name, scissors fallback) in the existing brass-tinted roundel, same row shape, more legible category at a glance.
- Barber step: 2-col grid of tall photo cards (4:5 image top, name+price+duration on a gradient-scrim strip at the bottom) instead of 48px circle rows — the barber is the hero, not a caption.
- Date step: full month calendar grid (Mon–Sun header, prev/next month nav, today marked, past days disabled, selected day brass-filled circle) replacing the 14-day horizontal scroller.
- Confirm sheet: summary rows gain icons (calendar/clock) and a barber avatar+name row; unchanged OTP sub-flow.
- Success: existing animated check stays; confirmation code becomes a stamped card with a copy-to-clipboard affordance (no new backend, clipboard API only) and a compact receipt (barber, service, date) below it.

FORM: Precisely specified by the user's reference screenshot + explicit "no marketplace" constraint — concept-seed tournament skipped per new-work.md ("never run the script for... a precisely specified narrow request").

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
