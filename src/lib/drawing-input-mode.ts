export type DrawingInputMode = 'standard' | 'stylus'
export const DRAWING_INPUT_MODE_KEY = 'learnforge:drawing-input-mode'

export function getDrawingInputMode(): DrawingInputMode {
  try {
    if (window.localStorage.getItem(DRAWING_INPUT_MODE_KEY) === 'stylus') return 'stylus'
  } catch { /* Restricted storage must not prevent drawing. */ }
  return 'standard'
}

export function saveDrawingInputMode(mode: DrawingInputMode): void {
  try { window.localStorage.setItem(DRAWING_INPUT_MODE_KEY, mode) }
  catch { /* The selected mode still works for the current mounted canvas. */ }
}
