import { useState, type FormEvent } from 'react';
import { ArrowRight, Eye, EyeOff, Fingerprint, LockKeyhole, Mail, UserRound } from 'lucide-react';

type Props = {
  mode: 'login' | 'register';
  busy: boolean;
  error: string;
  notice: string;
  onModeChange: (mode: 'login' | 'register') => void;
  onLogin: (login: string, password: string) => void;
  onRegister: (username: string, email: string, password: string) => void;
};

export function AuthView({ mode, busy, error, notice, onModeChange, onLogin, onRegister }: Props) {
  const [login, setLogin] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const register = mode === 'register';

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (register) onRegister(username, email, password);
    else onLogin(login, password);
  }

  return (
    <main className="auth-shell">
      <section className="auth-aside">
        <a className="brand" href="#home"><span className="brand-mark"><Fingerprint size={20} /></span> apuyor<span className="brand-light">engine</span></a>
        <div className="aside-copy">
          <div className="eyebrow"><span className="pulse-dot" /> CONSENT FIRST · TRANSPARENT BY DESIGN</div>
          <h1>Be present.<br /><span>Be unmistakably</span><br />yourself.</h1>
          <p>Real connections, with clear controls and honest disclosure built into every moment.</p>
          <div className="assurance"><span className="assurance-icon"><LockKeyhole size={17} /></span><span><b>Your likeness stays yours.</b><small>Every session is protected by consent.</small></span></div>
        </div>
        <div className="aside-bottom"><span>APUYOR ENGINE</span><span>PRIVATE BY DEFAULT</span></div>
      </section>

      <section className="auth-panel">
        <div className="auth-mobile-brand"><span className="brand-mark"><Fingerprint size={19} /></span> apuyor<span className="brand-light">engine</span></div>
        <div className="auth-card">
          <div className="auth-kicker">{register ? 'CREATE YOUR ACCOUNT' : 'WELCOME BACK'}</div>
          <h2>{register ? 'Start with trust.' : 'Good to see you.'}</h2>
          <p className="auth-subtitle">{register ? 'Join a space where transparency comes standard.' : 'Sign in to continue to your private studio.'}</p>
          <div className="mode-switch" role="tablist" aria-label="Authentication mode">
            <button type="button" role="tab" aria-selected={!register} className={!register ? 'selected' : ''} onClick={() => onModeChange('login')}>Sign in</button>
            <button type="button" role="tab" aria-selected={register} className={register ? 'selected' : ''} onClick={() => onModeChange('register')}>Create account</button>
          </div>
          <form onSubmit={submit} className="auth-form">
            {register ? <>
              <label>Username<div className="input-wrap"><UserRound size={17} /><input value={username} onChange={(e) => setUsername(e.target.value)} minLength={3} maxLength={32} pattern="[A-Za-z0-9_]{3,32}" autoComplete="username" placeholder="Choose a username" required /></div><small>3–32 characters · letters, numbers, underscores</small></label>
              <label>Email address<div className="input-wrap"><Mail size={17} /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" required /></div></label>
            </> : <label>Email or username<div className="input-wrap"><UserRound size={17} /><input value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" placeholder="Your email or username" required /></div></label>}
            <label>Password<div className="input-wrap"><LockKeyhole size={17} /><input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} minLength={register ? 12 : undefined} maxLength={128} autoComplete={register ? 'new-password' : 'current-password'} placeholder={register ? 'At least 12 characters' : 'Enter your password'} required /><button className="icon-button" type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>{register && <small>Use 12 or more characters.</small>}</label>
            {error && <div className="form-alert error" role="alert">{error}</div>}
            {notice && <div className="form-alert success" role="status">{notice}</div>}
            <button className="primary-button auth-submit" type="submit" disabled={busy}>{busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'} <ArrowRight size={17} /></button>
          </form>
          {register && <p className="approval-note"><span className="pulse-dot" /> New accounts are reviewed before access is granted.</p>}
          <p className="terms-note">By continuing, you agree to our <a href="#terms">Terms</a> and <a href="#privacy">Privacy Policy</a>.</p>
        </div>
        <div className="auth-foot"><span>© 2026 Apuyor Engine</span><span>SECURE SESSION <i /></span></div>
      </section>
    </main>
  );
}
