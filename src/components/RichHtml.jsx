import { useEffect, useState } from 'react'

export default function RichHtml({ html, resolveMediaSource }) {
    const [resolvedHtml, setResolvedHtml] = useState(html)

    useEffect(() => {
        let active = true
        const resolveAll = async () => {
            if (typeof DOMParser === 'undefined') return
            const doc = new DOMParser().parseFromString(html, 'text/html')
            const mediaElements = Array.from(doc.querySelectorAll('[src^="media/"]'))

            if (mediaElements.length === 0) {
                if (active) setResolvedHtml(html)
                return
            }

            await Promise.all(
                mediaElements.map(async (el) => {
                    const url = await resolveMediaSource(el.getAttribute('src'))
                    if (url) el.setAttribute('src', url)
                })
            )

            if (active) setResolvedHtml(doc.body.innerHTML)
        }
        resolveAll()
        return () => { active = false }
    }, [html, resolveMediaSource])

    return (
        <div
            className="rich-html"
            dangerouslySetInnerHTML={{ __html: resolvedHtml }}
        />
    )
}
