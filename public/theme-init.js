/* global document, window */
// Runs before styles and React. Keep the key and values aligned with src/lib/theme.ts.
;(() => {
  let theme
  try { theme = window.localStorage.getItem('learnforge:theme') }
  catch { /* Storage may be blocked; the system default still works. */ }
  if (theme !== 'light' && theme !== 'dark') {
    theme = window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  document.documentElement.dataset.theme = theme
})()
