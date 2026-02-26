# BeddyBytes Brand Reference (Working Draft)

## Use This Reference

Use this file for BeddyBytes SEO strategy and copywriting. Treat it as the first reference to load before `strategy.md` and `copywriting.md`.

If the user provides newer product/brand details, prefer those details and update this file.
Treat `HowBeddyBytesWorks2.md` as the most detailed technical explanation currently available.

## Product Snapshot (Current Working Facts)

- Brand: `BeddyBytes`
- Product type: Privacy-focused baby monitor webapp
- Category: Baby monitoring / parent tech / home monitoring software
- Core angle: Help caregivers check in on baby while prioritizing privacy and trust
- Hero positioning used on homepage: `The privacy-first baby camera`
- Core promise used across site: images/videos stay on user devices (local-only media path)

## Messaging Priorities

Prioritize this order in copy unless the page goal requires a different order:

1. Reassure on privacy and trust
2. Explain practical monitoring value (what parents can do)
3. Reduce setup/usage friction
4. Present CTA

## Confirmed Public Claims (from marketing site)

- Uses existing devices (phone/tablet/laptop) with a browser
- Video and audio monitoring
- Audio-only mode
- Recording is local to the user's device (downloads folder)
- Multiple parent stations can monitor at the same time
- Unlimited baby stations and unlimited parent stations (pricing section claim)
- Local-only streaming (pricing / feature messaging)
- One purchase per account gives access across devices
- 30-day refund guarantee
- Uses Stripe-hosted checkout for payments

## Confirmed Public Pricing (marketing code)

- `1 year access`: `$35`
- `Lifetime access`: `$55`
- Permanent promotion currently active: `50% off` coupon code (confirm exact code before publishing code-specific copy)

Pricing and promotion codes are configurable in the site, so confirm current live values before publishing time-sensitive pricing copy.

## Likely Audience Segments

- New parents comparing baby monitor options
- Privacy-conscious parents avoiding always-on cloud-first products
- Families wanting a web-based or app-flexible monitoring experience
- Gift shoppers researching trusted baby tech (secondary)

## Search Intent Themes To Target

### Commercial / Transactional

- privacy baby monitor
- secure baby monitor app
- baby monitor without cloud (only use if technically true)
- web-based baby monitor
- baby monitor for travel

### Informational

- how to choose a secure baby monitor
- baby monitor privacy concerns
- how baby monitors work (privacy / networking angle)
- local-only baby monitor vs cloud baby monitor
- what to look for in a baby monitor app
- baby monitor setup tips

Do not claim support for any feature unless confirmed by the user.

## Positioning Angles (Choose One Per Page)

- Privacy-first monitoring for modern parents
- Practical baby monitoring without unnecessary data exposure
- Flexible baby monitoring experience with trust built in
- Simpler monitoring workflow with clear privacy expectations
- Reuse your devices for private baby monitoring (privacy + sustainability)
- Travel-friendly baby monitoring using devices you already carry

Avoid stacking every angle into one page. Pick the strongest angle for the query.

## Technical Architecture Notes (from `HowBeddyBytesWorks2.md`)

Use these to support educational content, trust pages, and technical FAQs.

- WebRTC is used for encrypted peer-to-peer browser-to-browser media streaming.
- BeddyBytes is configured with no STUN/TURN servers (per article draft).
- If devices cannot connect locally, the stream fails; there is no relay fallback.
- Backend role during streaming:
  - session creation/listing
  - WebSocket signalling
  - signalling message relay (SDP offers/answers + ICE candidates)
  - account auth / session separation / license validation
- Backend does not receive media payloads (video/audio) and does not store recordings.
- Recording uses browser `MediaRecorder` on the Parent Station and saves to downloads.
- Zoom/video transformation is performed locally in-browser (canvas pipeline on Baby Station).
- Session behavior (clarified):
  - Session list projection forgets completed sessions (user-facing behavior is ephemeral)
  - Session events are still written to a persistent event store (technical persistence exists)
- Reconnect attempts use signalling only; backend still does not carry media.

## Offline Mode Roadmap (Planned)

- Future full offline mode is planned via user self-hosted MQTT server on the local network.
- Current messaging should avoid implying this exists today unless explicitly marked as planned/future.

## Confirmed Platform Support (tested by user)

- iOS Safari
- Android Chrome
- Desktop browsers (tested)

Use compatibility-page language for requirements and avoid over-claiming unsupported/untested browsers.

## Threat Model Messaging (from article draft)

Prefer explicit and bounded privacy language:

- Stronger framing:
  - "No central media repository to breach"
  - "No video relayed through our servers"
  - "No server-side recording storage"
- Bounded limitations (good trust copy):
  - Does not protect against compromised home network
  - Does not protect against malware on user devices
  - Does not protect against someone with physical access to hardware

Use this structure in trust content: what is protected, what is not, and why the tradeoff exists.

## Copy Guardrails (BeddyBytes)

- Avoid fear-based copy that overstates risks.
- Avoid absolute security claims like "100% secure" or "unhackable."
- Prefer precise phrasing such as:
  - "privacy-focused"
  - "designed with privacy in mind"
  - "clear privacy controls" (only if true)
  - "minimizes unnecessary data sharing" (only if true)
- Avoid medical, sleep-training, or safety guarantees.
- Do not imply the product replaces active caregiver supervision.
- Be careful with absolute phrases currently used on site like "guaranteed privacy" unless you intentionally want that marketing tone.

## Proof Elements To Request From User

Before finalizing high-conviction copy, ask for any available proof:

- Feature list
- Platform support (web/iOS/Android)
- Privacy architecture summary
- Encryption / storage details
- Pricing and plan structure
- Testimonials or user quotes
- Any substantiation for monitored-hours claim if using it in new pages (current approved claim: `20,000+ hours monitored`)
- Setup steps / time-to-first-use
- Screenshots or UI highlights

## CTA Direction (Examples)

Use the CTA that matches the page and funnel stage:

- `Try BeddyBytes`
- `Use Baby Monitor` (current primary CTA; links to pricing/buy flow)
- `Start monitoring with BeddyBytes`
- `See how BeddyBytes works`
- `Compare privacy features`
- `Get early access` (only if applicable)

## SEO Deliverables For BeddyBytes (Default)

When the user asks broadly for "SEO strategy and copy" for BeddyBytes, return:

1. Target query + intent summary
2. Page angle and differentiation
3. Metadata (title/meta/H1)
4. Recommended outline
5. Draft copy
6. FAQ section
7. Internal link ideas
8. Assumptions / facts to verify

## Known Messaging Inconsistencies To Resolve Before Publishing Technical SEO Content

The current site and the new technical article differ in places. Ask which source is authoritative for new copy:

- FAQ says internet is used because "the easiest way" is a remote server for discovery and mentions future ability to connect without internet.
- Article says WebRTC is configured with no STUN/TURN and local-only connection path, with no cloud relay fallback.
- Some pages use strong absolutes (`guaranteed privacy`, `completely private`), while the article presents a more precise threat-model-based explanation.

For trust/technical pages, prefer the article's explicit architecture and threat-model language unless the user says otherwise.

## Current Authoritative Clarifications (user-confirmed)

- `No STUN/TURN` is true in production and intended to remain true.
- Full offline mode is future/planned and will require users to self-host an MQTT server on their local network.
- Session history is technically persisted in an event store, but completed sessions are removed from the session-list projection (user-visible ephemerality).
- Supported/tested platforms include iOS Safari, Android Chrome, and desktop browsers.
- Current pricing remains `$35` yearly and `$55` lifetime, with a permanent `50% off` coupon active.
- Monitored-hours social proof claim can be updated to `20,000+ hours monitored`.
- Primary conversion CTA is `Use Baby Monitor`, which sends users to pricing to purchase.
