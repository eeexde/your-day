import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
      signInWithPassword: vi.fn(async () => ({ data: {}, error: null })),
      signUp: vi.fn(async () => ({ data: { session: null }, error: null })),
      signInWithOAuth: vi.fn(),
    },
  },
}));

import { AuthGate } from './AuthGate';
import { supabase } from '../lib/supabase';

const mockGetSession = vi.mocked(supabase.auth.getSession);
const mockOnAuthStateChange = vi.mocked(supabase.auth.onAuthStateChange);
const mockSignIn = vi.mocked(supabase.auth.signInWithPassword);
const mockSignUp = vi.mocked(supabase.auth.signUp);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
  mockOnAuthStateChange.mockReturnValue({
    data: {
      subscription: {
        id: 'test-sub',
        callback: vi.fn(),
        unsubscribe: vi.fn()
      }
    }
  } as any);
  mockSignIn.mockResolvedValue({ data: {}, error: null } as any);
  mockSignUp.mockResolvedValue({ data: { session: null }, error: null } as any);
});

test('shows sign-in when no session', async () => {
  render(<AuthGate><div>secret</div></AuthGate>);
  expect((await screen.findAllByText(/sign in/i)).length).toBeGreaterThan(0);
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

test('signs in with email and password', async () => {
  const user = userEvent.setup();
  render(<AuthGate><div>secret</div></AuthGate>);
  await user.type(await screen.findByLabelText('Email'), 'me@example.com');
  await user.type(screen.getByLabelText('Password'), 'hunter22');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(mockSignIn).toHaveBeenCalledWith({ email: 'me@example.com', password: 'hunter22' });
});

test('shows sign-in error message', async () => {
  mockSignIn.mockResolvedValueOnce({ data: {}, error: { message: 'Invalid login credentials' } } as any);
  const user = userEvent.setup();
  render(<AuthGate><div>secret</div></AuthGate>);
  await user.type(await screen.findByLabelText('Email'), 'me@example.com');
  await user.type(screen.getByLabelText('Password'), 'wrong'.padEnd(6, 'x'));
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Invalid login credentials');
});

test('sign-up mode creates account and signs straight in', async () => {
  const user = userEvent.setup();
  render(<AuthGate><div>secret</div></AuthGate>);
  await user.click(await screen.findByRole('tab', { name: 'Create account' }));
  await user.type(screen.getByLabelText('Email'), 'new@example.com');
  await user.type(screen.getByLabelText('Password'), 'hunter22');
  await user.click(screen.getByRole('button', { name: 'Create account' }));
  expect(mockSignUp).toHaveBeenCalledWith({
    email: 'new@example.com',
    password: 'hunter22',
    options: { emailRedirectTo: window.location.origin },
  });
  expect(mockSignIn).toHaveBeenCalledWith({ email: 'new@example.com', password: 'hunter22' });
  expect(screen.queryByText(/check your email/i)).not.toBeInTheDocument();
});

test('sign-up falls back to confirm notice when direct sign-in is rejected', async () => {
  mockSignIn.mockResolvedValueOnce({ data: {}, error: { message: 'Email not confirmed' } } as any);
  const user = userEvent.setup();
  render(<AuthGate><div>secret</div></AuthGate>);
  await user.click(await screen.findByRole('tab', { name: 'Create account' }));
  await user.type(screen.getByLabelText('Email'), 'new@example.com');
  await user.type(screen.getByLabelText('Password'), 'hunter22');
  await user.click(screen.getByRole('button', { name: 'Create account' }));
  expect(await screen.findByText(/check your email to confirm/i)).toBeInTheDocument();
});
