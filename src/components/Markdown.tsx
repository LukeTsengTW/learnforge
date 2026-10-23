import { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { isQuizFigurePath, type QuizFigures } from '../lib/quiz-figures'

export const Markdown = memo(function Markdown({ children, inline = false, figures }: { children: string; inline?: boolean; figures?: QuizFigures }) {
  const content = <ReactMarkdown skipHtml remarkPlugins={[remarkMath]}
    rehypePlugins={[[rehypeKatex, { trust: false, strict: 'ignore' }]]}
    components={{
      ...(inline ? { p: ({ children }) => <span>{children}</span> } : {}),
      a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
      img: ({ src, alt }) => {
        const resolved = src && isQuizFigurePath(src) && figures && Object.hasOwn(figures, src) ? figures[src] : null
        return resolved ? <img src={resolved} alt={alt ?? ''} className="quiz-figure" />
          : <span className="quiz-figure-unavailable" role="status">圖片無法使用：{alt || '未提供圖說'}</span>
      },
    }}>{children}</ReactMarkdown>
  return inline ? <span className="markdown markdown-inline">{content}</span> : <div className="markdown">{content}</div>
})
