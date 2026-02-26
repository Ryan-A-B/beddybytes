# How BeddyBytes Works

BeddyBytes was not designed by starting with infrastructure.  
It started with a simple question:

## Why Can’t My Phone Do This Already?

A phone already has:

- A camera  
- A microphone  
- A browser  
- WiFi  

If two devices are on the same network, why can’t they stream directly to each other?

Well, it turns out they can.

---

## Discovering WebRTC: Direct Browser-to-Browser Streaming

WebRTC is a browser technology that allows two devices to establish an encrypted, peer-to-peer connection. Once connected, they can exchange audio and video directly.

Crucially:

- The media does not pass through an application server.
- The connection is encrypted end-to-end between browsers.
- The stream travels directly from one device to the other.

In BeddyBytes, WebRTC is configured with **no STUN or TURN servers**. That means:

- No relay infrastructure  
- No fallback to cloud routing  
- No third-party traversal services  

If two devices cannot connect locally, the stream fails. It is never rerouted through external infrastructure.

This is the foundation of the privacy model.

So, WebRTC is perfect, except. 

---

## The Signalling Problem

WebRTC can stream directly — but two browsers cannot discover each other on their own.

Before a peer-to-peer connection can be established, the devices must exchange:

- A Session Decription Protocal (SDP) offer
- A SDP answer
- ICE candidates (possible local network paths)

This exchange is called **signalling**.

Signalling does not contain video or audio.
It contains connection metadata.

To solve this, BeddyBytes introduces a minimal backend.

---

## Why a Backend Exists at All

The BeddyBytes server has one job during streaming:

**To introduce two devices.**

When you click **Start** on the Baby Station:

1. A session is created on the backend.  
2. A WebSocket connection opens for signalling.  
3. The device waits.  

When you open the Parent Station:

1. It retrieves a list of active sessions.  
2. It opens its own WebSocket connection.  
3. It exchanges signalling messages with the Baby Station.  
4. A direct WebRTC connection is established.  
5. Media begins streaming directly between devices.  

- The server takes no part in media transport. 
- All video and audio flow only through the peer connection.
- The Baby Station keeps it's websocket open to allow other parent stations to connect. And also to reconnect in the case of lost connections. 

The server never receives video frames.  
It never receives audio samples.  
It never relays media packets.

It only relays connection metadata long enough for the devices to find each other.

In fact, I wouldn't be able to offer BeddyBytes at the price it is if it were relaying video. 

At this point we're ready to serve a single family. But, what happens if we want to serve multiple families at the same time?

---

## Why Accounts Were Added

Signalling alone is enough to connect two devices. 
But, without separation my sessions would appear in your list and yours would appear in mine. 
Our devices still wouldn't be able to connect to each other, due to being on different home networks. 

Accounts are used for authentication and session separation.  
They are not used to store media or monitor usage.

---

## Data Flow During Streaming

Once connected, the data flow is simple:

### Baby Station

- Camera and microphone accessed via the browser (`getUserMedia`)  
- Media fed into a WebRTC peer connection  

### Network

- Encrypted peer-to-peer transport  
- Local network only  

### Parent Station

- Receives media stream  
- Renders video in the browser  

### What the Backend Sees

- Client IDs (random identifier created the first time the app is opened)
- Session IDs (random identifier created for each session)
- SDP offers and answers
- ICE candidates

### What the Backend Does *Not* See

- Video frames  
- Audio data  
- Recordings  

---

## Recording Without Using the Server

Once BeddyBytes was up and running it wasn't long before we wanted to add recording. Our little one would do something cute in the cot and we'd be scrambling to grab a phone to take a photo or video of the parent station. Like some tech illiterate taking a photo of a screenshot on someone elses phone. 

The path most baby monitors take to recording is to record and store on their servers. Then the recordings can be conveniently accessed from anywhere. The cost of that convenience however is privacy, or at least risk of privacy breach. For me this tradeoff being unacceptable was a foregone conclusion. BeddyBytes had to record directly on the user's devices. Happily most browsers support this though the MediaRecorder interface. 

When you click the record button on your BeddyBytes Parent Station it will start up a MediaRecorder instance, attach the media stream from the baby station and begin recording in memory. When you stop the recording it is automatically transferred to your downloads folder. And you know it is not being downloaded from a remote server because the download is instant. 

No recording data is transmitted to the backend.  
No recordings are stored server-side.

---

## Zoom Without Cloud Processing

To start with we had our baby station phone mounted on the side of the cot with a 3D printed bracket. However this came to an end quickly when our little one started standing. And grabbing. So, we moved the phone to sit on a bench across the room. Suddenly the cot looked like a tiny postcard. So arose the obvious solution, zoom. Once again we knew this had to be done locally on the user devices. And the baby station made the most sense because it was before the compression WebRTC so it would preserve the most detail. HTML Canvas to the rescue. The baby station grabs the zoomed in portion of the Video frame and draw it on the canvas. Then we capture a video stream from the canvas and ship that to the parent station instead. This also means that the modified video stream is instantly replicated in all parent stations. 

All video transformation happens locally in the browser.

The backend remains uninvolved.

---

## Session Lifecycle

One thing I was determined to avoid was “ghost sessions”.

When you click **Stop** on the Baby Station:

1. A close message is sent to any connected Parent Stations.  
2. All WebRTC peer connections are closed.  
3. WebSocket signalling connections are closed.  
4. The session is deleted from the backend.  

That’s it.

There’s no archive.
There’s no hidden buffer.
There’s no “just in case” copy sitting somewhere.

If you’re not actively running a session, there is no live stream.  
If you stop the session, the connection is torn down and the server forgets it ever existed.

The system is intentionally ephemeral.

---

## What Happens If the Connection Drops?

WebRTC connections can drop. WiFi can wobble. Browsers can decide they’d rather save battery than keep a camera running.

When that happens:

- The peer connection detects the change in state.
- The Parent Station discards the broken connection.
- A fresh connection attempt is made through the signalling channel.

The backend still does not carry video.  
It simply helps the two devices reintroduce themselves.

If the devices cannot reconnect locally, the stream fails.  
There is no fallback to a relay server somewhere else.

That is a deliberate tradeoff.

---

## Threat Model

It’s easy to say “it’s private.”  
It’s more useful to define what that actually means.

To view a BeddyBytes stream, an attacker would need:

1. Access to your local network  
2. Access to the Baby Station device  
3. Valid account credentials  
4. An active running session  

Without local network access, there is no route to the stream.  
There is no cloud endpoint to target.

BeddyBytes does **not** protect against:

- A compromised home network  
- Malware on your device  
- Someone with physical access to your hardware  

It does remove one large category of risk:

Your video is not stored on, processed by, or relayed through external infrastructure.

There is no central media repository to breach.

---

## What the Server Actually Does

For clarity, the backend is responsible for:

- Account authentication  
- License validation  
- Session metadata  
- Signalling messages (SDP + ICE candidates)  

It is **not** responsible for:

- Video transport  
- Audio transport  
- Recording storage  
- Media processing  

If the backend were to disappear mid-stream, existing WebRTC connections would continue until they naturally closed. The media path does not depend on it once established.

That separation is intentional.

---

## Why It Is Built This Way

BeddyBytes is deliberately constrained:

- Browser-based  
- Local-only streaming  
- No STUN servers  
- No TURN relays  
- No cloud media storage  
- No server-side video processing  

The backend introduces devices.  
The devices establish an encrypted peer-to-peer connection.  
The backend steps out of the way.

When you stop the session, the system dismantles itself.

This architecture is not the most convenient way to build a baby monitor.  
It is the most straightforward way to keep your video inside your own walls.

The privacy properties of BeddyBytes are not promises layered on top of the system.

They are a consequence of how it is built.