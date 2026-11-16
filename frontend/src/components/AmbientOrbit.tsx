export function AmbientOrbit() {
  return (
    <svg
      className="ambient-orbit"
      viewBox="0 0 240 240"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="120" cy="120" r="94" stroke="currentColor" strokeWidth="1" opacity="0.32" />
      <g className="ambient-orbit-track">
        <path d="M 120 26 A 94 94 0 0 1 214 120" stroke="currentColor" strokeWidth="1" />
        <circle cx="214" cy="120" r="2" fill="currentColor" />
      </g>
    </svg>
  );
}
