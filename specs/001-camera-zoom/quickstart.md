# Developer Quickstart: Camera Zoom Implementation

**Date**: 2026-01-23  
**Feature**: 001-camera-zoom  
**Estimated Effort**: 3-5 days (with tests)

## Prerequisites

- Node.js 16+ and npm installed
- VS Code or similar IDE
- Chrome/Safari with touch device emulation
- Familiarity with React hooks and TypeScript
- Understanding of WebRTC basics (helpful but not required)

## Setup

```bash
# Navigate to project root
cd /home/ryan/Documents/beddybytes

# Install frontend dependencies (if not already done)
cd frontend
npm install

# Start development server
npm start

# In another terminal, run tests in watch mode
npm test -- --watch
```

## Implementation Roadmap

### Phase 1: Core Infrastructure (Day 1)

**Goal**: Set up canvas pipeline and basic rendering

#### Step 1.1: Create Canvas Renderer Module

**File**: `frontend/src/pages/BabyStation/ZoomControls/CanvasRenderer.ts`

```typescript
interface CanvasRendererConfig {
  canvas: HTMLCanvasElement;
  sourceVideo: HTMLVideoElement;
  frameRate: number;
}

class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private sourceVideo: HTMLVideoElement;
  private frameRate: number;
  private rendering: boolean = false;
  private animationFrameId: number | null = null;

  constructor(config: CanvasRendererConfig) {
    // Implementation
  }

  start(): void {
    // Start requestAnimationFrame loop
  }

  stop(): void {
    // Stop rendering loop
  }

  getCaptureStream(): MediaStream {
    return this.canvas.captureStream(this.frameRate);
  }

  private renderFrame = (): void => {
    // Basic rendering: copy full video to canvas
    this.context.drawImage(
      this.sourceVideo,
      0, 0, this.canvas.width, this.canvas.height
    );
    
    if (this.rendering) {
      this.animationFrameId = requestAnimationFrame(this.renderFrame);
    }
  };
}
```

**Test**: `frontend/src/pages/BabyStation/ZoomControls/CanvasRenderer.test.ts`

```typescript
describe('CanvasRenderer', () => {
  it('creates capture stream from canvas', () => {
    // Test getCaptureStream() returns MediaStream
  });

  it('starts and stops rendering loop', () => {
    // Test start() and stop() methods
  });
});
```

**Verification**:
```bash
npm test -- CanvasRenderer.test.ts
```

#### Step 1.2: Integrate Canvas into MediaStream Component

**File**: `frontend/src/pages/BabyStation/MediaStream.tsx` (MODIFY)

**Before**:
```tsx
<video ref={videoRef} autoPlay playsInline muted className="video" />
```

**After**:
```tsx
<div className="video-container">
  <video 
    ref={videoRef} 
    autoPlay 
    playsInline 
    muted 
    style={{ display: 'none' }}  {/* Hidden - source only */}
  />
  <canvas 
    ref={canvasRef}
    className="video"  {/* Takes over display */}
  />
</div>
```

**Implementation**:
```tsx
const canvasRef = React.useRef<HTMLCanvasElement>(null);
const rendererRef = React.useRef<CanvasRenderer | null>(null);

// Initialize canvas dimensions to match video
React.useEffect(() => {
  if (!videoRef.current || !canvasRef.current) return;
  if (media_device_state.media_stream_state.state !== 'available') return;

  const video = videoRef.current;
  const canvas = canvasRef.current;

  // Wait for video metadata
  const handleLoadedMetadata = () => {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Create renderer
    rendererRef.current = new CanvasRenderer({
      canvas,
      sourceVideo: video,
      frameRate: 30
    });
    rendererRef.current.start();
  };

  video.addEventListener('loadedmetadata', handleLoadedMetadata);
  if (video.readyState >= 1) handleLoadedMetadata();

  return () => {
    video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    rendererRef.current?.stop();
  };
}, [media_device_state.media_stream_state]);
```

**Verification**:
- Start baby station
- Canvas should display camera feed (identical to previous video element)
- Check browser console for errors
- Verify parent station still receives video

### Phase 2: Viewport State Management (Day 2)

**Goal**: Implement viewport state with constraints

#### Step 2.1: Create Viewport Manager

**File**: `frontend/src/pages/BabyStation/ZoomControls/ViewportManager.ts`

```typescript
interface ViewportState {
  zoom: number;
  panX: number;
  panY: number;
}

const DEFAULT_VIEWPORT: ViewportState = {
  zoom: 1.0,
  panX: 0,
  panY: 0
};

export const constrainViewport = (
  viewport: ViewportState,
  videoWidth: number,
  videoHeight: number
): ViewportState => {
  const zoom = Math.max(1.0, Math.min(3.0, viewport.zoom));
  const maxPanX = videoWidth - (videoWidth / zoom);
  const maxPanY = videoHeight - (videoHeight / zoom);

  return {
    zoom,
    panX: Math.max(0, Math.min(maxPanX, viewport.panX)),
    panY: Math.max(0, Math.min(maxPanY, viewport.panY))
  };
};
```

**Test**: `frontend/src/pages/BabyStation/ZoomControls/ViewportManager.test.ts`

```typescript
describe('constrainViewport', () => {
  it('constrains zoom to 1.0 - 3.0', () => {
    const result = constrainViewport(
      { zoom: 5.0, panX: 0, panY: 0 },
      1920, 1080
    );
    expect(result.zoom).toBe(3.0);
  });

  it('constrains pan to viewport bounds', () => {
    // Test pan constraint at various zoom levels
  });

  it('resets pan to 0 when zoom is 1.0', () => {
    // When fully zoomed out, pan should be 0
  });
});
```

**Verification**:
```bash
npm test -- ViewportManager.test.ts
```

#### Step 2.2: Create useZoomGestures Hook

**File**: `frontend/src/hooks/useZoomGestures.ts`

```typescript
export const useZoomGestures = (
  videoRef: React.RefObject<HTMLVideoElement>
) => {
  const [viewport, setViewport] = React.useState<ViewportState>(DEFAULT_VIEWPORT);

  const updateZoom = React.useCallback((newZoom: number) => {
    setViewport(prev => {
      if (!videoRef.current) return prev;
      return constrainViewport(
        { ...prev, zoom: newZoom },
        videoRef.current.videoWidth,
        videoRef.current.videoHeight
      );
    });
  }, [videoRef]);

  const updatePan = React.useCallback((deltaX: number, deltaY: number) => {
    setViewport(prev => {
      if (!videoRef.current) return prev;
      return constrainViewport(
        { ...prev, panX: prev.panX + deltaX, panY: prev.panY + deltaY },
        videoRef.current.videoWidth,
        videoRef.current.videoHeight
      );
    });
  }, [videoRef]);

  const resetViewport = React.useCallback(() => {
    setViewport(DEFAULT_VIEWPORT);
  }, []);

  const isDefaultViewport = viewport.zoom === 1.0;

  return { viewport, updateZoom, updatePan, resetViewport, isDefaultViewport };
};
```

**Verification**: Test in isolation or integration with MediaStream component

### Phase 3: Gesture Recognition (Day 3)

**Goal**: Implement touch gesture handling

#### Step 3.1: Create Gesture Handler

**File**: `frontend/src/pages/BabyStation/ZoomControls/GestureHandler.ts`

```typescript
type GestureCallback = (event: GestureEvent) => void;

class GestureHandler {
  private canvas: HTMLCanvasElement | null = null;
  private listeners: Set<GestureCallback> = new Set();
  
  // Gesture tracking state
  private touchStartDistance: number | null = null;
  private initialZoom: number = 1.0;
  private lastTouchPoint: { x: number; y: number } | null = null;

  attach(canvas: HTMLCanvasElement, currentZoom: number): void {
    this.canvas = canvas;
    this.initialZoom = currentZoom;
    
    canvas.addEventListener('touchstart', this.handleTouchStart);
    canvas.addEventListener('touchmove', this.handleTouchMove);
    canvas.addEventListener('touchend', this.handleTouchEnd);
  }

  detach(): void {
    if (this.canvas) {
      this.canvas.removeEventListener('touchstart', this.handleTouchStart);
      this.canvas.removeEventListener('touchmove', this.handleTouchMove);
      this.canvas.removeEventListener('touchend', this.handleTouchEnd);
      this.canvas = null;
    }
  }

  addListener(callback: GestureCallback): void {
    this.listeners.add(callback);
  }

  removeListener(callback: GestureCallback): void {
    this.listeners.delete(callback);
  }

  private handleTouchStart = (event: TouchEvent): void => {
    if (event.touches.length === 2) {
      // Pinch gesture
      this.touchStartDistance = this.getDistance(
        event.touches[0], 
        event.touches[1]
      );
    } else if (event.touches.length === 1) {
      // Pan gesture
      this.lastTouchPoint = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY
      };
    }
  };

  private handleTouchMove = (event: TouchEvent): void => {
    if (event.touches.length === 2 && this.touchStartDistance !== null) {
      event.preventDefault();  // Prevent page zoom
      this.handlePinch(event);
    } else if (event.touches.length === 1 && this.lastTouchPoint !== null) {
      if (this.initialZoom > 1.0) {
        event.preventDefault();  // Prevent scroll when zoomed
        this.handlePan(event);
      }
    }
  };

  private handleTouchEnd = (event: TouchEvent): void => {
    if (event.touches.length < 2) {
      this.touchStartDistance = null;
    }
    if (event.touches.length === 0) {
      this.lastTouchPoint = null;
    }
  };

  private handlePinch(event: TouchEvent): void {
    const currentDistance = this.getDistance(event.touches[0], event.touches[1]);
    const scale = currentDistance / this.touchStartDistance!;
    
    const gestureEvent: PinchGestureEvent = {
      type: 'pinch',
      touchCount: 2,
      timestamp: performance.now(),
      distance: currentDistance,
      previousDistance: this.touchStartDistance!,
      scale
    };

    this.emit(gestureEvent);
    this.touchStartDistance = currentDistance;
  }

  private handlePan(event: TouchEvent): void {
    const touch = event.touches[0];
    const deltaX = touch.clientX - this.lastTouchPoint!.x;
    const deltaY = touch.clientY - this.lastTouchPoint!.y;

    const gestureEvent: PanGestureEvent = {
      type: 'pan',
      touchCount: 1,
      timestamp: performance.now(),
      startPoint: this.lastTouchPoint!,
      currentPoint: { x: touch.clientX, y: touch.clientY },
      deltaX,
      deltaY
    };

    this.emit(gestureEvent);
    this.lastTouchPoint = { x: touch.clientX, y: touch.clientY };
  }

  private getDistance(touch1: Touch, touch2: Touch): number {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private emit(event: GestureEvent): void {
    this.listeners.forEach(callback => callback(event));
  }
}
```

**Test**: `frontend/src/pages/BabyStation/ZoomControls/GestureHandler.test.ts`

```typescript
describe('GestureHandler', () => {
  it('recognizes pinch gesture from two touches', () => {
    // Mock TouchEvent with 2 touches
    // Verify pinch event emitted
  });

  it('recognizes pan gesture when zoomed', () => {
    // Mock single touch movement
    // Verify pan event emitted only if zoom > 1.0
  });

  it('prevents default on gestures to avoid browser zoom/scroll', () => {
    // Verify event.preventDefault() called
  });
});
```

### Phase 4: Integrate Viewport with Rendering (Day 4)

**Goal**: Apply viewport transform to canvas rendering

#### Step 4.1: Modify CanvasRenderer to Accept Viewport

```typescript
class CanvasRenderer {
  private viewport: ViewportState = DEFAULT_VIEWPORT;

  setViewport(viewport: ViewportState): void {
    this.viewport = viewport;
  }

  private renderFrame = (): void => {
    const sourceWidth = this.sourceVideo.videoWidth / this.viewport.zoom;
    const sourceHeight = this.sourceVideo.videoHeight / this.viewport.zoom;

    this.context.drawImage(
      this.sourceVideo,
      this.viewport.panX, this.viewport.panY, sourceWidth, sourceHeight,  // Source crop
      0, 0, this.canvas.width, this.canvas.height                          // Dest (full canvas)
    );

    if (this.rendering) {
      this.animationFrameId = requestAnimationFrame(this.renderFrame);
    }
  };
}
```

#### Step 4.2: Wire Up Gestures in MediaStream Component

```tsx
const { viewport, updateZoom, updatePan, resetViewport, isDefaultViewport } = 
  useZoomGestures(videoRef);

// Create gesture handler
React.useEffect(() => {
  if (!canvasRef.current || !sessionActive) return;

  const gestureHandler = new GestureHandler();
  gestureHandler.attach(canvasRef.current, viewport.zoom);

  gestureHandler.addListener((event) => {
    if (event.type === 'pinch') {
      updateZoom(viewport.zoom * event.scale);
    } else if (event.type === 'pan') {
      updatePan(event.deltaX, event.deltaY);
    }
  });

  return () => gestureHandler.detach();
}, [sessionActive, viewport.zoom, updateZoom, updatePan]);

// Update renderer viewport
React.useEffect(() => {
  if (rendererRef.current) {
    rendererRef.current.setViewport(viewport);
  }
}, [viewport]);
```

**Verification**:
- Use Chrome DevTools device emulation (touch mode)
- Pinch gesture should zoom camera view
- Single-finger drag when zoomed should pan
- Verify zoomed feed transmitted to parent station

### Phase 5: UI Enhancements (Day 5)

**Goal**: Add reset button and zoom indicator

#### Step 5.1: Reset Button

```tsx
{!isDefaultViewport && sessionActive && (
  <button 
    onClick={resetViewport}
    className="btn btn-secondary zoom-reset-btn"
    aria-label="Reset zoom"
  >
    Reset Zoom
  </button>
)}
```

#### Step 5.2: Zoom Indicator (Optional)

```tsx
{viewport.zoom > 1.0 && (
  <div className="zoom-indicator">
    {Math.round(viewport.zoom * 100)}%
  </div>
)}
```

### Phase 6: Testing (Ongoing)

#### Integration Tests

**File**: `integration_tests/src/test_zoom_functionality.py`

```python
def test_baby_station_zoom_transmitted_to_parent():
    """Verify zoomed video feed reaches parent station"""
    # Start baby station with camera
    # Connect parent station
    # Simulate pinch gesture (via WebDriver touch events)
    # Verify parent receives zoomed feed (check video dimensions/content)
    pass

def test_zoom_state_persists_across_parent_reconnection():
    """Verify parent receives current zoom when connecting mid-session"""
    # Start baby station, zoom to 200%
    # Connect parent station
    # Verify parent immediately sees 200% zoomed feed
    pass
```

**Run**:
```bash
./run_integration_tests.sh
```

## Common Gotchas

1. **Canvas not updating**: Ensure `requestAnimationFrame` loop is running
2. **Touch events not firing**: Check `touch-action` CSS property
3. **Video dimensions zero**: Wait for `loadedmetadata` event before accessing `videoWidth/videoHeight`
4. **Parent station sees unzoomed**: Verify `Connections.ts` receives canvas stream, not original video stream
5. **Gestures laggy**: Throttle state updates (use ref for gesture calculations, batch setState)
6. **No audio**: Audio stream lost, not added to WebRTC stream

## Performance Monitoring

```typescript
// Add to renderFrame()
const startTime = performance.now();
// ... rendering code ...
const frameTime = performance.now() - startTime;
if (frameTime > 33) {  // 30fps = 33ms per frame
  console.warn(`Slow frame: ${frameTime.toFixed(2)}ms`);
}
```

## Debugging Tips

- Use Chrome DevTools: Sensors → Touch → Enable
- Check `canvas.captureStream()` in console: `$0.captureStream(30).getVideoTracks()[0]`
- Monitor WebRTC stats: `chrome://webrtc-internals/`
- Test on real device: Use QR code + local IP for mobile testing

## Next Steps After MVP

- Add mouse/trackpad support for desktop
- Implement smooth animations (currently instant per FR-026)
- Add pinch-to-zoom center point (zoom toward touch midpoint)
- Persist zoom settings across sessions
- Add zoom level presets (1.5x, 2x, 3x buttons)

## Questions / Issues?

See [spec.md](../spec.md) for requirements or [research.md](../research.md) for technical decisions.

