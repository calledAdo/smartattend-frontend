# SmartAttend frontend

React/Vite frontend for lecturer course management and student attendance. It starts in **live API mode** using the previously supplied deployment at `https://real-time-attendance-auth-service.onrender.com`. A separate browser-local demo remains available from the sign-in screen. The current backend source does not yet support a complete live dashboard; see [BACKEND_API_STATUS.md](BACKEND_API_STATUS.md).

## Run

```bash
npm install
npm run dev
```

Open the URL printed by Vite. `npm run build` checks TypeScript and creates a production build. Local `/api` requests pass through the Vite proxy; production requests go to the Render origin. Set `VITE_API_BASE_URL` to another backend origin before building to change that target. The value can include or omit `/api`.

## Live flow

The current source accepts lecturer or student registration and sends a six-digit email verification code. Students must use an `@student.oauife.edu.ng` address. The frontend sends `username` equal to the normalized email, then verifies with `{email,token}`. Resend is available. Login returns a JWT, but the source has no `/api/auth/me` endpoint to return the numeric user ID and verified account state, so the frontend stops before dashboard access and displays the missing-contract error. No live account can complete the agreed course and attendance flow yet.

The frontend uses bearer JWTs in tab `sessionStorage` and does not substitute mock data when a live request fails. Its course adapter now follows the source's draft creation, multipart CSV upload, and roster confirmation sequence; its attendance adapter follows `/api/attendance/sessions` and the six-character alphanumeric code. These later steps cannot be exercised until the backend supplies `/me`, lecturer course listing, and active-session discovery. The PDF route exists in source, but deployment and authorization remain unverified.

The existing face-api.js implementation remains in the code, but face integration is deferred. The current source still requires an embedding for check-in and exposes `/api/auth/onboard-face`, which differs from the frontend's earlier `/api/auth/face/enroll` assumption. The source also does not geofence submitted coordinates. These gaps are listed in [BACKEND_API_STATUS.md](BACKEND_API_STATUS.md). The Render deployment timed out on an earlier read-only probe, so build success does not establish backend connectivity.

## Demo flow

Select **Lecturer view** or **Student view** on sign-in. Demo accounts are Maya Johnson (`maya@smartattend.demo`) and Amara Okafor (`amara@smartattend.demo`, matric `CSC/2023/0421`). You can also register a new local account; its verification link appears in the Demo inbox. Demo passwords are not verified or stored. Use **Sign out**, then **Use live API** to return to the backend mode.

The demo saves accounts, courses, rosters, sessions, and attendance in browser `localStorage`. Its location and camera shortcuts are simulation tools. It performs no email delivery, face recognition, liveness detection, device restriction, real authentication, or server geofencing. Demo PDFs are generated locally.
