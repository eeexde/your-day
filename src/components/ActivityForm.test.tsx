import { render, screen, fireEvent } from '@testing-library/react';
import { vi, test, expect } from 'vitest';
import { ActivityForm } from './ActivityForm';

test('submits name, priority, duration; null fixed time by default', () => {
  const onSubmit = vi.fn();
  render(<ActivityForm initial={null} onSubmit={onSubmit} onCancel={() => {}} />);
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Gym' } });
  fireEvent.change(screen.getByLabelText('Priority'), { target: { value: '1' } });
  fireEvent.click(screen.getByText('Save'));
  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({ name: 'Gym', priority: 1, default_duration_minutes: 60, fixed_start_time: null }),
  );
});

test('fixed-time checkbox reveals time input and submits it', () => {
  const onSubmit = vi.fn();
  render(<ActivityForm initial={null} onSubmit={onSubmit} onCancel={() => {}} />);
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Meeting' } });
  fireEvent.click(screen.getByLabelText('Only at a specific hour'));
  fireEvent.change(screen.getByLabelText('Fixed time'), { target: { value: '14:00' } });
  fireEvent.click(screen.getByText('Save'));
  expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ fixed_start_time: '14:00' }));
});
