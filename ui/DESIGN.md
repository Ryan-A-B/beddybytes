---
version: "alpha"
name: "BeddyBytes"
description: "A calm, trustworthy design system for a private household baby monitor."
tokenSource:
  brand: "src/tokens/brand.css"
  alias: "src/tokens/alias.css"
  mapped: "src/tokens/mapping.css"
  responsive: "src/tokens/responsive.css"
---

## Overview

BeddyBytes should feel like practical household technology: calm, private, clear, and dependable. The system should avoid generic SaaS gloss, childish pastels, and heavy medical-device severity. It should make a parent feel oriented quickly, especially in the darker app surfaces used while monitoring.

The CSS token files are the source of truth for concrete values and references. `DESIGN.md` explains why those token groups, aliases, and mapped pairings exist. When a value changes, update the CSS. When the reason or rule changes, update this document.

The design system follows three tiers:

- **Brand:** raw colours, type, scale, font family, and the approved icon set. Brand is the bucket of available values; it does not carry product rationale.
- **Alias:** semantic categories that give raw brand values context, such as primary, info, success, warning, danger, neutral, border-width aliases, border-radius aliases, and icon usage aliases. Alias CSS contains the concrete references; this document explains why those semantic categories exist.
- **Mapped:** component-level application for buttons, fields, panels, alerts, badges, and surfaces. Mapped CSS contains the actual pairings; this document explains the usage rules behind those pairings.

Mapping must not reference Brand directly. Mapped tokens reference Alias. Alias may reference Brand.

The named themes are `dark` for the monitoring app and `light` for marketing. Components do not need to be theme-universal by default; `StarrySky` and `StarryNight` are intended for dark app surfaces.

## Brand

Brand is a rules bucket, not a rationale layer. The Brand gallery and `brand.css` show the actual available colour scales, type primitives, numeric scale, font family, and approved icon names.

Do not use `DESIGN.md` to restate Brand values. That creates drift. If a raw token is added, removed, or changed, make the change in `brand.css` and show it in the Brand gallery.

## Alias

Alias gives raw tokens product meaning. The concrete alias references live in `alias.css`; the rationale lives here.

Avoid one-note blue screens. The palette should pair the dark app identity with mint, gold, coral, sky, and restrained neutrals so the product reads as home-centred rather than enterprise software.

Colour aliases give the raw scales meaning:

- **Primary:** indigo.
- **Info:** sky.
- **Success:** mint.
- **Warning:** gold.
- **Danger:** coral.
- **Neutral:** gray.

Primary uses indigo because the product’s app experience is mostly dark, quiet, and night-friendly. Indigo gives the app a recognisable identity without making the whole interface feel corporate blue.

Info uses sky because informational states should feel clear and helpful rather than urgent. Sky is distinct from the main app indigo while still sitting comfortably near it.

Success uses mint because connection, privacy, and successful setup should feel calm and reassuring. Mint is positive without becoming loud.

Warning uses gold because warnings need attention but should not imply failure or danger. Gold is appropriate for low-light, permissions, and setup reminders where the user can continue after taking care.

Danger uses coral because errors, destructive actions, and connection failures need a clear stop signal. Coral is warmer and less harsh than pure red, which keeps the app from feeling medical or alarmist while still communicating risk.

Neutral uses gray because most app surfaces should stay quiet. Neutral is the base for text, panels, default borders, disabled states, and default dark-mode panes.

Role aliases exist only for station context. Baby station and parent station colours should identify, select, or act as a station role. They should not become general-purpose decoration.

Baby Station uses the indigo family because it should feel tied to the night-monitoring app identity. It is the device near the cot, so its role colour should feel calm, quiet, and app-native.

Parent Station uses the mint family because it represents the watching and connection role. This is a role mapping, not a success mapping. Parent Station may use a different mint step than success does; the important rule is that it sources from the mint scale while remaining semantically separate from success states.

Do not use `success-*` aliases to colour Parent Station UI. Use parent role aliases. Likewise, do not use `primary-*` directly for Baby Station UI. Use baby role aliases.

Icon aliases exist to keep icon use consistent. Station icons identify station roles, permission icons identify browser media access, configuration icons expose station settings and renaming, select icons expose dropdown controls, navigation icons control responsive menus, active-state icons indicate selection, and reassurance icons are reserved for small trust notes.

## Mapped

Mapped tokens are where alias tokens become actual interface pairings. The concrete mapped values live in `mapping.css`; the rationale and rules live here.

Mapped colour roles apply alias categories to interfaces:

- **Text:** heading, body, action, action-hover, disabled, information, and on-action.
- **Icons:** default, action, action-hover, disabled, information, and on-action.
- **Surface:** page, default, action, action-hover, success, warning, information, error, and disabled.
- **Border:** page, default, action, action-hover, success, warning, information, error, disabled, and focus.
- **Role:** baby-station info/action and parent-station info/action. Use role colours only when the UI is choosing, identifying, or operating as a station type.

Mapped role tokens must reference role aliases, not status aliases. Parent Station must map through `role-parent-*`, not `success-*`, even when the concrete value currently comes from the mint scale. Baby Station must map through `role-baby-*`, not direct primary usage.

`light` uses the light mapped values. `dark` inverts that mapping for app use. In dark mode, page surfaces use the deepest primary range with a subtle radial lift. The default dark-mode pane is a neutral surface with high transparency. Default app cards, setup cards, and neutral content panes should use this same default background unless they have a specific mapped status or action purpose. Default borders use reduced opacity so app cards do not become bright outlines.

Readable text/background pairings are part of the mapped layer:

- `text-heading`, `text-body`, and `icon-default` may be used on `surface-page`, `surface-default`, `background-default`, `background-media`, and any role setup panel that aliases `background-default`.
- `text-disabled` may be used only on page/default/media surfaces where the surrounding content is non-critical. Do not use disabled text for permission badges, command labels, or instructional content.
- `text-action` may be used as link text on page/default/media surfaces. Use `text-action-hover` only for hover states.
- `text-on-action` may be used only on `surface-action` and `surface-action-hover`.
- `role-baby-on-action` may be used only on `role-baby-action`; `role-parent-on-action` may be used only on `role-parent-action`.
- On tinted role/status surfaces, prefer heading/body text tokens unless a role/action token has an explicit `on-*` pairing.
- Permission badges use default text on a high-opacity neutral/default surface, not subdued text.

On-action colour is chosen by contrast, not by palette preference. For every non-neutral colour scale, use black text on light-to-mid stops and white text on dark stops. As a working rule for the current scales, stops `100` through `400` use black on-action text, while stops `500` and above use white on-action text. Role mappings may choose a different stop than the generic status/action mapping, but the on-action token must follow the same contrast rule.

Selected options in custom selects are action surfaces. They use the mapped selected-option background and selected-option text tokens so they inherit the same contrast rule as buttons.

Text inputs and select controls share the same mapped input background and border tokens. Do not give selects an opaque surface while text inputs use a translucent one, or vice versa; a form group should read as one control family.

Role colours are carried through the app home prototype:

- Baby station uses `role-baby-info` for the `01` identifier and `role-baby-action` for the baby station command.
- Parent station uses `role-parent-info` for the `02` identifier and `role-parent-action` for the parent station command.
- Role action text uses explicit `role-*-on-action` mapped tokens because baby and parent action surfaces have different contrast needs across themes.
- Media preview surfaces use `background-media`, separate from the page surface and default panel surface.

The Baby Station start screen is the state before the user has approved media access. It uses baby role colours, not success/green action colours. The central setup panel uses `background-role-baby-panel`, which aliases `background-default`; it must have the same neutral transparency as the Baby Station, Parent Station, and info cards on app home. Its border uses `role-baby-border`; its Continue button uses `role-baby-action` and `role-baby-on-action`. The top-right status badges from the reference are intentionally omitted.

The Baby Station live screen is the state after media access has been approved. Configuration actions use `role-baby-action` and `role-baby-on-action`. Neutral station metadata panes use `background-default` with reduced-opacity borders, matching other dark-mode app cards. The bottom configuration sheet uses the same mapped page background with a deterministic `StarryNight` treatment, making it feel like a page-level surface rather than another neutral card.

## Typography

Use Inter or the platform sans fallback. Type should be direct and highly legible on mobile. Letter spacing is always `0`.

Headings can be confident but should not become oversized inside controls, panels, or dense app workflows. Marketing pages may use larger headings than app screens, but the app should favour scan speed and calm hierarchy.

## Layout

Use a named numeric scale for values that need a number: font size, spacing, radius, border width, line height, fixed dimensions, and layout gaps. The concrete scale lives in `brand.css`; contextual use of that scale lives in `alias.css`, `mapping.css`, and `responsive.css`.

Responsive type mappings live in `responsive.css`. Tablet currently follows the desktop type rhythm unless a component or layout needs a tablet-specific adjustment. Line heights should be rounded to the scale and paragraph spacing should remain stable across breakpoints so copy does not feel cramped on mobile.

Mobile layouts should stack early and avoid cramped two-column forms. Desktop layouts can become denser, especially in the app, but status, action, and error areas must remain easy to scan.

The current app home prototype uses a mobile-first order:

- Station action buttons first.
- "How to use BeddyBytes" overview next.
- Video preview next.
- Baby station, parent station, and support notes last.

On desktop, the overview and instruction cards form one left-column stack. The video preview and station action buttons form one right-column stack. The word/logo links to the home overview; the visible nav only contains Baby Station and Parent Station. On mobile, that nav collapses into a burger menu.

The Baby Station start screen keeps the same app shell decisions: no Home item in the nav, the word/logo remains the home link, and Baby Station is the active nav item. It centres a single permission card on desktop and stacks naturally on mobile.

The Baby Station live screen is mobile first and optimised around the video feed. Its first viewport uses a three-row grid: configuration summary, video, then Start and Screen Saver actions. The configuration row spans both columns, the video spans both columns and grows to take available height, and the bottom actions split into two equal columns. The cog opens a bottom sheet so station naming and device selection do not compete with the video.

The app footer is retained across app prototype pages. It carries product attribution on the left and build metadata on the right. It should stay quiet, neutral, and utility-focused; it is not a marketing footer or a place for extra calls to action.

App pages use a full-height content wrapper. The content wrapper owns the first viewport, has a minimum height of one viewport, and lets its main content area grow to fill available space. The footer sits after that wrapper, not inside it, so it starts below the fold when the screen content is short.

The gallery stores state in the route for deep links. Prototype pages live under `/prototypes/*`; theme is carried as `?theme=dark` or `?theme=light` for pages that support them. Prototype pages should render the prototype directly in the right pane without gallery headings or local prototype submenus.

The gallery preview pane must not frame prototype pages. The left side is the menu and owns the right border. The right side should be only the prototype surface, with no gallery padding, border, radius, or wrapper card around it.

## Icons

Use FontAwesome as the UI icon set. The concrete approved icon names live in `brand.css` and the Brand gallery. Alias decides when those icons are used:

- **Station roles:** `baby` and `display` identify baby and parent station roles.
- **Permissions:** `microphone` and `video` are used for browser media access requests and troubleshooting.
- **Configuration:** `gear`, `tag`, and `pen-to-square` are used for station configuration, station naming, and explicit rename actions.
- **Select controls:** `chevron-down` is used on the right edge of custom select controls.
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

Buttons are clear commands with primary, secondary, ghost, and danger variants. Inputs and selects should have visible labels through `FormField`. Alerts must state what happened and, when useful, what the parent can do next.

Panels group related UI without becoming decorative cards. Badges are for state and metadata. `StarrySky` and `StarryNight` create deterministic dark-mode surfaces from `seed` and `count`; the same inputs must render the same star positions. Use higher counts for larger surfaces: around `100` for a full page and `20` to `40` for card-sized surfaces.

## Do's and Don'ts

Do use BeddyBytes' honest boundaries as part of the design language: private, same-home-network monitoring, no subscription, and device flexibility.

Do keep low-light app surfaces calm and legible.

Do test component states on mobile widths.

Don't use Bootstrap class names or visual assumptions in new UI components.

Don't build marketing-only decoration into app primitives.

Don't let the star surface reduce contrast around controls or text.
