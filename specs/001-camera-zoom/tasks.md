# Tasks: Camera Zoom for Baby Station

**Branch**: `001-camera-zoom`  
**Input**: Design documents from `/specs/001-camera-zoom/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Manual validation approach - no automated test tasks included per project decision.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `- [ ] [ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and canvas pipeline foundation

- [ ] T001 Create ZoomControls module directory structure in frontend/src/pages/BabyStation/ZoomControls/
- [ ] T002 [P] Create TypeScript interface definitions file in frontend/src/pages/BabyStation/ZoomControls/types.ts based on contracts/typescript-interfaces.md
- [ ] T003 [P] Create constants file in frontend/src/pages/BabyStation/ZoomControls/constants.ts (zoom limits, gesture thresholds, performance targets)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core canvas rendering pipeline that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Implement CanvasRenderer class in frontend/src/pages/BabyStation/ZoomControls/CanvasRenderer.ts (basic rendering loop, captureStream)
- [ ] T005 Implement ViewportManager module in frontend/src/pages/BabyStation/ZoomControls/ViewportManager.ts (state management, constraint functions)
- [ ] T006 Modify MediaStream component in frontend/src/pages/BabyStation/MediaStream.tsx to add canvas element alongside video element
- [ ] T007 Wire up canvas dimensions initialization in frontend/src/pages/BabyStation/MediaStream.tsx (match video dimensions on loadedmetadata)
- [ ] T008 Create CanvasRenderer instance in frontend/src/pages/BabyStation/MediaStream.tsx and start rendering loop
- [ ] T009 Modify Connections.ts in frontend/src/pages/BabyStation/Connections.ts to accept canvas stream instead of video stream
- [ ] T010 Manual validation: Verify canvas displays camera feed and parent stations receive video (no zoom functionality yet)

**Checkpoint**: Canvas pipeline functional - video rendering through canvas to parent stations. User story implementation can now begin.

---

## Phase 3: User Story 1 - Basic Pinch-to-Zoom on Baby Station (Priority: P1) 🎯 MVP

**Goal**: Enable pinch-out gesture to zoom in (100% to 300%) and pinch-in gesture to zoom out. Zoomed view transmitted to parent stations.

**Independent Test**: Open baby station on touch device, perform pinch gestures, verify camera view zooms. Connect parent station and verify zoomed feed received.

### Implementation for User Story 1

- [ ] T011 [P] [US1] Implement GestureHandler class in frontend/src/pages/BabyStation/ZoomControls/GestureHandler.ts (touch event listeners, distance calculation)
- [ ] T012 [P] [US1] Implement pinch gesture recognition in GestureHandler (touchstart with 2 fingers, touchmove distance tracking, scale calculation)
- [ ] T013 [US1] Create useZoomGestures custom hook in frontend/src/hooks/useZoomGestures.ts (viewport state, updateZoom callback)
- [ ] T014 [US1] Wire up GestureHandler in MediaStream.tsx component (attach to canvas, listen for pinch events)
- [ ] T015 [US1] Connect pinch gesture events to updateZoom callback in MediaStream.tsx
- [ ] T016 [US1] Modify CanvasRenderer.renderFrame() in CanvasRenderer.ts to apply viewport zoom transform (drawImage with source crop)
- [ ] T017 [US1] Update CanvasRenderer to accept viewport updates via setViewport() method
- [ ] T018 [US1] Wire up viewport state changes to renderer.setViewport() in MediaStream.tsx
- [ ] T019 [US1] Implement zoom constraint enforcement (1.0 - 3.0 range) in ViewportManager.constrainViewport()
- [ ] T020 [US1] Add event.preventDefault() to GestureHandler touch events to prevent browser zoom

**Manual Validation Checklist**:
- [ ] V001 [US1] Pinch-out gesture zooms in smoothly on touch device (SC-001: <2 seconds to max zoom)
- [ ] V002 [US1] Pinch-in gesture zooms out smoothly
- [ ] V003 [US1] Zoom constrained to 100% minimum (can't zoom out beyond full frame)
- [ ] V004 [US1] Zoom constrained to 300% maximum
- [ ] V005 [US1] Parent station receives zoomed video feed in real-time
- [ ] V006 [US1] Parent station connecting mid-session receives current zoom level (FR-016)
- [ ] V007 [US1] Multiple parent stations (3+) receive zoomed feed without degradation (SC-006)
- [ ] V008 [US1] Aspect ratio preserved at all zoom levels (FR-023)

**Checkpoint**: User Story 1 complete - pinch-to-zoom functional and transmitted to parent stations

---

## Phase 4: User Story 2 - Pan While Zoomed (Priority: P2)

**Goal**: Enable single-finger drag gesture to pan viewport when zoomed in, with boundary constraints.

**Independent Test**: Zoom in on baby station, drag with one finger to move viewport, verify panned view transmitted to parent stations and stops at frame boundaries.

### Implementation for User Story 2

- [ ] T021 [US2] Implement pan gesture recognition in GestureHandler (single touch tracking, delta calculation)
- [ ] T022 [US2] Add pan gesture condition check in GestureHandler (only when zoom > 1.0)
- [ ] T023 [US2] Add updatePan callback to useZoomGestures hook in frontend/src/hooks/useZoomGestures.ts
- [ ] T024 [US2] Wire up pan gesture events to updatePan callback in MediaStream.tsx
- [ ] T025 [US2] Implement pan boundary constraints in ViewportManager.constrainViewport() (maxPanX, maxPanY calculation)
- [ ] T026 [US2] Update CanvasRenderer.renderFrame() to apply panX/panY offsets to drawImage source rectangle
- [ ] T027 [US2] Add conditional event.preventDefault() for pan gestures (only when zoomed, to preserve scroll when not zoomed)

**Manual Validation Checklist**:
- [ ] V009 [US2] Single-finger drag pans viewport when zoomed in
- [ ] V010 [US2] Pan responds within 50ms of touch input (SC-002)
- [ ] V011 [US2] Viewport stops at frame boundaries (can't pan beyond edges - FR-006)
- [ ] V012 [US2] Pan disabled when zoom is 100% (allows normal scroll behavior)
- [ ] V013 [US2] Panned view transmitted to parent stations in real-time
- [ ] V014 [US2] Parent station sees same panned position as baby station
- [ ] V015 [US2] Rapid simultaneous pinch and pan handled without conflicts (FR-010)

**Checkpoint**: User Stories 1 AND 2 complete - full zoom and pan functionality working

---

## Phase 5: Polish & Additional Features (Priority: P3)

**Purpose**: Quality-of-life improvements and additional gesture support

### Reset Zoom Functionality

- [ ] T028 [P] Add resetViewport callback to useZoomGestures hook
- [ ] T029 [P] Implement double-tap gesture recognition in GestureHandler (two taps within 300ms threshold)
- [ ] T030 Wire up double-tap gesture to resetViewport callback in MediaStream.tsx

**Manual Validation Checklist**:
- [ ] V016 Double-tap resets zoom to 100% and centers viewport within 300ms (SC-007)
- [ ] V019 Reset zoom transmitted to parent stations

### Performance & Edge Cases

- [ ] T037 Add frame rate monitoring to CanvasRenderer (performance.now() tracking, log warnings if <30fps)
- [ ] T038 [P] Add error boundary for ZoomControls component
- [ ] T039 [P] Handle video device change during session (reset zoom, reinitialize canvas)

**Manual Validation Checklist**:
- [ ] V022 Frame rate maintains 15-30 fps at all zoom levels (FR-021, SC-004)
- [ ] V023 Touch response latency <50ms measured with performance tools
- [ ] V024 95% gesture recognition accuracy (SC-005) - test with multiple gestures
- [ ] V025 Device rotation handled gracefully (manual zoom reset required per FR-024)
- [ ] V026 Instant viewport updates (no animation lag - FR-026)

---

## Phase 6: Final Validation & Documentation

**Purpose**: Comprehensive validation and documentation updates

- [ ] T040 User manually run endurance test: 5+ hour session with zoom active, verify no performance degradation or memory leaks
- [ ] T041 [P] Test on iOS Safari (iPhone/iPad) - verify all gestures work correctly
- [ ] T042 [P] Test on Android Chrome (phone/tablet) - verify all gestures work correctly
- [ ] T043 [P] Verify parent station compatibility (receives zoom feed on all supported browsers)
- [ ] T044 Update user documentation with zoom feature usage instructions
- [ ] T045 [P] Update developer README with canvas pipeline architecture notes
- [ ] T046 Run through quickstart.md validation steps

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational phase - Core MVP functionality
- **User Story 2 (Phase 4)**: Depends on Foundational phase - Can start after US1 or in parallel if team capacity allows
- **Polish (Phase 5)**: Depends on User Stories 1 & 2 completion
- **Final Validation (Phase 6)**: Depends on all implementation phases

### User Story Dependencies

- **User Story 1 (P1)**: Independent after Foundational - No dependencies on other stories
- **User Story 2 (P2)**: Independent after Foundational - Builds on US1 gesture infrastructure but can be implemented in parallel

### Within Each User Story

**User Story 1 (Pinch-to-Zoom)**:
1. GestureHandler + pinch recognition (T011-T012) - Can be parallel
2. useZoomGestures hook (T013)
3. Wire up gestures + renderer (T014-T018) - Sequential integration
4. Constraints + polish (T019-T020)

**User Story 2 (Pan)**:
1. Pan gesture recognition (T021-T022)
2. Pan hook + wiring (T023-T024)
3. Boundary constraints + rendering (T025-T027)

### Parallel Opportunities

**Phase 1 (Setup)**:
- T002 (types) and T003 (constants) can run in parallel

**Phase 2 (Foundational)**:
- T004 (CanvasRenderer) and T005 (ViewportManager) can be developed in parallel initially
- T006-T009 are sequential integration steps

**Phase 3 (User Story 1)**:
- T011 and T012 (GestureHandler) can be one developer
- T013 (hook) can be another developer in parallel
- T014-T020 require sequential integration

**Phase 5 (Polish)**:
- T028-T029 (reset gesture), T034-T036 (visual feedback), T037-T039 (performance) can all be parallel

**Phase 6 (Validation)**:
- T041, T042, T043 (device testing) can all run in parallel
- T044, T045 (documentation) can run in parallel

---

## Parallel Example: User Story 1 Core Implementation

```bash
# Developer 1: Gesture recognition
T011 → T012  # GestureHandler with pinch detection

# Developer 2: State management (parallel)
T013  # useZoomGestures hook

# Both developers converge for integration
T014 → T015 → T016 → T017 → T018  # Wire everything together

# Final polish (can split again)
T019 + T020  # Constraints and preventDefault
```

---

## MVP Scope Recommendation

**Minimum Viable Product** = Phase 1 + Phase 2 + Phase 3 (User Story 1)

This delivers:
- ✅ Pinch-to-zoom (100% - 300%)
- ✅ Canvas rendering pipeline
- ✅ WebRTC transmission to parent stations
- ✅ Zoom constraints

**Not included in MVP** (can be added incrementally):
- ❌ Pan functionality (User Story 2)
- ❌ Reset button/double-tap (Phase 5)
- ❌ Visual feedback indicators (Phase 5)

**Total Tasks**: 46 implementation tasks + 26 manual validation checks
**Estimated Effort**: 3-5 days for MVP (Phases 1-3), 5-7 days for full feature (all phases)

---

## Implementation Strategy

1. **Start with MVP**: Complete Phases 1-3 first for immediate value
2. **Validate early**: Perform manual validation after each phase checkpoint
3. **Iterate**: Add Phase 4 (pan) and Phase 5 (polish) based on user feedback
4. **Test on real devices**: Use iOS/Android devices for gesture validation throughout development
5. **Monitor performance**: Track frame rates from Phase 2 onwards to catch degradation early

