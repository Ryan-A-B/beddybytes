# TODO
## Now
### Bugs
- reconnect WebRTC
- improve logic for knowing when a session has ended
- server rebooted event to mark all clients as disconnected?
- when changing camera stop current stream first

### Features
- show camera battery level on monitor
- picture in picture for all browsers
    - currently only firefox displays button
    - close if connection lost
- add cloudfront content security policy and permissions policy to cloudformation
- backup eventlog to S3
- integration tests for API prod release
- stats

## Next
### Bugs
- PaymentLinkMutex is expensive
- mock square for testing
- responive slightly broken on phone (S7)
- replace react logo
- server hardening
- websocket to notify when a new camera comes online
- S7 -> Latitude 7430 no video shows
    - incompatible encodings?
    - chrome works
- S7 switching cameras fails
    - S22 works with chrome
        - but not brave
- delay payment until end of trial period
    - or end of active subscription

### Features
- pause subscription
- connection lost
    - attempt reconnect
    - Picture in Picture doesn't support custom elements
        - disable picture in picture when connection is lost
- monitor time taken to connect call
    - show spinner
- edit device metadata
- Progressive Web App
- microphone from monitor (default muted)
- record button on monitor (picture and video)
    - instruct camera to do the recording (better quality)
    - record the stream coming over webrtc (more intuitive)
    - both? record on camera then send over data stream to monitor?
- show number of active connections
- continuous integration
- noise when connection lost
- battery usage analytics

## Later
### Bugs
- microphone didn't come through when also playing sound from different app?
- scale
    - use AWS IoT as message broker on production
        - when monitor comes on line it sends message asking what cameras are available
            - accounts/{account_id}
        - for WebRTC negotiation 
            - accounts/{account_id}/to_device/{device_id}/from_device/{device_id}
- frontend/node_modules/react-scripts/config/webpackDevServer.config.js
    - devServer.client.webSocketURL.protocol = wss

### Features
- configurable signal server
- configurable STUN server
- use colour from the video stream to set background colour
    - display video twice
        - fullscreen in background blurred
        - actual video stream
- Lighting payments
