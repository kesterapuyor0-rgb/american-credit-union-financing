import { useState } from 'react';
import { AuthView } from './components/AuthView';
import AdminDashboard from './components/AdminDashboard';
import VideoCall from './components/VideoCall';
import { api } from './api';
import type { User } from './types';

type Session = { token: string; user: User };
function readSession(): Session | null {
  try { const value = localStorage.getItem('apuyor-session'); return value ? JSON.parse(value) as Session : null; }
  catch { return null; }
}

export default function App() {
  const [session, setSession] = useState<Session | null>(readSession);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [inCall, setInCall] = useState(false);
  const [roomId, setRoomId] = useState('studio-' + Math.random().toString(36).slice(2, 8));

  function saveSession(value: Session) { localStorage.setItem('apuyor-session', JSON.stringify(value)); setSession(value); }
  function signOut() { localStorage.removeItem('apuyor-session'); setSession(null); setInCall(false); }
  async function login(loginValue: string, password: string) {
    setBusy(true); setError(''); setNotice('');
    try { saveSession(await api.login(loginValue, password)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to sign in.'); }
    finally { setBusy(false); }
  }
  async function register(username: string, email: string, password: string) {
    setBusy(true); setError(''); setNotice('');
    try { const response = await api.register(username, email, password); setNotice(response.message); setAuthMode('login'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to create account.'); }
    finally { setBusy(false); }
  }

  if (!session) return <AuthView mode={authMode} busy={busy} error={error} notice={notice} onModeChange={(mode) => { setAuthMode(mode); setError(''); setNotice(''); }} onLogin={(loginValue, password) => void login(loginValue, password)} onRegister={(username, email, password) => void register(username, email, password)} />;
  if (session.user.role === 'admin') return <AdminDashboard token={session.token} onSignOut={signOut} />;
  if (inCall) return <VideoCall roomId={roomId} token={session.token} onLeave={() => setInCall(false)} />;

  return <main className="home-shell">
    <header className="home-topbar"><a className="brand" href="#home"><span className="brand-mark">✳</span> apuyor<span className="brand-light">engine</span></a><div className="home-account"><span className="user-avatar">{session.user.username[0]?.toUpperCase()}</span><span>{session.user.username}</span><button className="quiet-button" onClick={signOut}>Sign out</button></div></header>
    <section className="studio-wrap"><div className="studio-greeting"><div className="eyebrow"><span className="pulse-dot" /> YOUR PRIVATE STUDIO</div><h1>Make room for<br /><span>real connection.</span></h1><p>Start a live room with consent-first controls and disclosure built into every call.</p></div>
      <div className="room-card"><div className="room-card-top"><div className="room-icon">✳</div><div><span className="eyebrow">LIVE VIDEO</span><h2>Start a new room</h2></div></div><label className="room-label">ROOM CODE<div className="room-input-wrap"><span>⌘</span><input value={roomId} onChange={(event) => setRoomId(event.target.value.replace(/[^\w-]/g, '').slice(0, 64))} aria-label="Room code" /><button onClick={() => setRoomId('studio-' + Math.random().toString(36).slice(2, 8))} title="Generate a new room code">↻</button></div></label><button className="primary-button start-call" disabled={!roomId} onClick={() => setInCall(true)}>Enter the studio <span>→</span></button><div className="room-safety"><span className="pulse-dot" /> Mandatory AI disclosure remains visible in every call.</div></div>
      <div className="home-trust"><span><i>01</i> Consent checked</span><span><i>02</i> Disclosure always on</span><span><i>03</i> You stay in control</span></div>
    </section>
    <footer className="home-footer"><span>APUYOR ENGINE · 2026</span><span>MADE FOR REAL CONNECTION</span></footer>
  </main>;
}
