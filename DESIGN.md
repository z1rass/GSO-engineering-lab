---
name: GSO Engineering Lab
description: A quiet dark workshop for discovering and organizing student-led technical work.
colors:
  mint: "#bdd8d2"
  mint-hover: "#e3f0eb"
  mint-soft: "#273532"
  mint-ink: "#111514"
  paper: "#151515"
  card: "#202020"
  surface: "#252525"
  card-hover: "#292929"
  collection-hover: "#262626"
  collection-line: "#353535"
  panel-line: "#3b3b3b"
  field-surface: "#303030"
  picker-popover: "#242424"
  picker-selected: "#e9e9e5"
  status-surface: "#27332f"
  status-ink: "#c0dcd1"
  ink: "#f4f3f0"
  muted: "#aaa9a6"
  line: "#383838"
  action: "#f0efeb"
  action-hover: "#d0e4df"
  action-ink: "#191919"
  action-hover-ink: "#171b1a"
  danger: "#f0a7a0"
  danger-soft: "#392522"
typography:
  display:
    fontFamily: "Space Grotesk, Arial, sans-serif"
    fontSize: "clamp(58px, 6.6vw, 90px)"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "-0.055em"
  headline:
    fontFamily: "Space Grotesk, Arial, sans-serif"
    fontSize: "clamp(42px, 5vw, 62px)"
    fontWeight: 500
    lineHeight: 1.05
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Space Grotesk, Arial, sans-serif"
    fontSize: "clamp(23px, 2.4vw, 32px)"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.035em"
  body:
    fontFamily: "Space Grotesk, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "Space Grotesk, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.4
rounded:
  status: "7px"
  nav: "9px"
  control: "10px"
  cover-thumbnail: "11px"
  collection: "15px"
  card: "16px"
  cover-detail: "17px"
  feature: "18px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "24px"
  xxl: "32px"
  section: "48px"
components:
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "{colors.action-ink}"
    rounded: "{rounded.control}"
    padding: "11px 18px"
    height: "46px"
  button-primary-hover:
    backgroundColor: "{colors.action-hover}"
    textColor: "{colors.action-hover-ink}"
  button-secondary:
    textColor: "{colors.ink}"
    rounded: "{rounded.nav}"
    padding: "10px 16px"
  field:
    backgroundColor: "{colors.field-surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "52px"
  nav-link:
    textColor: "{colors.muted}"
    rounded: "{rounded.nav}"
    padding: "8px 11px"
    height: "42px"
  status:
    backgroundColor: "{colors.status-surface}"
    textColor: "{colors.status-ink}"
    rounded: "{rounded.status}"
    padding: "4px 10px"
  collection-card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.collection}"
    padding: "20px 22px"
  event-timeline-card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.collection}"
    padding: "20px"
  archive-tabs:
    backgroundColor: "{colors.card-hover}"
    textColor: "{colors.muted}"
    rounded: "{rounded.control}"
    padding: "4px"
  activity-cover:
    rounded: "{rounded.cover-thumbnail}"
    width: "148px"
    height: "148px"
  creation-cover:
    rounded: "{rounded.feature}"
  schedule-trigger:
    textColor: "{colors.ink}"
    rounded: "{rounded.nav}"
    padding: "10px 12px"
    height: "50px"
  schedule-popover:
    backgroundColor: "{colors.picker-popover}"
    textColor: "{colors.ink}"
    padding: "16px"
  icon:
    textColor: "{colors.muted}"
    size: "18px"
---

# Design System: GSO Engineering Lab

## Overview

**Creative North Star: "The Open Workshop"**

The Lab feels like a place where people can arrive, understand what is happening, and take a concrete next step. Near-black working surfaces, pale text, and a restrained mint signal give technical character without making the community look like an official school service. The GSO name remains a quiet context cue; the visual emphasis belongs to the work and the people who start it.

The public entrance has room to breathe and a clear path into Events, Projects, and Ideas. Home, Seasons, profile, Ops, and operational routes share the same charcoal panels, borders, icons, and interaction states at a denser rhythm. Luma's legible event cadence informs the date rail and generous cards, while the Lab keeps its own compact mark and Discover → Join → Own story. Six original abstract covers give Ideas, Events, and Projects visual identity without implying a real speaker, attendee, room, or confirmed schedule.

**Key Characteristics:**

- A charcoal canvas and subtly lighter, stroked surfaces instead of floating shadows; creation pages shift into a cover-matched deep palette.
- Large, calm Space Grotesk headings with compact labels and generous line spacing for explanation.
- Off-white primary actions; mint marks state, focus, and technical details on default pages, with cover-matched accents in creation.
- One-column collections with square abstract covers, an event date rail, and focused two-column creation flows on wide screens.
- One coherent SVG icon set and localized date/time controls across navigation, actions, detail facts, and forms.

## Colors

### Primary

- **Pale mint** (`{colors.mint}`): active state, the Lab mark's last bar, and keyboard focus. Its related status ink and surface tokens keep badges readable; the lighter variant (`{colors.mint-hover}`) supports interaction, and the deep soft variant (`{colors.mint-soft}`) keeps selected or interested states quiet.

### Neutral

- **Workshop charcoal** (`{colors.paper}`): the uninterrupted page canvas.
- **Card charcoal** (`{colors.card}`), **raised charcoal** (`{colors.surface}`), and **hover charcoal** (`{colors.card-hover}`): a small tonal ladder for grouped content and response to interaction. Neutral form fields have their own darker gray (`{colors.field-surface}`).
- **Collection stroke and hover** (`{colors.collection-line}`, `{colors.collection-hover}`): the slightly tighter card treatment shared by Ideas, Projects, Events, and empty states. Work panels use the nearby panel stroke (`{colors.panel-line}`).
- **Picker surface and selection** (`{colors.picker-popover}`, `{colors.picker-selected}`): a fixed charcoal calendar/time popover and a bright selected tile that remain legible over every creation palette.
- **Warm chalk** (`{colors.ink}`): headings and main text. **Quiet gray** (`{colors.muted}`) carries explanation and metadata; **hairline gray** (`{colors.line}`) separates content without a heavy grid.
- **Action white** (`{colors.action}`): the strongest call to action, with its mint-tinted hover (`{colors.action-hover}`) and dedicated dark action ink tokens.
- **Soft coral** (`{colors.danger}`) on **deep red charcoal** (`{colors.danger-soft}`): destructive actions and errors only.

Idea, Event, and Project creation pages have six scoped color themes: teal, plum, slate, blue, amber, and graphite. The selected cover tone sets the page background, card, hover, line, muted text, accent, and soft accent together. These contextual values live in the sidecar's `extensions.coverThemes`; the neutral frontmatter tokens remain the default world for other pages. Controls inherit the chosen theme so the transition feels full-page, while primary action buttons keep their bright, high-contrast treatment.

**The Mint Signal Rule.** Use mint for orientation, state, and focus on default pages; use the selected cover's pale accent in creation, while off-white carries the primary action.

**The Cover Tone Rule.** Apply a cover's palette only to Idea, Event, and Project creation; change the surrounding chrome and form surfaces as one coordinated set.

## Typography

**Display Font:** Space Grotesk (Arial, sans-serif fallback).

**Body Font:** Space Grotesk (Arial, sans-serif fallback).
**Small technical labels:** Space Grotesk, with occasional tabular numerals for dates and sequence markers.

**Character:** Geometric and contemporary, with soft weight and tight display tracking. The very large type carries the page's personality while operational text remains plain and easy to scan.

### Hierarchy

- **Display** (`{typography.display}`): the landing hero only; keep its line breaks intentional and its second line quieter.
- **Headline** (`{typography.headline}`): collection introductions; Home and some Season headings use nearby sizes from their layout context.
- **Title** (`{typography.title}`): event timeline cards and other prominent item titles.
- **Body** (`{typography.body}`): descriptions and guidance, generally contained to a readable line length near 50–60 characters.
- **Label** (`{typography.label}`): form labels, status, dates, and small technical cues. Navigation uses a nearby size (13px) and medium weight.

**The Clear First Read Rule.** A large heading names the purpose; the next line explains it before a person must decide what to click.

## Layout

The shared page container is capped at 1280px, with a 64px total gutter on wider screens and a 36px total gutter at mobile widths. Desktop navigation occupies one row: brand at start, route links centered, Season/account/language tools at end. At 1170px and below, the route links take a second row while the active Season link remains in the header. At 760px and below, route links move behind the menu control; the active Season link moves into that menu so it remains directly accessible when one exists. At 540px and below, the compact header puts brand and menu on the first row and language controls on the second.

Collection pages open with a large heading, brief explanation, and a clear creation action. Ideas and Projects use one card per row rather than a dense card wall. Idea, Project, and Event cards end with a square abstract cover, and their detail pages pair the title with a larger square version. Events use one date rail beside one linked event card, with explicit date or “open” language. At 760px covers remain visible at a smaller size; at 540px the date becomes a line above the card and the rail disappears while the cover remains a compact thumbnail. Never present a placeholder date or place as confirmed.

New Idea, Event, and Project creation have a two-column desktop composition: a square original cover and a wider form. The editor's deep background and control surfaces follow the cover's palette. The title is the first and largest field; Event schedule and place are grouped; the save action remains unambiguous. The shared six-cover gallery is selected deterministically from content kind and normalized title, without an upload or stored choice. The same kind and unchanged title resolve to the same cover across list, detail, and creation surfaces; changing the title can change the cover. At 760px the editor becomes one column with the title field first and a short, wide image second. Event date/start/end controls reduce to two columns below 540px and one column below 380px. Editing existing content remains narrower and task-focused.

The Event detail view uses a cover-led two-column stage: square image and permitted owner context on one side, title, date/place facts, and participation state on the other. A low-opacity blurred cover wash sits behind that stage, with a narrower reading column for description, tasks, and room information. At 760px the title, image, and summary stack in that order. Other detail and internal work routes use the same surface and typographic vocabulary without claiming the same page composition.

The landing hero uses two columns on wide screens: narrative and action on the left, a three-route wayfinder on the right. It stacks below 760px. Use generous section breaks, with compact spacing inside cards and forms. German and English strings must wrap without clipping; user-authored titles may run long.

**The One Path Rule.** Give each collection one dominant reading direction and each form one obvious next action.

## Elevation & Depth

Depth comes from nearby dark tones, thin borders, and content spacing. Cards rest flat; hover changes their tone and stroke. Primary buttons have no resting shadow. Cover-matched creation pages use a full-page deep color field; lighter accents stay concentrated in text, focus, and state. The custom picker is the one floating layer with a defined shadow (0 16px 48px #0008). Event details use a very faint blurred version of their cover behind the factual content.

**The Flat Surface Rule.** A surface earns separation through tone and a hairline before any shadow is considered.

## Shapes

Controls are gently curved (`{rounded.control}`), while collection and feature surfaces use the larger card and feature radii. Small status shapes are tighter (`{rounded.status}`). Covers are square crops with softly rounded corners: thumbnails (`{rounded.cover-thumbnail}`), detail images near (`{rounded.card}` or `{rounded.cover-detail}`), and creation images near (`{rounded.card}` or `{rounded.feature}`). Borders are generally one pixel. Icons use a consistent 24-unit SVG viewBox, rounded 1.75-unit strokes, and current text color. The compact three-bar Lab mark is a contextual identity detail, never an official school lockup.

## Components

### Buttons

- **Primary:** Warm off-white fill, dark text, bold label, medium curve, and at least a 46px high target. On hover, shift to the mint-tinted action tone; on focus, show a 2px mint outline with 3px offset.
- **Secondary / text action:** Transparent charcoal field with a fine gray border for utility actions; inline links remain visibly link-like and gain mint on hover. Keep destructive actions coral and clearly labeled.

### Chips

- **Status:** Compact deep green charcoal with pale mint text and a fine border. Status text must remain explicit; hue alone must not distinguish planning, active, completed, or cancelled.
- **Tabs:** A dark segmented group with a stronger selected tile. Selected state uses `aria-pressed` and clear text contrast.

### Cards / Containers

- **Collection card:** One per row, dark filled and hairline bordered. A title, concise context, and state lead; hover is a small tone and border shift. Idea and Project cards carry a square cover at the trailing edge.
- **Timeline card:** The date and rail sit outside the card. Within it, show time or category, title, general location when safe, state, and a square abstract cover at the trailing edge. Keep the cover visible as a compact thumbnail on mobile.
- **Operational panel:** Uses the same charcoal ladder so Event details, tasks, rooms, and ownership controls feel part of one system.
- **Empty state:** A bordered charcoal panel with a semantic icon, explanatory text, and a direct action when one is available.

### Inputs / Fields

- **Standard:** Neutral field, gray border, light text, and a clear 52px high target. On cover-themed creation pages, field fills and borders follow that palette. Hover strengthens the stroke; focus uses the current accent stroke and outline. Labels stay outside the field, and placeholder text remains secondary.
- **Activity title:** An unusually large, border-bottom field on Idea, Event, and Project creation. Validation appears near the affected schedule or field, with semantic alert text. Read-only values lower their contrast without disappearing.
- **Date and time pickers:** A labeled 50px trigger with calendar or clock icon and chevron opens a dark popover. Calendar weekdays and month names follow German or English; selected day and time use a bright tile. Time suggestions run in half-hour steps, with a separate custom-time input. Today, clear, and done controls have text labels. The trigger retains the actual value in a hidden form input, and the popover can open upward when space is tight.

### Navigation

Desktop navigation is one quiet horizontal row at full width. Default links are gray; hover and current route gain chalk text and a charcoal tile. Semantic line icons accompany route labels, with icon color following the current state. Keyboard focus remains visible. The compact menu exposes the same route set and supports Escape to close; language selection keeps its pressed state legible.

### Iconography

A single inline SVG set covers Home, Events, Projects, Ideas, Seasons, people, account, actions, dates, time, location, and navigation. The default rendering is 18px with a 24-unit viewBox, no fill, rounded line joins, and a 1.75-unit stroke. Icons are hidden from assistive technology when adjacent text supplies the name; they support scanning and never replace the visible action label.

### Event Timeline

The date rail, small node, and single card make time easy to scan without claiming dates for unscheduled Events. The current/past switch stays close to the heading. “Interested” remains visually and semantically distinct from “Going”; a pending room never looks confirmed.

### Activity Covers

Six original square abstract images form one shared gallery for Ideas, Events, and Projects. The tone names are teal, plum, slate, blue, amber, and graphite. Render the chosen image decoratively with empty alternative text beside a real title; it must not replace the title or supply factual details. Use the same mapping across collection, detail, and creation views. On creation pages, let the image tone coordinate the full-page palette; on other pages, keep the default charcoal world.

## Do's and Don'ts

### Do:

- **Do** use the charcoal tonal ladder and thin borders to structure content.
- **Do** reserve mint for state, focus, technical detail, and small accents.
- **Do** keep collections in a single reading column and Events in an honest date timeline.
- **Do** use the stable, title-derived abstract cover consistently across an Activity's views.
- **Do** pair semantic SVG icons with readable labels and keep picker dates and times localized.
- **Do** preserve visible focus, readable contrast, reduced-motion behavior, and usable German and English layouts.

### Don't:

- **Don't** imply official school endorsement with a dominant GSO crest or institutional palette.
- **Don't** fill pages with invented attendee photos, speakers, confirmed rooms, or schedules.
- **Don't** use a cover palette as a global category color outside Idea, Event, and Project creation.
- **Don't** make a date or time icon the only cue to operate a picker.
- **Don't** make “Interested” look like registration or Project membership.
- **Don't** replace the white primary action with mint everywhere or build a bright multicolor card wall.
