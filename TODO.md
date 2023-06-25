# TODO
## Now
### Bugs
- logs
- stats

### Features
- payments

## Next
### Bugs
- responive slightly broken on phone (S7)
- replace react favicon
- server hardening
- websocket to notify when a new camera comes online
- S7 -> Latitude 7430 no video shows
    - incompatible encodings?
    - chrome works
- only get new token on demand
    - `getToken` function in context

### Features
- connection lost
    - attempt reconnect
    - Picture in Picture doesn't support custom elements
        - disable picture in picture when connection is lost
- call duration
- monitor time taken to connect call
    - show spinner
- edit device metadata
- Progressive Web App
- microphone from monitor (default muted)
- record button on monitor (picture and video)
    - instruct camera to do the recording (better quality)
    - record the stream coming over webrtc (more intuitive)
    - both? record on camera then send over data stream to monitor?
- configurable signal server
- configurable STUN server
- show number of active connections
- continuous integration

## Later
### Bugs
- scale
    - use AWS IoT as message broker on production
        - when monitor comes on line it sends message asking what cameras are available
            - accounts/{account_id}
        - for WebRTC negotiation 
            - accounts/{account_id}/to_device/{device_id}/from_device/{device_id}
- frontend/node_modules/react-scripts/config/webpackDevServer.config.js
    - devServer.client.webSocketURL.protocol = wss

### Features
- use colour from the video stream to set background colour
    - display video twice
        - fullscreen in background blurred
        - actual video stream
- Lighting payments
