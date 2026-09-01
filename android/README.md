# BeddyBytes Android

Native Android Baby Station client for BeddyBytes.

The current project contains the installable shell, native authorization, MQTT discovery and signalling, WebRTC transmission, and the first Baby Station screen. The screen uses Camera2 directly for preview and low-light exposure control, can target the preferred physical sensor behind a logical camera, and displays an eight-frame rolling grayscale average during manual low-light capture. It discovers the device's cameras and microphones, persists its compact immediate-apply settings, and implements the idle, running, and screen-saver presentation states. Foreground service behavior and Do Not Disturb arrive in later phases.

Authorization uses the existing BeddyBytes password and refresh grants without backend changes. Access tokens and account details remain in memory. The rotating refresh cookie is encrypted with an app-owned Android Keystore key, and sign out is local because the existing backend does not route a logout endpoint.

MQTT connects directly to the existing AWS IoT Core custom domain using MQTT 3.1.1 over secure WebSocket. It passes a fresh access token in the `access_token` handshake query parameter on every connection attempt. A persistent app-generated client ID scopes the connection, while connection and request IDs change on every reconnect. The client publishes connected and clean/Last-Will status, subscribes to parent announcements and its future WebRTC inbox, announces the running Baby Station, responds through each parent's control inbox, and re-announces after reconnect. Protocol traffic uses QoS 1, clean sessions, a 30-second keepalive, and non-retained messages.

The manifest grants WebRTC the normal `ACCESS_NETWORK_STATE` and `CHANGE_NETWORK_STATE`
permissions required by its Android network monitor. These permissions are granted at install time
and do not show a runtime permission prompt.

The MQTT transport pins `com.hivemq:hivemq-mqtt-client:1.4.0`. The Maven Central JAR used for provenance review has SHA-256 `22cb6148254e14a391818c08f6d4769294a61de7fa2c44fe3e20b03089a4be0f` and is licensed under Apache-2.0.

WebRTC pins `io.github.webrtc-sdk:android:144.7559.14`. Its official `libwebrtc.aar` has SHA-256 `44c243bb0c6ac5b0a4425e6211f7994b0d60df3cf2f5721c20c6a88aa1a68f64`, maps to upstream WebRTC revision `df1011beabae993c555f7c11a7a4b8e8fa62480d`, and contains native libraries for `arm64-v8a`, `armeabi-v7a`, `x86`, and `x86_64`. Version `144.7559.12` is the designated rollback. The wrapper is MIT licensed and WebRTC is BSD-3-Clause; see `THIRD_PARTY_NOTICES.md`. The AAR does not embed its upstream third-party license bundle, so the complete transitive notice audit remains a release-readiness task.

## Requirements

- Docker with Linux container support
- A POSIX shell (`sh`), available by default on Linux and macOS and through WSL or Git Bash on Windows
- Network access for the first image and dependency download

No host JDK, Android SDK, Gradle installation, or Android Studio installation is required to build.

The container keeps both its Gradle user cache and project cache under `.gradle-docker/`. This prevents host-side Gradle metadata, including absolute paths, from being restored inside `/workspace`.

The build uses a pinned `linux/amd64` container. Docker hosts on ARM need amd64 emulation enabled.

## Build and check

From the repository root:

```sh
./scripts/android/build-debug.sh
./scripts/android/check.sh
```

The debug APK is written to:

```text
android/app/build/outputs/apk/qa/debug/app-qa-debug.apk
```

The canonical debug build uses the `qa` flavor and connects to `api.qa.beddybytes.com` and `mqtt.qa.beddybytes.com`.

For an MQTT/WebRTC smoke test, install the QA debug APK, sign in, and press Start. A browser parent
station on the same account should discover the Android Baby Station and receive its selected
microphone. The current confirmation build creates and attaches only the WebRTC audio track, while
the camera preview and low-light processing continue locally without a video track. Multiple browser
parents may connect independently. Turning Wi-Fi off and
back on should show the reconnecting state and then re-announce the same station session. Stop
should remove it cleanly and end every peer connection.

When video transmission is re-enabled after the audio-only diagnostic, it initially uses the
existing Camera2 YUV stream, capped at 10 fps. As soon as
the rolling low-light processor has accumulated a complete stack, WebRTC switches to the same
brightened grayscale output displayed in the local preview. RAW-capable cameras use the eight-frame
RAW stack at its one-frame-per-second update rate; other cameras use the YUV rolling stack. If the
processor is withdrawn, WebRTC resumes the Camera2 feed. This keeps one camera owner and preserves
the manual exposure controls. Debug builds additionally persist the RAW source frames as DNG files;
that recording is diagnostic and is not required for production RAW processing.

Each Start in a debug build also creates
`Android/data/com.beddybytes.android.qa.debug/files/station-sessions/<session>/events.jsonl`.
The JSON Lines file records the app/device/host header, session lifecycle, MQTT connections,
subscriptions, reconnect timing, disconnects, WebRTC offers/answers/candidates and peer states,
redacted SDP media structure, the previous Android process-exit reason, and inbound/outbound message
topic, type, and byte count. It does not record access tokens, SDP bodies, ICE candidate values, or
MQTT payload bodies. When Android exposes an exit trace, the first session after an app restart also
writes a bounded `previous-process-trace.txt` beside the event log. The same JSON lines are available
in Logcat under the `BeddyBytesSession` tag while the phone is attached.

During low-light development, each press of Start in a debug build creates an app-specific
`files/camera-sessions/<camera-and-start-time>/` directory. Until Stop is pressed, the session
records `telemetry.csv` once per second and a full-resolution RAW DNG frame once per second under
`raw/`; `session.txt` and `raw-frames.csv` describe the session and individual frames. Preview and
on-screen telemetry continue while stopped, but nothing is persisted.

On a RAW-capable camera, the running preview changes to an eight-frame rolling RAW stack once the
first eight manual low-light frames have arrived. The stack uses the camera's reported black level,
combines each 4×4 group of sensor photosites before mapping to 8-bit grayscale, and automatically
lifts the result. It then refreshes once per newly captured RAW frame. Automatic exposure probe
frames are excluded so they cannot contaminate the stack.

After Stop, wait for `Saving RAW…` to disappear before copying a session from the phone. A completed
session contains `raw_finalized_utc` in `session.txt` and `recording_stopped=true` at the end of
`raw-frames.csv`. For `qaDebug`, these files are beneath Android's app-specific directory for
`com.beddybytes.android.qa.debug`.

Run a clean image and empty dependency-cache verification with:

```sh
./scripts/android/verify-clean.sh
```

Pass any Gradle task through the container with:

```sh
./scripts/android/gradle.sh tasks
./scripts/android/gradle.sh :app:bundleProdRelease
```

The release bundle is unsigned until release signing material is supplied at runtime. Signing keys and credentials must never be copied into the container image or committed to the repository.

## Build variants

| Flavor | Application ID | Purpose |
| --- | --- | --- |
| `local` | `com.beddybytes.android.local` | Existing local BeddyBytes stack |
| `qa` | `com.beddybytes.android.qa` | Existing QA deployment |
| `prod` | `com.beddybytes.android` | Production and Play closed testing |

Debug builds add a final `.debug` application ID suffix so local, QA, and production shells can coexist on a device. `build-debug.sh`, `check.sh`, CI, and clean verification use `qaDebug`; build another flavor explicitly through `scripts/android/gradle.sh` when required.

## Local API trust on a phone

The local debug variant permits certificates issued by a CA installed by the phone's user. Release variants continue to trust only system CAs, and cleartext HTTP is disabled in every variant.

To use the unchanged local backend from a Galaxy S22:

1. Make `api.beddybytes.local` resolve on the phone to the machine running the local stack. This is normally a local DNS/router entry; an entry in the development machine's hosts file does not affect the phone.
2. Install the mkcert root CA that signed the existing `beddybytes.local` certificate on the phone as a CA certificate. Never install or transfer the CA private key.
3. Confirm `https://api.beddybytes.local` is reachable from the phone on the same network.
4. Install the `localDebug` APK and sign in with an existing account.

The CA override is inside Android's `debug-overrides`, so it is ignored for non-debuggable release builds.

## Optional Android Studio use

Android Studio is optional. Open this `android/` directory as the project when IDE editing, previews, debugging, or direct Galaxy S22 deployment is useful. The Docker commands remain the canonical build and CI entry points.
