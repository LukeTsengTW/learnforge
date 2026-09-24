import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'

export function Markdown({ children, inline = false }: { children: string; inline?: boolean }) {
  const content = <ReactMarkdown skipHtml remarkPlugins={[remarkMath]}
    rehypePlugins={[[rehypeKatex, { trust: false, strict: 'ignore' }]]}
    components={{
      ...(inline ? { p: ({ children }) => <span>{children}</span> } : {}),
      a: ({ children, href }) => <a href={href} target="_blank" rel="noreferrer">{children}</a>,
    }}>{children}</ReactMarkdown>
  return inline ? <span className="markdown markdown-inline">{content}</span> : <div className="markdown">{content}</div>
}
