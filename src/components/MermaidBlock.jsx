import { useEffect, useState } from 'react'

export default function MermaidBlock({ code }) {
    const [svg, setSvg] = useState('')
    const [error, setError] = useState('')

    useEffect(() => {
        let cancelled = false
        const renderDiagram = async () => {
            try {
                const mermaidModule = await import('mermaid')
                const mermaid = mermaidModule.default
                mermaid.initialize({ startOnLoad: false, securityLevel: 'loose' })
                const id = `mmd-${Math.random().toString(36).slice(2, 10)}`
                const out = await mermaid.render(id, code)
                if (!cancelled) {
                    setSvg(out.svg)
                    setError('')
                }
            } catch {
                if (!cancelled) setError('Mermaid diagram failed to render.')
            }
        }
        renderDiagram()
        return () => {
            cancelled = true
        }
    }, [code])

    if (error) return <p className="error">{error}</p>
    if (!svg) return <p>Rendering diagram...</p>
    return <div className="mermaid-block" dangerouslySetInnerHTML={{ __html: svg }} />
}
