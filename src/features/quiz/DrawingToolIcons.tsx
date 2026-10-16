// Line icons for the drawing toolbar (24×24, drawn with the button's text colour). The buttons carry the name as
// aria-label and title, so the icons are decorative.
const ICON_PATHS = {
  pen: ['M4 20h4L19 9a2.83 2.83 0 0 0-4-4L4 16z', 'M13.5 6.5l4 4'],
  eraser: ['M3.6 14.4 12.9 5.1a2 2 0 0 1 2.8 0l3.2 3.2a2 2 0 0 1 0 2.8L11 19H8.2z', 'M8.5 9.5l6 6', 'M11 19h9'],
  undo: ['M9 14 4 9l5-5', 'M4 9h10.5a5.5 5.5 0 0 1 0 11H11'],
  redo: ['M15 14l5-5-5-5', 'M20 9H9.5a5.5 5.5 0 0 0 0 11H13'],
  expand: ['M15 3h6v6', 'M9 21H3v-6', 'M21 3l-7 7', 'M3 21l7-7'],
  collapse: ['M4 14h6v6', 'M20 10h-6V4', 'M14 10l7-7', 'M3 21l7-7'],
  move: ['M12 2v20', 'M2 12h20', 'M9 5l3-3 3 3', 'M9 19l3 3 3-3', 'M5 9l-3 3 3 3', 'M19 9l3 3-3 3'],
} as const

export type DrawingToolIconName = keyof typeof ICON_PATHS

export function DrawingToolIcon({ name }: { name: DrawingToolIconName }) {
  return <svg className="drawing-tool-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {ICON_PATHS[name].map((d) => <path key={d} d={d} />)}
  </svg>
}
