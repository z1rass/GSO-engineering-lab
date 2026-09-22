# GSO Engineering Lab — visual system

Applied to the public homepage and Season screen. Based on the verified ui-ux-pro-max recommendation for `student engineering community editorial`: Swiss grid, generous spacing, strong hierarchy, restrained interaction. Palette is adapted for the technical student community rather than the suggested editorial pink.

## Direction

Graphite canvas, warm white type, acid yellow primary action. A lightweight inline SVG engineering diagram gives the Season card a distinctive identity. A light panel separates the community explanation from the active Season. No stock photography, fabricated participation numbers or non-working actions.

## Tokens and layout

Source of truth for implemented tokens: apps/web/src/styles.css. Ink #141a1d; foreground #f5f6ef; surface #20282c; muted foreground #b4bdbf; accent #e3fa73; light-panel body #4f5a5e. Local system font stack avoids external font requests. Monospace labels distinguish metadata from prose.

Desktop container max 1320px; asymmetric hero grid; three community steps. Below 760px all content stacks, navigation remains visible, and step cards become compact rows. Controls have at least 44px target height. Primary actions use accent fill; secondary actions remain text links.

## Interaction and accessibility

Semantic links/buttons, active Season navigation, visible keyboard focus, skip link, decorative SVG hidden from assistive technology. 180ms color/background feedback; reduced-motion disables transitions. Loading, empty and retry states remain usable in DE/EN. User-authored Season content is never automatically translated.
