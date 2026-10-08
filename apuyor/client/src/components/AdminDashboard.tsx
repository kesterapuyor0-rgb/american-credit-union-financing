import { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, Check, Clock3, LoaderCircle, ShieldCheck, ShieldOff, Users, Video, X } from 'lucide-react';
import { api } from '../api';
import type { LikenessProfile, PendingUser } from '../types';

type Props = { token: string; onSignOut: () => void };

export default function AdminDashboard({ token, onSignOut }: Props) {
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [profiles, setProfiles] = useState<LikenessProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [userData, likenessData] = await Promise.all([api.pendingUsers(token), api.pendingLikeness(token)]);
      setUsers(userData.users); setProfiles(likenessData.profiles);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to load moderation queue.'); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function reviewUser(id: string, decision: 'approve' | 'reject') {
    setBusyId(id); setError('');
    try { await api.reviewUser(token, id, decision); setUsers((current) => current.filter((user) => user.id !== id)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to update account.'); }
    finally { setBusyId(''); }
  }

  async function patchProfile(id: string, changes: Partial<Pick<LikenessProfile, 'status' | 'forcedLabelState'>>) {
    setBusyId(id); setError('');
    try {
      const result = await api.updateLikeness(token, id, changes) as { profile: LikenessProfile };
      setProfiles((current) => current.map((profile) => profile._id === id ? result.profile : profile).filter((profile) => profile.status === 'pending'));
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to update likeness profile.'); }
    finally { setBusyId(''); }
  }

  return <main className="admin-shell">
    <header className="admin-topbar"><a className="brand" href="#home"><span className="brand-mark"><ShieldCheck size={18} /></span> apuyor<span className="brand-light">engine</span></a><div className="admin-nav"><span className="admin-status"><i /> ADMIN CONSOLE</span><button className="quiet-button" onClick={onSignOut}>Sign out</button></div></header>
    <section className="admin-content">
      <div className="admin-heading"><div><div className="eyebrow">TRUST & SAFETY</div><h1>Review queue</h1><p>Review account access and likeness permissions before they go live.</p></div><button className="secondary-button" onClick={() => void refresh()}><LoaderCircle size={15} className={loading ? 'spin' : ''} /> Refresh</button></div>
      {error && <div className="form-alert error" role="alert">{error}</div>}
      <div className="queue-stats"><div className="stat-card"><span className="stat-icon"><Users size={18} /></span><span className="stat-label">PENDING ACCOUNTS</span><b>{users.length}</b></div><div className="stat-card"><span className="stat-icon violet"><Video size={18} /></span><span className="stat-label">LIKNESS REVIEWS</span><b>{profiles.length}</b></div><div className="stat-card"><span className="stat-icon gold"><Clock3 size={18} /></span><span className="stat-label">LABEL OVERRIDES</span><b>{profiles.filter((profile) => profile.forcedLabelState).length}</b></div></div>

      <section className="admin-section"><div className="section-heading"><div><span className="section-icon"><Users size={17} /></span><div><h2>Account approvals</h2><p>New members waiting for access</p></div></div><span className="count-pill">{users.length} pending</span></div>
        <div className="table-wrap"><table><thead><tr><th>MEMBER</th><th>REQUESTED</th><th>STATUS</th><th className="align-right">REVIEW</th></tr></thead><tbody>
          {loading ? <tr><td colSpan={4} className="table-empty"><LoaderCircle className="spin" /> Loading review queue…</td></tr> : users.length === 0 ? <tr><td colSpan={4} className="table-empty"><BadgeCheck /> All account requests are reviewed.</td></tr> : users.map((user) => <tr key={user.id}><td><div className="identity-cell"><span className="avatar">{user.username.slice(0, 1).toUpperCase()}</span><span><b>{user.username}</b><small>{user.email}</small></span></div></td><td>{new Date(user.createdAt).toLocaleDateString()}</td><td><span className="status-tag pending"><i /> Pending</span></td><td><div className="row-actions"><button disabled={busyId === user.id} className="action-approve" onClick={() => void reviewUser(user.id, 'approve')}><Check size={14} /> Approve</button><button disabled={busyId === user.id} className="action-reject" onClick={() => void reviewUser(user.id, 'reject')}><X size={14} /> Reject</button></div></td></tr>)}
        </tbody></table></div>
      </section>

      <section className="admin-section"><div className="section-heading"><div><span className="section-icon violet"><Video size={17} /></span><div><h2>Likeness permissions</h2><p>Consent, identity, and required disclosure</p></div></div><span className="count-pill">{profiles.length} pending</span></div>
        <div className="table-wrap"><table><thead><tr><th>PROFILE</th><th>CONSENT EXPIRES</th><th>SAFETY LABEL</th><th>STATUS</th></tr></thead><tbody>
          {loading ? <tr><td colSpan={4} className="table-empty"><LoaderCircle className="spin" /> Loading review queue…</td></tr> : profiles.length === 0 ? <tr><td colSpan={4} className="table-empty"><BadgeCheck /> No likeness reviews are waiting.</td></tr> : profiles.map((profile) => <tr key={profile._id}><td><div className="identity-cell"><span className="avatar violet"><Video size={15} /></span><span><b>{profile.userId.slice(-8)}</b><small>Reference: {(profile.referenceMediaPath ?? profile.referenceVideoPath ?? 'media unavailable').split(/[\\/]/).pop()} · {profile.referenceMediaType ?? 'video'}</small></span></div></td><td>{new Date(profile.expiresAt).toLocaleDateString()}</td><td><button className={`label-toggle ${profile.forcedLabelState ? 'enabled' : ''}`} disabled={busyId === profile._id} onClick={() => void patchProfile(profile._id, { forcedLabelState: !profile.forcedLabelState })} aria-pressed={profile.forcedLabelState}><span className="toggle-knob" />{profile.forcedLabelState ? <><ShieldCheck size={13} /> Required</> : <><ShieldOff size={13} /> Standard</>}</button></td><td><select className="status-select" value={profile.status} disabled={busyId === profile._id} onChange={(event) => void patchProfile(profile._id, { status: event.target.value as LikenessProfile['status'] })}><option value="pending">Pending</option><option value="verified">Verified</option><option value="rejected">Rejected</option><option value="revoked">Revoked</option></select></td></tr>)}
        </tbody></table></div>
      </section>
      <p className="admin-footnote"><ShieldCheck size={14} /> Every decision is enforced by the server and recorded against the consent profile.</p>
    </section>
  </main>;
}
