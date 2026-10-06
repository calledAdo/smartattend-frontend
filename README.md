# SmartAttend frontend

React/Vite frontend for lecturer course setup, five-minute attendance sessions, student check-in, and attendance reports. It starts in live API mode. A separate browser-local demo is available from the sign-in screen.

The production frontend is `https://smartattend-frontend-jade.vercel.app`. It currently uses the older Render API at `https://real-time-attendance-auth-service.onrender.com`; the new paired backend changes in `backend-service/` have not been deployed. See [BACKEND_API_STATUS.md](BACKEND_API_STATUS.md) before testing live mode on the public site.

## Run

```bash
npm install
npm run dev
npm run build
```

Vite proxies local `/api` requests to the Render backend by default. To test the paired local backend on port 2000, start it with its `local` profile and run:

```bash
VITE_API_PROXY_TARGET=http://127.0.0.1:2000 npm run dev
```

For persistent local testing, use real PostgreSQL with the setup and smoke scripts in the [backend review branch](https://github.com/calledAdo/Real-time-Attendance-Auth-service/tree/codex/live-integration). Clone it alongside this frontend repository. The Vite development proxy works on whichever local port is available.

To test the camera flow yourself, register fresh lecturer and student accounts in separate browser tabs. The local API prints each six-digit email verification code in its terminal. Verify both accounts, enroll the student with a live camera capture, then create a lecturer course with a CSV containing `name,matricNo,email` and the student's exact matric number and email. Open the course, start attendance with location permission, and check in from the student tab with the displayed code, location and camera. The completed session appears in lecturer Reports and student History. Browser camera and location permissions work on `localhost`; testing from a phone over plain HTTP requires a secure origin.

For production builds, `VITE_API_BASE_URL` can override the backend origin and may include or omit `/api`. The frontend stores the bearer JWT in tab `sessionStorage`; it does not substitute mock data when a live request fails. Vercel SPA route rewrites are configured in `vercel.json`.

## Live flow

Students register with their `@student.oauife.edu.ng` email, name, password and matric number. Lecturers register with staff email, name and password. The backend emails a six-digit confirmation code. After verifying, users sign in; students then enroll a camera-generated 128-value face descriptor. Lecturer course creation sends course details, optional supporting lecturer emails and a CSV roster. A verified student's email **and** matric number must match the roster to see the course.

Lecturers start attendance from a course after allowing location access. The backend issues a five-minute code. Students use location, the class code and a live camera capture to check in; the backend checks roster, 100 m geofence, code, duplicate status and face descriptor similarity. Sessions and history are polled every 15 seconds. Lecturers can close a session and download a server-generated PDF containing present and absent roster members.

Face descriptor matching is not liveness detection. A presented photo or video may pass, and browser GPS can be spoofed. The interface should not be represented as fraud-proof. The current API does not provide background push notifications or a reliable device lock.

## Demo flow

Select **Lecturer view** or **Student view** on sign-in. Demo accounts are Maya Johnson (`maya@smartattend.demo`) and Amara Okafor (`amara@smartattend.demo`, matric `CSC/2023/0421`). Student view opens face setup first. **Open camera** captures a descriptor for local matching; **Use demo capture** is a simulated shortcut. The seeded session may expire; start a new one from Lecturer view. Newly registered demo accounts receive a link in the in-app Demo inbox. Demo passwords are not checked or stored.

The demo saves courses, rosters, sessions and attendance in browser `localStorage`. Camera templates remain in memory and clear on refresh or sign-out. Demo PDFs are generated locally. Demo location, email delivery, device restriction and authentication are simulations.
