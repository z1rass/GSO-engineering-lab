---
name: GSO Engineering Lab
description: A cover-led public showcase for Events and Ideas, with a quiet charcoal admin.
colors:
  canvas: "#151515"
  card: "#202020"
  card-hover: "#262626"
  admin-field: "#292929"
  admin-panel: "#242424"
  border: "#373737"
  ink: "#f7f7f5"
  muted: "#aaa9aa"
  focus-mint: "#b7d9d3"
  error: "#ffb0ab"
  plum-page: "#321e3e"
  teal-page: "#123b3b"
  slate-page: "#1f2935"
  blue-page: "#e2e7f8"
  amber-page: "#efe4cd"
  graphite-page: "#272627"
  blue-ink: "#1f2742"
  amber-ink: "#352c1d"
typography:
  display:
    fontFamily: "Space Grotesk, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "clamp(48px, 5.3vw, 86px)"
    fontWeight: 700
    lineHeight: 1.03
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Space Grotesk, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "clamp(46px, 5vw, 72px)"
    fontWeight: 700
    lineHeight: 1.04
    letterSpacing: "-0.04em"
  detail-title:
    fontFamily: "Space Grotesk, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "clamp(42px, 4.6vw, 71px)"
    fontWeight: 700
    lineHeight: 1.06
    letterSpacing: "-0.04em"
  body:
    fontFamily: "Space Grotesk, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "clamp(17px, 1.6vw, 20px)"
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: "Space Grotesk, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.4
rounded:
  small: "8px"
  control: "9px"
  fact: "11px"
  cover: "15px"
  feature: "16px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "24px"
  section: "80px"
components:
  admin-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.canvas}"
    rounded: "{rounded.control}"
    padding: "11px 15px"
    height: "46px"
  admin-field:
    backgroundColor: "{colors.admin-field}"
    textColor: "{colors.ink}"
    rounded: "{rounded.small}"
    height: "45px"
  nav-link:
    textColor: "{colors.muted}"
    rounded: "{rounded.control}"
    padding: "8px 14px"
    height: "42px"
  event-card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.cover}"
    padding: "21px 23px"
  idea-card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.cover}"
  detail-fact-tile:
    rounded: "{rounded.fact}"
    width: "58px"
    height: "58px"
---

# Design System: GSO Engineering Lab

## Overview

**Creative North Star: "The Cover Sets the Scene"**

The public site is an image-led showcase for Events and Ideas. A minimal charcoal frame lets each abstract cover and its content lead. The GSO Lab mark is small and contextual, without an institutional lockup. The admin keeps the same type and icon language in a simple dark workspace.

**Key Characteristics:**

- A charcoal collection canvas, with a featured cover panel on the landing page.
- A Luma-like Event cadence: date rail, one readable card per Event, and explicit time and place.
- A three-column, image-first Idea grid on wide screens.
- Full-page cover-matched detail themes, including light blue and amber with dark ink.
- Rounded line icons beside text labels; localized date and time information.

## Colors

The default public shell and admin use charcoal (`{colors.canvas}`), lighter cards (`{colors.card}`), fine borders (`{colors.border}`), off-white text (`{colors.ink}`), and gray metadata (`{colors.muted}`). Mint (`{colors.focus-mint}`) marks focus, selection, and small accents. Admin inputs use `{colors.admin-field}` and grouped schedule and place controls use `{colors.admin-panel}`. Error text uses `{colors.error}`.

The six deterministic cover tones set the surrounding public detail page, including header and footer: plum (`{colors.plum-page}`), teal (`{colors.teal-page}`), slate (`{colors.slate-page}`), blue (`{colors.blue-page}`), amber (`{colors.amber-page}`), and graphite (`{colors.graphite-page}`). Blue and amber switch to dark ink (`{colors.blue-ink}`, `{colors.amber-ink}`) and a light color scheme. The other tones use pale ink. Each theme also defines its own muted text and line color; exact page overrides are recorded in `extensions.coverThemes` in the sidecar. The landing feature matches its featured cover, while collections and the admin retain charcoal.

**The Cover Context Rule.** Let the chosen cover color the landing feature and public detail page; keep collection pages and admin controls charcoal.

## Typography

Space Grotesk is the display and body face, with system sans-serif fallbacks. Bold, tightly tracked headings create the visual hierarchy: featured Event (`{typography.display}`), collection heading (`{typography.headline}`), and detail title (`{typography.detail-title}`). Detail prose (`{typography.body}`) reads at a generous line height in a column up to 68 characters. Labels (`{typography.label}`) are compact and direct. Dates and times use tabular numerals where alignment helps scanning.

**The Factual First Read Rule.** On an Event, show title, date and time, and place before long description; label unknowns and requested school rooms honestly.

## Layout

The header spans up to 1440px; the landing page uses 1320px, collections 1120px, detail pages 1240px, and admin 1200px. Wide layouts use a 64px total gutter; at 690px and below, most pages use 36px. The landing feature pairs text and a square cover. Its follow-on sections show a vertical Event timeline and Idea cards, with generous space between sections. Event collections retain one timeline card per row. Ideas use three columns, two below 900px, and one below 480px.

The detail stage places a large square cover beside title and content. Event facts group date/time and place into icon-backed rows with 58px tiles; the long description follows. At 690px, detail content stacks title, cover, facts, actions, body, and source context. The date rail disappears at that width, but Event cards keep time and place in the card. Navigation collapses to a menu at 690px; language and admin access remain visible. The admin home uses two lists on wide screens. Its editor pairs a cover preview and form until 690px, then stacks them. Event scheduling and place controls stay grouped inside dark panels.

**The Clear Conditions Rule.** Never substitute a decorative date or guaranteed school location for a missing or requested one.

## Elevation & Depth

The collections and admin are mostly flat: neighboring charcoal tones, hairline borders, and spacing distinguish regions. Event and Idea cards lift 2px on hover. The featured and detail covers have restrained shadows; a low-opacity blurred cover sits behind public detail content. Admin date and time popovers use a stronger shadow to separate the active control.

## Shapes

Cards and square cover crops use softly rounded corners (`{rounded.cover}`), the landing feature is slightly broader (`{rounded.feature}`), factual tiles use `{rounded.fact}`, and controls use `{rounded.control}` or `{rounded.small}`. Borders are generally 1px. The inline SVG set uses a 24-unit viewBox, rounded ends and joins, a 1.75-unit stroke, and current text color. Icons accompany readable labels rather than replacing them.

## Components

### Public navigation and actions

The centered desktop navigation holds only Events and Ideas. Current and hovered links gain a translucent tile. The DE/EN switch exposes its pressed state. The admin link is a quiet utility action. The landing feature uses a high-contrast solid action whose foreground and background invert with the feature tone; detail actions are small outlined or translucent controls with icons and text. All keyboard focus is visible with a 2px mint outline and 3px offset.

### Collections and details

Event rows pair a date rail with a bordered charcoal card, square cover, time, title, and general place; Past/Upcoming is a segmented control. Idea cards put the cover above published date, title, and a short description. The Event detail uses a status chip plus clear date and place rows, with calendar and map actions only when their information exists. Idea detail uses the same cover-led stage and shows its publication date. Cover images are decorative beside real text.

### Admin

Admin login is a narrow single-field screen. Admin home offers create actions and separate Event and Idea lists. The editor shows a title-first form and live deterministic cover preview. Event date, time, place, category, and description fields are grouped for scanning. Labeled date and time popovers support localized choices. Primary save or publish actions are off-white; secondary actions stay dark. Error text appears next to the relevant form area.

## Do's and Don'ts

### Do:

- **Do** use the same title-derived cover across a public card, detail page, and admin preview.
- **Do** allow each public detail tone to change the whole shell, with dark text on blue and amber.
- **Do** keep Event date, time, and place visible and truthful, including requested school rooms.
- **Do** keep German and English text, keyboard focus, and reduced-motion behavior usable.

### Don't:

- **Don't** introduce Projects, Seasons, registration, or member workflows into the current public navigation.
- **Don't** present the Lab mark as an official school seal.
- **Don't** turn the admin into a cover-colored page; the preview image carries that color.
- **Don't** use imagery to imply confirmed speakers, attendees, or rooms.
