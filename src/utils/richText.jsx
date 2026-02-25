// JSX rendering utilities — must be in a .jsx file so Vite processes JSX transforms.
import { sanitizePublishedHtml, sanitizeHandTagsForRender, isLikelyHtmlContent } from './richText'

export function renderInlineRichText(text, keyPrefix = 'rt') {
    const source = sanitizeHandTagsForRender(text)
    if (!source) return null

    const patterns = [
        {
            re: /\[color=([#a-zA-Z0-9(),.\s%-]+)\]([\s\S]*?)\[\/color\]/,
            render: (match, children, key) =>
                <span key={key} style={{ color: match[1].trim() }}>{children}</span>,
        },
        {
            re: /\[bg=([#a-zA-Z0-9(),.\s%-]+)\]([\s\S]*?)\[\/bg\]/,
            render: (match, children, key) =>
                <span key={key} style={{ background: match[1].trim(), padding: '0 2px', borderRadius: '4px' }}>{children}</span>,
        },
        {
            re: /\[(hand(?:10|[1-9])?)\]([\s\S]*?)\[\/\1\]/,
            render: (match, children, key) =>
                <span key={key} className={match[1] === 'hand' ? 'hand1' : match[1]}>{children}</span>,
        },
        {
            re: /\*\*([^*]+)\*\*/,
            render: (_match, children, key) => <strong key={key}>{children}</strong>,
        },
        {
            re: /_([^_]+)_/,
            render: (_match, children, key) => <em key={key}>{children}</em>,
        },
    ]

    for (let i = 0; i < patterns.length; i += 1) {
        const { re, render } = patterns[i]
        const m = source.match(re)
        if (!m || m.index === undefined) continue
        const start = m.index
        const end = start + m[0].length
        const before = source.slice(0, start)
        const after = source.slice(end)
        const inner = m[2] ?? m[1]
        return [
            ...(before ? renderInlineRichText(before, `${keyPrefix}-b-${i}`) : []),
            render(m, renderInlineRichText(inner, `${keyPrefix}-m-${i}`), `${keyPrefix}-v-${i}`),
            ...(after ? renderInlineRichText(after, `${keyPrefix}-a-${i}`) : []),
        ]
    }

    return [source]
}

export function renderRichTitle(title, keyPrefix = 'title') {
    const source = String(title || '')
    if (!source.trim()) return null
    if (isLikelyHtmlContent(source)) {
        return (
            <span
                key={keyPrefix}
                className="rich-title"
                dangerouslySetInnerHTML={{ __html: sanitizePublishedHtml(source) }}
            />
        )
    }
    return renderInlineRichText(source, keyPrefix)
}

export function renderStyledTextBlock(text, keyPrefix = 'txt') {
    const lines = String(text || '').split('\n')
    const blocks = []
    let paraLines = []
    let listMode = null
    let listStart = 1
    let listItems = []

    const flushParagraph = (suffix) => {
        if (!paraLines.length) return
        const paragraphText = paraLines.join('\n')
        blocks.push(
            <p key={`${keyPrefix}-p-${suffix}`} style={{ whiteSpace: 'pre-wrap' }}>
                {renderInlineRichText(paragraphText, `${keyPrefix}-p-${suffix}`)}
            </p>
        )
        paraLines = []
    }

    const flushList = (suffix) => {
        if (!listItems.length || !listMode) return
        if (listMode === 'ol') {
            blocks.push(
                <ol key={`${keyPrefix}-ol-${suffix}`} start={listStart}>
                    {listItems.map((item, idx) =>
                        <li key={`${keyPrefix}-oli-${suffix}-${idx}`}>
                            {renderInlineRichText(item, `${keyPrefix}-oli-${suffix}-${idx}`)}
                        </li>
                    )}
                </ol>
            )
        } else {
            blocks.push(
                <ul key={`${keyPrefix}-ul-${suffix}`}>
                    {listItems.map((item, idx) =>
                        <li key={`${keyPrefix}-uli-${suffix}-${idx}`}>
                            {renderInlineRichText(item, `${keyPrefix}-uli-${suffix}-${idx}`)}
                        </li>
                    )}
                </ul>
            )
        }
        listMode = null
        listItems = []
    }

    lines.forEach((rawLine, index) => {
        const line = rawLine.trimEnd()
        if (!line.trim()) {
            flushParagraph(index)
            flushList(index)
            return
        }

        const ordered = line.match(/^\s*(\d+)[.)]\s+(.+)$/)
        const unordered = line.match(/^\s*([-*•●◦○])\s+(.+)$/)
        if (ordered || unordered) {
            flushParagraph(index)
            const nextMode = ordered ? 'ol' : 'ul'
            if (listMode && listMode !== nextMode) flushList(index)
            if (!listMode) {
                listMode = nextMode
                listStart = ordered ? Number(ordered[1]) || 1 : 1
            }
            listItems.push((ordered ? ordered[2] : unordered[2]).trim())
            return
        }

        if (listMode) flushList(index)

        const h3 = line.match(/^###\s+(.+)/)
        const h2 = line.match(/^##\s+(.+)/)
        const h1 = line.match(/^#\s+(.+)/)
        if (h1 || h2 || h3) {
            flushParagraph(index)
            flushList(index)
            const headingText = (h1?.[1] || h2?.[1] || h3?.[1] || '').trim()
            const className = h1 ? 'rich-h1' : h2 ? 'rich-h2' : 'rich-h3'
            blocks.push(
                <div className={className} key={`${keyPrefix}-h-${index}`}>
                    {renderInlineRichText(headingText, `${keyPrefix}-h-${index}`)}
                </div>
            )
            return
        }

        paraLines.push(line)
    })

    flushParagraph('last')
    flushList('last')
    return blocks
}
