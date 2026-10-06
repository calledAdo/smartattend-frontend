import { useEffect, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, Check, ChevronRight, ClipboardList, Clock3, Download, FileText, Plus, Radio, Search, Square, Upload, Users, X } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Modal, PageHeading } from '../components'
import { checkedInCount, formatDate, formatTime, initials, isLive, lecturerCourses, useApp, type Course, type RosterStudent, type Session } from '../data'
import { parseRosterCsv } from '../csv'

function Countdown({ expiresAt }: { expiresAt: string }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1_000); return () => window.clearInterval(timer) }, [])
  const remaining = Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 1_000))
  return <span className="countdown" aria-live="off">{String(Math.floor(remaining / 60)).padStart(2, '0')}:{String(remaining % 60).padStart(2, '0')}</span>
}

function AddCourseModal({ onClose }: { onClose: () => void }) {
  const { createCourse, mode } = useApp()
  const [code, setCode] = useState('')
  const [title, setTitle] = useState('')
  const [room, setRoom] = useState('')
  const [schedule, setSchedule] = useState('')
  const [semester, setSemester] = useState('First semester 2026/27')
  const [roster, setRoster] = useState<RosterStudent[]>([])
  const [fileName, setFileName] = useState('')
  const [supporting, setSupporting] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function upload(file?: File) {
    if (!file) return
    setError('')
    setRoster([])
    setFileName('')
    if (!file.name.toLowerCase().endsWith('.csv')) { setError('Choose a .csv file.'); return }
    try { const parsed = parseRosterCsv(await file.text()); setRoster(parsed); setFileName(file.name) }
    catch (issue) { setError((issue as Error).message) }
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    const emails = supporting.split(/[\s,;]+/).map(value => value.trim().toLowerCase()).filter(Boolean)
    if (emails.some(value => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) { setError('Enter valid supporting lecturer emails.'); return }
    if (new Set(emails).size !== emails.length) { setError('Remove duplicate supporting lecturer emails.'); return }
    setBusy(true)
    try { await createCourse({ code, title, semester, room, schedule, roster, supportingLecturerEmails: emails }); onClose() }
    catch (issue) { setError((issue as Error).message) }
    finally { setBusy(false) }
  }
  return <Modal title="Add a course" onClose={onClose} width="wide"><form className="modal-form" onSubmit={submit}><p className="modal-subtitle">Students are assigned through the roster. Their verified email and matric number must match a row to see this course.</p><div className="form-grid"><label className="field"><span>Course code</span><input value={code} onChange={event => setCode(event.target.value)} placeholder="e.g. CSC 410" required /></label><label className="field"><span>Semester</span><input value={semester} onChange={event => setSemester(event.target.value)} required /></label></div><label className="field"><span>Course title</span><input value={title} onChange={event => setTitle(event.target.value)} placeholder="e.g. Software Engineering" required /></label>{mode === 'demo' && <div className="form-grid"><label className="field"><span>Room</span><input value={room} onChange={event => setRoom(event.target.value)} placeholder="e.g. LT 204" /></label><label className="field"><span>Schedule</span><input value={schedule} onChange={event => setSchedule(event.target.value)} placeholder="e.g. Mon, Wed at 10 AM" /></label></div>}<label className="field"><span>Student roster CSV</span><span className="file-picker"><Upload size={18} /> {fileName || 'Choose CSV file'}<input type="file" accept=".csv,text/csv" onChange={event => void upload(event.target.files?.[0])} /></span></label><p className="field-hint">Required headers: name, matricNo, email. Quoted names and commas are supported.</p>{roster.length > 0 && <div className="roster-preview"><strong>{roster.length} students ready</strong><div>{roster.slice(0, 4).map(row => <span key={row.email}>{row.name} · {row.matricNo} · {row.email}</span>)}{roster.length > 4 && <span>+ {roster.length - 4} more</span>}</div></div>}{mode === 'demo' && <label className="field"><span>Supporting lecturer emails</span><textarea value={supporting} onChange={event => setSupporting(event.target.value)} placeholder="lecturer@university.edu, colleague@university.edu" rows={2} /></label>}<p className="field-hint">{mode === 'live' ? 'Supporting lecturers cannot be added by the current API.' : 'Separate emails with commas, spaces or new lines. Verified lecturers with these emails can manage the course.'}</p>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancel</button><button className="button button-primary" type="submit" disabled={!roster.length || busy}>{busy ? 'Creating...' : 'Create course'}</button></div></form></Modal>
}

export function LecturerDashboard() {
  const { db, user, mode } = useApp()
  const [courseModal, setCourseModal] = useState(false)
  const [search, setSearch] = useState('')
  const courses = lecturerCourses(db, user)
  const visible = courses.filter(course => `${course.code} ${course.title}`.toLowerCase().includes(search.toLowerCase()))
  const active = db.sessions.find(session => courses.some(course => course.id === session.courseId) && isLive(session))
  const activeCourse = courses.find(course => course.id === active?.courseId)
  const thisMonth = db.sessions.filter(session => courses.some(course => course.id === session.courseId) && (mode === 'live' ? isLive(session) : new Date(session.startedAt).getMonth() === new Date().getMonth())).length

  return <><PageHeading eyebrow="Lecturer dashboard" title={`Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, ${user?.name.split(' ')[1] ?? 'Lecturer'}`} subtitle="Here's what's happening across your courses." action={<button className="button button-primary" onClick={() => setCourseModal(true)}><Plus size={18} /> Add course</button>} />
    {active && activeCourse && <div className="live-banner"><div className="live-banner-main"><div className="live-kicker"><span className="pulse-dot" /> Attendance in progress</div><h2>{activeCourse.code} <span>/ {activeCourse.title}</span></h2><div className="live-banner-meta"><span><Clock3 size={16} /> <Countdown expiresAt={active.expiresAt} /> remaining</span><span><Users size={16} /> {checkedInCount(active)} checked in</span></div></div><Link className="button button-light" to={`/lecturer/session/active/${active.id}`}>Open session <ArrowRight size={18} /></Link></div>}
    <div className="stats-grid"><div className="stat-item"><span className="stat-icon mint"><BookOpen size={21} /></span><span className="stat-number">{courses.length.toString().padStart(2, '0')}</span><span className="stat-label">Active courses</span></div><div className="stat-item"><span className="stat-icon peach"><Users size={21} /></span><span className="stat-number">{courses.reduce((sum, course) => sum + course.enrolledCount, 0)}</span><span className="stat-label">Course enrollments</span></div><div className="stat-item"><span className="stat-icon blue"><ClipboardList size={21} /></span><span className="stat-number">{thisMonth.toString().padStart(2, '0')}</span><span className="stat-label">{mode === 'live' ? 'Active sessions' : 'Sessions this month'}</span></div></div>
    <section className="content-section"><div className="section-heading"><div><h2>Your courses</h2><p>First semester 2026/27</p></div><div className="search-field"><Search size={18} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search courses" aria-label="Search courses" /></div></div><div className="table-wrap"><table className="course-table"><thead><tr><th>Course</th><th>Schedule</th><th>Students</th><th>Room</th><th><span className="sr-only">Action</span></th></tr></thead><tbody>{visible.map(course => { const running = db.sessions.find(session => session.courseId === course.id && isLive(session)); return <tr key={course.id}><td><div className="course-cell"><span className={`course-symbol ${course.color}`}><BookOpen size={21} /></span><span><strong>{course.code}</strong><small>{course.title}</small></span></div></td><td>{course.schedule}</td><td>{course.enrolledCount}</td><td>{course.room}</td><td><Link className={`button ${running ? 'button-soft' : 'button-secondary'} table-action`} to={`/lecturer/course/${course.id}`}>Open course <ChevronRight size={16} /></Link></td></tr> })}</tbody></table>{visible.length === 0 && <div className="empty-state"><BookOpen size={26} /><strong>No courses found</strong><p>Try another search or add a course.</p></div>}</div></section>
    {courseModal && <AddCourseModal onClose={() => setCourseModal(false)} />}
  </>
}

export function CourseDetailPage() {
  const { courseId } = useParams()
  const { db, user, mode, startSession, refreshCourse } = useApp()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(false)
  useEffect(() => { if (mode === 'live' && courseId) void refreshCourse(courseId).catch(issue => setError((issue as Error).message)) }, [courseId, mode, refreshCourse])
  const course = lecturerCourses(db, user).find(item => item.id === courseId)
  const live = db.sessions.find(item => item.courseId === courseId && isLive(item))
  if (!course) return <><PageHeading title="Course unavailable" /><div className="empty-page"><p>This course is not assigned to your verified lecturer email.</p><Link className="button button-primary" to="/lecturer/dashboard">Back to courses</Link></div></>
  async function createFor(latitude?: number, longitude?: number) {
    setStarting(true)
    try { const session = await startSession(course!.id, latitude === undefined || longitude === undefined ? undefined : { latitude, longitude }); navigate(`/lecturer/session/active/${session.id}`) }
    catch (issue) { setError((issue as Error).message) }
    finally { setStarting(false) }
  }
  function start() {
    setStarting(true)
    setError('')
    if (mode === 'live') { void createFor(); return }
    if (!navigator.geolocation) { setError('Location is unavailable in this browser.'); setStarting(false); return }
    navigator.geolocation.getCurrentPosition(position => void createFor(position.coords.latitude, position.coords.longitude), () => { setStarting(false); setError('Allow location access to start attendance, or use the demo location.') }, { enableHighAccuracy: true, timeout: 10_000 })
  }
  return <><PageHeading eyebrow="Course" title={course.title} subtitle={`${course.code} · ${course.semester}`} action={<Link className="button button-secondary" to="/lecturer/dashboard"><ArrowLeft size={17} /> All courses</Link>} /><div className="course-detail-actions"><div><span className={`course-symbol ${course.color}`}><BookOpen size={21} /></span><strong>{course.code}</strong><span>{course.room} · {course.schedule}</span></div>{live ? <Link className="button button-primary" to={`/lecturer/session/active/${live.id}`}>Open live attendance <ArrowRight size={18} /></Link> : <button className="button button-primary" disabled={starting} onClick={start}><Radio size={18} /> {starting ? 'Starting...' : 'Start attendance'}</button>}</div>{error && <div className="course-start-error" role="alert"><p className="form-error">{error}</p>{mode === 'demo' && <button className="button button-secondary" onClick={() => void createFor(6.5244, 3.3792)}>Use demo location</button>}</div>}<div className="course-detail-grid"><section className="content-section"><div className="section-heading"><div><h2>Student roster</h2><p>Access is matched by verified email and matric number.</p></div><span className="section-count">{course.enrolledCount} students</span></div><div className="roster-list">{mode === 'live' && !course.roster.length && <div>Roster details are unavailable from this course response.</div>}{course.roster.map(row => <div key={row.email}><span className="feed-avatar">{initials(row.name)}</span><span><strong>{row.name}</strong><small>{row.matricNo}</small></span><span>{row.email}</span></div>)}</div></section><aside className="content-section"><div className="section-heading"><div><h2>Lecturers</h2><p>Course management access</p></div></div><div className="lecturer-list"><strong>Course creator</strong><span>{db.users.find(item => item.id === course.lecturerId)?.email ?? (mode === 'live' ? 'Not provided by service' : '')}</span><strong>Supporting lecturers</strong>{course.supportingLecturerEmails.length ? course.supportingLecturerEmails.map(email => <span key={email}>{email}</span>) : <span>None added</span>}</div></aside></div></>
}

function EmptyLive() {
  return <div className="empty-page"><span className="empty-page-icon"><Radio size={30} /></span><h2>No live session right now</h2><p>Start attendance from one of your courses when class begins.</p><Link className="button button-primary" to="/lecturer/dashboard">Go to courses <ArrowRight size={18} /></Link></div>
}

export function LiveSessionPage() {
  const { sessionId } = useParams()
  const { db, user, mode, endSession } = useApp()
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [ending, setEnding] = useState(false)
  const [endError, setEndError] = useState('')
  const owned = lecturerCourses(db, user).map(course => course.id)
  const session = sessionId ? db.sessions.find(item => item.id === sessionId && owned.includes(item.courseId)) : db.sessions.find(item => owned.includes(item.courseId) && isLive(item))
  const course = db.courses.find(item => item.id === session?.courseId)
  if (!session || !course) return <><PageHeading eyebrow="Live attendance" title="Session control" /><EmptyLive /></>
  const live = isLive(session)
  return <><PageHeading eyebrow="Attendance session" title={course.title} subtitle={`${course.code} · ${course.room} · ${formatDate(session.startedAt, { weekday: 'long', day: 'numeric', month: 'long' })}`} action={<Link className="button button-secondary" to="/lecturer/dashboard"><ArrowRight className="rotate-180" size={17} /> Back to courses</Link>} />
    <div className="session-status-row"><span className={`status-badge ${live ? 'status-live' : 'status-ended'}`}>{live && <span className="pulse-dot" />}{live ? 'Session is live' : 'Session ended'}</span><span>Started at {formatTime(session.startedAt)}</span></div>
    <div className="session-main"><section className="code-panel"><div className="panel-topline"><span>Attendance code</span><span><Radio size={17} /> {live ? 'Visible in class' : 'Closed'}</span></div><div className="code-display" aria-label={`Attendance code ${session.code}`}>{session.code.slice(0, 3)} <span>{session.code.slice(3)}</span></div><p>Share this code with students in the lecture hall.</p><div className="code-panel-footer"><div><span className="code-small-label">Time remaining</span><strong>{live ? <Countdown expiresAt={session.expiresAt} /> : '00:00'}</strong></div><div className="timer-rail"><span style={{ width: `${Math.max(0, Math.min(100, ((Date.parse(session.expiresAt) - Date.now()) / (Date.parse(session.expiresAt) - Date.parse(session.startedAt))) * 100))}%` }} /></div></div></section><aside className="attendance-panel"><div className="attendance-panel-top"><span className="attendance-icon"><Users size={22} /></span><span>{live ? 'Checking in now' : 'Final check-ins'}</span></div><div className="attendance-number">{checkedInCount(session)}<span> / {course.enrolledCount}</span></div><div className="attendance-progress"><span style={{ width: `${Math.min(100, checkedInCount(session) / Math.max(1, course.enrolledCount) * 100)}%` }} /></div><p>{Math.round(checkedInCount(session) / Math.max(1, course.enrolledCount) * 100)}% of enrolled students</p></aside></div>
    <div className="feed-layout"><section className="content-section feed-section"><div className="section-heading"><div><h2>Recent check-ins</h2><p>Updates appear as students complete check-in.</p></div><span className="feed-count">{checkedInCount(session)} total</span></div>{session.checkIns.length ? <div className="feed-list">{session.checkIns.map(item => <div className="feed-row" key={item.userId}><span className="feed-avatar">{initials(item.name)}</span><span><strong>{item.name}</strong><small>Checked in</small></span><time>{formatTime(item.at)}</time><Check size={18} className="success-icon" /></div>)}</div> : <div className="empty-state"><Users size={25} /><strong>{mode === 'live' ? 'Check-in feed unavailable' : 'Waiting for students'}</strong><p>{mode === 'live' ? 'The server currently provides a count without a student feed.' : 'Check-ins will appear here as they arrive.'}</p></div>}</section><aside className="session-side"><div className="session-detail"><h3>Session details</h3><div><span>Course</span><strong>{course.code}</strong></div><div><span>Room</span><strong>{course.room}</strong></div><div><span>Ends at</span><strong>{formatTime(session.expiresAt)}</strong></div></div>{live ? <button className="button button-danger-outline button-full" onClick={() => setConfirmEnd(true)}><Square size={16} /> End attendance</button> : mode === 'demo' ? <Link className="button button-primary button-full" to="/lecturer/reports"><FileText size={17} /> View report</Link> : <p className="session-auto-close">Session ended</p>}</aside></div>
    {confirmEnd && <Modal title="End attendance?" onClose={() => setConfirmEnd(false)}><p className="modal-subtitle">Students will no longer be able to check in to this session.</p>{endError && <p className="form-error" role="alert">{endError}</p>}<div className="modal-actions"><button className="button button-secondary" onClick={() => setConfirmEnd(false)}>Keep session live</button><button className="button button-danger" disabled={ending} onClick={async () => { setEnding(true); setEndError(''); try { await endSession(session.id); setConfirmEnd(false) } catch (issue) { setEndError((issue as Error).message) } finally { setEnding(false) } }}>{ending ? 'Ending...' : 'End attendance'}</button></div></Modal>}
  </>
}

async function downloadReport(session: Session, course: Course) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF()
  doc.setFillColor(10, 90, 80); doc.rect(0, 0, 210, 34, 'F')
  doc.setTextColor(255, 255, 255); doc.setFontSize(19); doc.text('SmartAttend', 17, 21)
  doc.setTextColor(29, 43, 46); doc.setFontSize(17); doc.text('Attendance report', 17, 52)
  doc.setFontSize(11); doc.text(`${course.code} - ${course.title}`, 17, 62)
  doc.setTextColor(98, 112, 114); doc.text(`${formatDate(session.startedAt)}  |  ${formatTime(session.startedAt)}  |  ${course.room}`, 17, 70)
  const roster = session.rosterSnapshot ?? course.roster
  doc.setTextColor(29, 43, 46); doc.text(`Present: ${session.checkIns.length}`, 17, 85); doc.text(`Absent: ${Math.max(0, roster.length - session.checkIns.length)}`, 78, 85); doc.text(`Roster: ${roster.length}`, 140, 85)
  doc.setDrawColor(218, 226, 222); doc.line(17, 94, 193, 94)
  doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.text('Student', 17, 104); doc.text('Matric no.', 93, 104); doc.text('Status', 153, 104)
  doc.setFont('helvetica', 'normal')
  let y = 115
  roster.forEach(row => { if (y > 275) { doc.addPage(); y = 22 } const present = session.checkIns.some(item => item.email ? item.email.toLowerCase() === row.email.toLowerCase() && item.matricNo?.toLowerCase() === row.matricNo.toLowerCase() : item.name.toLowerCase() === row.name.toLowerCase()); doc.text(row.name.slice(0, 35), 17, y); doc.text(row.matricNo.slice(0, 25), 93, y); doc.text(present ? 'Present' : 'Absent', 153, y); y += 9 })
  if (!roster.length) doc.text('No students on this roster.', 17, 117)
  doc.save(`${course.code.replaceAll(' ', '-')}-${formatDate(session.startedAt).replaceAll(' ', '-')}-attendance.pdf`)
}


export function ReportsPage() {
  const { db, user, mode } = useApp()
  const [courseFilter, setCourseFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('')
  const [downloadError, setDownloadError] = useState('')
  const courses = lecturerCourses(db, user)
  const sessions = db.sessions.filter(session => courses.some(course => course.id === session.courseId) && !isLive(session) && (courseFilter === 'all' || courseFilter === session.courseId) && (!dateFilter || session.startedAt.slice(0, 10) === dateFilter))
  const totalPresent = sessions.reduce((sum, session) => sum + checkedInCount(session), 0)
  if (mode === 'live') return <><PageHeading eyebrow="Lecturer reports" title="Attendance reports" subtitle="Reports are not available yet." /><div className="empty-page"><span className="empty-page-icon"><FileText size={30} /></span><h2>Reports are coming later</h2><p>The current API does not provide completed-session history or PDF downloads.</p><Link className="button button-primary" to="/lecturer/dashboard">Back to courses</Link></div></>
  return <><PageHeading eyebrow="Lecturer reports" title="Attendance reports" subtitle="Review past sessions and download attendance sheets." /><div className="report-summary"><div><span className="summary-icon mint"><CalendarDays size={21} /></span><strong>{sessions.length.toString().padStart(2, '0')}</strong><span>Completed sessions</span></div><div><span className="summary-icon peach"><Check size={21} /></span><strong>{totalPresent}</strong><span>Total check-ins</span></div><div><span className="summary-icon blue"><BookOpen size={21} /></span><strong>{courses.length.toString().padStart(2, '0')}</strong><span>Courses</span></div></div><section className="content-section"><div className="section-heading"><div><h2>Session history</h2><p>Download a PDF for any completed session.</p></div><div className="filter-row"><label className="sr-only" htmlFor="course-filter">Filter by course</label><select id="course-filter" value={courseFilter} onChange={event => setCourseFilter(event.target.value)}><option value="all">All courses</option>{courses.map(course => <option key={course.id} value={course.id}>{course.code}</option>)}</select><label className="sr-only" htmlFor="date-filter">Filter by date</label><input id="date-filter" type="date" value={dateFilter} onChange={event => setDateFilter(event.target.value)} aria-label="Filter by date" />{dateFilter && <button className="icon-button" title="Clear date" aria-label="Clear date filter" onClick={() => setDateFilter('')}><X size={17} /></button>}</div></div>{downloadError && <p className="form-error" role="alert">{downloadError}</p>}<div className="table-wrap"><table className="report-table"><thead><tr><th>Course</th><th>Date & time</th><th>Attendance</th><th>Status</th><th><span className="sr-only">Download</span></th></tr></thead><tbody>{sessions.map(session => { const course = courses.find(item => item.id === session.courseId)!; return <tr key={session.id}><td><strong>{course.code}</strong><small>{course.title}</small></td><td>{formatDate(session.startedAt)}<small>{formatTime(session.startedAt)}</small></td><td><strong>{checkedInCount(session)} / {course.enrolledCount}</strong><small>students present</small></td><td><span className="status-badge status-complete"><Check size={14} /> Complete</span></td><td><button className="icon-button download-button" title={`Download ${course.code} report`} aria-label={`Download ${course.code} report`} onClick={() => { setDownloadError(''); void downloadReport(session, course).catch(issue => setDownloadError((issue as Error).message)) }}><Download size={19} /></button></td></tr> })}</tbody></table>{sessions.length === 0 && <div className="empty-state"><FileText size={26} /><strong>No reports found</strong><p>Change your filters or complete an attendance session.</p></div>}</div></section></>
}
