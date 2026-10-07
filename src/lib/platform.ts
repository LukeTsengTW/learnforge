/** Browser heuristic only; it cannot inspect the iPadOS Scribble setting. */
export function isIPadOS(browser: Pick<Navigator, 'platform' | 'maxTouchPoints'>): boolean {
  return browser.platform === 'iPad' || (browser.platform === 'MacIntel' && browser.maxTouchPoints > 1)
}
