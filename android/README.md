# BeddyBytes Android

Native Android Baby Station client for BeddyBytes.

Phase 1 contains the installable application shell, environment variants, session state boundaries, and build quality gates. Authentication, MQTT, WebRTC, camera capture, foreground service behavior, and Do Not Disturb arrive in later phases.

## Requirements

- Docker with Linux container support
- A POSIX shell (`sh`), available by default on Linux and macOS and through WSL or Git Bash on Windows
- Network access for the first image and dependency download

No host JDK, Android SDK, Gradle installation, or Android Studio installation is required to build.

The build uses a pinned `linux/amd64` container. Docker hosts on ARM need amd64 emulation enabled.

## Build and check

From the repository root:

```sh
./scripts/android/build-debug.sh
./scripts/android/check.sh
```

The debug APK is written to:

```text
app/build/outputs/apk/local/debug/app-local-debug.apk
```

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

Debug builds add a final `.debug` application ID suffix so local, QA, and production shells can coexist on a device.

## Optional Android Studio use

Android Studio is optional. Open this `android/` directory as the project when IDE editing, previews, debugging, or direct Galaxy S22 deployment is useful. The Docker commands remain the canonical build and CI entry points.
