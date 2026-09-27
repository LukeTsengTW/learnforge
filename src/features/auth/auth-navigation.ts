export function safeDestination(value: unknown): string {
  return typeof value === 'string' && (/^\/(quiz|result)\/[a-z0-9_-]+$/.test(value)
    || ['/history', '/mistakes', '/analytics', '/review', '/ai-usage', '/account', '/recovery'].includes(value)) ? value : '/'
}
