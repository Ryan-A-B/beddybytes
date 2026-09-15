---
version: "alpha"
name: "BeddyBytes"
description: "A calm, trustworthy design system for a private household baby monitor."
tokenSource:
  brand: "src/tokens/brand.css"
  alias: "src/tokens/alias.css"
  mapped: "src/tokens/theme/dark.css"
  responsive: "src/tokens/responsive.css"
---

## Overview

BeddyBytes should feel like practical household technology: calm, private, clear, and dependable. The system should avoid generic SaaS gloss, childish pastels, and heavy medical-device severity. It should make a parent feel oriented quickly, especially in the darker app surfaces used while monitoring.

The CSS token files are the source of truth for concrete values and references. `DESIGN.md` explains why those token groups, aliases, and mapped pairings exist. When a value changes, update the CSS. When the reason or rule changes, update this document.

The design system follows three tiers:

- **Brand:** raw colors, type, numeric scale, and font family. Brand is the bucket of available values; it does not carry product rationale.
- **Alias:** semantic categories that give raw brand values context, such as primary, info, success, warning, danger, neutral, baby, parent, spacing, type, radius, border-width, and shadow aliases. Alias CSS contains the concrete references; this document explains why those semantic categories exist.
- **Mapped:** product and component application for text, actions, inputs, panels, badges, surfaces, roles, and atmospheric app treatments. The active dark mapping lives in `src/tokens/theme/dark.css`; this document explains the usage rules behind those pairings.

Mapping should reference Alias rather than Brand directly. Alias may reference Brand.

The app bundle is currently locked to `dark`. Marketing is intended to be locked to `light`, but the light theme has not been implemented yet and marketing prototype work is intentionally disabled in the gallery. Components do not need to be theme-universal by default; `StarrySky` and `StarryNight` are intended for dark app surfaces.

## Brand

Brand is a rules bucket, not a rationale layer. The Brand gallery and `brand.css` show the actual available color scales, type primitives, numeric scale, and font family.

Do not use `DESIGN.md` to restate Brand values. That creates drift. If a raw token is added, removed, or changed, make the change in `brand.css` and show it in the Brand gallery.

## Alias

Alias gives raw tokens product meaning. The concrete alias references live in `alias.css`; the rationale lives here.

Avoid one-note blue screens. The palette should pair the dark app identity with mint, gold, coral, sky, and restrained neutrals so the product reads as home-centered rather than enterprise software.

Color aliases give the raw scales meaning:

- **Primary:** indigo.
- **Info:** sky.
- **Success:** mint.
- **Warning:** gold.
- **Danger:** coral.
- **Neutral:** gray.

Primary uses indigo because the product’s app experience is mostly dark, quiet, and night-friendly. Indigo gives the app a recognizable identity without making the whole interface feel corporate blue.

Info uses sky because informational states should feel clear and helpful rather than urgent. Sky is distinct from the main app indigo while still sitting comfortably near it.

Success uses mint because connection, privacy, and successful setup should feel calm and reassuring. Mint is positive without becoming loud.

Warning uses gold because warnings need attention but should not imply failure or danger. Gold is appropriate for low-light, permissions, and setup reminders where the user can continue after taking care.

Danger uses coral because errors, destructive actions, and connection failures need a clear stop signal. Coral is warmer and less harsh than pure red, which keeps the app from feeling medical or alarmist while still communicating risk.

Neutral uses gray because most app surfaces should stay quiet. Neutral is the base for text, panels, default borders, disabled states, and default dark-mode panes.

Role aliases exist only for station context. Baby station and parent station colors should identify, select, or act as a station role. They should not become general-purpose decoration.

Baby Station uses the indigo family because it should feel tied to the night-monitoring app identity. It is the device near the crib, so its role color should feel calm, quiet, and app-native.

Parent Station uses the mint family because it represents the watching and connection role. This is a role mapping, not a success mapping. Parent Station may use a different mint step than success does; the important rule is that it sources from the mint scale while remaining semantically separate from success states.

Do not use `success-*` aliases to color Parent Station UI. Use parent role aliases. Likewise, do not use `primary-*` directly for Baby Station UI. Use baby role aliases.

Icon aliases exist to keep icon use consistent. Station icons identify station roles, permission icons identify browser media access, configuration icons expose station settings and renaming, select icons expose dropdown controls, session controls show compact monitoring actions, video controls operate live streams, navigation icons control responsive menus, active-state icons indicate selection, and reassurance icons are reserved for small trust notes.

Session control aliases exist for monitoring controls that are compact but persistent. Timer, play, and restart icons should be used together when the UI is showing elapsed session time or a listening control group.

Video control aliases exist for controls that operate the live video itself. Record, volume, mute, full-screen, and picture-in-picture icons should stay grouped at the bottom edge of the video rather than scattered around the page.

## Mapped

Mapped tokens are where alias tokens become actual interface pairings. The concrete mapped values for the app live in `theme/dark.css`; the rationale and rules live here.

Mapped color roles apply alias categories to interfaces:

- **Text:** heading, text, subdued, disabled, action, action-hover, info, and on-action.
- **Icons:** use the same mapped color utilities as text unless a component has a stricter role-specific rule.
- **Surface:** page, canvas, surface, raised, muted, media, status-soft, action-soft, and input.
- **Border:** border, border-strong, input-border, input-border-hover, status borders, role borders, and focus.
- **Role:** baby info/action and parent info/action. Use role colors only when the UI is choosing, identifying, or operating as a station type.

Mapped role tokens must reference role aliases, not status aliases. Parent Station maps through `parent-*`, not `success-*`, even when the concrete value currently comes from the mint scale. Baby Station maps through `baby-*`, not direct primary usage.

`dark` is the only active mapped theme today. In dark mode, page surfaces use the deepest primary range with a subtle radial lift. The default dark-mode pane is a neutral surface with high transparency. Default app cards, setup cards, and neutral content panes should use this same default background unless they have a specific mapped status or action purpose. Default borders use reduced opacity so app cards do not become bright outlines.

Readable text/background pairings are part of the mapped layer:

- `text-heading`, `text-text`, and default icon color may be used on `bg-page`, `bg-surface`, `bg-muted`, `bg-media`, and neutral role setup panels.
- `text-disabled` may be used only on page/default/media surfaces where the surrounding content is non-critical. Do not use disabled text for permission badges, command labels, or instructional content.
- `text-action` may be used as link text on page/default/media surfaces. Use `text-action-hover` only for hover states.
- `text-on-action` may be used only on `bg-action` and `bg-action-hover`.
- `text-baby-on-action` may be used only on `bg-baby-action`; `text-parent-on-action` may be used only on `bg-parent-action`.
- On tinted role/status surfaces, prefer heading/body text tokens unless a role/action token has an explicit `on-*` pairing.
- Permission badges use default text on a high-opacity neutral/default surface, not subdued text.

On-action color is chosen by contrast, not by palette preference. For every non-neutral color scale, use black text on light-to-mid stops and white text on dark stops. As a working rule for the current scales, stops `100` through `400` use black on-action text, while stops `500` and above use white on-action text. Role mappings may choose a different stop than the generic status/action mapping, but the on-action token must follow the same contrast rule.

Selects are native browser controls styled to match text inputs. Do not replace them with a custom listbox unless the full keyboard, focus-management, and assistive-technology interaction pattern is implemented.

Text inputs and select controls share the same mapped input background and border tokens. Do not give selects an opaque surface while text inputs use a translucent one, or vice versa; a form group should read as one control family.

Role colors are carried through the app home prototype:

- Baby station uses `baby-info` for its role icon treatment and `baby-action` for the baby station command.
- Parent station uses `parent-info` for its role icon treatment and `parent-action` for the parent station command.
- Role action text uses explicit `baby-on-action` and `parent-on-action` mapped tokens, exposed as `text-baby-on-action` and `text-parent-on-action` utilities, because baby and parent action surfaces have different contrast needs across themes.
- Media preview surfaces use `background-media`, separate from the page surface and default panel surface.

The Baby Station start screen is the state before the user has approved media access. It uses baby role colors, not success/green action colors. The central setup panel uses the neutral surface treatment; it must have the same neutral transparency as the Baby Station, Parent Station, and info cards on app home. Its media-access icon and permission copy use `baby-info`; its Continue button uses `baby-action` and `baby-on-action`. The top-right status badges from the reference are intentionally omitted.

The Baby Station live screen is the state after media access has been approved. Configuration actions use `baby-action` and `baby-on-action`. On desktop, station name, microphone, and camera are shown as an inline form above the video with icons inside the controls and no surrounding panel. On mobile and tablet, a compact configuration summary opens a bottom sheet so station naming and device selection do not compete with the video. The bottom configuration sheet uses the same mapped page background with a deterministic `StarryNight` treatment, making it feel like a page-level surface rather than another neutral card.

## Typography

Use Inter or the platform sans fallback. Type should be direct and highly legible on mobile. Letter spacing is `0` by default. Exceptions must be explicit component treatments, such as compact uppercase status badges.

Headings can be confident but should not become oversized inside controls, panels, or dense app workflows. Marketing pages may use larger headings than app screens, but the app should favor scan speed and calm hierarchy.

## Layout

Use a named numeric scale for values that need a number: font size, spacing, radius, border width, line height, fixed dimensions, and layout gaps. The concrete scale lives in `brand.css`; contextual use of that scale lives in `alias.css`, `theme/dark.css`, and `responsive.css`.

Tailwind utilities are preferred inside React components. Direct `var(...)` usage and arbitrary Tailwind values such as `grid-cols-[...]` are a smell in component markup. Reusable component behaviors should become component APIs or named utilities; static page-specific grid templates, grid areas, gradients, and geometry should live in a local CSS file for that prototype or page.

All normal page content uses the shared `.container` class. That includes navigation content, main page content, sheets that behave like page sections, and footer content. Full-bleed backgrounds can extend to the viewport edge, but readable and interactive content should sit inside the container. Mobile widths are fluid with side gutters; tablet and desktop widths step through fixed maximum content widths so pages do not drift into arbitrary one-off `max-width` values.

Responsive type mappings live in `responsive.css`. Tablet currently follows the desktop type rhythm unless a component or layout needs a tablet-specific adjustment. Line heights should be rounded to the scale and paragraph spacing should remain stable across breakpoints so copy does not feel cramped on mobile.

Mobile layouts should stack early and avoid cramped two-column forms. Desktop layouts can become denser, especially in the app, but status, action, and error areas must remain easy to scan.

The current app home prototype uses a mobile-first order:

- Station action buttons first.
- "How to use BeddyBytes" overview next.
- Video preview next.
- Baby station, parent station, and support notes last.

On desktop, the overview and instruction cards form one left-column stack. The video preview and station action buttons form one right-column stack. The word/logo links to the home overview. The app nav contains Baby Station and Parent Station; the selected page uses a top-flush translucent gradient block background rather than pill tabs. On mobile, that nav collapses into a burger menu.

The Baby Station start screen keeps the same app shell decisions: no Home item in the nav, the word/logo remains the home link, and Baby Station is the active nav item. It centers a single permission card on desktop and stacks naturally on mobile.

The Baby Station live screen is mobile first and optimized around the video feed. On mobile and tablet, its first viewport uses a three-row grid: configuration summary, video, then Start and Screen Saver actions. The configuration row spans both columns, the video spans both columns and grows to take available height, and the bottom actions split into two equal columns. The cog opens a bottom sheet for station naming and device selection. On desktop, the cog and summary row are removed and the inline configuration form sits directly above the video.

The Parent Station waiting screen is the state before a baby station has appeared. It keeps the same app shell and puts connection status, station-empty messaging, and elapsed session controls in the center of the viewport. Ready and stream badges are compact status indicators; they should not compete with the primary message. Use `Ready / to connect` when no baby station stream is connected, `Ready / connected` when a stream is connected, `Stream / waiting` before the WebRTC stream is live, and `Stream / live` when the baby station stream is connected. The timer groups elapsed time with listening actions so parents can see whether the parent station is actively waiting without reading a larger panel.

The Parent Station live screen is the state after selecting or discovering an active baby station. The video is the primary content and should take as much of the first viewport as possible. The station bar above the video uses a select so homes with multiple baby stations can switch context without leaving the page. When only one baby station is available, the caret may use disabled text color to signal that switching is not currently useful while keeping the same control shape. Stream status badges sit over the top edge of the video. On mobile, Ready sits on the left and Stream sits on the right; from tablet up, both badges are grouped to the right. The timer remains outside the video in the station bar.

Live video controls sit along the bottom of the video: record, volume or mute, full screen, and picture in picture. Do not place a separate zoom control in the top-right corner of the video.

The app footer is retained across app prototype pages. It carries product attribution on the left and build metadata on the right. It should stay quiet, neutral, and utility-focused; it is not a marketing footer or a place for extra calls to action.

App pages use a full-height content wrapper. The content wrapper owns the first viewport, has a minimum height of one viewport, and lets its main content area grow to fill available space. The footer sits after that wrapper, not inside it, so it starts below the fold when the screen content is short.

The gallery stores state in the route for deep links. Prototype pages live under `/prototypes/*`. There is no runtime theme switcher and no `data-theme`; the current UI bundle imports the dark app theme directly. Marketing remains listed in the prototype navigation but disabled until the light theme and marketing bundle are ready. Prototype pages should render the prototype directly in the right pane without gallery headings or local prototype submenus.

The gallery preview pane must not frame prototype pages. The left side is the menu and owns the right border. The right side should be only the prototype surface, with no gallery padding, border, radius, or wrapper card around it.

## Icons

Use FontAwesome as the UI icon set. The current approved icon names are shown in the Brand gallery. Alias decides when those icons are used:

- **Station roles:** `microphone` and `display` identify baby and parent station role panels in the current app prototype. The `baby` icon may remain in the gallery as a possible future role icon, but it is not the current app treatment.
- **Permissions:** `microphone` and `video` are used for browser media access requests and troubleshooting.
- **Configuration:** `gear`, `tag`, and `pen-to-square` are used for station configuration, station naming, and explicit rename actions.
- **Select controls:** `chevron-down` is used as a decorative affordance on the right edge of native select controls.
- **Session controls:** `clock`, `play`, and `rotate-right` are used for compact monitoring session controls.
- **Video controls:** `circle`, `volume-high`, `volume-xmark`, `expand`, and `picture-in-picture` are used for live stream controls.
- **Navigation:** `bars` and `xmark` are used for mobile menu open and close controls.
- **Active states:** `circle-dot` uses the regular style to indicate a selected navigation item or mode.
- **Reassurance:** `wand-magic-sparkles` is reserved for small trust notes and should not become general decoration.

Use solid icons by default. Use regular icons for active/selected states where FontAwesome provides a suitable regular icon.

## Elevation & Depth

Depth should be quiet. Use soft shadows for raised panels and menus. In dark mode, use border contrast and subtle glow more often than large shadows. In light mode, use shadows sparingly so pages stay clean and readable.

`StarrySky` is an atmospheric surface for the app, not a decorative layer for every screen. It should support focus rather than compete with controls.

## Shapes

Use modest radii:

Use border width aliases `none`, `sm`, `md`, and `lg`. Use border radius aliases `0`, `50`, `100`, and `200`.

Avoid pill-shaped controls except for badges and compact status chips. Cards should not be nested inside cards.

## Components

`Button` is for clear text or icon+text commands. Its public API is intentionally narrow: `variant`, `size`, `full_width`, and normal button attributes. `variant` is required and currently supports `primary`, `baby-action`, `parent-action`, and `secondary`. `primary` maps to the same action treatment as Baby Station for now so marketing can use a generic primary command without inventing a new visual language. Role-specific app commands should use `baby-action` or `parent-action`. `Button` owns its sizing, focus, disabled, loading, border, background, text, and hover styles; call sites should not layer extra styling to recreate button variants.

`IconButton` is for icon-only commands and keeps its own icon-specific variants: `ghost`, `secondary`, and `danger`. Do not use `Button` with hidden text as a substitute for an icon-only command.

Text inputs and selects share the same control family. They use mapped input background and border tokens, the shared `focus-ring` utility, and consistent height/radius. Labels may be visible, screen-reader-only, or represented by a leading icon depending on layout density, but the accessible label must remain present. Alerts must state what happened and, when useful, what the parent can do next.

Panels group related UI without becoming decorative cards. Badges are for state and metadata. `StarrySky` and `StarryNight` create deterministic dark-mode surfaces from `seed` and `count`; the same inputs must render the same star positions. Use higher counts for larger surfaces: around `100` for a full page and `20` to `40` for card-sized surfaces.

`ConnectionStatusBadge` is for compact monitoring connection state. It should use parent role information color for Ready/connected states because the Parent Station is ready to accept or maintain connections. Stream live states use baby role information color because the stream is the baby station feed. Waiting and idle states stay neutral so they do not read as success or failure. Avoid protocol labels such as MQTT in user-facing badges.

`SessionTimer` is for compact elapsed monitoring time plus session actions. It uses the parent role action mapping for the play control because it operates the Parent Station listening role, not a generic success action.

`VideoControls` is for live video command clusters. It belongs on the video surface itself, normally aligned to the bottom center over a dark gradient so controls remain readable without covering the main view.

## Do's and Don'ts

Do use BeddyBytes' honest boundaries as part of the design language: private, same-home-network monitoring, no subscription, and device flexibility.

Do keep low-light app surfaces calm and legible.

Do test component states on mobile widths.

Don't use Bootstrap class names or visual assumptions in new UI components.

Don't build marketing-only decoration into app primitives.

Don't let the star surface reduce contrast around controls or text.
