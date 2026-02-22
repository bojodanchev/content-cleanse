/**
 * Sanitize a filename for Supabase Storage.
 * Strips emojis, special characters, and replaces spaces with hyphens.
 * Preserves the file extension.
 */
export function sanitizeFilename(name: string): string {
  const lastDot = name.lastIndexOf('.')
  const ext = lastDot !== -1 ? name.slice(lastDot) : ''
  const base = lastDot !== -1 ? name.slice(0, lastDot) : name

  const clean = base
    // Remove emojis and other non-ASCII symbols
    .replace(/[^\w\s.-]/g, '')
    // Collapse whitespace and replace with hyphens
    .replace(/\s+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, '')

  // Fallback if filename is entirely special chars
  return (clean || 'file') + ext
}
