# Feature Specification: Camera Zoom for Baby Station

**Feature Branch**: `001-camera-zoom`  
**Created**: 2026-01-20  
**Status**: Draft  
**Input**: User description: "Update the baby station to be able to zoom in on the camera. Only the zoomed in area will be transmitted to parent stations. I expect this will require switching the video element to be a canvas. Then supporting 2 finger zoom gestures. The WebRTC video should be taken from the canvas and transmitted to parent stations. For the first pass only support touch devices."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Basic Pinch-to-Zoom on Baby Station (Priority: P1)

A parent operating the baby station wants to zoom in on a specific area of the camera view (e.g., to see their sleeping baby's face more clearly). They use a standard two-finger pinch gesture on the touchscreen to zoom in and out smoothly. The zoomed view is what gets transmitted to any connected parent stations, so remote parents see the same focused view.

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

### User Story 3 - Visual Zoom Feedback (Priority: P3)

Users want clear visual feedback about their current zoom level and position within the full camera frame so they understand what portion of the full view is being shown.

**Why this priority**: Enhances usability by helping users understand zoom state, but the feature functions without it.

**Independent Test**: Can be tested by zooming/panning and observing visual indicators (e.g., zoom level percentage, minimap, or viewport outline).

**Acceptance Scenarios**:

1. **Given** the user is zooming in or out, **When** the zoom level changes, **Then** a visual indicator shows the current zoom level (e.g., "150%")
2. **Given** the user is zoomed in and panning, **When** the viewport moves, **Then** a minimap or outline shows the current viewport position within the full frame
3. **Given** zoom feedback is displayed, **When** the user stops interacting for 3 seconds, **Then** the visual indicators fade out to avoid obstructing the view

---

### User Story 4 - Reset to Default View (Priority: P3)

Users want a quick way to reset the camera to the default unzoomed view without having to manually pinch out to 100%.

**Why this priority**: Quality-of-life improvement for faster navigation, but users can achieve this manually.

**Independent Test**: Can be tested by zooming/panning to any position, then using reset button or double-tapping, and verifying the view returns to 100% zoom centered.

**Acceptance Scenarios**:

1. **Given** the camera is zoomed in and/or panned, **When** the user double-taps the screen, **Then** the view resets to 100% zoom centered on the full frame
2. **Given** the camera is zoomed in, **When** the user taps the reset button in video controls, **Then** the view resets to 100% zoom centered on the full frame
3. **Given** the zoom level is at 100%, **When** the user views the video controls, **Then** the reset button is not visible
4. **Given** the view is reset to default, **When** parent stations are viewing, **Then** they see the full unzoomed camera feed

---

### Edge Cases

- What happens when the user tries to zoom beyond maximum or minimum zoom limits?
- How does the system handle rapid, simultaneous pinch and pan gestures?
- What happens if the user rotates the device while zoomed and panned? (No automatic handling - user must manually correct using reset button or gestures)
- How does the system handle very small viewport sizes when zoomed to maximum level?
- What happens if parent station video resolution differs from baby station - how is the zoomed area scaled?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Baby station MUST support two-finger pinch-in gesture to zoom out on touch devices
- **FR-002**: Baby station MUST support two-finger pinch-out gesture to zoom in on touch devices
- **FR-003**: Baby station MUST constrain zoom to a minimum level of 100% (no zoom out beyond full frame) - zoom out is locked at this limit
- **FR-004**: Baby station MUST constrain zoom to a maximum level to prevent excessive pixelation (reasonable default: 300%)
- **FR-005**: Baby station MUST support single-finger drag gesture to pan the viewport when zoomed in
- **FR-006**: Baby station MUST prevent panning beyond the boundaries of the camera frame
- **FR-007**: Baby station MUST transmit only the visible zoomed/panned viewport area to parent stations via WebRTC
- **FR-008**: System MUST maintain smooth video transmission when zoom or pan state changes
- **FR-009**: Zoom and pan state changes MUST be reflected in the parent station video feed within 500ms
- **FR-016**: Parent stations connecting mid-session MUST immediately receive the current zoom/pan state from baby station
- **FR-017**: Only the baby station operator can control zoom and pan - parent stations are view-only
- **FR-025**: Baby station MUST maintain zoom/pan state locally - state is independent of network connectivity
- **FR-018**: System MUST maintain real-time video updates during network degradation by reducing quality rather than freezing or falling back
- **FR-010**: Baby station MUST handle simultaneous multi-touch gestures without conflicts (e.g., distinguishing between pinch and pan)
- **FR-011**: Baby station MUST support double-tap gesture to reset zoom to 100% and center viewport
- **FR-012**: System MUST display a reset button in video controls that resets zoom to 100% when tapped
- **FR-019**: Reset button MUST only be visible when zoom level is greater than 100% (hidden when fully zoomed out)
- **FR-020**: System MUST display current zoom level as a percentage to the user during zoom gestures
- **FR-021**: System MUST maintain video quality and frame rate when zoomed (target: minimum 15 fps, ideally 30 fps)
- **FR-022**: Baby station MUST work exclusively on touch-enabled devices for this initial release
- **FR-023**: System MUST preserve aspect ratio of camera feed when zooming
- **FR-024**: System does not handle device rotation automatically - user must manually correct zoom/pan after rotation

### Key Entities

- **Viewport**: The visible portion of the camera frame currently being displayed and transmitted. Has properties: zoom level (percentage), x-offset, y-offset, width, height
- **Camera Frame**: The full unzoomed video frame from the device camera. Represents the maximum available view area
- **Gesture Event**: Touch interaction from user including type (pinch, pan, tap), coordinates, and delta values used to calculate viewport changes
- **Video Stream**: The WebRTC media stream transmitted from baby station to parent stations, derived from the viewport

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can zoom from 100% to maximum zoom level using pinch gesture in under 2 seconds
- **SC-002**: Pan gesture responds within 50ms of touch input with smooth movement (no visible lag or stuttering)
- **SC-003**: Parent stations receive zoomed video feed with less than 500ms latency from zoom/pan state change
- **SC-004**: Video transmission maintains minimum 15 frames per second at all zoom levels
- **SC-005**: 95% of pinch and pan gestures are correctly recognized and executed without accidental triggering
- **SC-006**: System supports simultaneous viewing by at least 3 parent stations with zoomed feed without performance degradation
- **SC-007**: Double-tap to reset zoom completes within 300ms
- **SC-008**: Video quality remains acceptable (no severe pixelation or artifacts) at maximum zoom level

## Clarifications

### Session 2026-01-20

- Q: When a parent station connects mid-session while the baby station is already zoomed in to a specific area, what should the parent see? → A: Parent immediately sees the current zoomed/panned state (matching what baby station displays) - there is only one zoom level, the one the baby station has set
- Q: When network conditions degrade temporarily during zooming or panning, how should the parent station video feed behave? → A: Continue streaming with reduced quality (lower resolution/frame rate) but maintain real-time updates - not expected to be an issue in practice
- Q: When the baby station device is rotated (portrait ↔ landscape) while zoomed in, how should the zoom state be handled? → A: Do nothing, requires manual correction by user - not expected to be an issue in practice. Add a zoom reset button to video controls (only displayed when not fully zoomed out at 100%)
- Q: When the baby station temporarily disconnects and reconnects (network interruption, app backgrounded, device sleep), how should zoom state be handled? → A: Zoom is maintained by the baby station locally - network interruption is irrelevant. Parent stations receive whatever the baby station is currently streaming when they reconnect
