import { useEffect, useRef, useState } from 'react'
import type { DrawingStroke } from '../../models/drawing'
import type { DrawingConfig } from '../../models/quiz'
import { downloadDrawingPng, replayDrawing } from '../../lib/drawing'

export function DrawingPreview({ config, strokes, id, label = '已提交的繪圖答案', exportLabel = '匯出這份繪圖 PNG' }: {
  config: DrawingConfig; strokes: DrawingStroke[]; id: string; label?: string; exportLabel?: string
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [notice, setNotice] = useState('')
  useEffect(() => {
    const context = canvas.current?.getContext('2d')
    if (context) replayDrawing(context, config, strokes)
  }, [config, strokes])
  return <div>
    <div className="canvas-frame preview-frame"><canvas ref={canvas} width={config.width} height={config.height}
      role="img" aria-label={label} className="drawing-preview">{label}。</canvas></div>
    <button type="button" className="text-button" onClick={async () => {
      try { await downloadDrawingPng(config, strokes, `${id}-submitted.png`); setNotice('PNG 已匯出。') }
      catch { setNotice('PNG 匯出失敗，請重試。') }
    }}>{exportLabel}</button>
    <span role="status">{notice}</span>
  </div>
}
