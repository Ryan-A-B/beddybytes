# Manual Validation Checklist

**Feature**: Camera Zoom for Baby Station  
**Branch**: `001-camera-zoom`  
**Date**: 2026-01-23

## Setup Instructions

1. Start the local stack: `./run_local_stack.sh`
2. Open baby station on a touch-enabled device
3. Start a session
4. Open parent station(s) in separate browsers

## Phase 2: Canvas Pipeline ✅

- [X] T010 **Canvas displays camera feed**
  - Open baby station
  - Verify canvas shows camera view (not video element)
  - Check browser console for "Canvas renderer started" message
  - **Expected**: Camera feed visible, no errors

## Phase 3: User Story 1 - Pinch-to-Zoom ⏳

### V001: Pinch-out zooms in smoothly
- [ ] Place two fingers on canvas
- [ ] Move fingers apart (pinch out)
- [ ] **Expected**: View zooms in smoothly, no lag

### V002: Pinch-in zooms out smoothly
- [ ] With zoomed view, place two fingers on canvas
- [ ] Move fingers together (pinch in)
- [ ] **Expected**: View zooms out smoothly

### V003: Cannot zoom below 100%
- [ ] At 100% zoom, try pinching in further
- [ ] **Expected**: View stays at 100%, cannot zoom out more

### V004: Cannot zoom above 300%
- [ ] Zoom in fully with pinch gesture
- [ ] Try to zoom in more
- [ ] **Expected**: View stops at 300%, cannot zoom further

### V005: Parent station receives zoomed feed
- [ ] With parent station connected, zoom in on baby station
- [ ] Check parent station view
- [ ] **Expected**: Parent sees zoomed view matching baby station

### V006: Parent connecting mid-session sees current zoom
- [ ] Zoom to 200% on baby station
- [ ] Connect new parent station
- [ ] **Expected**: New parent immediately sees 200% zoomed view

### V007: Multiple parents receive feed without degradation
- [ ] Connect 3+ parent stations
- [ ] Zoom and pan on baby station
- [ ] **Expected**: All parents receive feed smoothly, no stuttering

### V008: Aspect ratio preserved at all zoom levels
- [ ] Zoom to various levels (150%, 200%, 300%)
- [ ] Check for image distortion
- [ ] **Expected**: Video maintains aspect ratio, no stretching

## Phase 4: User Story 2 - Pan While Zoomed ⏳

### V009: Single-finger drag pans when zoomed
- [ ] Zoom to 200%
- [ ] Drag with one finger across canvas
- [ ] **Expected**: View pans smoothly in drag direction

### V010: Pan responds within 50ms
- [ ] Zoom in and pan quickly
- [ ] Observe lag between touch and viewport movement
- [ ] **Expected**: Near-instant response, <50ms latency

### V011: Viewport stops at frame boundaries
- [ ] Zoom to 300%
- [ ] Pan to edges in all directions
- [ ] **Expected**: Cannot pan beyond camera frame edges

### V012: Pan disabled at 100% zoom
- [ ] Zoom out to 100%
- [ ] Try to drag with one finger
- [ ] **Expected**: Page scrolls normally, no pan behavior

### V013: Panned view transmitted to parents
- [ ] Zoom to 200% and pan to corner
- [ ] Check parent station view
- [ ] **Expected**: Parent sees same corner view as baby station

### V014: Parent sees same panned position
- [ ] Pan around at various zoom levels
- [ ] Compare baby station and parent station views
- [ ] **Expected**: Views match exactly

### V015: Simultaneous pinch and pan handled correctly
- [ ] Pinch and drag simultaneously
- [ ] Try various gesture combinations
- [ ] **Expected**: No conflicts, gestures work correctly

## Phase 5: Polish Features ⏳

### V022: Frame rate maintains 15-30 fps
- [ ] Open browser developer tools console
- [ ] Zoom to various levels and pan
- [ ] Check console for FPS warnings
- [ ] **Expected**: No warnings, FPS stays above 15

### V023: Touch latency <50ms
- [ ] Perform rapid pinch and pan gestures
- [ ] Observe response time
- [ ] **Expected**: Immediate response, no noticeable delay

### V024: 95% gesture recognition accuracy
- [ ] Perform 20+ pinch gestures
- [ ] Perform 20+ pan gestures
- [ ] **Expected**: <5% failure rate (gestures not recognized)

### V025: Device rotation handled gracefully
- [ ] Zoom to 200%
- [ ] Rotate device (portrait ↔ landscape)
- [ ] **Expected**: Canvas adjusts, zoom resets, no crashes

### V026: Instant viewport updates
- [ ] Zoom and pan rapidly
- [ ] Observe animation
- [ ] **Expected**: Instant updates, no smooth transitions/lag

## Phase 6: Endurance & Cross-Platform ⏳

### T040: Endurance test
- [ ] Start session with zoom active at 200%
- [ ] Let run for 5+ hours
- [ ] Monitor FPS in console every hour
- [ ] Check browser memory usage (DevTools → Memory)
- [ ] **Expected**: No FPS degradation, no memory leaks

### T041: iOS Safari testing
- [ ] Test on iPhone (iOS Safari)
- [ ] Test on iPad (iOS Safari)
- [ ] Verify all gestures work (pinch, pan)
- [ ] **Expected**: All features functional on iOS

### T042: Android Chrome testing
- [ ] Test on Android phone (Chrome)
- [ ] Test on Android tablet (Chrome)
- [ ] Verify all gestures work
- [ ] **Expected**: All features functional on Android

### T043: Parent station compatibility
- [ ] Connect parent on desktop Chrome
- [ ] Connect parent on desktop Firefox
- [ ] Connect parent on desktop Safari (macOS)
- [ ] Connect parent on mobile browsers
- [ ] **Expected**: All parents receive zoomed feed correctly

### T046: Quickstart validation
- [ ] Follow quickstart.md Day 1-5 steps
- [ ] Verify each checkpoint passes
- [ ] **Expected**: All quickstart validations pass

## Performance Metrics Checklist

- [ ] Frame rate: 15-30 fps at all zoom levels
- [ ] Touch latency: <50ms response time
- [ ] Gesture accuracy: >95% recognition rate
- [ ] Memory stable: No leaks over 5+ hours
- [ ] Multi-parent: 3+ parents without degradation

## Browser Console Checks

Expected console messages:
- ✅ `[MediaStream] Canvas renderer started: WxH`
- ✅ `[MediaStream] Canvas renderer stopped. Final FPS: N`
- ⚠️ Warnings if FPS drops below 15

Should NOT see:
- ❌ Uncaught errors
- ❌ Canvas rendering errors
- ❌ WebRTC connection failures

## Failure Handling

If any validation fails:
1. Note the specific test case
2. Check browser console for errors
3. Document device/browser details
4. Take screenshots/screen recordings
5. Report issue with context

## Sign-off

When all validations pass:

- [ ] All Phase 3 validations (V001-V008) passed
- [ ] All Phase 4 validations (V009-V015) passed
- [ ] All Phase 5 validations (V016-V026) passed
- [ ] All Phase 6 validations (T040-T043) passed
- [ ] Performance metrics met
- [ ] No console errors

**Validated by**: ________________  
**Date**: ________________  
**Devices tested**: ________________  
**Notes**: ________________

---

**Status**: Ready for manual validation  
**Estimated time**: 2-3 hours + 5 hour endurance test  
**Required devices**: iOS device, Android device, touch-enabled laptop/tablet
