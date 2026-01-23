# Research: Camera Zoom Implementation

**Date**: 2026-01-23  
**Feature**: 001-camera-zoom  
**Purpose**: Document technical decisions, best practices, and implementation patterns

## Research Topics

### 1. HTMLCanvasElement.captureStream() for WebRTC

**Decision**: Use `canvas.captureStream(frameRate)` to convert canvas rendering to MediaStream  
**Rationale**: 
- Native browser API designed specifically for this use case
- Returns MediaStream compatible with RTCPeerConnection.addTrack()
- Supports frame rate control (target 15-30 fps per FR-021)
- Zero external dependencies required

**Best Practices**:
- Call `captureStream()` once after canvas setup, not on every frame
- Specify frame rate explicitly: `canvas.captureStream(30)` for 30 fps
- Canvas updates automatically propagate to stream - no manual sync required
- Keep canvas dimensions matching video source to avoid quality loss

**Performance Considerations**:
- Canvas rendering is synchronous and blocks main thread
- Use `requestAnimationFrame()` for smooth rendering loop
- Consider OffscreenCanvas for future optimization (not initial scope)

**Browser Compatibility**:
- Chrome/Edge: Full support
- Safari iOS: Supported (13.1+)
- Firefox: Supported
- Touch-device focus aligns with best browser support

**Alternatives Considered**:
- MediaStream Image Capture API: Too low-level, requires manual frame extraction
- WebCodecs API: Too complex, requires manual encoding - violates Simplicity-First
- Server-side video processing: Breaks Privacy-First principle, adds backend complexity

**Source**: MDN Web Docs, WebRTC samples repository

---

### 2. Touch Gesture Recognition (Pinch & Pan)

**Decision**: Use native TouchEvent API with manual distance calculations  
**Rationale**:
- Standard browser API, no external dependencies
- Full control over gesture thresholds and behavior
- Lightweight - no gesture library overhead
- Clear and debuggable code

**Implementation Pattern**:

```typescript
// Pinch detection: Calculate distance between two touch points
const getDistance = (touch1: Touch, touch2: Touch): number => {
  const dx = touch1.clientX - touch2.clientX;
  const dy = touch1.clientY - touch2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
};

// Track initial distance on touchstart with 2 fingers
let initialDistance: number | null = null;
let initialZoom: number = 1.0;

const handleTouchStart = (event: TouchEvent) => {
  if (event.touches.length === 2) {
    initialDistance = getDistance(event.touches[0], event.touches[1]);
    initialZoom = currentZoom;
  }
};

const handleTouchMove = (event: TouchEvent) => {
  if (event.touches.length === 2 && initialDistance !== null) {
    const currentDistance = getDistance(event.touches[0], event.touches[1]);
    const scale = currentDistance / initialDistance;
    const newZoom = Math.max(1.0, Math.min(3.0, initialZoom * scale));
    updateZoom(newZoom);
  } else if (event.touches.length === 1 && currentZoom > 1.0) {
    // Single-finger pan when zoomed
    handlePan(event.touches[0]);
  }
};
```

**Gesture Conflict Resolution**:
- 2 touches = pinch (zoom) - disables pan
- 1 touch + zoomed = pan - disables scroll
- 1 touch + not zoomed = scroll (default browser behavior)
- Call `event.preventDefault()` only when handling gesture to avoid blocking scroll

**Best Practices**:
- Debounce viewport updates to avoid excessive re-renders
- Store gesture state in React ref (not state) for synchronous access
- Clean up event listeners on component unmount
- Respect browser touch-action CSS property

**Alternatives Considered**:
- Hammer.js: 20KB library, adds complexity - violates Simplicity-First
- Pointer Events API: Desktop-focused, complicates touch-only initial scope
- React gesture libraries (react-use-gesture): Adds dependency, learning curve

**Source**: MDN TouchEvent documentation, Google touch gesture guidelines

---

### 3. Canvas Rendering with Viewport Transform

**Decision**: Use `CanvasRenderingContext2D.drawImage()` with crop parameters  
**Rationale**:
- Built-in method for drawing sub-regions of source image
- Single API call per frame - optimal performance
- Handles aspect ratio preservation automatically

**Implementation Pattern**:

```typescript
// Given:
// - sourceVideo: HTMLVideoElement with camera feed
// - viewport: { zoom: number, panX: number, panY: number }
// - canvas: HTMLCanvasElement

const renderFrame = () => {
  const ctx = canvas.getContext('2d')!;
  
  // Calculate source rectangle (portion of video to extract)
  const sourceWidth = sourceVideo.videoWidth / viewport.zoom;
  const sourceHeight = sourceVideo.videoHeight / viewport.zoom;
  const sourceX = viewport.panX;
  const sourceY = viewport.panY;
  
  // Draw cropped/zoomed region to full canvas
  ctx.drawImage(
    sourceVideo,
    sourceX, sourceY, sourceWidth, sourceHeight,  // Source rectangle
    0, 0, canvas.width, canvas.height             // Destination (full canvas)
  );
  
  requestAnimationFrame(renderFrame);
};
```

**Viewport Boundary Constraints**:

```typescript
const constrainViewport = (viewport: Viewport, videoWidth: number, videoHeight: number): Viewport => {
  const maxPanX = videoWidth - (videoWidth / viewport.zoom);
  const maxPanY = videoHeight - (videoHeight / viewport.zoom);
  
  return {
    zoom: Math.max(1.0, Math.min(3.0, viewport.zoom)),
    panX: Math.max(0, Math.min(maxPanX, viewport.panX)),
    panY: Math.max(0, Math.min(maxPanY, viewport.panY))
  };
};
```

**Performance Optimization**:
- Set canvas dimensions to match video source dimensions (avoid scaling)
- Use `willReadFrequently: false` context option (default - we're writing, not reading)
- Avoid canvas state changes (fillStyle, strokeStyle) in render loop
- Monitor frame timing to detect GPU bottlenecks

**Alternatives Considered**:
- CSS transform on video element: Doesn't affect captureStream output
- WebGL for rendering: Overkill for simple crop operation, violates Simplicity-First
- SVG filter effects: Poor performance, limited browser support

**Source**: MDN Canvas API documentation, HTML5 Rocks canvas performance guide

---

### 4. State Management for Zoom/Pan

**Decision**: Use React useState + useRef hybrid approach  
**Rationale**:
- useState for UI updates (zoom level display, reset button visibility)
- useRef for gesture calculations (avoid re-render during touch moves)
- Follows existing BeddyBytes patterns (see useServiceState hook)

**Implementation Pattern**:

```typescript
interface ViewportState {
  zoom: number;      // 1.0 - 3.0 (100% - 300%)
  panX: number;      // 0 to (videoWidth - croppedWidth)
  panY: number;      // 0 to (videoHeight - croppedHeight)
}

const useZoomControls = (videoRef: RefObject<HTMLVideoElement>) => {
  const [viewportState, setViewportState] = useState<ViewportState>({
    zoom: 1.0,
    panX: 0,
    panY: 0
  });
  
  // Ref for gesture calculations (avoid stale closures)
  const viewportRef = useRef(viewportState);
  useEffect(() => {
    viewportRef.current = viewportState;
  }, [viewportState]);
  
  const updateZoom = useCallback((newZoom: number) => {
    setViewportState(prev => constrainViewport({ ...prev, zoom: newZoom }));
  }, []);
  
  const updatePan = useCallback((deltaX: number, deltaY: number) => {
    setViewportState(prev => constrainViewport({
      ...prev,
      panX: prev.panX + deltaX,
      panY: prev.panY + deltaY
    }));
  }, []);
  
  const resetViewport = useCallback(() => {
    setViewportState({ zoom: 1.0, panX: 0, panY: 0 });
  }, []);
  
  return { viewportState, updateZoom, updatePan, resetViewport };
};
```

**State Persistence**: 
- NOT persisted to localStorage (setup is per-session, static once configured)
- Follows FR-025: Baby station maintains zoom/pan locally

**Best Practices**:
- Batch state updates during gestures (throttle to 60Hz max)
- Use functional setState updates to avoid race conditions
- Memoize callbacks with useCallback to prevent child re-renders

**Alternatives Considered**:
- Redux/Zustand global state: Overkill for single-component state
- Service class pattern (like existing SessionService): Unnecessary complexity for UI-only state
- No state management (direct DOM manipulation): Violates React patterns, hard to test

**Source**: React hooks documentation, BeddyBytes existing codebase patterns

---

### 5. Integration with Existing WebRTC Pipeline

**Decision**: Replace `video.srcObject` assignment with canvas-based stream in MediaStream.tsx  
**Rationale**:
- Minimal changes to existing Connections.ts (WebRTC handling)
- Connections already accepts MediaStream parameter
- No changes to parent station (receives standard MediaStream)

**Integration Points**:

1. **MediaStream.tsx** (existing component):
   - BEFORE: `video.srcObject = media_stream`
   - AFTER: Render video to canvas → `const stream = canvas.captureStream(30)`
   - Pass canvas stream to Connections

2. **Connections.ts** (existing WebRTC handler):
   - NO CHANGES REQUIRED
   - Already calls `stream.getTracks().forEach(track => connection.addTrack(track, stream))`
   - Canvas stream is drop-in replacement

3. **Parent Station**:
   - NO CHANGES REQUIRED
   - Receives MediaStream via RTCPeerConnection (same as before)
   - Displays on video element (no knowledge of zoom/pan)

**Data Flow**:
```
Camera getUserMedia → HTMLVideoElement (hidden) → Canvas (with transform) 
→ captureStream() → MediaStream → Connections.addTrack() 
→ WebRTC → Parent Station video element
```

**Backward Compatibility**:
- When zoom = 1.0 and pan = (0, 0), output identical to current behavior
- No protocol changes - WebRTC signaling unchanged
- Parent stations receive standard video track (no special handling)

**Testing Strategy**:
- Endurance test: Verify 5+ hour session (reliability)

**Source**: Existing BeddyBytes codebase analysis, WebRTC API documentation

---

### 6. Maximum Zoom Level Determination

**Decision**: Default max zoom 300% (3.0x), configurable if needed  
**Rationale**:
- 300% provides 3x digital zoom without excessive pixelation
- Typical phone cameras: 1080p source → 360p visible area at 3x zoom
- Balances usability (see details far away) with quality
- FR-004 specifies "reasonable default: 300%"

**Quality Considerations**:
- No interpolation during canvas rendering (uses default bilinear)
- Pixelation acceptable for stated use case (initial device positioning, not continuous viewing)
- If quality insufficient, user adjusts physical placement or reduces zoom

**Performance Impact**:
- Higher zoom = smaller source region extracted = FASTER rendering (less pixels to copy)
- Canvas output size remains constant (same bandwidth to parent stations)
- No quality degradation for WebRTC transmission (canvas is already at target resolution)

**Future Enhancements** (out of scope):
- Configurable max zoom via settings UI
- Image enhancement filters (sharpening) at high zoom levels
- Optical zoom API (if supported by device hardware)

**Source**: Feature spec FR-004, digital zoom quality research

---

## Summary

All technical unknowns resolved. Key decisions:

1. **Canvas Pipeline**: video → canvas (drawImage with crop) → captureStream() → WebRTC
2. **Touch Gestures**: Native TouchEvent API with manual distance calculations
3. **State Management**: useState + useRef hybrid (existing BeddyBytes pattern)
4. **Integration**: Minimal changes to existing components (Connections.ts unchanged)
5. **Performance**: Target 30 fps with requestAnimationFrame rendering loop
6. **Testing**: TDD with Jest (unit) + Python integration tests (end-to-end)

Zero external dependencies required. All solutions use standard browser APIs.

