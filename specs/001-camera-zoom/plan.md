# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Summary

Add pinch-to-zoom and pan camera controls to the baby station to enable device positioning when placed far from the cot. Replace video element with canvas to capture and transform the zoomed/panned viewport before streaming to parent stations via WebRTC. Touch-only support for initial release.

## Technical Context

**Language/Version**: TypeScript 5.2.2, React 18.2.0  
**Primary Dependencies**: React functional components, hooks, browser WebRTC APIs (HTMLCanvasElement::captureStream), touch events API  
**Storage**: LocalStorage for session state persistence  
**Testing**: Jest 29.6.2 with @testing-library/react 13.4.0 (frontend unit tests via scripts/frontend/test.sh), Python integration tests (run_integration_tests.sh)  
**Target Platform**: Touch-enabled web browsers (iOS Safari, Android Chrome) - baby station PWA  
**Project Type**: Web application (existing React frontend + Go backend architecture)  
**Performance Goals**: 50ms touch response latency, maintain 15-30 fps video streaming at all zoom levels  
**Constraints**: Touch-only (no mouse support initially), instant viewport updates (0ms animation), maintain existing WebRTC P2P reliability  
**Scale/Scope**: Single baby station component modification, affects BabyStation page and SessionService, no backend changes

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Simplicity-First (Occam's Razor) ✅ PASS

- **Canvas-based approach**: Replacing `<video>` with `<canvas>` is the simplest way to crop/transform video before transmission. Alternative (server-side video processing) would be far more complex, and not an option due to privacy concerns.
- **Touch-only initial release**: Explicitly defers mouse/desktop support to avoid over-engineering gesture detection.
- **Instant viewport updates (0ms animation)**: Removes animation complexity - user explicitly requested no over-complication.
- **Static positioning use case**: Design acknowledges zoom is for one-time setup, not continuous tracking - avoids building unnecessary dynamic features.
- **No backend state storage**: Zoom state maintained locally on baby station.

**Verdict**: Passes. Solution is appropriately scoped to immediate need.

### II. Privacy-First (Non-Negotiable) ✅ PASS

- **No new communication**: Only the video stream source is changing. 
- **Cropped video never leaves local network**: HTMLCanvasElement::captureStream creates new MediaStream from canvas; transmitted via existing WebRTC P2P architecture.
- **No cloud processing**: All zooming, panning, and canvas rendering happens client-side in browser.

**Verdict**: Passes. Privacy model unchanged - video remains P2P.

### III. Modularity & Composability ✅ PASS

- **Single responsibility modules**: 
  - GestureHandler: Touch event → zoom/pan calculations
  - ViewportRenderer: Canvas rendering with transform
  - StreamCapture: Canvas → MediaStream
- **Clear component boundaries**: BabyStation page orchestrates; MediaStream component owns video capture; Connections handles WebRTC (existing).
- **Isolated from parent station**: Parent stations remain view-only, receive transformed stream with zero code changes required.

**Verdict**: Passes. Design maintains existing modularity.

### IV. Test-First (Strict Discipline) ⚠️ EXCEPTION GRANTED

- **Manual validation approach**: Due to the highly visual and interactive nature of touch gestures and camera zoom, this feature will rely on manual validation rather than automated tests.
- **Validation coverage**:
  - Pinch gesture zoom behavior on touch devices
  - Pan gesture viewport movement
  - Canvas rendering quality at various zoom levels
  - WebRTC stream transmission to parent stations
- **Rationale**: Touch gesture simulation in automated tests is complex and unreliable. Real device testing provides better validation for this UI-heavy feature.

**Verdict**: Pass with exception. Manual validation replaces TDD requirement for this feature.

### V. Clear Communication Over Cleverness ✅ PASS

- **Explicit naming**: Viewport, Camera Frame, Gesture Event, Video Stream entities clearly defined in spec.
- **Canvas transform approach**: Standard browser API (drawImage with crop params) - no custom image processing algorithms.
- **Touch event handling**: Standard browser TouchEvent API - well-documented, no clever libraries.

**Verdict**: Passes. Approach uses standard APIs with clear intent.

### VI. Reliability & Resilience ⚠️ REQUIRES VALIDATION

- **Zoom state persistence**: Maintained locally - network outages don't affect baby station zoom (parent stations are view only and reconnect as they do currently).
- **Performance at zoom levels**: Must validate canvas rendering + captureStream maintains 15-30 fps target (FR-021).
- **P2P reliability unchanged**: Existing endurance tests must pass (5+ hour sessions, backend outage resilience).
- **Edge cases documented**: Device rotation, rapid gestures, boundary conditions all specified.

**Verdict**: Conditional pass. Endurance tests must validate performance doesn't degrade. Monitor canvas rendering overhead in tests.

### Overall Assessment: PASS WITH CONDITIONS

**Blockers**: None  
**Requirements**:
1. Manual validation on touch devices (iOS Safari, Android Chrome)
2. Validate canvas rendering performance manually (maintain 15-30 fps)
3. Manual endurance testing (5+ hour session with zoom active)

**Justifications**: None - no constitutional violations requiring complexity justification.

---

## Post-Design Constitution Re-Check

**Date**: 2026-01-23 (After Phase 1 Design)

### Design Review Against Constitution

✅ **I. Simplicity-First**: CONFIRMED
- Zero external dependencies added (canvas, touch events = native browser APIs)
- Module count minimal: 4 new files (GestureHandler, ViewportManager, CanvasRenderer, useZoomGestures hook)
- Integration points: 1 modified file (MediaStream.tsx), Connections.ts unchanged
- Clear responsibility separation maintained

✅ **II. Privacy-First**: CONFIRMED
- No new network requests or external services
- Canvas stream transmitted via existing P2P WebRTC (same privacy model)
- Zoom state never leaves client (no backend storage)

✅ **III. Modularity**: CONFIRMED
- Each module has single responsibility (see quickstart.md phases)
- TypeScript interfaces define clear contracts (see contracts/typescript-interfaces.md)
- Parent station requires zero changes (receives standard MediaStream)

✅ **IV. Test-First**: EXCEPTION APPROVED
- Manual validation approach adopted for this feature
- Touch gesture behavior best validated on real devices
- Visual/interactive nature makes automated testing impractical
- **Action Required**: Manual testing on touch devices (iOS Safari, Android Chrome)

✅ **V. Clear Communication**: CONFIRMED
- All entities clearly named (Viewport, CameraFrame, GestureEvent, VideoStream)
- Standard browser APIs used (no clever abstractions)
- Code samples in quickstart use explicit variable names

✅ **VI. Reliability**: VALIDATION REQUIRED
- Endurance tests must validate 5+ hour sessions with zoom
- **Action Required**: Run endurance tests post-implementation to confirm no performance degradation

### Final Verdict: APPROVED FOR IMPLEMENTATION

**Conditions Met**: All constitutional principles pass or have clear validation path  
**Next Phase**: Proceed to /speckit.tasks to generate implementation tasks

---

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── pages/
│   │   └── BabyStation/
│   │       ├── index.tsx              # Main baby station page (existing)
│   │       ├── MediaStream.tsx        # Video component (MODIFY: replace video with canvas)
│   │       ├── Connections.ts         # WebRTC connections (MODIFY: use canvas stream)
│   │       └── ZoomControls/          # NEW: Zoom gesture & viewport management
│   │           ├── index.tsx          # NEW: Zoom controls component
│   │           ├── GestureHandler.ts  # NEW: Touch gesture recognition
│   │           ├── ViewportManager.ts # NEW: Zoom/pan state & calculations
│   │           └── CanvasRenderer.ts  # NEW: Canvas drawing with transforms
│   ├── services/
│   │   └── BabyStation/
│   │       └── SessionService/
│   │           └── index.ts           # Session management (existing - no changes)
│   └── hooks/
│       └── useZoomGestures.ts         # NEW: Custom hook for gesture handling
└── tests/
    └── ZoomControls/                  # NEW: Unit tests for zoom functionality
        ├── GestureHandler.test.ts
        ├── ViewportManager.test.ts
        └── CanvasRenderer.test.ts

integration_tests/
└── src/
    └── test_zoom_functionality.py     # NEW: End-to-end zoom tests

golang/
└── (No changes required - signaling already handles arbitrary data)
```

**Structure Decision**: Web application structure (Option 2). Zoom functionality is frontend-only (React), isolated to BabyStation component. Backend (Go) requires no changes - existing WebRTC signaling protocol already supports arbitrary data transmission. New ZoomControls module added under BabyStation page with clear separation of concerns: gesture handling, viewport calculations, and canvas rendering.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
