import { useEffect, useState } from 'react'

export default function InlineMedia({ type, source, alt, resolveMediaSource }) {
    const [src, setSrc] = useState(() => resolveMediaSource(source))

    useEffect(() => {
        const resolved = resolveMediaSource(source)
        if (resolved) {
            setSrc(resolved)
            return
        }

        if (!source?.startsWith('media/')) {
            setSrc(source || '')
            return
        }

        // For signed storage paths, wait for cache hydration from refreshData().
        setSrc('')
    }, [source, resolveMediaSource])

    if (!src) return null
    if (type === 'video') {
        return <video className="media media-full" controls preload="metadata" playsInline src={src} />
    }
    return <img className="media media-full" src={src} alt={alt} loading="lazy" decoding="async" />
}
