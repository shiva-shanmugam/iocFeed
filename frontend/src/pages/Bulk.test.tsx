import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { test, expect } from 'vitest';
import { Bulk } from './Bulk';
test('bulk triage has paste area and action', () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Bulk />
    </QueryClientProvider>,
  );
  expect(screen.getByPlaceholderText(/Paste one IOC/)).toBeInTheDocument();
  expect(screen.getByText('RUN TRIAGE')).toBeInTheDocument();
});
