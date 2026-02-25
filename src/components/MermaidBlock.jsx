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
 * Mermaid 11 rejects bare newlines inside node labels (e.g. [Route 53\nLatency Routing]).
 * This replaces newlines inside [], (), {}, "" label regions with a space so the
 * diagram renders cleanly without syntax errors.
 */
function sanitizeMermaidCode(raw) {
    let code = raw

    // Replace newlines inside square-bracket node labels: [text\nmore] → [text more]
    code = code.replace(/\[([^\]]*)\]/g, (match, inner) => {
        if (!/\n/.test(inner)) return match
        return `["${inner.replace(/\n+/g, ' ').trim()}"]`
    })

    // Replace newlines inside round-bracket labels: (text\nmore) → (text more)
    code = code.replace(/\(([^)]*)\)/g, (match, inner) => {
        if (!/\n/.test(inner)) return match
        return `("${inner.replace(/\n+/g, ' ').trim()}")`
    })

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

                // Register logos icon pack once (provides logos:aws-* icons for architecture-beta)
                if (!iconsLoaded.current) {
                    const icons = await loadLogosIcons()
                    if (icons) {
                        try { mermaid.registerIconPacks([{ name: 'logos', icons }]) } catch { /* already registered */ }
                    }
                    iconsLoaded.current = true
                }

                mermaid.initialize({ startOnLoad: false, securityLevel: 'loose' })
                const id = `mmd-${Math.random().toString(36).slice(2, 10)}`

                // Pre-process to fix multiline node labels before rendering
                const cleanCode = sanitizeMermaidCode(code)
                const out = await mermaid.render(id, cleanCode)

                if (cancelled) return

                // Mermaid 11 sometimes renders errors as SVG instead of throwing
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
