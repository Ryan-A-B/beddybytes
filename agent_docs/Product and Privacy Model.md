## Product Model

BeddyBytes is for parents monitoring children during sleep using existing devices with modern browsers.

Two runtime roles exist:

- Baby Station: captures audio/video and streams.
- Parent Station: connects to and monitors one or more baby station sessions.

## Privacy Model

Privacy priorities:

- Primary: privacy.
- Secondary: simplicity.

Privacy guarantees (intended behavior):

- No video/audio leaves the home network.
- Backend never receives media payloads.
- No server-side recording.
- Analytics are anonymous.

Data collected by service:

- Email address (account identity).
- Payment processing via Stripe (one-off checkout, no subscription model).

## Recording Behavior

- Recording is initiated on Parent Station.
- Browser `MediaRecorder` captures incoming stream.
- Recording is downloaded immediately to local device.
- Recording is never uploaded to backend.

## Product Constraints

- No STUN/TURN means no off-LAN fallback for media.
- Connection intentionally fails when local-network conditions are not met.

## Operational Reality

Because this is a PWA, users may run cached app versions for weeks before refresh/update. Any migration strategy must tolerate mixed-version clients.
