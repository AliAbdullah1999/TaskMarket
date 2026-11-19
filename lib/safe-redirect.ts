/**
 * Only same-site relative paths are allowed as post-login destinations.
 * Rejects protocol-relative URLs (`//evil.com`), the backslash variant browsers
 * normalise to the same thing (`/\evil.com`), and absolute URLs.
 */
export function safeNext(value: string, fallback = "/dashboard") {
  return /^\/(?![/\\])[^\\\s]*$/.test(value) ? value : fallback;
}
