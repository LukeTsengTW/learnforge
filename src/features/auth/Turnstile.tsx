import { useEffect, useRef, useState } from 'react'
import { turnstileSiteKey } from './captcha-config'
interface TurnstileApi {
  render(container: HTMLElement, options: Record<string, unknown>): string
  remove(id: string): void
}
declare global { interface Window { turnstile?: TurnstileApi } }
let scriptPromise: Promise<void> | undefined
function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  return scriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => { scriptPromise = undefined; script.remove(); reject(new Error('Unavailable')) }
    document.head.append(script)
  })
}
export function Turnstile({ action, onToken }: { action: 'signup' | 'login' | 'recovery'; onToken: (token: string) => void }) {
  const target = useRef<HTMLDivElement>(null)
  const callback = useRef(onToken)
  const [failed, setFailed] = useState(false)
  useEffect(() => { callback.current = onToken }, [onToken])
  useEffect(() => {
    if (!turnstileSiteKey) return
    let active = true, widget: string | undefined
    void loadScript().then(() => {
      if (!active || !target.current || !window.turnstile) return
      widget = window.turnstile.render(target.current, { sitekey: turnstileSiteKey, action, size: 'flexible',
        callback: (token: string) => callback.current(token),
        'expired-callback': () => callback.current(''),
        'error-callback': () => { callback.current(''); setFailed(true) },
      })
    }).catch(() => { if (active) setFailed(true) })
    return () => { active = false; if (widget) window.turnstile?.remove(widget) }
  }, [action])
  return turnstileSiteKey ? <div className="captcha"><div ref={target} aria-label="安全驗證" />{failed && <p role="alert">安全驗證無法載入，請重新整理後再試。</p>}</div> : null
}
