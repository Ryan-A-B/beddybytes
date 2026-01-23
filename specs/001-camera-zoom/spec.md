# Feature Specification: Camera Zoom for Baby Station

**Feature Branch**: `001-camera-zoom`  
**Created**: 2026-01-20  
**Status**: Draft  
**Input**: User description: "Update the baby station to be able to zoom in on the camera. Only the zoomed in area will be transmitted to parent stations. I expect this will require switching the video element to be a canvas. Then supporting 2 finger zoom gestures. The WebRTC video should be taken from the canvas (HTMLCanvasElement::captureStream) and transmitted to parent stations. For the first pass only support touch devices."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Basic Pinch-to-Zoom on Baby Station (Priority: P1)

A parent operating the baby station has placed the device far from the cot (e.g., on the other side of the room) and wants to zoom in on the cot area during initial setup. They use a standard two-finger pinch gesture on the touchscreen to zoom in and out. The zoomed view is what gets transmitted to any connected parent stations, and this setup remains static for the session duration.

**Why this priority**: This is the core MVP functionality - enabling camera operators to focus on specific areas and transmit only that view. Without this, the feature provides no value.

**Independent Test**: Can be fully tested by opening the baby station on a touch device, performing pinch gestures, and verifying the camera view zooms in/out. The zoomed area should be visible on connected parent stations.

**Acceptance Scenarios**:

1. **Given** the baby station camera is active and displaying on a touch device, **When** the user places two fingers on the screen and moves them apart (pinch-out), **Then** the camera view zooms in on the area between the fingers
2. **Given** the camera view is zoomed in, **When** the user places two fingers on the screen and moves them together (pinch-in), **Then** the camera view zooms out
1. **Given** the camera is zoomed in on a specific area, **When** a parent station connects mid-session, **Then** the parent station immediately receives the current zoomed/panned state matching the baby station display
4. **Given** the baby station operator adjusts the zoom level, **When** parent stations are already connected, **Then** the parent stations immediately see the updated zoom level

---

### User Story 2 - Pan While Zoomed (Priority: P2)

When zoomed in, the user wants to pan around the camera view to focus on different areas without changing the zoom level. They use a single-finger drag gesture to move the visible viewport.

**Why this priority**: Zooming is only half the functionality - users need to reposition the zoomed viewport to look at different parts of the frame. This extends P1 to make it fully usable.

**Independent Test**: Can be tested by zooming in on the baby station, then dragging with one finger to move the viewport around, verifying the panned view is transmitted to parent stations.

**Acceptance Scenarios**:

1. **Given** the camera view is zoomed in, **When** the user drags with one finger in any direction, **Then** the visible viewport pans in that direction
2. **Given** the user pans while zoomed, **When** they reach the edge of the camera frame, **Then** the viewport stops at the boundary and doesn't pan further
3. **Given** the user has panned to a specific area, **When** parent stations are viewing, **Then** they see the same panned position

---

### Edge Cases

- What happens when the user tries to zoom beyond maximum or minimum zoom limits?
- How does the system handle rapid, simultaneous pinch and pan gestures?
- What happens if the user rotates the device while zoomed and panned? (No automatic handling - user must manually correct)
- How does the system handle very small viewport sizes when zoomed to maximum level?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Baby station MUST support two-finger pinch-in gesture to zoom out on touch devices
- **FR-002**: Baby station MUST support two-finger pinch-out gesture to zoom in on touch devices
- **FR-003**: Baby station MUST constrain zoom to a minimum level of 100% (no zoom out beyond full frame) - zoom out is locked at this limit
- **FR-005**: Baby station MUST support single-finger drag gesture to pan the viewport when zoomed in
- **FR-006**: Baby station MUST prevent panning beyond the boundaries of the camera frame
- **FR-007**: Baby station MUST transmit only the visible zoomed/panned viewport area to parent stations via WebRTC
- **FR-008**: System MUST maintain smooth video transmission when zoom or pan state changes
- **FR-016**: Parent stations connecting mid-session MUST immediately receive the current zoom/pan state from baby station
- **FR-017**: Only the baby station operator can control zoom and pan - parent stations are view-only
- **FR-025**: Baby station MUST maintain zoom/pan state locally - state is independent of network connectivity
- **FR-010**: Baby station MUST handle simultaneous multi-touch gestures without conflicts (e.g., distinguishing between pinch and pan)
- **FR-011**: Baby station MUST support double-tap gesture to reset zoom to 100% and center viewport
- **FR-022**: Baby station MUST work on touch-enabled devices for this initial release
- **FR-023**: System MUST preserve aspect ratio of camera feed when zooming
- **FR-024**: System does not handle device rotation automatically - user must manually correct zoom/pan after rotation
- **FR-026**: Viewport MUST update instantly (0ms animation) when zoom or pan changes - no smooth animation transitions

### Key Entities

- **Viewport**: The visible portion of the camera frame currently being displayed and transmitted. Has properties: zoom level (percentage), x-offset, y-offset, width, height
- **Camera Frame**: The full unzoomed video frame from the device camera. Represents the maximum available view area
- **Gesture Event**: Touch interaction from user including type (pinch, pan, tap), coordinates, and delta values used to calculate viewport changes
- **Video Stream**: The WebRTC media stream transmitted from baby station to parent stations, derived from the viewport (HTMLCanvasElement::captureStream)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can zoom from 100% to maximum zoom level using pinch gesture in under 2 seconds
- **SC-002**: Pan gesture responds within 50ms of touch input with smooth movement (no visible lag or stuttering)
- **SC-005**: 95% of pinch and pan gestures are correctly recognized and executed without accidental triggering
- **SC-006**: System supports simultaneous viewing by at least 3 parent stations with zoomed feed without performance degradation
- **SC-007**: Double-tap to reset zoom completes within 300ms

## Clarifications

### Session 2026-01-23

- Q: What is the primary use case for the zoom functionality? → A: Zoom is for initial device positioning when the baby station is placed far from the cot (e.g., on the other side of the room). The setup remains static for the session duration. It is NOT for dynamically tracking baby movement or zooming on the baby's face as that position changes.

### Session 2026-01-20

- Q: When a parent station connects mid-session while the baby station is already zoomed in to a specific area, what should the parent see? → A: Parent immediately sees the current zoomed/panned state (matching what baby station displays) - there is only one zoom level, the one the baby station has set
- Q: When network conditions degrade temporarily during zooming or panning, how should the parent station video feed behave? → A: Continue streaming with reduced quality (lower resolution/frame rate) but maintain real-time updates - not expected to be an issue in practice
- Q: When the baby station device is rotated (portrait ↔ landscape) while zoomed in, how should the zoom state be handled? → A: Do nothing, requires manual correction by user - not expected to be an issue in practice. Add a zoom reset button to video controls (only displayed when not fully zoomed out at 100%)
- Q: When the baby station temporarily disconnects and reconnects (network interruption, app backgrounded, device sleep), how should zoom state be handled? → A: Zoom is maintained by the baby station locally - network interruption is irrelevant. Parent stations receive whatever the baby station is currently streaming when they reconnect
