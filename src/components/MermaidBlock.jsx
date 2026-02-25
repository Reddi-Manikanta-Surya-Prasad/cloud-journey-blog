import { useEffect, useRef, useState } from 'react'

// Cache icon pack so we only fetch once per page session
let iconPackPromise = null
function loadLogosIcons() {
    if (!iconPackPromise) {
        iconPackPromise = fetch(
            'https://unpkg.com/@iconify-json/logos@1/icons.json',
            { signal: AbortSignal.timeout(8000) }
        )
            .then((r) => r.json())
            .catch(() => null)
    }
    return iconPackPromise
}

/**
 * Collapse bare newlines inside [...] and (...) regions first,
 * so that multiline node labels become single-line before any further parsing.
 * Uses a state-machine approach to handle nested content correctly.
 */
function collapseMultilineLabels(code) {
    let result = ''
    let depth = 0
    let inBracket = false  // inside [...]
    let inParen = false    // inside (...)

    for (let i = 0; i < code.length; i++) {
        const ch = code[i]
        if (ch === '[' && !inParen) { inBracket = true; depth++; result += ch; continue }
        if (ch === '(' && !inBracket) { inParen = true; depth++; result += ch; continue }
        if (ch === ']' && inBracket) { depth--; if (depth === 0) inBracket = false; result += ch; continue }
        if (ch === ')' && inParen) { depth--; if (depth === 0) inParen = false; result += ch; continue }

        // Inside a label region: replace newlines with space
        if ((inBracket || inParen) && ch === '\n') {
            result += ' '
            continue
        }
        result += ch
    }
    return result
}

/**
 * Convert architecture-beta diagram to a standard flowchart LR.
 * Call AFTER collapseMultilineLabels so all labels are single-line.
 */
function convertArchBetaToFlowchart(code) {
    const lines = code.split('\n')
    const nodes = []   // { id, label }
    const edges = []   // "A --> B" strings

    for (const line of lines) {
        const trimmed = line.trim()

        // service id(icon)[Label] in group  OR  service id(icon)[Label]
        const svc = trimmed.match(/^service\s+(\w+)\s*\([^)]*\)\s*\[([^\]]+)\]/)
        if (svc) {
            nodes.push({ id: svc[1], label: svc[2].trim() })
            continue
        }

        // id:Direction --> Direction:id  (architecture-beta connection syntax)
        const conn = trimmed.match(/^(\w+):[LRTB]\s*-->\s*[LRTB]:(\w+)/)
        if (conn) {
            edges.push(`    ${conn[1]} --> ${conn[2]}`)
            continue
        }
    }

    if (nodes.length === 0) return 'flowchart LR\n    A["Architecture Diagram"]'

    const nodeDefs = nodes.map(n => `    ${n.id}["${n.label.replace(/"/g, "'")}"]`).join('\n')
    return `flowchart LR\n${nodeDefs}\n${edges.join('\n')}`
}

/**
 * Pre-process mermaid code before passing to the renderer.
 */
function sanitizeMermaidCode(raw) {
    // Step 1: collapse multiline labels inside [...] and (...)
    let code = collapseMultilineLabels(raw.trim())

    // Step 2: architecture-beta → standard flowchart
    if (/^architecture-beta/i.test(code)) {
        return convertArchBetaToFlowchart(code)
    }

    return code
}

/** True if mermaid rendered an error SVG instead of a real diagram */
function isMermaidErrorSvg(svg) {
    return (
        svg.includes('Syntax error') ||
        svg.includes('error-icon') ||
        svg.includes('class="error"') ||
        svg.includes('Parse error') ||
        svg.includes('mermaid-error')
    )
}

export default function MermaidBlock({ code }) {
    const [svg, setSvg] = useState('')
    const [error, setError] = useState('')
    const iconsLoaded = useRef(false)

    useEffect(() => {
        let cancelled = false
        const renderDiagram = async () => {
            try {
                const mermaidModule = await import('mermaid')
                const mermaid = mermaidModule.default

                // Register logos icon pack once
                if (!iconsLoaded.current) {
                    const icons = await loadLogosIcons()
                    if (icons) {
                        try { mermaid.registerIconPacks([{ name: 'logos', icons }]) } catch { /* already registered */ }
                    }
                    iconsLoaded.current = true
                }

                mermaid.initialize({ startOnLoad: false, securityLevel: 'loose' })

                // Pre-process: collapse multiline labels + convert architecture-beta
                const cleanCode = sanitizeMermaidCode(code)

                // Validate syntax before rendering
                try {
                    await mermaid.parse(cleanCode)
                } catch {
                    if (!cancelled) setError('diagram')
                    return
                }

                const id = `mmd-${Math.random().toString(36).slice(2, 10)}`
                const out = await mermaid.render(id, cleanCode)

                if (cancelled) return

                if (isMermaidErrorSvg(out.svg)) {
                    setError('diagram')
                } else {
                    setSvg(out.svg)
                    setError('')
                }
            } catch {
                if (!cancelled) setError('diagram')
            }
        }
        renderDiagram()
        return () => { cancelled = true }
    }, [code])

    // Graceful fallback: show the diagram source in a readable box
    if (error === 'diagram') {
        return (
            <div className="mermaid-block" style={{ background: 'rgba(128,128,128,0.08)', borderRadius: 8, padding: '12px 16px', border: '1px dashed rgba(128,128,128,0.3)' }}>
                <p style={{ fontSize: '0.72rem', opacity: 0.45, margin: '0 0 8px', fontFamily: 'monospace' }}>⬡ Architecture Diagram (preview unavailable)</p>
                <pre style={{ fontSize: '0.78rem', overflowX: 'auto', margin: 0, whiteSpace: 'pre-wrap', opacity: 0.8 }}>{code}</pre>
            </div>
        )
    }
    if (!svg) return <p style={{ fontSize: '0.85rem', opacity: 0.45 }}>Rendering diagram…</p>
    return <div className="mermaid-block" dangerouslySetInnerHTML={{ __html: svg }} />
}
