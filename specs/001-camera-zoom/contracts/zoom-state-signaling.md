# WebRTC Signaling Contract: Zoom State (Optional)

**Date**: 2026-01-23  
**Feature**: 001-camera-zoom  
**Protocol**: WebRTC Data Channel (optional enhancement)  
**Status**: Not Required for MVP

## Overview

**Key Decision**: Zoom state synchronization is **NOT REQUIRED** for the camera zoom feature MVP.

**Rationale**:
- Parent stations are **view-only** (FR-017) - they cannot control zoom
- Parent stations automatically receive the **transformed video stream** via existing WebRTC video track
- The zoomed/panned viewport is "baked into" the video pixels parent stations receive
- No separate state synchronization needed - the video IS the state

## Current Behavior (No Changes Required)

### Video Track Transmission (Existing)

Baby Station sends zoomed video via standard WebRTC video track:

```typescript
// Baby Station (Connections.ts - existing, no changes)
const stream = canvas.captureStream(30); // Now from canvas instead of video element
stream.getTracks().forEach((track) => {
  connection.peer_connection.addTrack(track, stream);
});

// Parent Station (existing, no changes)
peer_connection.addEventListener('track', (event) => {
  videoElement.srcObject = event.streams[0];
});
```

**Result**: Parent station automatically displays zoomed video. No additional protocol needed.

## Optional Enhancement: Viewport State Metadata

**Use Case**: Future feature where parent station UI displays zoom level indicator (e.g., "Zoomed 200%")

**Not in Current Scope**: Feature spec does not require parent stations to display zoom metadata.

### Proposed Data Channel Message (If Needed Later)

```typescript
// Message Type
interface ZoomStateMessage {
  type: 'zoom-state';
  viewport: {
    zoom: number;    // 1.0 - 3.0
    panX: number;    // normalized 0.0 - 1.0
    panY: number;    // normalized 0.0 - 1.0
  };
  timestamp: number; // DOMHighResTimeStamp
}

// Example
{
  "type": "zoom-state",
  "viewport": {
    "zoom": 2.0,
    "panX": 0.25,
    "panY": 0.5
  },
  "timestamp": 1234567890.123
}
```

**Normalized Coordinates**: Pan values normalized (0.0 - 1.0) to be resolution-independent:
- `normalizedPanX = panX / maxPanX`
- `normalizedPanY = panY / maxPanY`

### Implementation (If Needed)

**Baby Station**:
```typescript
// Create data channel
const dataChannel = peerConnection.createDataChannel('zoom-metadata');

// Send on zoom/pan change
const sendZoomState = (viewport: Viewport) => {
  if (dataChannel.readyState === 'open') {
    const message: ZoomStateMessage = {
      type: 'zoom-state',
      viewport: {
        zoom: viewport.zoom,
        panX: viewport.panX / maxPanX,
        panY: viewport.panY / maxPanY
      },
      timestamp: performance.now()
    };
    dataChannel.send(JSON.stringify(message));
  }
};
```

**Parent Station**:
```typescript
// Receive data channel
peerConnection.addEventListener('datachannel', (event) => {
  if (event.channel.label === 'zoom-metadata') {
    event.channel.addEventListener('message', (msgEvent) => {
      const message: ZoomStateMessage = JSON.parse(msgEvent.data);
      // Display zoom indicator in UI
      showZoomIndicator(message.viewport.zoom);
    });
  }
});
```

## Why This Is Optional

1. **FR-017**: Parent stations are view-only - they receive video, don't control zoom
2. **No UI Requirement**: Feature spec has no parent station zoom indicator requirement
3. **Simplicity-First**: Adding data channel adds complexity for no immediate user value
4. **YAGNI**: Only build what is needed today - defer until explicit requirement

## Decision

**For MVP**: Do NOT implement zoom state data channel.  
**Rationale**: Violates Simplicity-First and YAGNI principles. Parent stations receiving zoomed video is sufficient.  
**Future Enhancement**: Add if/when parent station UI needs to display zoom metadata.

