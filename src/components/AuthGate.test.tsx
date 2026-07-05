import { render, screen } from '@testing-library/react';
import { vi, test, expect, beforeEach } from 'vitest';

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
      onAuthStateChange: vi.fn(() => ({
        data: {
          subscription: {
            id: 'test-sub',
            callback: vi.fn(),
            unsubscribe: vi.fn()
          }
        }
      })),
      signInWithOtp: vi.fn(),
      signInWithOAuth: vi.fn(),
    },
  },
}));

import { AuthGate } from './AuthGate';
import { supabase } from '../lib/supabase';

const mockGetSession = vi.mocked(supabase.auth.getSession);
const mockOnAuthStateChange = vi.mocked(supabase.auth.onAuthStateChange);

beforeEach(() => {
  mockGetSession.mockReset();
  mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
  mockOnAuthStateChange.mockReset();
  mockOnAuthStateChange.mockReturnValue({
    data: {
      subscription: {
        id: 'test-sub',
        callback: vi.fn(),
        unsubscribe: vi.fn()
      }
    }
  } as any);
});

test('shows sign-in when no session', async () => {
  render(<AuthGate><div>secret</div></AuthGate>);
  expect(await screen.findByText(/sign in/i)).toBeInTheDocument();
  expect(screen.queryByText('secret')).not.toBeInTheDocument();
});

test('renders children when session exists', async () => {
  const mockSession = {
    id: 'test-session-id',
    user: {
      id: 'test-user-id',
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    },
  } as any;
  mockGetSession.mockResolvedValueOnce({
    data: { session: mockSession },
    error: null,
  });
  render(<AuthGate><div>secret content</div></AuthGate>);
  expect(await screen.findByText('secret content')).toBeInTheDocument();
  expect(screen.queryByText(/sign in/i)).not.toBeInTheDocument();
});
