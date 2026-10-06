import { useState, type FormEvent, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, Camera, Check, GraduationCap, LockKeyhole, Mail, ShieldCheck, Users } from 'lucide-react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Brand, CameraCapture } from '../components'
import { useApp, type CaptureSource, type Role } from '../data'
import { enterLive } from '../mode'

function AuthAside() {
  return <aside className="auth-aside"><div className="auth-aside-inner"><span className="aside-overline">A clearer day on campus</span><h2>Every class.<br />Everyone accounted for.</h2><p>Stay in step with courses, live sessions, and attendance records.</p><div className="auth-session-preview"><div className="preview-header"><span className="preview-live"><span /> Live attendance</span><span>10:42 AM</span></div><div className="preview-course"><span className="preview-course-icon"><BookOpen size={24} /></span><div><strong>Database Management Systems</strong><small>CSC 301 · Lecture theatre 204</small></div></div><div className="preview-progress"><span style={{ width: '69%' }} /></div><div className="preview-bottom"><strong>33 <small>/ 48 students</small></strong><span>Checked in</span></div></div></div><div className="auth-aside-footer">SmartAttend / Academic year 2026-27</div></aside>
}
function AuthLayout({ children }: { children: ReactNode }) { return <div className="auth-layout"><div className="auth-main"><div className="auth-brand"><Brand /></div><div className="auth-form-wrap register-wrap">{children}</div></div><AuthAside /></div> }
function destination(role: Role) { return role === 'LECTURER' ? '/lecturer/dashboard' : '/student/dashboard' }
function nextPage(user: { role: Role; emailVerified: boolean; faceEnrolled?: boolean }) { return !user.emailVerified ? '/auth/verify' : user.role === 'STUDENT' && !user.faceEnrolled ? '/auth/face' : destination(user.role) }

export function EntryPage() {
  const { user, mode } = useApp()
  if (user) return <Navigate to={nextPage(user)} replace />
  return <AuthLayout><div className="auth-heading"><span className="auth-icon"><GraduationCap size={23} /></span><h1>Welcome to SmartAttend</h1><p>Choose how you will use attendance.</p></div><div className="role-choices"><Link to="/auth/register?role=student" className="role-choice"><span className="demo-option-icon peach"><BookOpen size={22} /></span><span><strong>Sign up as a student</strong><small>See your courses and check in to class.</small></span><ArrowRight size={20} /></Link><Link to="/auth/register?role=lecturer" className="role-choice"><span className="demo-option-icon mint"><Users size={22} /></span><span><strong>Sign up as a lecturer</strong><small>Manage course rosters and attendance.</small></span><ArrowRight size={20} /></Link></div><p className="auth-switch">Already have an account? <Link to="/auth/login">Sign in</Link></p>{mode === 'demo' && <p className="auth-note">This demo shows verification links here instead of sending email.</p>}</AuthLayout>
}

export function LoginPage() {
  const { user, mode, signIn, signInDemo } = useApp()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  if (user) return <Navigate to={nextPage(user)} replace />
  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true); setError('')
    try { const found = await signIn(email, password); navigate(nextPage(found)) }
    catch (issue) { setError((issue as Error).message) }
    finally { setBusy(false) }
  }
  function enterDemo(role: Role) { signInDemo(role); navigate(destination(role)) }
  return <AuthLayout><div className="auth-heading"><span className="auth-icon"><LockKeyhole size={21} /></span><h1>Welcome back</h1><p>Sign in to your SmartAttend workspace.</p></div>{params.get('verified') === '1' && <p className="auth-note" role="status">Email verified. Sign in to continue.</p>}<form onSubmit={submit} className="auth-form"><label className="field"><span>Email address</span><div className="input-with-icon"><Mail size={18} aria-hidden="true" /><input type="email" autoComplete="email" placeholder="you@university.edu" value={email} onChange={event => setEmail(event.target.value)} required /></div></label><label className="field"><span>Password</span><input type="password" autoComplete="current-password" placeholder="Enter your password" value={password} onChange={event => setPassword(event.target.value)} required /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-primary button-full" type="submit" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'} <ArrowRight size={18} /></button></form><div className="auth-divider"><span>Explore the demo</span></div><div className="demo-options"><button className="demo-option" onClick={() => enterDemo('LECTURER')}><span className="demo-option-icon mint"><Users size={19} /></span><span><strong>Lecturer view</strong><small>Courses and live sessions</small></span><ArrowRight size={17} /></button><button className="demo-option" onClick={() => enterDemo('STUDENT')}><span className="demo-option-icon peach"><BookOpen size={19} /></span><span><strong>Student view</strong><small>Check-in and history</small></span><ArrowRight size={17} /></button></div><p className="auth-switch">New to SmartAttend? <Link to="/">Create an account</Link></p>{mode === 'demo' ? <p className="auth-note">Demo passwords are not stored or checked. <button className="text-button" onClick={enterLive}>Use live API</button></p> : <p className="auth-note">Live API uses the previously provided attendance service. Demo accounts remain separate from real accounts.</p>}</AuthLayout>
}

export function RegisterPage() {
  const { user, mode, register } = useApp()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const role: Role = params.get('role') === 'lecturer' ? 'LECTURER' : 'STUDENT'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [matricNo, setMatricNo] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  if (user) return <Navigate to={nextPage(user)} replace />
  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true); setError('')
    try { await register({ name, email, matricNo, password, role }); navigate('/auth/verify') }
    catch (issue) { setError((issue as Error).message) }
    finally { setBusy(false) }
  }
  return <AuthLayout><Link className="back-link" to="/"><ArrowLeft size={17} /> Choose another role</Link><div className="auth-heading"><span className="auth-icon">{role === 'STUDENT' ? <BookOpen size={22} /> : <Users size={22} />}</span><h1>{role === 'STUDENT' ? 'Student sign up' : 'Lecturer sign up'}</h1><p>{mode === 'live' && role === 'STUDENT' ? 'Use your @student.oauife.edu.ng email.' : 'Use the email linked to your university account.'}</p></div><div className="register-steps"><span className="current">1. Your details</span><span>2. Verify email</span>{mode === 'demo' && role === 'STUDENT' && <span>3. Face capture</span>}</div><form className="auth-form" onSubmit={submit}><label className="field"><span>Full name</span><input value={name} onChange={event => setName(event.target.value)} autoComplete="name" placeholder="Your full name" required /></label><label className="field"><span>{role === 'STUDENT' ? 'Student email' : 'Staff email'}</span><input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" placeholder={mode === 'live' && role === 'STUDENT' ? 'you@student.oauife.edu.ng' : 'you@university.edu'} required /></label>{role === 'STUDENT' && <label className="field"><span>Matric number</span><input value={matricNo} onChange={event => setMatricNo(event.target.value)} placeholder="e.g. CSC/2023/0421" required /></label>}<label className="field"><span>Password</span><input type="password" minLength={8} value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" placeholder="At least 8 characters" required /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-primary button-full" type="submit" disabled={busy}>{busy ? 'Creating account...' : 'Create account'} <ArrowRight size={18} /></button></form><p className="auth-switch">Already have an account? <Link to="/auth/login">Sign in</Link></p>{mode === 'demo' && <p className="auth-note">Demo registration stays in this browser. Passwords are not stored or checked.</p>}</AuthLayout>
}

export function VerifyEmailPage() {
  const { db, user, mode, verifyEmail, resendVerification } = useApp()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const token = params.get('token')
  const [code, setCode] = useState(token ?? '')
  if (user?.emailVerified && !token) return <Navigate to={nextPage(user)} replace />
  async function confirm(value: string) {
    setBusy(true); setError('')
    try {
      const found = await verifyEmail(value)
      navigate(mode === 'live' ? '/auth/login?verified=1' : found.role === 'STUDENT' ? '/auth/face' : '/lecturer/dashboard')
    }
    catch (issue) { setError((issue as Error).message) }
    finally { setBusy(false) }
  }
  const demoToken = mode === 'demo' && user && !user.emailVerified ? db.verificationTokens[user.id] : undefined
  return <AuthLayout><div className="auth-heading"><span className="auth-icon"><Mail size={22} /></span><h1>Verify your email</h1><p>{mode === 'live' ? `Enter the six-digit code sent to ${user?.email ?? 'your email'}.` : user && !user.emailVerified ? `We sent a confirmation link to ${user.email}.` : 'Open the confirmation link for your account.'}</p></div><div className="register-steps"><span>1. Your details</span><span className="current">2. Verify email</span>{mode === 'demo' && user?.role === 'STUDENT' && <span>3. Face capture</span>}</div>{mode === 'live' && <form className="auth-form" onSubmit={event => { event.preventDefault(); void confirm(code) }}><label className="field"><span>Verification code</span><input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" placeholder="000000" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ''))} required /></label><button className="button button-primary button-full" type="submit" disabled={busy || code.length !== 6}>{busy ? 'Confirming...' : 'Confirm email'} <Check size={18} /></button></form>}{demoToken && <div className="demo-inbox"><strong>Demo inbox</strong><p>SmartAttend email confirmation</p><span>To: {user?.email}</span><button className="button button-primary button-full" disabled={busy} onClick={() => void confirm(demoToken)}>Open confirmation link <ArrowRight size={18} /></button></div>}{error && <p className="form-error" role="alert">{error}</p>}{user && !user.emailVerified && <button className="button button-quiet button-full" disabled={busy} onClick={async () => { setBusy(true); setError(''); try { await resendVerification(); setSent(true) } catch (issue) { setError((issue as Error).message) } finally { setBusy(false) } }}>{sent ? mode === 'demo' ? 'New demo link created' : 'Verification email sent' : 'Resend verification code'}</button>}{mode === 'demo' && <p className="auth-note">Email delivery is simulated for this frontend demo.</p>}</AuthLayout>
}

export function FaceOnboardingPage() {
  const { user, mode, completeFace } = useApp()
  const navigate = useNavigate()
  const [photo, setPhoto] = useState<Blob | null>(null)
  const [source, setSource] = useState<CaptureSource>('camera')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  if (!user) return <Navigate to="/auth/login" replace />
  if (!user.emailVerified) return <Navigate to="/auth/verify" replace />
  if (user.role !== 'STUDENT' || user.faceEnrolled) return <Navigate to={destination(user.role)} replace />
  async function finish() {
    setBusy(true); setError('')
    try { await completeFace(photo, source); navigate('/student/dashboard') }
    catch (issue) { setError((issue as Error).message) }
    finally { setBusy(false) }
  }
  return <AuthLayout><div className="auth-heading"><span className="auth-icon"><Camera size={22} /></span><h1>Set up face check-in</h1><p>Capture a clear photo to finish your student account.</p></div><div className="register-steps"><span>1. Your details</span><span>2. Verify email</span><span className="current">3. Face capture</span></div><div className="auth-form"><div className="capture-note"><ShieldCheck size={18} /><span>{mode === 'demo' ? 'A camera capture is matched locally during check-in. The template stays in this tab and is cleared on refresh; demo capture remains simulated.' : 'Your face descriptor is sent to the attendance service for enrollment.'}</span></div><CameraCapture allowDemo={mode === 'demo'} onCapture={(blob, capturedFrom) => { setPhoto(blob); setSource(capturedFrom) }} onClear={() => { setPhoto(null); setSource('camera') }} />{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-primary button-full" disabled={!photo || busy} onClick={finish}>{busy ? 'Enrolling...' : 'Finish setup'} <ArrowRight size={18} /></button></div></AuthLayout>
}
