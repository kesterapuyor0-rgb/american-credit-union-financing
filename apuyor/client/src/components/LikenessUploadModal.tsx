import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Check, CircleAlert, ImagePlus, LoaderCircle, ShieldCheck, Upload, Video, X } from 'lucide-react';
import { api } from '../api';
import type { LikenessProfile, VerifiedConsent } from '../types';

type Props = {
  token: string;
  activeProfileId?: string;
  onAttach: (profile: LikenessProfile) => void;
  onClose: () => void;
};

const MAX_FILE_BYTES = 100 * 1024 * 1024;

export default function LikenessUploadModal({ token, activeProfileId, onAttach, onClose }: Props) {
  const [profiles, setProfiles] = useState<LikenessProfile[]>([]);
  const [consents, setConsents] = useState<VerifiedConsent[]>([]);
  const [consentId, setConsentId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([api.myLikeness(token), api.verifiedConsents(token)])
      .then(([profileResult, consentResult]) => {
        if (!active) return;
        setProfiles(profileResult.profiles);
        setConsents(consentResult.consents);
        setConsentId(consentResult.consents[0]?.id ?? '');
      })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Unable to load likeness permissions.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0] ?? null;
    setError('');
    setFile(null);
    if (!next) return;
    if (next.size > MAX_FILE_BYTES) { setError('Choose a file smaller than 100 MB.'); event.target.value = ''; return; }
    if (!/^(image\/(jpeg|png|webp)|video\/(mp4|webm|quicktime))$/.test(next.type)) {
      setError('Choose a JPEG, PNG, WebP, MP4, or WebM file.'); event.target.value = ''; return;
    }
    setFile(next);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(''); setNotice('');
    if (!consentId || !file) { setError('Choose an active verified consent record and a reference file.'); return; }
    setBusy(true);
    try {
      const result = await api.uploadLikeness(token, file, consentId);
      setProfiles((current) => [result.profile, ...current]);
      setNotice(result.message);
      setFile(null);
      onAttach(result.profile);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Upload failed. Please retry.'); }
    finally { setBusy(false); }
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="likeness-modal" role="dialog" aria-modal="true" aria-labelledby="likeness-title">
      <header className="modal-heading"><div><span className="modal-icon"><ImagePlus size={18} /></span><div><h2 id="likeness-title">Likeness profiles</h2><p>Use only your own likeness with verified consent.</p></div></div><button className="modal-close" onClick={onClose} aria-label="Close likeness profiles"><X size={18} /></button></header>
      <div className="modal-content">
        <form className="upload-form" onSubmit={(event) => void submit(event)}>
          <div className="upload-section-title"><Upload size={15} /> Add reference media</div>
          <label className="modal-field">Verified consent record
            <select value={consentId} onChange={(event) => setConsentId(event.target.value)} disabled={loading || consents.length === 0}>
              {consents.length === 0 ? <option value="">No active verified consent record</option> : consents.map((consent) => <option key={consent.id} value={consent.id}>Expires {new Date(consent.expiresAt).toLocaleDateString()} · {consent.id.slice(-8)}</option>)}
            </select>
          </label>
          {consents.length === 0 && !loading && <div className="consent-help"><ShieldCheck size={15} /> A verified, unexpired consent record on your account is required before adding likeness media.</div>}
          <label className="modal-field">Reference photo or video
            <span className={`file-drop ${file ? 'has-file' : ''}`}><input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" onChange={selectFile} />{file ? <><Check size={17} /><span><b>{file.name}</b><small>{(file.size / 1024 / 1024).toFixed(1)} MB selected</small></span></> : <><ImagePlus size={20} /><span><b>Choose a reference file</b><small>JPEG, PNG, WebP, MP4, or WebM · max 100 MB</small></span></>}</span>
          </label>
          {error && <div className="form-alert error" role="alert"><CircleAlert size={14} />{error}</div>}
          {notice && <div className="form-alert success" role="status"><ShieldCheck size={14} />{notice}</div>}
          <button className="primary-button upload-submit" type="submit" disabled={busy || loading || !consentId || !file}>{busy ? <><LoaderCircle size={15} className="spin" /> Uploading…</> : 'Upload for review'}</button>
          <p className="upload-safety"><ShieldCheck size={13} /> New uploads stay pending and cannot be transformed until an admin approves them.</p>
        </form>
        <div className="profile-list-head"><span>Your profiles</span><span>{profiles.length}</span></div>
        {loading ? <div className="profiles-empty"><LoaderCircle size={17} className="spin" /> Loading profiles…</div> : profiles.length === 0 ? <div className="profiles-empty"><Video size={17} /> No reference media uploaded yet.</div> : <div className="profile-list">{profiles.map((profile) => <div className={`profile-row ${activeProfileId === profile._id ? 'is-active' : ''}`} key={profile._id}><span className="profile-type-icon">{profile.referenceMediaType === 'video' ? <Video size={16} /> : <ImagePlus size={16} />}</span><span className="profile-details"><b>{(profile.referenceMediaPath ?? profile.referenceVideoPath ?? 'Reference media').split(/[\\/]/).pop()}</b><small>Expires {new Date(profile.expiresAt).toLocaleDateString()}</small></span><span className={`profile-status ${profile.status}`}>{profile.status}</span><button type="button" className="attach-button" disabled={profile.status !== 'verified'} onClick={() => onAttach(profile)}>{activeProfileId === profile._id ? <><Check size={13} /> Attached</> : profile.status === 'verified' ? 'Attach' : 'Pending'}</button></div>)}</div>}
        <div className="modal-disclosure"><span className="badge-signal" /> AI TRANSFORMED — NOT THE REAL PERSON <span className="modal-ai-voice">AI VOICE</span><small>Disclosure stays visible during every session.</small></div>
      </div>
    </section>
  </div>;
}
