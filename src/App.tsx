import { Navigate, Route, Routes } from 'react-router-dom'
import { Shell } from './components'
import { useApp, type Role } from './data'
import { EntryPage, FaceOnboardingPage, LoginPage, RegisterPage, VerifyEmailPage } from './pages/Auth'
import { CourseDetailPage, LecturerDashboard, LiveSessionPage, ReportsPage } from './pages/Lecturer'
import { StudentDashboard, CheckInPage, StudentHistoryPage } from './pages/Student'

function Home() {
  const { user } = useApp()
  return <Navigate to={user ? !user.emailVerified ? '/auth/verify' : user.role === 'STUDENT' && !user.faceEnrolled ? '/auth/face' : user.role === 'LECTURER' ? '/lecturer/dashboard' : '/student/dashboard' : '/welcome'} replace />
}

function Protected({ role, children }: { role: Role; children: React.ReactNode }) {
  const { user } = useApp()
  if (!user) return <Navigate to="/auth/login" replace />
  if (!user.emailVerified) return <Navigate to="/auth/verify" replace />
  if (user.role === 'STUDENT' && !user.faceEnrolled) return <Navigate to="/auth/face" replace />
  if (user.role !== role) return <Home />
  return <Shell role={role}>{children}</Shell>
}

export default function App() {
  return <Routes>
    <Route path="/" element={<Home />} />
    <Route path="/welcome" element={<EntryPage />} />
    <Route path="/auth/login" element={<LoginPage />} />
    <Route path="/auth/register" element={<RegisterPage />} />
    <Route path="/auth/verify" element={<VerifyEmailPage />} />
    <Route path="/auth/face" element={<FaceOnboardingPage />} />
    <Route path="/lecturer/dashboard" element={<Protected role="LECTURER"><LecturerDashboard /></Protected>} />
    <Route path="/lecturer/course/:courseId" element={<Protected role="LECTURER"><CourseDetailPage /></Protected>} />
    <Route path="/lecturer/session/active" element={<Protected role="LECTURER"><LiveSessionPage /></Protected>} />
    <Route path="/lecturer/session/active/:sessionId" element={<Protected role="LECTURER"><LiveSessionPage /></Protected>} />
    <Route path="/lecturer/reports" element={<Protected role="LECTURER"><ReportsPage /></Protected>} />
    <Route path="/student/dashboard" element={<Protected role="STUDENT"><StudentDashboard /></Protected>} />
    <Route path="/student/check-in" element={<Protected role="STUDENT"><CheckInPage /></Protected>} />
    <Route path="/student/check-in/:sessionId" element={<Protected role="STUDENT"><CheckInPage /></Protected>} />
    <Route path="/student/history" element={<Protected role="STUDENT"><StudentHistoryPage /></Protected>} />
    <Route path="*" element={<Home />} />
  </Routes>
}
