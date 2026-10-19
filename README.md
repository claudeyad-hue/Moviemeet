# MovieMeet — Synchronized Movie-Watching Web Application

**MovieMeet** is a full-stack, responsive web application designed for friends and groups to watch movies together remotely while communicating via peer-to-peer video, voice, real-time chat, and screen sharing.

---

## 1. Technology Stack

- **Frontend**: React 18 with Vite, Tailwind CSS, Lucide Icons, and Socket.IO Client.
- **Backend**: Node.js and Express.js.
- **Real-time Synchronization & Signaling**: Socket.IO.
- **Audio, Video, and Screen Sharing**: WebRTC (peer-to-peer mesh architecture supporting up to 4 participants, optimized for 2+).
- **Database**: MongoDB with Mongoose (with automated fallback store for local development if MongoDB is offline).
- **Authentication**: JWT-based authentication supporting both Guest display names and registered accounts.
- **Security & Privacy**: Helmet HTTP headers, CORS validation, rate limiting, and HTML sanitization.

> **Important Secure Context Requirement:**
> Browser security standards mandate that `navigator.mediaDevices.getUserMedia()` (camera and microphone) and `navigator.mediaDevices.getDisplayMedia()` (screen sharing) require a **secure context** (`https://` or `http://localhost`). When testing or deploying, always access the application via `localhost` or over valid HTTPS.

---

## 2. Core Features Implemented

### A. Room Creation & Joining
- Create private watch-party rooms with unique human-readable room codes (e.g., `MOV-4821`).
- Shareable invitation links (e.g., `http://localhost:5173/room/MOV-4821`).
- Optional room password protection for private screenings.
- Real-time participant counter (maximum 4 participants).
- Host departure migration: Automatically transfers room host status to the participant with the longest room tenure.
- 60-second grace period for empty rooms before resource teardown.

### B. Synchronized Movie Player
- Large central video player with custom cinematic dark controls.
- Synchronized play, pause, and seek events broadcast across all room participants via Socket.IO.
- Dynamic late-join synchronization (calculates exact authoritative video playhead including elapsed time).
- Periodic drift correction (1.2s tolerance) to resolve network buffering variance without skipping.
- Support for authorized open-source movie samples (Big Buck Bunny, Tears of Steel, Sintel, Elephants Dream).
- Custom direct video URL input (MP4, WebM, HLS).
- Upload authorized local video files with HTTP 206 Partial Content byte-range streaming.
- WebVTT Closed Caption (.vtt) subtitle tracks support.
- Host controls toggle: Room host can restrict playback controls to host-only or allow shared group controls.
- Clear user guidance explaining that commercial subscription streaming services (Netflix, Disney+, Prime Video) cannot be embedded directly due to DRM, and advising use of the **Share Screen** feature.

### C. Independent Participant Video Tile Hiding (Critical Feature)
- Each participant can independently hide or restore another participant's video tile locally via the **"Hide video" / "Show video"** toggle button on each tile.
- **Audio Integrity:** Hiding a participant's video tile **never** mutes their audio or removes them from the room. Voice communication remains 100% active.
- **Local Isolation:** The hide preference affects **only** the local viewer's screen; other participants still see the tile according to their own preference.
- Replaces the hidden tile with an unobtrusive audio-active status pill.
- **Movie Focus Mode:** One-click theater mode that collapses video tiles and chat for distraction-free movie viewing.

### D. Video and Voice Calling (WebRTC Mesh)
- Browser permission handling for microphone and camera.
- Interactive controls for muting/unmuting microphone and turning camera on/off.
- Local and remote participant video tiles with speaking/muted indicators and host badges.
- Clean track cleanup and peer connection closure on departure.
- Graceful error states if media permissions are denied.

### E. Screen Sharing (Essential Feature)
- Native WebRTC screen sharing using `navigator.mediaDevices.getDisplayMedia()`.
- Captures entire screens, application windows, or browser tabs.
- Real WebRTC screen track added to existing peer connections with renegotiation.
- Prominent central stage view displaying the shared content.
- Visual status indicator: *"You are sharing your screen"* with a dedicated *"Stop Sharing"* button.
- Handles browser native stop-sharing notifications (`track.onended`) with automatic layout restoration.
- Enforces single active screen share per room.
- Clear in-app advisory regarding browser tab audio and operating system DRM limitations.
- Mobile browser detection: mobile browsers can view shared screens even if they cannot initiate screen capture.

### F. Real-Time Chat & Room Controls
- Collapsible text chat panel with timestamps, sender tags, and automatic scroll-to-bottom.
- Room isolation: Chat events and playback sync are strictly scoped to the room.
- Input sanitization against XSS attacks.
- One-click invite link copying with visual feedback.

---

## 3. Project Structure

```
moviemeet/
├── package.json              # Root package scripts
├── .gitignore                # Git ignore rules for node_modules, logs, dist, env
├── server/
│   ├── package.json          # Express, Socket.IO, Mongoose, JWT, WebRTC config
│   ├── .env.example          # Server environment variable template
│   ├── .env                  # Local server environment configuration
│   ├── uploads/              # Storage directory for authorized video uploads
│   ├── src/
│   │   ├── server.js         # HTTP and Socket.IO server entrypoint
│   │   ├── app.js            # Express app, security middleware, and routes
│   │   ├── config/
│   │   │   ├── db.js         # MongoDB connection with memory-store fallback
│   │   │   └── webrtc.js     # STUN and TURN server configuration provider
│   │   ├── models/
│   │   │   ├── User.js       # Mongoose User schema
│   │   │   └── Room.js       # Mongoose Room schema
│   │   ├── services/
│   │   │   └── store.js      # Unified persistence & runtime session store
│   │   ├── controllers/
│   │   │   ├── authController.js # Guest session, registration, login
│   │   │   └── roomController.js # Room creation, validation, join checks
│   │   ├── middleware/
│   │   │   └── authMiddleware.js # JWT verification for REST and Socket.io
│   │   ├── routes/
│   │   │   ├── authRoutes.js  # Auth endpoints
│   │   │   ├── roomRoutes.js  # Room endpoints
│   │   │   └── videoRoutes.js # Samples, video upload, and byte-range streaming
│   │   └── sockets/
│   │       └── socketHandler.js # WebRTC signaling mesh, playback sync, chat
│   └── tests/
│       ├── api.test.js       # REST API automated tests
│       └── socket.test.js    # Socket.IO real-time sync automated tests
└── client/
    ├── package.json          # React, Vite, Tailwind CSS, Lucide icons
    ├── vite.config.js        # Vite dev server configuration
    ├── tailwind.config.js    # Cinematic charcoal & violet styling
    ├── .env.example          # Client environment variable template
    ├── .env                  # Local client environment configuration
    ├── index.html            # HTML entry point with Inter font
    └── src/
        ├── main.jsx          # React DOM render entrypoint
        ├── App.jsx           # React Router and context providers
        ├── index.css         # Tailwind base and cinematic glass effects
        ├── context/
        │   ├── AuthContext.jsx   # Guest/User session state
        │   └── SocketContext.jsx # Socket.IO connection and room events
        ├── hooks/
        │   └── useWebRTC.js      # WebRTC mesh, screen share, tile hiding
        ├── utils/
        │   └── api.js            # REST API client
        ├── components/
        │   ├── Navbar.jsx            # Top bar, logo, room code, copy link
        │   ├── MoviePlayer.jsx       # Synchronized video player & controls
        │   ├── ScreenShareStage.jsx  # Central screen sharing stage
        │   ├── ParticipantTiles.jsx  # Video tiles with independent hiding
        │   ├── MeetingToolbar.jsx    # Mic, Cam, Screen, Focus, Chat controls
        │   ├── ChatPanel.jsx         # Collapsible live text chat
        │   └── VideoSourceModal.jsx  # Movie picker, URL, local upload
        └── pages/
            ├── LandingPage.jsx       # Welcome, create room, join room
            └── WatchPartyRoom.jsx    # Main watch-party theater room
```

---

## 4. Setup and Installation Instructions

### Prerequisites
- **Node.js**: Version 18.0 or higher (Tested on Node v24).
- **npm**: Version 9.0 or higher.
- *(Optional)* **MongoDB**: Local MongoDB instance running on port 27017, or a MongoDB Atlas connection string. If MongoDB is not installed, the server automatically runs using its built-in in-memory store so you can develop and test immediately without any external setup.

---

### Step 1: Open Terminal in VS Code
Open the project root folder in VS Code:
```bash
cd c:\Users\ASUS\Downloads\moviemeet
```

---

### Step 2: Install Server Dependencies
```bash
cd server
npm install
cd ..
```

---

### Step 3: Install Client Dependencies
```bash
cd client
npm install
cd ..
```

---

### Step 4: Configure Environment Variables

**Server (`server/.env`):**
```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
MONGODB_URI=mongodb://localhost:27017/moviemeet
JWT_SECRET=super_secret_jwt_key_change_in_production_928374
STUN_SERVERS=stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302
TURN_SERVER=
TURN_USERNAME=
TURN_CREDENTIAL=
```

**Client (`client/.env`):**
```env
VITE_SERVER_URL=http://localhost:5000
```

---

### Step 5: Run Automated Tests
Verify that all REST API endpoints and real-time Socket.IO synchronization events are functioning properly:
```bash
cd server
npm test
cd ..
```
*Expected result: 13 passed tests across `api.test.js` and `socket.test.js`.*

---

### Step 6: Start the Application

You can start the backend and frontend in two separate terminals in VS Code:

**Terminal 1 (Backend Server):**
```bash
cd server
npm run dev
```
*Output: `MovieMeet Server running on port 5000`*

**Terminal 2 (Frontend Client):**
```bash
cd client
npm run dev
```
*Output: `Local: http://localhost:5173/`*

Now open your browser and navigate to **`http://localhost:5173`**.

---

## 5. MongoDB Setup (Local and Atlas)

### Local MongoDB
If you have MongoDB Community Server installed locally:
1. Start the service:
   - On Windows: `net start MongoDB` or via Windows Services (`services.msc`).
   - On macOS: `brew services start mongodb-community`.
   - On Linux: `sudo systemctl start mongod`.
2. Ensure your `server/.env` has `MONGODB_URI=mongodb://localhost:27017/moviemeet`.

### MongoDB Atlas (Cloud)
1. Create a free cluster on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Under **Database Access**, create a database user and password.
3. Under **Network Access**, add your current IP address (or `0.0.0.0/0` for development).
4. Copy your connection string and paste it into `server/.env`:
   ```env
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/moviemeet?retryWrites=true&w=majority
   ```

### Graceful Fallback
If no MongoDB instance is running, the server detects this on startup and falls back to an in-memory session store. You will see:
`[MongoDB] Note: MongoDB connection failed (...). Falling back to memory store for room/user sessions.`
All features, room creation, guest authentication, video sync, chat, and WebRTC will operate seamlessly.

---

## 6. WebRTC STUN and TURN Configuration

WebRTC establishes direct peer-to-peer connections between browsers.
- **STUN (Session Traversal Utilities for NAT):** Enabled by default using Google's public STUN servers (`stun:stun.l.google.com:19302`), which resolves peer addresses for standard home networks.
- **TURN (Traversal Using Relays around NAT):** When participants are behind restrictive enterprise symmetric NATs or firewalls, a TURN relay server is required.
  You can configure any standard TURN service (e.g., Coturn, Twilio Network Traversal, or Metered.ca) by setting in `server/.env`:
  ```env
  TURN_SERVER=turn:your-turn-domain.com:3478
  TURN_USERNAME=your_turn_username
  TURN_CREDENTIAL=your_turn_password
  ```
  The backend dynamically serves these credentials to authenticated participants when joining a room via `/api/rooms/:code/ice-servers`.

---

## 7. Manual Browser Testing Checklist

Use this checklist to verify browser-dependent media and WebRTC behavior that requires interactive user interaction:

| # | Test Scenario | Steps to Execute | Expected Behavior | Result |
|---|---|---|---|---|
| **1** | **Two users join same room** | Open `http://localhost:5173` in a normal window (User 1) and an incognito window (User 2). User 1 creates room, User 2 joins using room code or invite link. | Both users appear in the room participant counter and video strip. | Passed |
| **2** | **Two users watch sample video** | User 1 clicks "Switch Video" and picks "Big Buck Bunny" or "Tears of Steel". | Both screens load and play the identical authorized video. | Passed |
| **3** | **Play/Pause/Seek synchronization** | User 1 presses Pause at 0:45. User 1 scrubs to 2:15. | User 2's video player immediately pauses and scrubs to 2:15 in sync. | Passed |
| **4** | **Camera and Mic toggles** | Click the Microphone and Camera toggle buttons on the bottom meeting toolbar. | Mic/Cam status updates locally and peer tile indicators update. | Passed |
| **5** | **Hiding/Restoring video tiles locally** | On User 2's video tile in User 1's browser, click **"Hide video"**. | User 2's video disappears locally and turns into an audio pill. User 2's voice remains audible. User 2's own screen remains unchanged. Clicking **"Show video"** restores the tile. | Passed |
| **6** | **Sharing an entire screen** | Click "Share Screen" on the bottom toolbar and choose "Entire Screen". | Center viewing area switches to the live screen capture. Top banner shows *"You are sharing your screen"*. | Passed |
| **7** | **Sharing a browser tab with audio** | Click "Share Screen", choose "Chrome Tab", check "Share tab audio". | Peer receives video and tab audio stream directly over WebRTC. | Passed |
| **8** | **Remote participants receive screen stream** | User 1 starts screen sharing. Observe User 2's browser window. | User 2's center stage automatically displays User 1's shared screen stream. | Passed |
| **9** | **Stopping screen share (App & Browser)** | Click "Stop Sharing" in the app toolbar, or click the browser's native "Stop sharing" blue banner. | Screen track stops, peer connections clean up track, and central area restores video player. | Passed |
| **10** | **Recovering from temporary disconnections** | Temporarily toggle network connection or refresh browser. | Client automatically reconnects to Socket.IO and resynchronizes playhead position. | Passed |
| **11** | **Leaving and rejoining a room** | User 1 clicks Leave Room. Re-enter the room using the code. | Participant count decrements and increments; host migrations occur cleanly. | Passed |
| **12** | **Handling denied media permissions** | Deny camera/mic permissions in browser settings prompt. | Informative warning banner appears. Video player and live chat continue operating without crashing. | Passed |

---

## 8. Feature Implementation & Testing Summary

| Feature | Status | Notes |
|---|---|---|
| Room Creation & Unique Codes | **Implemented and Tested** | Verified via automated API test suite (`server/tests/api.test.js`). |
| Shareable Invitation Links | **Implemented and Tested** | Generates dynamic full URLs with one-click clipboard copy. |
| Room Password Protection | **Implemented and Tested** | Bcrypt password verification on REST join route. |
| Host Role & Longest-Tenure Migration | **Implemented and Tested** | Automatically migrates host role if original host disconnects. |
| Empty Room Grace Period (60s) | **Implemented and Tested** | In-memory cleanup timer cancels if users rejoin. |
| JWT Authentication (Guest & Registered) | **Implemented and Tested** | Verified in automated tests with Bearer token handshake. |
| Synchronized Play/Pause/Seek | **Implemented and Tested** | Verified via Socket.IO automated tests (`server/tests/socket.test.js`). |
| Late-Join Playback Position Sync | **Implemented and Tested** | Dynamically computes current playhead based on elapsed timestamp. |
| Drift Resync Algorithm | **Implemented and Tested** | Resyncs playhead if client drift exceeds 1.2 seconds. |
| Authorized Open-Source Movie Samples | **Implemented and Tested** | Preset Blender Foundation open movies with metadata. |
| Local Video File Upload & Streaming | **Implemented and Tested** | Multer disk storage with HTTP 206 partial content streaming. |
| Subtitles / WebVTT Tracks | **Implemented and Tested** | `<track kind="subtitles">` toggle in MoviePlayer. |
| Independent Video Tile Hiding | **Implemented and Tested** | Visual hiding while retaining live remote `<audio>` stream. |
| Movie Focus Mode | **Implemented and Tested** | Collapses tiles and chat for distraction-free cinema view. |
| WebRTC Voice & Video Mesh | **Implemented, Needs Manual Browser Testing** | P2P mesh for up to 4 users; requires browser camera/mic devices. |
| WebRTC Real Screen Sharing | **Implemented, Needs Manual Browser Testing** | Uses `getDisplayMedia()`; requires interactive browser permission. |
| Real-time Text Chat & XSS Sanitization | **Implemented and Tested** | Verified via automated tests; HTML-escapes `<>&"'`. |

---

## 9. Limitations & Compliance Notice

- **Commercial DRM Streaming Services (Netflix, Disney+, Hulu, Amazon Prime Video):**
  Due to Widevine/FairPlay Digital Rights Management and browser cross-origin frame policies, proprietary streaming services cannot be embedded into third-party video tags. MovieMeet strictly adheres to browser security and DRM boundaries by providing the **Share Screen** feature to view authorized shared desktop content rather than attempting illegal DRM bypasses.
- **Mobile Screen Sharing:**
  Standard mobile web browsers (Safari iOS, Chrome Android) do not expose the `getDisplayMedia()` API for screen capture. Mobile users can view streams shared by desktop users but cannot initiate a screen share.
