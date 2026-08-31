# BeddyBytes Android

Native Android Baby Station client for BeddyBytes.

The current project contains the installable shell, native authorization, and the first Baby Station screen. The screen uses Camera2 directly for preview and low-light exposure control, can target the preferred physical sensor behind a logical camera, and displays an eight-frame rolling grayscale average during manual low-light capture. It discovers the device's cameras and microphones, persists its compact immediate-apply settings, and implements the idle, running, and screen-saver presentation states. Start and Stop currently control local UI state only; MQTT, WebRTC transmission, foreground service behavior, and Do Not Disturb arrive in later phases.

Authorization uses the existing BeddyBytes password and refresh grants without backend changes. Access tokens and account details remain in memory. The rotating refresh cookie is encrypted with an app-owned Android Keystore key, and sign out is local because the existing backend does not route a logout endpoint.

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
