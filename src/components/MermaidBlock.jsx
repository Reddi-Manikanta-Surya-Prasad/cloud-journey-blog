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
 * Pre-process mermaid code before passing to the renderer.
 * Mermaid 11 rejects bare newlines inside node labels.
 * Also converts unsupported architecture-beta to a plain flowchart.
 */
function sanitizeMermaidCode(raw) {
    let code = raw.trim()

    // architecture-beta is unreliable (requires specific registered icon packs).
    // Convert to a standard flowchart so it always renders.
    if (/^architecture-beta/i.test(code)) {
        return convertArchBetaToFlowchart(code)
    }

    // Replace bare newlines inside square-bracket node labels
    code = code.replace(/\[([^\]]*)\]/g, (match, inner) => {
        if (!/\n/.test(inner)) return match
        return `["${inner.replace(/\n+/g, ' ').trim()}"]`
    })
    // Replace bare newlines inside round-bracket labels
    code = code.replace(/\(([^)]*)\)/g, (match, inner) => {
        if (!/\n/.test(inner)) return match
        return `("${inner.replace(/\n+/g, ' ').trim()}")`
    })

    return code
}

/**
 * Convert architecture-beta diagram to a standard flowchart LR.
 * Extracts service names and connections so the diagram renders.
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
            nodes.push({ id: svc[1], label: svc[2].replace(/\n/g, ' ') })
            continue
        }

        // id:Direction --> Direction:id  (architecture-beta connection syntax)
        const conn = trimmed.match(/^(\w+):[LRTB]\s*-->\s*[LRTB]:(\w+)/)
        if (conn) {
            edges.push(`    ${conn[1]} --> ${conn[2]}`)
            continue
        }
    }

    if (nodes.length === 0) return 'flowchart LR\n    A[Diagram unavailable]'

    const nodeDefs = nodes.map(n => `    ${n.id}["${n.label}"]`).join('\n')
    return `flowchart LR\n${nodeDefs}\n${edges.join('\n')}`
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

                // Pre-process: fix multiline labels, convert architecture-beta
                const cleanCode = sanitizeMermaidCode(code)

                // Validate syntax before rendering (mermaid.parse throws on invalid syntax)
                try {
                    await mermaid.parse(cleanCode)
                } catch {
                    if (!cancelled) setError('diagram')
                    return
                }

                const id = `mmd-${Math.random().toString(36).slice(2, 10)}`
                const out = await mermaid.render(id, cleanCode)

                if (cancelled) return

                // Belt-and-suspenders: also check if mermaid rendered an error SVG
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
