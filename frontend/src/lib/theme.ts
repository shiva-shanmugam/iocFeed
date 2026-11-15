export function colorToken(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
