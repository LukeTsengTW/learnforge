export function normalizeUsername(value: string): string { return value.trim().toLowerCase() }
export function validateUsername(value: string): boolean { return /^[a-z0-9_]{3,24}$/.test(normalizeUsername(value)) }
export function usernameToSyntheticEmail(value: string): string {
  if (!validateUsername(value)) throw new Error('Invalid username')
  return `${normalizeUsername(value)}@users.learnforge.invalid`
}
