import { useEffect, useState, type ReactNode, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export function useSession(): { session: Session | null; ready: boolean } {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_evt, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  return { session, ready };
}

type Mode = 'signin' | 'signup';

export function AuthGate({ children }: { children: ReactNode }) {
  const { session, ready } = useSession();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!ready) return null;
  if (session) return <>{children}</>;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setPending(true);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setError(error.message);
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) setError(error.message);
        else if (!data.session) setNotice('Account created. Check your email to confirm, then sign in.');
      }
    } finally {
      setPending(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setNotice(null);
  }

  return (
    <div className="auth-screen">
      <div className="auth-gate">
        <p className="auth-kicker">One day at a time</p>
        <h1 className="auth-title">Your Day</h1>
        <div className="auth-tabs" role="tablist">
          <button
            type="button" role="tab" aria-selected={mode === 'signin'}
            className={mode === 'signin' ? 'active' : ''}
            onClick={() => switchMode('signin')}
          >
            Sign in
          </button>
          <button
            type="button" role="tab" aria-selected={mode === 'signup'}
            className={mode === 'signup' ? 'active' : ''}
            onClick={() => switchMode('signup')}
          >
            Create account
          </button>
        </div>
        <form onSubmit={submit}>
          <input
            type="email" required placeholder="you@example.com" autoComplete="email"
            aria-label="Email"
            value={email} onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password" required placeholder="Password" minLength={6}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            aria-label="Password"
            value={password} onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit" className="primary" disabled={pending}>
            {mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>
        {error && <p className="auth-error" role="alert">{error}</p>}
        {notice && <p className="auth-notice">{notice}</p>}
        <div className="auth-divider"><span>or</span></div>
        <button
          type="button"
          onClick={() => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })}
        >
          Continue with Google
        </button>
      </div>
    </div>
  );
}
