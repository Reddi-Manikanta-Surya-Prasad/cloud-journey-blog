// â”€â”€â”€ Pure Utility Functions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Extracted from App.jsx to reduce initial parse cost.

export function toStorageSafeName(name) {
    return name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '')
}

export function toTitleCaseName(text) {
    return String(text || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
}

export function deriveFriendlyUserName(user, attrs) {
    const explicitName = toTitleCaseName(attrs?.name)
    if (explicitName) return explicitName

    const given = toTitleCaseName(attrs?.given_name)
    const family = toTitleCaseName(attrs?.family_name)
    const full = `${given} ${family}`.trim()
    if (full) return full

    const email = String(attrs?.email || '')
    if (email.includes('@')) {
        const localPart = email.split('@')[0].replace(/[._-]+/g, ' ').trim()
        const fromEmail = toTitleCaseName(localPart)
        if (fromEmail) return fromEmail
    }

    const username = String(user?.username || '')
    if (/^google[_-]/i.test(username)) return 'Google User'
    return toTitleCaseName(username) || 'User'
}

export function buildReadableParagraphs(rawText) {
    const text = (rawText || '').replace(/\r\n/g, '\n').trim()
    if (!text) return []

    const manualParagraphs = text
        .split(/\n\s*\n/)
        .map((part) => part.trim())
        .filter(Boolean)

    if (manualParagraphs.length > 1) return manualParagraphs

    const sentences = text
        .split(/(?<=[.!?])\s+/)
        .map((part) => part.trim())
        .filter(Boolean)

    if (sentences.length <= 3) return [text]

    const grouped = []
    for (let i = 0; i < sentences.length; i += 3) {
        grouped.push(sentences.slice(i, i + 3).join(' '))
    }
    return grouped
}

export function sanitizeHandTagsForRender(text) {
    let next = String(text || '')
    next = next.replace(/\[(\/?)\hand\]/g, (_, slash) => `[${slash}hand1]`)

    const re = /\[(\/?)\hand(10|[1-9])\]/g
    const chunks = []
    const stack = []
    let last = 0
    let m
    while ((m = re.exec(next)) !== null) {
        chunks.push(next.slice(last, m.index))
        const closing = m[1] === '/'
        const style = `hand${m[2]}`
        if (!closing) {
            const marker = { style, text: m[0], keep: true }
            chunks.push(marker)
            stack.push(marker)
        } else if (stack.length && stack[stack.length - 1].style === style) {
            stack.pop()
            chunks.push(m[0])
        }
        last = re.lastIndex
    }
    chunks.push(next.slice(last))
    stack.forEach((marker) => {
        marker.keep = false
    })
    return chunks
        .map((part) => (typeof part === 'string' ? part : part.keep ? part.text : ''))
        .join('')
}

export function sanitizePublishedHtml(html) {
    let next = String(html || '')
        .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
        .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '')
        .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
        .replace(/javascript:/gi, '')
    if (typeof document !== 'undefined') {
        const root = document.createElement('div')
        root.innerHTML = next
        root.querySelectorAll('font').forEach((el) => {
            const span = document.createElement('span')
            span.innerHTML = el.innerHTML
            if (el.color) span.style.color = el.color
            if (el.getAttribute('style')) span.style.cssText += ';' + el.getAttribute('style')
            if (el.size) span.style.fontSize = el.size
            if (el.face) span.style.fontFamily = el.face
            el.replaceWith(span)
        })
        next = root.innerHTML
    } else {
        next = next.replace(
            /<font[^>]*color=(['"]?)([^"']+)\1[^>]*>([\s\S]*?)<\/font>/gi,
            '<span style="color:$2">$3</span>',
        )
    }
    return next
}

export function isLikelyHtmlContent(content) {
    const source = String(content || '').trim()
    if (!source) return false
    return /<(p|div|span|strong|em|b|i|u|mark|font|h1|h2|h3|ul|ol|li|pre|code|img|video|br)\b/i.test(source)
}

export const INLINE_MEDIA_RE = /^\[\[(img|vid):(.+)\]\]$/
export const MD_IMAGE_RE = /^!\[[^\]]*]\(([^)]+)\)$/


export function codeLineScore(line) {
    const trimmed = (line || '').trim()
    if (!trimmed) return 0
    let score = 0

    if (/^<\/?[a-zA-Z][\w:-]*[^>]*>$/.test(trimmed) || /^<!doctype/i.test(trimmed)) score += 3
    if (/^<([a-zA-Z][\w:-]*)\b[^>]*>.*<\/\1>$/.test(trimmed)) score += 3
    if (/^(import|export|const|let|var|function|class|return|def)\b/.test(trimmed)) score += 3
    if (/^(if|for|while|switch)\s*\(/.test(trimmed)) score += 3
    if (/=>|[{}()[\]]/.test(trimmed)) score += 1
    if (/;\s*$/.test(trimmed)) score += 1
    if (/^\s*["'][^"']+["']\s*:\s*/.test(trimmed)) score += 2
    if (/^(\/\/|\/\*|\*\/)/.test(trimmed)) score += 2
    if (/^[\w.-]+\.(tf|tfvars|js|jsx|ts|tsx|py|java|go|rb|php|json|yml|yaml|xml|html|css|sh)\b/.test(trimmed)) score += 2
    if (/^[|`~\-_/\\]{2,}/.test(trimmed) || /[|`~]{2,}/.test(trimmed)) score += 2

    return score
}

export function isCodeContinuationLine(line) {
    const trimmed = (line || '').trim()
    if (!trimmed) return true
    if (codeLineScore(line) >= 2) return true
    if (/^<\/?[a-zA-Z][\w:-]*[^>]*>/.test(trimmed)) return true
    if (/^<([a-zA-Z][\w:-]*)\b[^>]*>.*<\/\1>$/.test(trimmed)) return true
    if (/=>|[{()}[\];]/.test(trimmed)) return true
    return false
}

export function splitMixedTextIntoBlocks(text) {
    const lines = (text || '').split('\n')
    const blocks = []
    let textBuffer = []

    const flushText = () => {
        const value = textBuffer.join('\n').trim()
        if (value) blocks.push({ type: 'text', value })
        textBuffer = []
    }

    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i]
        const score = codeLineScore(line)

        if (!line.trim() || score < 3) {
            if (/^<(h[1-6]|div|p|ul|ol|section|article|blockquote|table|figure|span|strong|em|font|mark)\b/i.test(line.trim())) {
                flushText()
                blocks.push({ type: 'html', value: line })
                continue
            }
            textBuffer.push(line)
            continue
        }

        let j = i
        let nonEmptyCodeLines = 0
        let strongLineFound = false
        let totalScore = 0

        while (j < lines.length) {
            const current = lines[j]
            const currentScore = codeLineScore(current)
            if (!isCodeContinuationLine(current)) break
            if (!current.trim()) {
                j += 1
                continue
            }
            nonEmptyCodeLines += 1
            totalScore += currentScore
            if (currentScore >= 4) strongLineFound = true
            j += 1
        }

        const avgScore = nonEmptyCodeLines ? totalScore / nonEmptyCodeLines : 0
        const shouldTreatAsCode =
            nonEmptyCodeLines >= 2
                ? strongLineFound || avgScore >= 2.8
                : nonEmptyCodeLines === 1 && strongLineFound
        if (!shouldTreatAsCode) {
            textBuffer.push(line)
            continue
        }

        flushText()
        const code = lines.slice(i, j).join('\n').trimEnd()
        if (code) blocks.push({ type: 'code', lang: 'auto', code })
        i = j - 1
    }

    flushText()
    return blocks
}

export function parseContentBlocks(content) {
    if (isLikelyHtmlContent(content)) {
        return [{ type: 'html', value: sanitizePublishedHtml(content) }]
    }

    const lines = (content || '').split('\n')
    const blocks = []
    let textBuffer = []

    const flushText = () => {
        const text = textBuffer.join('\n')
        splitMixedTextIntoBlocks(text).forEach((block) => blocks.push(block))
        textBuffer = []
    }

    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i]
        const trimmed = line.trim()

        if (trimmed.toLowerCase().startsWith('codestart')) {
            flushText()
            const lang = trimmed.slice('codestart'.length).trim().toLowerCase() || 'auto'
            const codeLines = []
            i += 1
            while (i < lines.length && lines[i].trim().toLowerCase() !== 'codeend') {
                codeLines.push(lines[i])
                i += 1
            }
            const code = codeLines.join('\n').trimEnd()
            if (code) {
                blocks.push({ type: 'code', lang, code })
            }
            continue
        }

        if (trimmed.startsWith('```')) {
            flushText()
            const lang = trimmed.slice(3).trim().toLowerCase()
            const codeLines = []
            i += 1
            while (i < lines.length && !lines[i].trim().startsWith('```')) {
                codeLines.push(lines[i])
                i += 1
            }
            const code = codeLines.join('\n').trim()
            if (code) {
                if (lang === 'mermaid') {
                    blocks.push({ type: 'mermaid', code })
                } else {
                    blocks.push({ type: 'code', lang: lang || 'text', code })
                }
            }
            continue
        }

        const match = trimmed.match(INLINE_MEDIA_RE)
        if (match) {
            flushText()
            blocks.push({ type: match[1] === 'img' ? 'image' : 'video', value: match[2].trim() })
        } else if (MD_IMAGE_RE.test(trimmed)) {
            flushText()
            const mdSrc = trimmed.match(MD_IMAGE_RE)?.[1]?.trim() || ''
            if (mdSrc) {
                const isVideo = /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(mdSrc)
                blocks.push({ type: isVideo ? 'video' : 'image', value: mdSrc })
            }
        } else {
            textBuffer.push(line)
        }
    }
    flushText()
    return blocks
}

export function deriveCoverMedia(content) {
    if (isLikelyHtmlContent(content)) {
        const source = String(content || '')
        const img = source.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i)?.[1]
        if (img) {
            return {
                mediaType: 'image',
                mediaUrl: img.startsWith('media/') ? null : img,
                mediaPath: img.startsWith('media/') ? img : null,
            }
        }
        const vid =
            source.match(/<video[^>]+src=["']([^"']+)["'][^>]*>/i)?.[1] ||
            source.match(/<source[^>]+src=["']([^"']+)["'][^>]*>/i)?.[1]
        if (vid) {
            return {
                mediaType: 'video',
                mediaUrl: vid.startsWith('media/') ? null : vid,
                mediaPath: vid.startsWith('media/') ? vid : null,
            }
        }
        return { mediaType: null, mediaUrl: null, mediaPath: null }
    }

    const firstMedia = parseContentBlocks(content).find(
        (block) => block.type === 'image' || block.type === 'video',
    )
    if (!firstMedia) {
        return { mediaType: null, mediaUrl: null, mediaPath: null }
    }
    const isPath = firstMedia.value.startsWith('media/')
    return {
        mediaType: firstMedia.type === 'image' ? 'image' : 'video',
        mediaUrl: isPath ? null : firstMedia.value,
        mediaPath: isPath ? firstMedia.value : null,
    }
}

export function stripReadableText(content) {
    if (isLikelyHtmlContent(content)) {
        return String(content || '')
            .replace(/<pre[\s\S]*?<\/pre>/gi, ' ')
            .replace(/<code[\s\S]*?<\/code>/gi, ' ')
            .replace(/<img[^>]*>/gi, ' ')
            .replace(/<video[\s\S]*?<\/video>/gi, ' ')
            .replace(/<source[^>]*>/gi, ' ')
            .replace(/<br\s*\/?>/gi, ' ')
            .replace(/<\/(p|div|li|h1|h2|h3|h4|h5|h6)>/gi, ' ')
            .replace(/<[^>]+>/g, ' ')
    }

    return (content || '')
        .replace(/\[\[(img|vid):.+?\]\]/g, ' ')
        .replace(/```[\s\S]*?```/g, (block) => block.replace(/```[^\n]*\n?/g, ' '))
        .replace(/^\s*codestart[^\n]*$/gim, ' ')
        .replace(/^\s*codeend\s*$/gim, ' ')
}

export function estimateReadMinutes(content) {
    const words = stripReadableText(content)
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .filter(Boolean).length
    return Math.max(1, Math.ceil(words / 220))
}

export function skillMeta(level) {
    const normalized = String(level || '').toLowerCase()
    if (normalized === 'advanced') {
        return { label: 'Advanced', icon: '\u{1F534}', cls: 'skill-advanced' }
    }
    if (normalized === 'intermediate') {
        return { label: 'Intermediate', icon: '\u{1F7E1}', cls: 'skill-intermediate' }
    }
    return { label: 'Beginner friendly', icon: '\u{1F7E2}', cls: 'skill-beginner' }
}

export function progressMeta(status) {
    const normalized = String(status || '').toLowerCase()
    if (normalized === 'mastered') return { label: 'Mastered', icon: '\u2B50', cls: 'progress-mastered' }
    if (normalized === 'revisit') return { label: 'Revisit', icon: '\u{1F516}', cls: 'progress-revisit' }
    return { label: 'Read', icon: '\u2705', cls: 'progress-read' }
}

export function detectCodeRuntimeHint(lang, code) {
    const lower = String(lang || '').toLowerCase()
    const sample = String(code || '').trim()
    if (lower.includes('bash') || lower.includes('shell') || lower.includes('sh')) {
        return {
            windows: 'PowerShell: .\\script.ps1 or bash script.sh',
            linux: 'bash script.sh',
            mac: 'bash script.sh',
        }
    }
    if (lower.includes('python') || /^def\s+\w+\(/m.test(sample)) {
        return {
            windows: 'python main.py',
            linux: 'python3 main.py',
            mac: 'python3 main.py',
        }
    }
    if (lower.includes('javascript') || lower.includes('js') || /console\.log\(/.test(sample)) {
        return {
            windows: 'node app.js',
            linux: 'node app.js',
            mac: 'node app.js',
        }
    }
    if (lower.includes('typescript') || /\.ts\b/m.test(sample)) {
        return {
            windows: 'npx tsx app.ts',
            linux: 'npx tsx app.ts',
            mac: 'npx tsx app.ts',
        }
    }
    if (lower.includes('terraform') || /^provider\s+"/m.test(sample) || /^resource\s+"/m.test(sample)) {
        return {
            windows: 'terraform init && terraform plan',
            linux: 'terraform init && terraform plan',
            mac: 'terraform init && terraform plan',
        }
    }
    return null
}

export function contentToSpeechText(content) {
    const plain = stripReadableText(content || '')
        .replace(/\s+/g, ' ')
        .trim()
    return plain
}

export function isOwnedByCurrentUser(currentUser, record) {
    if (!currentUser || !record) return false
    const userId = String(currentUser.userId || '')
    const username = String(currentUser.username || '')
    const authorSub = String(record.authorSub || '')
    if (authorSub && (authorSub === userId || authorSub === username)) return true

    const owner = String(record.owner || '')
    if (!owner) return false
    const ownerParts = owner.split('::').filter(Boolean)
    const candidates = [owner, ...ownerParts]
    return candidates.some((value) => value === userId || value === username)
}

export function isLikelyCode(text) {
    const sample = (text || '').trim()
    if (!sample) return false
    const lines = sample.split('\n')
    const signalPatterns = [
        /\b(import|export|const|let|var|function|class|return|await|async)\b/,
        /\b(def|public|private|void|if|else|for|while|try|catch)\b/,
        /\b(from\s+['"`].+['"`])\b/,
        /=>|[{()[\];]/,
        /^\s*[.#]?[a-zA-Z0-9_-]+\s*:\s*.+$/m,
    ]

    const signalHits = signalPatterns.reduce(
        (count, re) => count + (re.test(sample) ? 1 : 0),
        0,
    )

    const punctuation = (sample.match(/[{}()[\];=<>]/g) || []).length
    const likelyByDensity = punctuation >= 5 && sample.length <= 500

    if (lines.length >= 2) {
        return signalHits >= 1 || likelyByDensity
    }

    return signalHits >= 2 || likelyByDensity
}
