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
 * Convert architecture-beta diagram to a reliable flowchart LR.
 *
 * Steps:
 *  1. Collapse any bare newlines inside [...] and (...) regions using the
 *     dotAll [^] trick, so "S3 Object Lock\nCOMPLIANCE" becomes one line.
 *  2. Parse service & connection lines from the normalised code.
 *  3. Emit a clean "flowchart LR" string.
 */
function convertArchBetaToFlowchart(raw) {
    // 1. Collapse newlines inside [...] (lazy, dotAll via [^]*?)
    let code = raw.replace(/\[([^]*?)\]/g, (_, inner) =>
        `[${inner.replace(/\r?\n/g, ' ').replace(/\s{2,}/g, ' ').trim()}]`
    )
    // Collapse newlines inside (...) too
    code = code.replace(/\(([^)]*?\r?\n[^)]*?)\)/g, (_, inner) =>
        `(${inner.replace(/\r?\n/g, ' ').trim()})`
    )

    const lines = code.split('\n')
    const nodes = []
    const edges = []

    for (const line of lines) {
        const trimmed = line.trim()

        // service id(icon)[Label]  or  service id(icon)[Label] in group
        const svc = trimmed.match(/^service\s+(\w+)\s*\([^)]*\)\s*\[([^\]]+)\]/)
        if (svc) {
            // sanitise label: replace " with '
            const label = svc[2].trim().replace(/"/g, "'")
            nodes.push({ id: svc[1], label })
            continue
        }

        // id:Direction --> Direction:id
        const conn = trimmed.match(/^(\w+):[LRTB]\s*-->\s*[LRTB]:(\w+)/)
        if (conn) {
            edges.push(`    ${conn[1]} --> ${conn[2]}`)
            continue
        }
    }

    if (nodes.length === 0) {
        return 'flowchart LR\n    A["Architecture Diagram"]'
    }

    const nodeDefs = nodes.map(n => `    ${n.id}["${n.label}"]`).join('\n')
    return ['flowchart LR', nodeDefs, ...edges].join('\n')
}

/**
 * General pre-processing for any mermaid diagram:
 * – architecture-beta → flowchart LR
 * – collapse bare newlines in node labels for standard graph/flowchart diagrams
 */
function sanitizeMermaidCode(raw) {
    const trimmed = raw.trim()

    if (/^architecture-beta/i.test(trimmed)) {
        return convertArchBetaToFlowchart(trimmed)
    }

    // For other diagram types: collapse newlines inside [...] labels
    return trimmed.replace(/\[([^]*?)\]/g, (_, inner) => {
        if (!/\r?\n/.test(inner)) return `[${inner}]`
        return `["${inner.replace(/\r?\n/g, ' ').replace(/\s{2,}/g, ' ').trim()}"]`
    })
}

/** True if mermaid rendered an error SVG rather than a diagram */
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

                if (!iconsLoaded.current) {
                    const icons = await loadLogosIcons()
                    if (icons) {
                        try { mermaid.registerIconPacks([{ name: 'logos', icons }]) } catch { /* already registered */ }
                    }
                    iconsLoaded.current = true
                }

                mermaid.initialize({ startOnLoad: false, securityLevel: 'loose' })

                const cleanCode = sanitizeMermaidCode(code)

                // Validate syntax first — mermaid.parse() throws on invalid code.
                // Guard with typeof check for version compatibility.
                if (typeof mermaid.parse === 'function') {
                    try {
                        await mermaid.parse(cleanCode)
                    } catch {
                        if (!cancelled) setError('diagram')
                        return
                    }
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

    if (error === 'diagram') {
        return (
            <div className="mermaid-block" style={{
                background: 'rgba(128,128,128,0.08)', borderRadius: 8,
                padding: '12px 16px', border: '1px dashed rgba(128,128,128,0.3)'
            }}>
                <p style={{ fontSize: '0.72rem', opacity: 0.45, margin: '0 0 8px', fontFamily: 'monospace' }}>
                    ⬡ Architecture Diagram (preview unavailable)
                </p>
                <pre style={{ fontSize: '0.78rem', overflowX: 'auto', margin: 0, whiteSpace: 'pre-wrap', opacity: 0.8 }}>
                    {code}
                </pre>
            </div>
        )
    }

    if (!svg) return <p style={{ fontSize: '0.85rem', opacity: 0.45 }}>Rendering diagram…</p>

    return <div className="mermaid-block" dangerouslySetInnerHTML={{ __html: svg }} />
}
