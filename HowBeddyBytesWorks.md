# How BeddyBytes Works
## WebRTC
The central technology that enables BeddyBytes is WebRTC. WebRTC allows audio and video streaming through peer-to-peer (P2P) communication. This P2P communcation is what allows me to be certain about the privacy of the BeddyBytes system. By having the P2P communication never leave your home network it almost doesn't matter if I do a terrible job on the BeddyBytes backend. To compromise the audio/video stream being sent using BeddyBytes someone would have to have access to your home WiFi. They'd have to be physically nearby, they'd need to know your WiFi password and finally they'd need to know your BeddyBytes password. But knowing the BeddyBytes password alone would only allow someone to see that a session is currently running, they'd be unable to view the session without having access to the same network. 

## Signalling
To facilitate two devices establishing a WebRTC connection a signalling mechanism is required. This signalling mechanism is what enables the two devices to find each other. WebRTC has 3 message types, offer, accept and ICE candidate. You can think of ICE candidates as possible routes to reach the other device. These possible routes need to be sent from one device to the other before the WebRTC connection is established. 

If it weren't for the need of signalling BeddyBytes wouldn't need a backend. It wouldn't even require accounts. 

The way BeddyBytes performs signalling is for both devices to open a connection to the BeddyBytes server 

## Establishing a WebRTC connection
### Baby Station
When you click start on the BeddyBytes baby station two things happen. First it sends a message to the server creating a session, this message contains the device's client ID (random identifier created the first time BeddyBytes runs) and the session name. Second it opens a WebSocket connection with the BeddyBytes server. Then it waits to receive a message on the WebSocket connection from a parent station wantint to connect.

### Parent Station
When you open the parent station the app immediately goes to the backend and gets a list of all the running baby station sessions. It will then automatically connect to the first baby station session. If there is more than one session you'll be able to switch using the dropdown menu. When the parent station connects to the baby station it will first open up a WebSocket connection to the server. Over this connection it will send the required WebRTC messages, to which, when received the baby station will respond with the expected WebRTC messages. 

## Audio and Video
Captured using the builtin browser interface Media Capture.

## Recording
Recording is done entirely in the browser using the builtin MediaRecorder interface. 

## Zoom
Uses HTML canvas to modify the video stream in real time and touch events to capture pan and zoom gestures. 

## Fullscreen
Using the builtin browser video interface.

## Picture in picture
Using the builtin browser picture-in-picture interface.