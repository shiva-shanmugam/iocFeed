import { render, screen } from '@testing-library/react';
import { test, expect } from 'vitest';
import { Panel } from './Dashboard';
test('leaderboard panel labels are visible', () => {
  render(
    <Panel title="TOP COUNTRIES">
      <span>US</span>
    </Panel>,
  );
  expect(screen.getByText('TOP COUNTRIES')).toBeInTheDocument();
  expect(screen.getByText('US')).toBeInTheDocument();
});
