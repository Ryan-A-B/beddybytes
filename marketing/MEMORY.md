## Voice - tone, phrasing, writing corrections
Avoid fear-based baby monitor marketing.
Privacy messaging should be strong and precise: BeddyBytes does not relay media, does not store media, and live media never leaves the local network.
Do not default to DIY or hack positioning, though those angles may be explored later.
When describing reused devices, prefer `second life` over `new job` or `new purpose`.
Avoid medical and safety wording.
For broader market messaging, `no subscription` and `quick` are expected to resonate more strongly than privacy alone.
Prefer language that feels personal and direct, like Ryan talking to someone about BeddyBytes, rather than passive or corporate.
In FAQ answers, lead with an immediate `Yes.` or `No.` where possible.
Make testimonials read clearly as customer quotes.

## Process - how I want tasks to be done
Read repo context and `MEMORY.md` before shaping work.
Check and use repo-local skills in `skills/` when relevant.
Treat `context/` as read-only.
Keep `MEMORY.md` current by replacing outdated information in place.
Remove the user from the loop where practical.
Make marketing decisions proactively; Ryan will push back where needed.
Flag meaningful implementation or marketing decisions and provide a brief rationale.
Prefer reusable page patterns to be expressed as composable section components rather than a single tightly constrained wrapper.
Prefer libraries over frameworks, and composable components over a monolith with configuration dials.
Use Google Search Console data when available.
Do not use Google Analytics for this project because it conflicts with the privacy positioning.
Prefer approaches that reduce user manual involvement when practical.

## Projects - active work, current tasks, status
BeddyBytes is a privacy-first baby monitor that streams video and audio only over the local network using WebRTC without STUN or TURN, so remote access is intentionally impossible.
BeddyBytes uses devices people already own, giving them a second life.
There are two roles: baby station and parent station.
Both roles require a modern browser with WebSockets and WebRTC; the baby station requires a microphone and can optionally use a camera.
Ryan is the sole developer and can make website and product changes quickly.
The marketing site is `beddybytes.com`; the public repo is `https://github.com/Ryan-A-B/beddybytes`.
Primary focus is SEO.
Core SEO objective is top-3 rankings for terms related to `private baby monitor`.
Target markets are English-speaking Western countries: US, UK, Australia, and New Zealand.
Core audiences are privacy-conscious families and tech-savvy parents.
Primary differentiators are smart but private, no subscription, and reuse of existing devices.
BeddyBytes has been live for about 18 months.
Primary SEO conversion goal is purchase.
Pricing: one-year access is $35 with a standing 50% discount to $17.50; lifetime is $55 with a standing 50% discount to $27.50.
There is no trial.
Refund policy is 30 days, no questions asked.
The current funnel is CTA to pricing, pricing to Stripe, successful checkout to after-checkout, then link to the app.
Google Search Console is configured; Bing Webmaster Tools is not set up yet.
Current SEO visibility is effectively nonexistent beyond branded searches; initial last-28-day GSC data confirms visibility is still almost entirely branded.
Historically, the home page and `/baby-monitor-without-wifi/` converted relatively well; the main problem is top-of-funnel traffic.
Existing marketing content includes the home page, pricing, about, blog index, blog posts, feature pages for video, recording, and camera zoom, plus the `baby monitor without wifi` landing page.
Comparison content is starting from zero.
The primary money page is pricing.
The user is willing to create content aggressively and needs progress without a large budget.
Future SEO directions may include self-hosted and open-source positioning.
Testimonials exist on the pricing page.
A Reddit launch post on `r/SideProject` previously drove some traffic.
Available proof assets include screenshots, a short demo video, and an hours-monitored counter.
Accounts are required because the backend handles signaling and separates devices and sessions.
Important positioning nuance: internet is required to establish the WebRTC connection because signaling uses the backend, but usage is minimal, on the order of tens of kilobytes; live media still never leaves the local network.
Support emails or messages exist and can be mined for objections and language; the support email source has already been converted into markdown for easier analysis.
Near-term competitor context includes non-Wi-Fi radio monitors and the need to educate buyers that Wi-Fi can still be private when media never leaves the local network.
Customer objections are not yet known.
Sales mix is roughly 60:40 in favor of lifetime purchases, which is also the preferred offer.
Refund rate is currently 9 out of 92 total sales, with at least one refund caused by confusion about whether purchase is required per device.
BeddyBytes works across iOS and Android, unlike some competing local or Wi-Fi baby monitor apps that only support one ecosystem.
Purchases are mostly from the United States, with meaningful worldwide distribution including Australia, the UK, Brazil, South Africa, Croatia, Sweden, Romania, the Netherlands, and Estonia.
Technical realities to communicate carefully: most browsers should work, battery drain is heavier on the baby station, and the baby station device is effectively dedicated while in use.
Setup flow: on the baby-station device, the user gives it a name, selects microphone and camera, and clicks start; those settings are remembered between sessions. On the parent-station device, opening the parent station auto-connects when a session is available, and a dropdown is used to switch if multiple sessions exist. There is no limit on active baby stations or parent stations.
Because BeddyBytes does not relay or store media, backend costs stay low and support the `no subscription` angle as a secondary benefit.
Search Console service-account access is configured and working in the SEO repo.

## Output - formats, naming, delivery preferences
SEO work should stay focused on ranking outcomes and purchases.

## Tools - which tools to use and how
Use Google Search Console data when available.
Do not use Google Analytics for this project because it conflicts with the privacy positioning.
Prefer approaches that reduce user manual involvement when practical.
