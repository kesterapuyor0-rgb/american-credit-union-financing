import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { AlertTriangle, Camera, CameraOff, Mic, MicOff, PhoneOff, Radio, RefreshCw, UserRoundSearch, WandSparkles } from 'lucide-react';
import { API_URL } from '../api';
import type { LikenessProfile } from '../types';
import LikenessUploadModal from './LikenessUploadModal';
import { TransformBoundary } from './TransformBoundary';

type Props = {
  roomId: string;
  token: string;
  onTransformStream?: (stream: MediaStream, likenessProfileId: string) => Promise<MediaStream>;
  onConvertVoice?: (stream: MediaStream, likenessProfileId: string) => Promise<MediaStream>;
  onLeave: () => void;
};

const DISCLOSURE = 'AI TRANSFORMED — NOT THE REAL PERSON';

function getSessionToken(explicitToken?: string): string {
  try {
    const rawSession = localStorage.getItem('apuyor-session');
    if (!rawSession) return '';
    const session: unknown = JSON.parse(rawSession);
    if (session && typeof session === 'object' && 'token' in session) {
      const value = (session as { token?: unknown }).token;
      return typeof value === 'string' ? value : '';
    }
  } catch {
    // A malformed or stale local session should not prevent the call UI from rendering.
  }
  return explicitToken?.trim() || '';
}

function MediaStage({ stream, label }: { stream: MediaStream | null; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (ref.current) ref.current.srcObject = stream; }, [stream]);
  return <video ref={ref} className="stage-video" autoPlay playsInline muted={label === 'You'} aria-label={`${label} video`} />;
}

export default function VideoCall({ roomId, token, onTransformStream, onConvertVoice, onLeave }: Props) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [voiceActive, setVoiceActive] = useState(false);
  const [transformActive, setTransformActive] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [showLikeness, setShowLikeness] = useState(false);
  const [activeLikeness, setActiveLikeness] = useState<LikenessProfile | null>(null);
  const [callError, setCallError] = useState('');
  const socketRef = useRef<Socket | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const originalTracksRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let alive = true;
    let socket: Socket | null = null;
    let peer: RTCPeerConnection | null = null;
    let base: MediaStream | null = null;

    async function startCall() {
      try {
        const initialToken = getSessionToken(token);
        if (!initialToken && !import.meta.env.DEV) {
          setCallError('Your sign-in session is missing. Sign in again before joining a call.');
          return;
        }
        base = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (!alive) { base.getTracks().forEach((track) => track.stop()); return; }
        originalTracksRef.current = base;
        setLocalStream(base);
        socket = io(API_URL || 'http://localhost:4000', {
          // Local development may use the server's loopback-only mock-auth bypass.
          auth: { token: initialToken },
          withCredentials: true,
          autoConnect: false,
        });
        socketRef.current = socket;
        peer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        peerRef.current = peer;
        base.getTracks().forEach((track) => peer?.addTrack(track, base));
        peer.ontrack = (event) => {
          const stream = event.streams[0] ?? new MediaStream([event.track]);
          setRemoteStream(stream);
        };
        peer.onicecandidate = ({ candidate }) => {
          if (candidate) socket?.emit('signal:ice', { roomId, payload: candidate.toJSON() });
        };
        peer.onconnectionstatechange = () => {
          if (peer && ['failed', 'disconnected', 'closed'].includes(peer.connectionState)) setCallError('Connection interrupted. Check your network and reconnect.');
          else setCallError('');
        };
        socket.on('connect_error', (error) => {
          console.error('Socket.IO connection failed:', error.message);
          setCallError('Signaling service unavailable. Check the API URL, allowed client origin, and session authorization.');
        });
        socket.on('signal:offer', async ({ payload }) => {
          if (!peer || !payload) return;
          await peer.setRemoteDescription(payload);
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          socket?.emit('signal:answer', { roomId, payload: answer });
        });
        socket.on('signal:answer', async ({ payload }) => { if (peer && payload) await peer.setRemoteDescription(payload); });
        socket.on('signal:ice', async ({ payload }) => { if (peer && payload) await peer.addIceCandidate(payload).catch(() => undefined); });
        socket.on('signal:peer-joined', async () => {
          if (peer?.signalingState !== 'stable') return;
          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);
          socket?.emit('signal:offer', { roomId, payload: offer });
        });
        socket.on('connect', async () => {
          setCallError('');
          socket?.emit('signal:join', roomId);
        });
        socket.connect();
      } catch {
        setCallError('Camera or microphone access is unavailable. Check browser permissions and try again.');
      }
    }
    void startCall();
    return () => {
      alive = false;
      socket?.disconnect();
      peer?.close();
      base?.getTracks().forEach((track) => track.stop());
      socketRef.current = null;
      peerRef.current = null;
    };
  }, [roomId, token]);

  const replaceOutgoing = useCallback(async (stream: MediaStream) => {
    const peer = peerRef.current;
    if (!peer) return;
    const tracks = stream.getTracks();
    for (const sender of peer.getSenders()) {
      const currentKind = sender.track?.kind;
      if (!currentKind) continue;
      const next = tracks.find((track) => track.kind === currentKind);
      if (next) await sender.replaceTrack(next);
    }
  }, []);

  function toggleTrack(kind: 'audio' | 'video') {
    const next = kind === 'video' ? !cameraOn : !micOn;
    localStream?.getTracks().filter((track) => track.kind === kind).forEach((track) => { track.enabled = next; });
    if (kind === 'video') setCameraOn(next); else setMicOn(next);
  }

  async function toggleTransform() {
    if (transformActive) {
      const base = originalTracksRef.current;
      if (base) await replaceOutgoing(base);
      setLocalStream(base ?? null);
      setTransformActive(false);
      setFallback(false);
      return;
    }
    try {
      if (!onTransformStream || !originalTracksRef.current || !activeLikeness || activeLikeness.status !== 'verified') throw new Error('Approved likeness and transformation service required');
      const transformed = await onTransformStream(originalTracksRef.current, activeLikeness._id);
      await replaceOutgoing(transformed);
      setLocalStream(transformed);
      setTransformActive(true);
      setFallback(false);
    } catch {
      const base = originalTracksRef.current;
      if (base) await replaceOutgoing(base).catch(() => undefined);
      setLocalStream(base ?? null);
      setTransformActive(false);
      setFallback(true);
    }
  }

  async function toggleVoice() {
    if (voiceActive) {
      const base = originalTracksRef.current;
      if (base) await replaceOutgoing(base);
      setLocalStream(base ?? null);
      setVoiceActive(false);
      return;
    }
    try {
      if (!onConvertVoice || !originalTracksRef.current || !activeLikeness || activeLikeness.status !== 'verified') throw new Error('Approved likeness and voice service required');
      const converted = await onConvertVoice(originalTracksRef.current, activeLikeness._id);
      await replaceOutgoing(converted);
      setLocalStream(converted);
      setVoiceActive(true);
      setFallback(false);
    } catch {
      const base = originalTracksRef.current;
      if (base) await replaceOutgoing(base).catch(() => undefined);
      setLocalStream(base ?? null);
      setVoiceActive(false);
      setFallback(true);
    }
  }

  const stageFallback = <div className="stage-fallback"><AlertTriangle size={22} /><span>AI transformation temporarily unavailable — normal video active.</span></div>;

  return (
    <section className="call-layout">
      <header className="call-topbar"><a className="brand" href="#home"><span className="brand-mark"><Radio size={18} /></span> apuyor<span className="brand-light">engine</span></a><div className="call-room"><span className="live-dot" /> LIVE SESSION <span className="room-code">{roomId}</span></div><button className="quiet-button" onClick={onLeave}>Leave room</button></header>
      {fallback && <div className="fallback-banner" role="status"><AlertTriangle size={17} /> AI transformation temporarily unavailable — normal video active.</div>}
      {callError && <div className="fallback-banner connection-banner" role="alert"><AlertTriangle size={17} /> {callError}</div>}
      <div className="video-stage-grid">
        <div className="video-tile main-tile">
          <TransformBoundary fallback={stageFallback}><MediaStage stream={remoteStream} label="Participant" /></TransformBoundary>
          <div className="disclosure-badge" aria-label={DISCLOSURE}><span className="badge-signal" />{DISCLOSURE}</div>
          {voiceActive && <div className="voice-badge"><WandSparkles size={14} /> AI VOICE</div>}
          <span className="participant-name">Participant</span>
          {!remoteStream && <div className="waiting-state"><div className="waiting-orbit"><Radio size={24} /></div><b>Waiting for someone to join</b><span>Share the room code to connect.</span></div>}
        </div>
        <div className="video-tile self-tile"><MediaStage stream={localStream} label="You" /><span className="participant-name">You <span className="you-pill">YOU</span></span>{!cameraOn && <div className="camera-off"><CameraOff size={24} /></div>}</div>
      </div>
      {activeLikeness && <div className={`active-likeness ${activeLikeness.status !== 'verified' ? 'awaiting' : ''}`}><UserRoundSearch size={14} /><span>Reference attached</span><b>{activeLikeness.status === 'verified' ? 'APPROVED' : 'AWAITING REVIEW'}</b></div>}
      <div className="call-control-wrap"><div className="call-controls">
        <button className={`control-button ${!micOn ? 'is-off' : ''}`} onClick={() => toggleTrack('audio')} aria-label={micOn ? 'Mute microphone' : 'Enable microphone'}>{micOn ? <Mic /> : <MicOff />}<span>{micOn ? 'Mic on' : 'Mic off'}</span></button>
        <button className={`control-button ${!cameraOn ? 'is-off' : ''}`} onClick={() => toggleTrack('video')} aria-label={cameraOn ? 'Turn camera off' : 'Turn camera on'}>{cameraOn ? <Camera /> : <CameraOff />}<span>{cameraOn ? 'Camera on' : 'Camera off'}</span></button>
        <button className="control-button" onClick={() => setShowLikeness(true)}><UserRoundSearch /><span>Likeness</span></button>
        <button className={`control-button ai-control ${transformActive ? 'active' : ''}`} disabled={!activeLikeness || activeLikeness.status !== 'verified'} title="Attach an admin-approved profile first" onClick={() => void toggleTransform()}><WandSparkles /><span>{transformActive ? 'AI on' : 'Transform'}</span></button>
        <button className={`control-button ai-control ${voiceActive ? 'active' : ''}`} disabled={!activeLikeness || activeLikeness.status !== 'verified'} title="Attach an admin-approved profile first" onClick={() => void toggleVoice()}><Radio /><span>{voiceActive ? 'AI voice on' : 'AI voice'}</span></button>
        <button className="hangup-button" onClick={onLeave} aria-label="Leave call"><PhoneOff size={20} /></button>
      </div></div>
      <p className="call-footnote"><RefreshCw size={13} /> Your camera and microphone stay in your control. Disclosure remains visible for the entire session.</p>
      {showLikeness && <LikenessUploadModal token={token} activeProfileId={activeLikeness?._id} onAttach={setActiveLikeness} onClose={() => setShowLikeness(false)} />}
    </section>
  );
}
