import { useEffect, useState, type ChangeEvent } from 'react';
import { AudioLines, Check, CircleAlert, ImagePlus, LoaderCircle, ShieldCheck, Upload, Video } from 'lucide-react';
import { api } from '../api';
import type { LikenessProfile, VerifiedConsent } from '../types';
import './LiveStudioControls.css';

type Props = {
  token: string;
  faceProfile: LikenessProfile | null;
  voiceProfile: LikenessProfile | null;
  onFaceProfileChange: (profile: LikenessProfile | null) => void;
  onVoiceProfileChange: (profile: LikenessProfile | null) => void;
  edgeBlending: number;
  onEdgeBlendingChange: (value: number) => void;
  maskSoftness: number;
  onMaskSoftnessChange: (value: number) => void;
  pitchOffset: number;
  onPitchOffsetChange: (value: number) => void;
  faceTransformAvailable: boolean;
  voiceTransformAvailable: boolean;
};

type StudioTab = 'face' | 'voice';

function ProfilePreview({ token, profile, kind }: { token: string; profile: LikenessProfile | null; kind: 'face' | 'voice' }) {
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewError, setPreviewError] = useState(false);

  useEffect(() => {
    let current = true;
    let objectUrl = '';
    setPreviewUrl('');
    setPreviewError(false);
    if (!profile) return () => { current = false; };
    api.likenessMedia(token, profile._id).then((url) => {
      if (current) {
        objectUrl = url;
        setPreviewUrl(url);
      } else URL.revokeObjectURL(url);
    }).catch(() => { if (current) setPreviewError(true); });
    return () => {
      current = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [profile, token]);

  return <div className={`studio-preview ${kind}`}>
    {kind === 'face' && previewUrl && !previewError
      ? <img src={previewUrl} alt="Active target face preview" />
      : kind === 'voice' && previewUrl && !previewError
        ? <audio src={previewUrl} controls aria-label="Active custom voice sample preview" />
        : <span>{kind === 'face' ? <ImagePlus size={25} /> : <AudioLines size={25} />}{previewError ? 'Preview unavailable' : profile ? 'Loading private preview…' : `No ${kind === 'face' ? 'target face' : 'voice profile'} selected`}</span>}
    {profile && <small className={`studio-approval ${profile.status}`}>{profile.status === 'verified' ? 'APPROVED' : profile.status === 'pending' ? 'AWAITING REVIEW' : profile.status.toUpperCase()}</small>}
  </div>;
}

function readAudioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      if (Number.isFinite(audio.duration)) resolve(audio.duration);
      else reject(new Error('Audio duration could not be read.'));
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Choose a valid WAV or MP3 audio clip.'));
    };
    audio.src = url;
  });
}

export default function LiveStudioControls({
  token,
  faceProfile,
  voiceProfile,
  onFaceProfileChange,
  onVoiceProfileChange,
  edgeBlending,
  onEdgeBlendingChange,
  maskSoftness,
  onMaskSoftnessChange,
  pitchOffset,
  onPitchOffsetChange,
  faceTransformAvailable,
  voiceTransformAvailable,
}: Props) {
  const [tab, setTab] = useState<StudioTab>('face');
  const [profiles, setProfiles] = useState<LikenessProfile[]>([]);
  const [consents, setConsents] = useState<VerifiedConsent[]>([]);
  const [consentId, setConsentId] = useState('');
  const [faceFile, setFaceFile] = useState<File | null>(null);
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let current = true;
    Promise.all([api.myLikeness(token), api.verifiedConsents(token)])
      .then(([likeness, consentResult]) => {
        if (!current) return;
        setProfiles(likeness.profiles);
        setConsents(consentResult.consents);
        setConsentId(consentResult.consents[0]?.id ?? '');
      })
      .catch((reason: unknown) => { if (current) setError(reason instanceof Error ? reason.message : 'Unable to load studio profiles.'); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [token]);

  const faceProfiles = profiles.filter((profile) => profile.referenceMediaType === 'image');
  const voiceProfiles = profiles.filter((profile) => profile.referenceMediaType === 'audio');
  const selectableFaces = faceProfiles.filter((profile) => profile.status === 'verified');
  const selectableVoices = voiceProfiles.filter((profile) => profile.status === 'verified');

  function selectFace(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setFaceFile(null);
    setError('');
    setNotice('');
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 10 * 1024 * 1024) {
      setError('Choose a JPEG or PNG image no larger than 10 MB.');
      event.target.value = '';
      return;
    }
    setFaceFile(file);
  }

  async function selectVoice(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setVoiceFile(null);
    setError('');
    setNotice('');
    if (!file) return;
    const audioExtension = /\.wav$/i.test(file.name) ? 'wav' : /\.mp3$/i.test(file.name) ? 'mp3' : '';
    if ((!['audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave', 'audio/mpeg', 'audio/mp3'].includes(file.type) && !audioExtension) || file.size > 15 * 1024 * 1024) {
      setError('Choose a WAV or MP3 file no larger than 15 MB.');
      event.target.value = '';
      return;
    }
    try {
      const duration = await readAudioDuration(file);
      if (duration < 5 || duration > 15) {
        setError('Voice clips must be between 5 and 15 seconds long.');
        event.target.value = '';
        return;
      }
      setVoiceFile(file);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to read audio duration.');
      event.target.value = '';
    }
  }

  async function upload(kind: StudioTab) {
    const file = kind === 'face' ? faceFile : voiceFile;
    setError('');
    setNotice('');
    if (!file || !consentId) {
      setError('Choose a file and an active verified consent record.');
      return;
    }
    setBusy(true);
    try {
      const result = kind === 'face'
        ? await api.uploadLikeness(token, file, consentId)
        : await api.uploadVoiceSample(token, file, consentId);
      setProfiles((current) => [result.profile, ...current.filter((profile) => profile._id !== result.profile._id)]);
      setNotice(result.message);
      if (kind === 'face') setFaceFile(null);
      else setVoiceFile(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Upload failed. Please retry.');
    } finally {
      setBusy(false);
    }
  }

  const profileSelector = (kind: StudioTab) => {
    const selected = kind === 'face' ? faceProfile : voiceProfile;
    const available = kind === 'face' ? selectableFaces : selectableVoices;
    const onChange = kind === 'face' ? onFaceProfileChange : onVoiceProfileChange;
    return <label className="studio-select-label">Approved {kind === 'face' ? 'face profile' : 'voice profile'}
      <select value={selected?._id ?? ''} onChange={(event) => onChange(available.find((profile) => profile._id === event.target.value) ?? null)}>
        <option value="">Select an approved profile</option>
        {available.map((profile) => <option value={profile._id} key={profile._id}>{(profile.referenceMediaPath ?? 'Studio profile').split(/[\\/]/).pop()}</option>)}
      </select>
    </label>;
  };

  return <section className="live-studio" aria-label="Live media studios">
    <div className="studio-tabs" role="tablist" aria-label="Live studio">
      <button type="button" role="tab" aria-selected={tab === 'face'} className={tab === 'face' ? 'selected' : ''} onClick={() => { setTab('face'); setError(''); setNotice(''); }}><ImagePlus size={15} /> Face &amp; Video Studio</button>
      <button type="button" role="tab" aria-selected={tab === 'voice'} className={tab === 'voice' ? 'selected' : ''} onClick={() => { setTab('voice'); setError(''); setNotice(''); }}><AudioLines size={15} /> Live Voice Studio</button>
    </div>
    {consents.length > 0 && <label className="studio-consent">VERIFIED CONSENT
      <select value={consentId} onChange={(event) => setConsentId(event.target.value)} disabled={loading}>
        {consents.map((consent) => <option key={consent.id} value={consent.id}>Expires {new Date(consent.expiresAt).toLocaleDateString()}</option>)}
      </select>
    </label>}
    {consents.length === 0 && !loading && <div className="studio-consent-warning"><ShieldCheck size={14} /> An active verified consent record is required for all target profiles.</div>}
    <div className="studio-panel" role="tabpanel">
      {tab === 'face' ? <>
        <div className="studio-card">
          <div className="studio-card-heading"><span className="studio-card-icon"><ImagePlus size={17} /></span><div><b>Target Face Image</b><small>Upload your own face as JPEG or PNG. Verified consent and admin approval are required.</small></div></div>
          <ProfilePreview token={token} profile={faceProfile} kind="face" />
          {profileSelector('face')}
          <label className="studio-file-picker"><input type="file" accept="image/jpeg,image/png" onChange={selectFace} /><Upload size={15} />{faceFile ? faceFile.name : 'Choose target image'}</label>
          <button type="button" className="studio-upload-button" disabled={busy || !consentId || !faceFile} onClick={() => void upload('face')}>{busy ? <LoaderCircle size={14} className="spin" /> : <Check size={14} />} Upload target face</button>
          <small className="studio-pipeline-state">Embedding: {faceProfile?.embeddingStatus ?? 'select an approved face to activate'}</small>
        </div>
        <div className="studio-card">
          <div className="studio-card-heading"><span className="studio-card-icon"><Video size={17} /></span><div><b>Face-swap rendering</b><small>Adjust live controls for the connected frame renderer.</small></div></div>
          <RangeControl label="Edge blending" value={edgeBlending} min={0} max={100} unit="%" onChange={onEdgeBlendingChange} />
          <RangeControl label="Mask softness" value={maskSoftness} min={0} max={100} unit="%" onChange={onMaskSoftnessChange} />
          <div className={`studio-adapter-note ${faceTransformAvailable ? 'connected' : ''}`}>{faceTransformAvailable ? 'Face transform adapter connected.' : 'Live face rendering is unavailable until a trusted transform adapter is connected.'}</div>
        </div>
      </> : <>
        <div className="studio-card">
          <div className="studio-card-heading"><span className="studio-card-icon voice"><AudioLines size={17} /></span><div><b>Custom Voice Clone</b><small>Upload 5–15 seconds of your own voice as WAV or MP3. Verified consent and admin approval are required.</small></div></div>
          <ProfilePreview token={token} profile={voiceProfile} kind="voice" />
          {profileSelector('voice')}
          <label className="studio-file-picker"><input type="file" accept="audio/wav,audio/mpeg,.wav,.mp3" onChange={(event) => void selectVoice(event)} /><Upload size={15} />{voiceFile ? voiceFile.name : 'Choose voice sample'}</label>
          <button type="button" className="studio-upload-button" disabled={busy || !consentId || !voiceFile} onClick={() => void upload('voice')}>{busy ? <LoaderCircle size={14} className="spin" /> : <Check size={14} />} Upload voice sample</button>
          <small className="studio-pipeline-state">Embedding: {voiceProfile?.embeddingStatus ?? 'select an approved voice to activate'}</small>
        </div>
        <div className="studio-card">
          <div className="studio-card-heading"><span className="studio-card-icon voice"><AudioLines size={17} /></span><div><b>Voice conversion</b><small>Adjust pitch offset for a connected voice adapter.</small></div></div>
          <RangeControl label="Pitch offset" value={pitchOffset} min={-12} max={12} unit=" semitones" onChange={onPitchOffsetChange} />
          <div className={`studio-adapter-note ${voiceTransformAvailable ? 'connected' : ''}`}>{voiceTransformAvailable ? 'Voice conversion adapter connected.' : 'Live voice conversion is unavailable until a trusted voice adapter is connected.'}</div>
        </div>
      </>}
    </div>
    {error && <div className="form-alert error studio-alert" role="alert"><CircleAlert size={14} />{error}</div>}
    {notice && <div className="form-alert success studio-alert" role="status"><ShieldCheck size={14} />{notice}</div>}
  </section>;
}

function RangeControl({ label, value, min, max, unit, onChange }: { label: string; value: number; min: number; max: number; unit: string; onChange: (value: number) => void }) {
  return <label className="studio-range"><span>{label}<b>{value > 0 && min < 0 ? '+' : ''}{value}{unit}</b></span><input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}
