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

export function AuthGate({ children }: { children: ReactNode }) {
  const { session, ready } = useSession();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  if (!ready) return null;
  if (session) return <>{children}</>;

  async function sendLink(e: FormEvent) {
    e.preventDefault();
    await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
    setSent(true);
  }

  return (
    <div className="auth-gate">
      <h1>Your Day</h1>
      <h2>Sign in</h2>
      {sent ? (
        <p>Check your email for the sign-in link.</p>
      ) : (
        <form onSubmit={sendLink}>
          <input
            type="email" required placeholder="you@example.com"
            value={email} onChange={(e) => setEmail(e.target.value)}
          />
          <button type="submit">Send magic link</button>
        </form>
      )}
      <button
        onClick={() => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })}
      >
        Continue with Google
      </button>
    </div>
  );
}
