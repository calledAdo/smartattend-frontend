import { useEffect, useRef, useState, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { BookOpen, ChartNoAxesCombined, ClipboardCheck, DoorOpen, GraduationCap, History, LayoutDashboard, Menu, Radio, X, type LucideIcon } from 'lucide-react'
import { initials, useApp, type CaptureSource, type Role } from './data'

const lecturerLinks: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/lecturer/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/lecturer/session/active', label: 'Live attendance', icon: Radio },
  { to: '/lecturer/reports', label: 'Reports', icon: ChartNoAxesCombined },
]
const studentLinks: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/student/dashboard', label: 'My courses', icon: BookOpen },
  { to: '/student/check-in', label: 'Check in', icon: ClipboardCheck },
  { to: '/student/history', label: 'History', icon: History },
]

export function Brand({ compact = false }: { compact?: boolean }) {
  return <span className={`brand ${compact ? 'brand-compact' : ''}`}><span className="brand-mark"><GraduationCap size={22} strokeWidth={2.3} aria-hidden="true" /></span><span>Smart<span className="brand-accent">Attend</span></span></span>
}

export function Shell({ children, role }: { children: ReactNode; role: Role }) {
  const { user, mode, error, loading, refresh, signOut } = useApp()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const links = role === 'LECTURER' ? lecturerLinks : studentLinks
  const exit = () => { signOut(); navigate('/auth/login') }
  return <div className="app-shell">
    <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
      <div className="sidebar-top"><Brand /><button className="icon-button mobile-only" aria-label="Close menu" onClick={() => setMenuOpen(false)}><X size={20} /></button></div>
      <div className="workspace-label">{role === 'LECTURER' ? 'Lecturer workspace' : 'Student workspace'}</div>
      <nav className="side-nav" aria-label="Main navigation">{links.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to.includes('dashboard')} onClick={() => setMenuOpen(false)} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}><Icon size={19} aria-hidden="true" /><span>{label}</span></NavLink>)}</nav>
      <div className="sidebar-bottom"><div className="profile-avatar">{initials(user?.name ?? 'SA')}</div><div className="profile-details"><strong>{user?.name}</strong><small>{user?.matricNo ?? (user?.department || user?.email)}</small></div><button className="icon-button" title="Sign out" aria-label="Sign out" onClick={exit}><DoorOpen size={19} /></button></div>
    </aside>
    {menuOpen && <button className="sidebar-scrim mobile-only" aria-label="Close menu" onClick={() => setMenuOpen(false)} />}
    <div className="main-column">
      <header className="topbar"><button className="icon-button mobile-only" aria-label="Open menu" onClick={() => setMenuOpen(true)}><Menu size={22} /></button><div className="topbar-brand mobile-only"><Brand compact /></div><div className="topbar-spacer" /><span className="demo-pill"><span className="demo-dot" /> {mode === 'live' ? 'Live API' : 'Demo workspace'}</span><div className="topbar-avatar" title={user?.name}>{initials(user?.name ?? 'SA')}</div></header>
      <main className="page-content">{mode === 'live' && error && <div className="service-alert" role="alert"><span>{error}</span><button className="button button-secondary" disabled={loading} onClick={() => void refresh()}>{loading ? 'Retrying...' : 'Retry'}</button></div>}{children}</main>
    </div>
    <nav className="bottom-nav mobile-only" aria-label="Mobile navigation">{links.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to.includes('dashboard')} className={({ isActive }) => `bottom-link ${isActive ? 'active' : ''}`}><Icon size={21} aria-hidden="true" /><span>{label}</span></NavLink>)}</nav>
  </div>
}

export function PageHeading({ eyebrow, title, subtitle, action }: { eyebrow?: string; title: string; subtitle?: string; action?: ReactNode }) {
  return <div className="page-heading"><div>{eyebrow && <p className="section-eyebrow">{eyebrow}</p>}<h1>{title}</h1>{subtitle && <p className="page-subtitle">{subtitle}</p>}</div>{action && <div className="page-action">{action}</div>}</div>
}

export function Modal({ title, children, onClose, width = 'standard' }: { title: string; children: ReactNode; onClose: () => void; width?: 'standard' | 'wide' }) {
  const dialog = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    dialog.current?.querySelector<HTMLElement>('input, button, select')?.focus()
    return () => { document.removeEventListener('keydown', onKey); previous?.focus() }
  }, [onClose])
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><div ref={dialog} role="dialog" aria-modal="true" aria-label={title} className={`modal modal-${width}`}><div className="modal-heading"><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={20} /></button></div>{children}</div></div>
}

export function CameraCapture({ onCapture, onClear, allowDemo = false }: { onCapture: (blob: Blob, source: CaptureSource) => void; onClear?: () => void; allowDemo?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const previewRef = useRef<string | null>(null)
  const mountedRef = useRef(false)
  const openingRef = useRef(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [opening, setOpening] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [error, setError] = useState('')

  const errorName = (issue: unknown) => issue && typeof issue === 'object' && 'name' in issue ? String(issue.name) : 'UnknownError'
  const cameraError = (issue: unknown) => {
    const name = errorName(issue)
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return `Camera access was blocked (${name}). Allow access for this site in your browser settings and try again.`
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return `No camera was found on this device (${name}).`
    if (name === 'NotReadableError' || name === 'TrackStartError') return `The camera could not start (${name}). Close other apps using it and try again.`
    return `Camera error (${name}). Try again or report this error name.`
  }

  const stop = () => { streamRef.current?.getTracks().forEach(track => track.stop()); streamRef.current = null; setCameraOpen(false) }
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false; streamRef.current?.getTracks().forEach(track => track.stop()); if (previewRef.current) URL.revokeObjectURL(previewRef.current) }
  }, [])
  useEffect(() => {
    if (!cameraOpen) return
    const video = videoRef.current
    const stream = streamRef.current
    if (!video || !stream) return
    video.srcObject = stream
    void video.play().catch(issue => {
      if (mountedRef.current && streamRef.current === stream) {
        stop()
        setError(`Camera preview could not start (${errorName(issue)}). Try opening the camera again.`)
      }
    })
    return () => { video.pause(); video.srcObject = null }
  }, [cameraOpen])

  async function openCamera() {
    if (openingRef.current) return
    setError('')
    if (!navigator.mediaDevices?.getUserMedia) { setError('Camera access is unavailable. Use a secure connection and allow camera permission.'); return }
    openingRef.current = true
    setOpening(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      if (!mountedRef.current) { stream.getTracks().forEach(track => track.stop()); return }
      streamRef.current?.getTracks().forEach(track => track.stop())
      streamRef.current = stream
      setCameraOpen(true)
    } catch (issue) { if (mountedRef.current) setError(cameraError(issue)) }
    finally { openingRef.current = false; if (mountedRef.current) setOpening(false) }
  }

  function capture() {
    if (capturing) return
    const video = videoRef.current
    if (!video || !video.videoWidth) { setError('The camera is still starting. Try again.'); return }
    const canvas = document.createElement('canvas')
    canvas.width = Math.min(video.videoWidth, 720)
    canvas.height = Math.round(canvas.width * video.videoHeight / video.videoWidth)
    const context = canvas.getContext('2d')
    if (!context) { setError('Could not capture a photo. Try again.'); return }
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    setCapturing(true)
    canvas.toBlob(blob => {
      if (!mountedRef.current) return
      setCapturing(false)
      if (!blob) { setError('Could not capture a photo. Try again.'); return }
      if (previewRef.current) URL.revokeObjectURL(previewRef.current)
      const url = URL.createObjectURL(blob)
      previewRef.current = url
      setPreview(url)
      onCapture(blob, 'camera')
      stop()
    }, 'image/jpeg', 0.85)
  }

  function demoCapture() {
    const canvas = document.createElement('canvas')
    canvas.width = 320; canvas.height = 320
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#d8e8e2'; ctx.fillRect(0, 0, 320, 320)
    ctx.fillStyle = '#7ea99b'; ctx.beginPath(); ctx.arc(160, 124, 55, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.ellipse(160, 294, 100, 100, 0, 0, Math.PI * 2); ctx.fill()
    canvas.toBlob(blob => {
      if (!mountedRef.current) return
      if (!blob) return
      if (previewRef.current) URL.revokeObjectURL(previewRef.current)
      const url = URL.createObjectURL(blob)
      previewRef.current = url
      setPreview(url)
      onCapture(blob, 'demo')
      stop()
      setError('')
    }, 'image/jpeg')
  }

  function retake() {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    previewRef.current = null
    setPreview(null)
    setError('')
    onClear?.()
  }

  return <div className="camera-capture"><div className="camera-frame">{preview ? <img src={preview} alt="Captured face preview" /> : cameraOpen ? <video ref={videoRef} autoPlay muted playsInline aria-label="Live camera preview" /> : <div className="camera-idle"><div className="face-outline"><span /></div><p>Position your face in the frame</p></div>}</div>{error && <p className="field-error" role="alert">{error}</p>}<div className="camera-actions">{preview ? <button type="button" className="button button-secondary" onClick={retake}>Retake photo</button> : cameraOpen ? <button type="button" className="button button-primary" disabled={capturing} onClick={capture}>{capturing ? 'Capturing...' : 'Capture photo'}</button> : <><button type="button" className="button button-primary" disabled={opening} onClick={openCamera}>{opening ? 'Opening camera...' : 'Open camera'}</button>{allowDemo && <button type="button" className="button button-quiet" disabled={opening} onClick={demoCapture}>Use demo capture</button>}</>}</div></div>
}
