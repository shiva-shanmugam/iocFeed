export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        line: 'var(--color-border)',
        primary: 'var(--color-text)',
        secondary: 'var(--color-text-secondary)',
        disabled: 'var(--color-text-disabled)',
        accent: 'var(--color-accent)',
        malicious: 'var(--color-malicious)',
        suspicious: 'var(--color-suspicious)',
        bar: 'var(--color-bar)',
      },
      borderRadius: { sm: '2px' },
      fontFamily: { mono: ['JetBrains Mono', 'monospace'] },
    },
  },
  plugins: [],
};
