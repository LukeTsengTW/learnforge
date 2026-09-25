export function safeDestination(value: unknown): string {
  return typeof value === 'string' && (/^\/(quiz|result)\/[a-z0-9_-]+$/.test(value)
    || value === '/history' || value === '/mistakes') ? value : '/'
}
