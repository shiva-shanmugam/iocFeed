import { render, screen } from '@testing-library/react';
import { test, expect } from 'vitest';
import { Panel } from './Dashboard';
test('panel renders accessible title and content', () => {
  render(
    <Panel title="LIVE FEEDS">
      <p>online</p>
    </Panel>,
  );
  expect(screen.getByText('LIVE FEEDS')).toBeInTheDocument();
  expect(screen.getByText('online')).toBeInTheDocument();
});
