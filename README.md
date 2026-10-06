# SmartAttend frontend

React/Vite frontend for lecturer course management and student attendance. It starts in **live API mode** using the previously supplied deployment at `https://real-time-attendance-auth-service.onrender.com`. A separate browser-local demo remains available from the sign-in screen. The current backend source does not yet support a complete live dashboard; see [BACKEND_API_STATUS.md](BACKEND_API_STATUS.md).

**Production frontend:** https://smartattend-frontend-jade.vercel.app. Vercel is connected to this GitHub repository and builds production from `main`. Direct links to auth, lecturer, and student routes use `vercel.json` SPA rewrites.

## Run

```bash
npm install
npm run dev
```

Open the URL printed by Vite. `npm run build` checks TypeScript and creates a production build. Local `/api` requests pass through the Vite proxy; production requests go to the Render origin. Set `VITE_API_BASE_URL` to another backend origin before building to change that target. The value can include or omit `/api`.

## Live flow

The current source accepts lecturer or student registration and sends a six-digit email verification code. Students must use an `@student.oauife.edu.ng` address. The frontend sends `username` equal to the normalized email, then verifies with `{email,token}`. Resend is available. Login returns a JWT, but the source has no `/api/auth/me` endpoint to return the numeric user ID and verified account state, so the frontend stops before dashboard access and displays the missing-contract error. No live account can complete the agreed course and attendance flow yet.

The frontend uses bearer JWTs in tab `sessionStorage` and does not substitute mock data when a live request fails. Its course adapter now follows the source's draft creation, multipart CSV upload, and roster confirmation sequence; its attendance adapter follows `/api/attendance/sessions` and the six-character alphanumeric code. These later steps cannot be exercised until the backend supplies `/me`, lecturer course listing, and active-session discovery. The PDF route exists in source, but deployment and authorization remain unverified.

The browser can generate a 128-number descriptor from a camera capture for enrollment and check-in. Live face enrollment remains paused: the current backend exposes public `/api/auth/onboard-face` with a caller-supplied username, rather than a JWT-bound enrollment endpoint, and `/api/auth/me` is still absent. The check-in endpoint still expects an embedding but cannot be reached through the agreed live flow yet. The source also does not geofence submitted coordinates. These gaps are listed in [BACKEND_API_STATUS.md](BACKEND_API_STATUS.md). The Render deployment timed out on an earlier read-only probe, so build success does not establish backend connectivity.

## Demo flow

Select **Lecturer view** or **Student view** on sign-in. Demo accounts are Maya Johnson (`maya@smartattend.demo`) and Amara Okafor (`amara@smartattend.demo`, matric `CSC/2023/0421`). Student view now opens face setup first. Choose **Open camera** to enroll a real camera capture; check-in takes another camera capture and compares its descriptor locally. **Use demo capture** keeps the older simulated path. The active seeded session may expire while you enroll; start a new one from Lecturer view if needed. You can also register a new local account; its verification link appears in the Demo inbox. Demo passwords are not verified or stored. Use **Sign out**, then **Use live API** to return to the backend mode.

The demo saves accounts, courses, rosters, sessions, and attendance in browser `localStorage`. Camera enrollment templates stay only in memory and are cleared on refresh or sign-out; a student must enroll again afterwards. Real camera captures use face-api.js detection and cosine matching with the backend's current 0.65 threshold. This is face matching, not liveness detection: a photo or video shown to the camera may pass. The **Use demo capture** button, location shortcut, email delivery, device restriction, and authentication are simulations. Demo PDFs are generated locally.
