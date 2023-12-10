# TODO
## Now
### Bugs
- backup eventlog to S3
- reconnect WebRTC
- when app has failed to refresh token it doesn't retry
- improve logic for knowing when a session has ended
- refresh token already used results in bricked app
    - from too fast refreshes

### Features
- indicate that the connection is being established
- record monitor events

- show camera battery level on monitor
- picture in picture for all browsers
    - currently only firefox displays button
    - close if connection lost
- add cloudfront content security policy and permissions policy to cloudformation
- integration tests for API prod release

## Next
### Bugs
- PaymentLinkMutex is expensive
- mock square for testing
- responive slightly broken on phone (S7)
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
