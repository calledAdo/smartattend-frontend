import { useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, Camera, Check, CheckCircle2, ChevronDown, Clock3, History, LocateFixed, MapPin, Radio, ShieldCheck, X } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { CameraCapture, PageHeading } from '../components'
import { completedStudentSessions, formatDate, formatTime, isLive, studentCourses, studentInRoster, useApp } from '../data'

export function StudentDashboard() {
  const { db, user, mode } = useApp()
  const enrolled = studentCourses(db, user)
  const enrolledIds = enrolled.map(course => course.id)
  const activeSessions = db.sessions.filter(session => user && enrolledIds.includes(session.courseId) && (session.isEligible || studentInRoster(session.rosterSnapshot ?? [], user)) && isLive(session))
  const records = db.attendance.filter(item => item.userId === user?.id)
  const completedSessions = completedStudentSessions(db, user?.id)
  const present = completedSessions.filter(session => records.some(record => record.sessionId === session.id && record.status === 'PRESENT')).length
  const firstName = user?.name.split(' ')[0] ?? 'Student'
  return <><PageHeading eyebrow="Student dashboard" title={`Hi, ${firstName}`} subtitle="Your courses and attendance, all in one place." />
    {activeSessions.length > 0 && <section className="student-live"><div className="student-live-content"><span className="student-live-label"><span className="pulse-dot" /> Attendance is open</span><h2>{db.courses.find(course => course.id === activeSessions[0].courseId)?.title}</h2><p>{db.courses.find(course => course.id === activeSessions[0].courseId)?.code} · Check in before the session closes.</p><Link className="button button-light" to={`/student/check-in/${activeSessions[0].id}`}>Check in now <ArrowRight size={18} /></Link></div><div className="student-live-time"><Clock3 size={21} /><span>5 min</span><small>session window</small></div></section>}
    <div className="student-overview"><div className="student-overview-item"><span className="overview-icon mint"><BookOpen size={21} /></span><strong>{enrolled.length.toString().padStart(2, '0')}</strong><span>Assigned courses</span></div><div className="student-overview-item"><span className="overview-icon peach"><CheckCircle2 size={21} /></span><strong>{mode === 'live' ? 'N/A' : present}</strong><span>Sessions attended</span></div><div className="student-overview-item"><span className="overview-icon blue"><History size={21} /></span><strong>{mode === 'live' ? 'N/A' : `${completedSessions.length ? Math.round(present / completedSessions.length * 100) : 0}%`}</strong><span>Attendance rate</span></div></div>
    <section className="content-section"><div className="section-heading"><div><h2>My courses</h2><p>Courses assigned to your verified identity</p></div><span className="section-count">{enrolled.length} courses</span></div>{enrolled.length ? <div className="enrolled-grid">{enrolled.map(course => { const session = activeSessions.find(item => item.courseId === course.id); return <div className="enrolled-card" key={course.id}><div className="enrolled-card-top"><span className={`course-symbol ${course.color}`}><BookOpen size={21} /></span>{session && <span className="mini-live"><span className="pulse-dot" /> Live now</span>}</div><div><span className="course-code">{course.code}</span><h3>{course.title}</h3></div><div className="enrolled-card-footer"><span><MapPin size={16} /> {course.room}</span><span>{course.schedule}</span></div>{session && <Link className="enrolled-link" to={`/student/check-in/${session.id}`}>Open check-in <ArrowRight size={17} /></Link>}</div> })}</div> : <div className="empty-state"><BookOpen size={26} /><strong>No courses assigned yet</strong><p>Ask your lecturer to add your email and matric number to the course roster.</p></div>}</section>
    <p className="roster-help">Courses appear here when your verified email and matric number match a lecturer's roster. Contact your lecturer if a course is missing.</p>
  </>
}

type Position = { latitude: number; longitude: number; accuracyMeters?: number }

export function CheckInPage() {
  const { sessionId } = useParams()
  const { db, user, mode, verifyLocation, verifyCode, submitCheckIn } = useApp()
  const [step, setStep] = useState(1)
  const [position, setPosition] = useState<Position | null>(null)
  const [code, setCode] = useState('')
  const [faceImage, setFaceImage] = useState<Blob | null>(null)
  const [error, setError] = useState('')
  const [locating, setLocating] = useState(false)
  const [busy, setBusy] = useState(false)
  const eligible = (item: (typeof db.sessions)[number]) => user && (item.isEligible || studentInRoster(item.rosterSnapshot ?? db.courses.find(course => course.id === item.courseId)?.roster ?? [], user))
  const session = sessionId ? db.sessions.find(item => item.id === sessionId && eligible(item)) : db.sessions.find(item => eligible(item) && isLive(item))
  const course = db.courses.find(item => item.id === session?.courseId)
  const existing = db.attendance.find(item => item.sessionId === session?.id && item.userId === user?.id)
  const success = step === 4 || existing?.status === 'PRESENT'
  if (!session || !course) return <><PageHeading eyebrow="Student check-in" title="No active attendance" subtitle="Your check-in will appear here when a lecturer opens a session." /><div className="empty-page"><span className="empty-page-icon"><Radio size={30} /></span><h2>Nothing to check in to</h2><p>Look for a live session in your enrolled courses.</p><Link className="button button-primary" to="/student/dashboard">View my courses <ArrowRight size={18} /></Link></div></>
  if (!isLive(session) && !success) return <><PageHeading eyebrow="Student check-in" title="Session closed" subtitle={`${course.code} · ${course.title}`} /><div className="empty-page"><span className="empty-page-icon"><Clock3 size={30} /></span><h2>Attendance has ended</h2><p>This session closed at {formatTime(session.endedAt ?? session.expiresAt)}.</p><Link className="button button-primary" to="/student/dashboard">Back to my courses</Link></div></>

  async function validatePosition(next: Position) {
    try { await verifyLocation(session!.id, next); setPosition(next); setStep(2); setError('') }
    catch (issue) { setError((issue as Error).message) }
    finally { setLocating(false) }
  }
  function locate() {
    setError(''); setLocating(true)
    if (!navigator.geolocation) { setError('Location is unavailable in this browser.'); setLocating(false); return }
    navigator.geolocation.getCurrentPosition(position => void validatePosition({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracyMeters: position.coords.accuracy }), () => { setError('Location access was denied or timed out. Check browser permissions and try again.'); setLocating(false) }, { enableHighAccuracy: true, timeout: 10_000 })
  }
  async function submitCode(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    try { await verifyCode(session!.id, code); setStep(3); setError('') }
    catch (issue) { setError((issue as Error).message) }
    finally { setBusy(false) }
  }
  async function finish() {
    setBusy(true)
    try { await submitCheckIn(session!.id, faceImage, position, code); setStep(4); setError('') }
    catch (issue) { setError((issue as Error).message) }
    finally { setBusy(false) }
  }

  return <><PageHeading eyebrow="Student check-in" title={success ? 'Attendance recorded' : 'Check in to class'} subtitle={`${course.code} · ${course.title}`} action={!success && <span className="deadline-chip"><Clock3 size={16} /> Closes at {formatTime(session.expiresAt)}</span>} />
    <div className="checkin-layout"><div className="checkin-main">{success ? <div className="checkin-success"><span className="success-circle"><Check size={34} /></span><h2>You're checked in</h2><p>Your attendance for {course.code} has been recorded.</p><div className="success-detail"><span>Course</span><strong>{course.title}</strong><span>Status</span><strong className="text-success">Present</strong><span>Time</span><strong>{formatTime(existing?.at ?? new Date().toISOString())}</strong></div><Link className="button button-primary button-full" to={mode === 'live' ? '/student/dashboard' : '/student/history'}>{mode === 'live' ? 'Back to my courses' : 'View attendance history'} <ArrowRight size={18} /></Link></div> : <><div className="checkin-progress" aria-label={`Step ${step} of 3`}>{[{ label: 'Location', icon: MapPin }, { label: 'Class code', icon: ShieldCheck }, { label: 'Face photo', icon: Camera }].map((item, index) => <div className={`progress-step ${step === index + 1 ? 'current' : ''} ${step > index + 1 ? 'complete' : ''}`} key={item.label}><span>{step > index + 1 ? <Check size={17} /> : <item.icon size={17} />}</span><strong>{item.label}</strong></div>)}</div><div className="checkin-step">{step === 1 && <><div className="step-icon"><LocateFixed size={26} /></div><span className="step-count">Step 1 of 3</span><h2>Confirm your location</h2><p>{mode === 'live' ? 'Allow location access to continue. The current service collects your coordinates but does not enforce the lecture hall boundary.' : 'Attendance is available within the lecture hall boundary. Allow location access to continue.'}</p><div className="location-box"><MapPin size={20} /><div><strong>{course.room}</strong><span>Campus lecture location</span></div></div>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-primary button-full" disabled={locating} onClick={locate}>{locating ? 'Checking location...' : 'Use my current location'} <ArrowRight size={18} /></button>{mode === 'demo' && <button className="button button-quiet button-full" onClick={() => void validatePosition({ latitude: session.latitude, longitude: session.longitude })}>Use demo location</button>}</>}{step === 2 && <><div className="step-icon"><ShieldCheck size={26} /></div><span className="step-count">Step 2 of 3</span><h2>Enter the class code</h2><p>Ask your lecturer for the six-character code shown in class.{mode === 'live' && ' The service validates it when you submit.'}</p><form onSubmit={submitCode}><label className="field code-input-field"><span>Attendance code</span><input inputMode={mode === 'live' ? 'text' : 'numeric'} pattern={mode === 'live' ? '[A-Za-z0-9]{6}' : '[0-9]{6}'} maxLength={6} autoComplete="one-time-code" placeholder={mode === 'live' ? 'ABC123' : '000000'} value={code} onChange={event => setCode(mode === 'live' ? event.target.value.replace(/[^a-z0-9]/gi, '').toUpperCase() : event.target.value.replace(/\D/g, ''))} required /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-primary button-full" disabled={code.length !== 6 || busy} type="submit">{busy ? 'Continuing...' : 'Continue'} <ArrowRight size={18} /></button></form><button className="button button-quiet button-full" onClick={() => { setStep(1); setError('') }}><ArrowLeft size={17} /> Back to location</button></>}{step === 3 && <><div className="step-icon"><Camera size={26} /></div><span className="step-count">Step 3 of 3</span><h2>Take a live photo</h2><p>Look into the camera and capture a clear photo to complete check-in.</p><CameraCapture allowDemo={mode === 'demo'} onCapture={setFaceImage} onClear={() => setFaceImage(null)} />{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-primary button-full" disabled={!faceImage || busy} onClick={() => void finish()}>{busy ? 'Submitting...' : 'Mark me present'} <ArrowRight size={18} /></button><button className="button button-quiet button-full" onClick={() => { setStep(2); setFaceImage(null); setError('') }}><ArrowLeft size={17} /> Back to code</button></>}</div></>}</div><aside className="checkin-side"><div className="checkin-context"><div className="checkin-context-top"><span className={`course-symbol ${course.color}`}><BookOpen size={22} /></span><span className="status-badge status-live"><span className="pulse-dot" /> {isLive(session) ? 'Live' : 'Closed'}</span></div><strong>{course.code}</strong><h3>{course.title}</h3><div className="context-divider" /><div><MapPin size={17} /><span>{course.room}</span></div><div><Clock3 size={17} /><span>Opened {formatTime(session.startedAt)}</span></div></div><div className="privacy-note"><ShieldCheck size={20} /><p>Camera and location access are used for this check-in. {mode === 'demo' ? 'This demo does not perform identity matching.' : 'A 128-value face descriptor is sent to the attendance service for verification.'}</p></div></aside></div>
  </>
}

export function StudentHistoryPage() {
  const { db, user, mode } = useApp()
  const [openCourse, setOpenCourse] = useState<string | null>(null)
  const courses = studentCourses(db, user)
  const records = db.attendance.filter(item => item.userId === user?.id)
  const completedSessions = completedStudentSessions(db, user?.id)
  const attended = completedSessions.filter(session => records.some(record => record.sessionId === session.id && record.status === 'PRESENT')).length
  const absent = completedSessions.length - attended
  const percentage = completedSessions.length ? Math.round(attended / completedSessions.length * 100) : 0
  if (mode === 'live') return <><PageHeading eyebrow="My attendance" title="Attendance history" subtitle="Your attendance records" /><div className="empty-page"><span className="empty-page-icon"><History size={30} /></span><h2>History is not available yet</h2><p>The deployed API needs a student attendance history endpoint before we can show complete records and rates.</p><Link className="button button-primary" to="/student/dashboard">Back to my courses</Link></div></>
  return <><PageHeading eyebrow="My attendance" title="Attendance history" subtitle="Track your attendance across enrolled courses." /><div className="history-summary"><div className="history-rate"><div className="rate-ring" style={{ '--rate': `${percentage}%` } as React.CSSProperties}><div><strong>{percentage}%</strong><span>Overall rate</span></div></div><p>{attended} of {completedSessions.length} sessions attended</p></div><div className="history-metrics"><div><span className="metric-icon mint"><CheckCircle2 size={20} /></span><strong>{attended}</strong><span>Present</span></div><div><span className="metric-icon peach"><X size={20} /></span><strong>{absent}</strong><span>Absent</span></div><div><span className="metric-icon blue"><BookOpen size={20} /></span><strong>{courses.length}</strong><span>Courses</span></div></div></div><section className="content-section"><div className="section-heading"><div><h2>By course</h2><p>Session-by-session attendance records.</p></div></div><div className="history-courses">{courses.map(course => { const items = completedSessions.filter(session => session.courseId === course.id); const courseRecords = records.filter(record => record.courseId === course.id); const count = items.filter(session => courseRecords.some(record => record.sessionId === session.id && record.status === 'PRESENT')).length; const rate = items.length ? Math.round(count / items.length * 100) : 0; const open = openCourse === course.id; return <div className="history-course" key={course.id}><button className="history-course-heading" onClick={() => setOpenCourse(open ? null : course.id)} aria-expanded={open}><span className={`course-symbol ${course.color}`}><BookOpen size={21} /></span><span className="history-course-name"><strong>{course.code}</strong><small>{course.title}</small></span><span className="history-course-rate"><strong>{rate}%</strong><small>{count} / {items.length} sessions</small></span><ChevronDown className={open ? 'chevron-up' : ''} size={19} /></button>{open && <div className="history-course-detail">{items.length ? items.map(session => { const record = courseRecords.find(item => item.sessionId === session.id); return <div className="history-session" key={session.id}><span className={`history-status ${record?.status === 'PRESENT' ? 'present' : 'absent'}`}>{record?.status === 'PRESENT' ? <Check size={17} /> : <X size={17} />}</span><span><strong>{formatDate(session.startedAt)}</strong><small>{formatTime(session.startedAt)} · {course.room}</small></span><span className={`status-word ${record?.status === 'PRESENT' ? 'text-success' : 'text-danger'}`}>{record?.status === 'PRESENT' ? 'Present' : 'Absent'}</span></div> }) : <div className="history-empty">No completed sessions yet.</div>}</div>}</div> })}</div></section></>
}
