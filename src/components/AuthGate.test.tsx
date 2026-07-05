import { render, screen } from '@testing-library/react';
import { vi, test, expect } from 'vitest';

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signInWithOtp: vi.fn(),
      signInWithOAuth: vi.fn(),
    },
  },
}));

import { AuthGate } from './AuthGate';

test('shows sign-in when no session', async () => {
  render(<AuthGate><div>secret</div></AuthGate>);
  expect(await screen.findByText(/sign in/i)).toBeInTheDocument();
  expect(screen.queryByText('secret')).not.toBeInTheDocument();
});
