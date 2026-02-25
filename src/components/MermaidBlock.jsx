import { useEffect, useRef, useState } from 'react'

// Cache the icon pack fetch so we only load it once
let iconPackPromise = null
function loadAwsIcons() {
    if (!iconPackPromise) {
        iconPackPromise = fetch(
            'https://unpkg.com/@iconify-json/logos@1/icons.json'
        )
            .then((r) => r.json())
            .catch(() => null)
    }
    return iconPackPromise
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

                // Register logos icon pack once (for architecture-beta AWS icons)
                if (!iconsLoaded.current) {
                    const icons = await loadAwsIcons()
                    if (icons) {
                        try {
                            mermaid.registerIconPacks([{ name: 'logos', icons }])
                        } catch { /* ignore if already registered */ }
                    }
                    iconsLoaded.current = true
                }

                mermaid.initialize({
                    startOnLoad: false,
                    securityLevel: 'loose',
                    architecture: { useWidth: 800 },
                })
                const id = `mmd-${Math.random().toString(36).slice(2, 10)}`
                const out = await mermaid.render(id, code)
                if (!cancelled) {
                    setSvg(out.svg)
                    setError('')
                }
            } catch (e) {
                if (!cancelled) setError('Diagram failed to render.')
            }
        }
        renderDiagram()
        return () => { cancelled = true }
    }, [code])

    if (error) return <p className="error" style={{ fontSize: '0.85rem', opacity: 0.7 }}>{error}</p>
    if (!svg) return <p style={{ fontSize: '0.85rem', opacity: 0.6 }}>Rendering diagram…</p>
    return <div className="mermaid-block" dangerouslySetInnerHTML={{ __html: svg }} />
}
