import { act, render, screen, waitFor } from '@testing-library/react';
import { vi, test, expect, beforeEach, afterEach } from 'vitest';

vi.mock('./lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signInWithOtp: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
      getUser: vi.fn(async () => ({ data: { user: { id: 'u1' } }, error: null })),
    },
  },
}));

vi.mock('./api', () => ({
  fetchActivities: vi.fn(async () => []),
  ensureDayPlan: vi.fn(async () => ({ id: 'plan-1', user_id: 'u1', date: '2026-07-05' })),
  fetchEntries: vi.fn(async () => []),
  createEntry: vi.fn(),
  updateEntry: vi.fn(),
  deleteEntry: vi.fn(),
  createActivity: vi.fn(),
  updateActivity: vi.fn(),
  archiveActivity: vi.fn(),
  listTemplates: vi.fn(async () => []),
  copyDay: vi.fn(),
  applyTemplate: vi.fn(),
  saveTemplate: vi.fn(),
}));

vi.mock('./lib/reminders', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lib/reminders')>();
  return { ...actual, scheduleReminders: vi.fn(() => vi.fn()) };
});

import App from './App';
import { supabase } from './lib/supabase';
import * as api from './api';
import { scheduleReminders } from './lib/reminders';

const mockGetSession = vi.mocked(supabase.auth.getSession);
const mockedApi = vi.mocked(api);
const mockedSchedule = vi.mocked(scheduleReminders);

const mockSession = {
  id: 'test-session-id',
  user: {
    id: 'u1',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString(),
  },
} as any;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function todayLocalISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const hadNotification = Object.prototype.hasOwnProperty.call(globalThis, 'Notification');
let originalNotification: unknown;

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue({ data: { session: null }, error: null } as any);
  vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  } as any);
  mockedApi.fetchActivities.mockResolvedValue([]);
  mockedApi.ensureDayPlan.mockResolvedValue({ id: 'plan-1', user_id: 'u1', date: '2026-07-05' } as any);
  mockedApi.fetchEntries.mockResolvedValue([]);
  mockedApi.listTemplates.mockResolvedValue([]);
  Element.prototype.scrollTo = vi.fn();
  originalNotification = (globalThis as any).Notification;
});

afterEach(() => {
  if (hadNotification) {
    (globalThis as any).Notification = originalNotification;
  } else {
    delete (globalThis as any).Notification;
  }
});

test('renders sign-in screen when logged out', async () => {
  render(<App />);
  expect(await screen.findByText(/sign in/i)).toBeInTheDocument();
});

test('logged in: loads today and renders the planner layout', async () => {
  mockGetSession.mockResolvedValueOnce({ data: { session: mockSession }, error: null } as any);

  const { unmount } = render(<App />);

  const expectedDate = todayLocalISO();
  await waitFor(() => expect(mockedApi.ensureDayPlan).toHaveBeenCalledWith(expectedDate));
  expect(mockedApi.ensureDayPlan).toHaveBeenCalledTimes(1);

  expect(await screen.findByText('Activities')).toBeInTheDocument();
  expect(screen.getByLabelText('Date')).toHaveValue(expectedDate);
  expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();

  unmount();
});

test('logged in: schedules reminders once notification permission resolves, without further data changes', async () => {
  mockGetSession.mockResolvedValueOnce({ data: { session: mockSession }, error: null } as any);

  const now = new Date();
  const startMinutes = now.getHours() * 60 + now.getMinutes() + 20;
  const startTime = `${pad(Math.floor(startMinutes / 60) % 24)}:${pad(startMinutes % 60)}:00`;

  const activity = {
    id: 'a1', user_id: 'u1', name: 'Meeting', color: '#fff', priority: 1,
    default_duration_minutes: 60, fixed_start_time: startTime, is_archived: false,
  };
  const entry = {
    id: 'e1', day_plan_id: 'plan-1', activity_id: 'a1',
    start_time: startTime, duration_minutes: 60, done: false,
  };
  mockedApi.fetchActivities.mockResolvedValueOnce([activity] as any);
  mockedApi.fetchEntries.mockResolvedValueOnce([entry] as any);

  let resolvePermission!: (v: NotificationPermission) => void;
  const permissionPromise = new Promise<NotificationPermission>((resolve) => {
    resolvePermission = resolve;
  });
  class FakeNotification {
    static permission: NotificationPermission = 'default';
    static requestPermission = vi.fn(() => permissionPromise);
  }
  (globalThis as any).Notification = FakeNotification;

  const { unmount } = render(<App />);

  // Wait for the real data to land (this triggers the reminder effect to re-run
  // with the actual entries/activities, matching the reported race).
  await waitFor(async () => expect((await screen.findAllByText('Meeting')).length).toBeGreaterThan(0));

  // Permission is still pending at this point, so nothing should be scheduled yet.
  expect(mockedSchedule).not.toHaveBeenCalled();

  await act(async () => {
    FakeNotification.permission = 'granted';
    resolvePermission('granted');
    await permissionPromise;
  });

  await waitFor(() => expect(mockedSchedule).toHaveBeenCalledTimes(1));
  expect(mockedSchedule.mock.calls[0][0]).toEqual([
    { title: 'Meeting at ' + startTime.slice(0, 5), fireInMs: expect.any(Number) },
  ]);

  unmount();
});
