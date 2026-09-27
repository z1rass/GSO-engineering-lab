# Public homepage and Season — current override

This overrides the earlier graphite/lime MASTER direction for `/` and `/season` following the user's redesign request and feedback: earlier comps were overloaded, the quiet alternative too plain. Implemented through ui-ux-pro-max, using its Swiss grid and semantic React navigation guidance.

Warm light canvas (#f7f6f2), dark ink (#182020), muted text (#535c5d), blue-gray Season surface (#dfe8e9), vermilion primary action (#b73524, white text). All colors are CSS custom properties. Self-hosted Barlow Condensed 700 headings and Space Grotesk 400/500/700 body, with restrained monospace metadata. Fonts ship with the app and do not contact a third-party font service.

One asymmetric opening grid, moderate display headline, a distinctive Season module with a small decorative three-frame SVG, compact dates, three unboxed explanatory columns. No giant season number, atom illustration, lime fills or card grid. On phones content stacks; all controls remain at least 44px tall, text wraps naturally, and motion respects reduced-motion.

Real API content, DE/EN labels, empty/error/retry behavior are preserved. No synthetic activity listings or implied signup capability. Approved product copy remains in the language dictionary. The image mock is a direction reference, not a raster UI asset.

Refinement after feedback that the implementation was too plain: condensed display type, accent-colored final headline line, a compact two-block construction drawing, a strong top rule on Season, and distinct rules above the three participation steps. No new functionality or invented activity data.

## Current refinement: independent enthusiast identity

The user rejected the official-school presentation. The full wordmark is `GSO engineering lab`, with `engineering lab` bold and GSO regular; never shorten it to an `/ gso` suffix. Do not use the official school logo or imply institutional endorsement. A small muted cyan detail is enough. The live design uses warm off-white, dark neutral text, a pale sage Season card, restrained technical illustration and an asymmetric layout. Space Grotesk, normal-case type and one quiet primary action keep it minimal without feeling institutional. This supersedes the school-affiliation and condensed-heading explorations.

## Public landing refinement

The `/` welcome page blends the existing Lab identity with the spacious composition of SpaceFS (https://spacefs.com/): a centered two-line headline, quiet second-line color, one clear primary action, and an unboxed process sequence below the hero. The generic slogan badge and dotted decoration were removed after review. The page does not reuse SpaceFS assets or copy. The full GSO engineering lab wordmark, muted cyan mark, approved DE/EN copy, and existing destinations remain.

## Site-wide extension

The same visual language now covers Home, Seasons, Events, Projects, Ideas, account, and internal work screens. Shared tokens and component treatments live in `apps/web/src/system.css`: near-white canvas, dark Space Grotesk headings, soft cyan accents, flat underlined navigation, a pill for the primary action, restrained panels, readable forms, and generous section spacing. The landing keeps its larger hero treatment in `landing.css`. Work screens retain clear status, focus, error, and form states. Route pages load on demand so the initial screen does not ship all work flows at once.

## Creation paths and link cues

Home presents Idea and Project as two distinct ways to begin: an Idea is a suggestion without organising responsibility; creating a Project makes its creator the owner. Collection pages put a short effort cue beside the create action. Idea and Project creation use title plus a short description or goal. Event creation shows title, date, start/end time, place, then description on one page. For school Events with a complete schedule, saving sends the room request automatically; the form states that no separate booking is needed and that Ops must confirm the room. All three schedule fields can stay empty when the date is unknown, and an incomplete schedule is explained inline before submission. New Events use the unclassified format and stay in preparation until registration is opened. A new Project may have an empty description; the public detail page omits that section until an owner adds it. The owner can set Event format, further dates, links and member details, or Project description, links and member details while editing. Edit sections use rules and white controls on the page canvas, without the former green schedule panel or inset fieldset legend. Existing details open while editing. Starting from an Idea preserves its association via the originating link; the creation form does not load a separate Idea picker. After sign-in from a create page, the magic link returns to that page. Internal links use text and clear labels instead of repeated diagonal arrows; list cards use a small “Ansehen / View” cue.
