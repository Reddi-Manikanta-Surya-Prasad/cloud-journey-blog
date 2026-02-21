import { useEffect, useMemo, useRef, useState } from 'react'

function sanitizeEditorHtml(html) {
  const raw = String(html || '')
  if (!raw.trim()) return ''
  return raw
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript:/gi, '')
    .trim()
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function stripLegacyInlineTags(text) {
  return String(text || '')
    .replace(/\[color=[^\]]+]/gi, '')
    .replace(/\[\/color]/gi, '')
    .replace(/\[bg=[^\]]+]/gi, '')
    .replace(/\[\/bg]/gi, '')
    .replace(/\[(?:\/)?hand(?:10|[1-9])?]/gi, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .trim()
}

function convertLegacyInlineToHtml(text) {
  let html = escapeHtml(text || '')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/_(.+?)_/g, '<em>$1</em>')
  html = html.replace(
    /\[color=([#a-zA-Z0-9(),.\s%-]+)\]([\s\S]*?)\[\/color]/gi,
    '<span style="color:$1">$2</span>',
  )
  html = html.replace(
    /\[bg=([#a-zA-Z0-9(),.\s%-]+)\]([\s\S]*?)\[\/bg]/gi,
    '<span style="background:$1;padding:0 2px;border-radius:4px;">$2</span>',
  )
  html = html.replace(/\[(hand(?:10|[1-9])?)\]([\s\S]*?)\[\/\1]/gi, '<span class="$1">$2</span>')
  html = html.replace(/\[(?:\/)?hand(?:10|[1-9])?]/gi, '')
  return html
}

function legacyTextToHtml(text) {
  const source = String(text || '').replace(/\r\n/g, '\n')
  if (!source.trim()) return ''

  const lines = source.split('\n')
  let html = ''
  let i = 0
  let inUl = false
  let inOl = false

  const closeLists = () => {
    if (inUl) {
      html += '</ul>'
      inUl = false
    }
    if (inOl) {
      html += '</ol>'
      inOl = false
    }
  }

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      closeLists()
      html += '<p><br></p>'
      i += 1
      continue
    }

    if (/^codestart\b/i.test(trimmed)) {
      closeLists()
      const codeLines = []
      i += 1
      while (i < lines.length && !/^codeend\b/i.test(lines[i].trim())) {
        codeLines.push(lines[i])
        i += 1
      }
      html += `<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`
      i += 1
      continue
    }

    if (trimmed.startsWith('```')) {
      closeLists()
      const codeLines = []
      i += 1
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i])
        i += 1
      }
      html += `<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`
      i += 1
      continue
    }

    const media = trimmed.match(/^\[\[(img|vid):(.+)\]\]$/i)
    if (media) {
      closeLists()
      const src = media[2].trim()
      html +=
        media[1].toLowerCase() === 'vid'
          ? `<p><video data-inline-media="1" controls playsinline preload="metadata" src="${src}"></video></p>`
          : `<p><img data-inline-media="1" src="${src}" alt="Inline media" loading="lazy" decoding="async" /></p>`
      i += 1
      continue
    }

    const h1 = trimmed.match(/^#\s+(.+)/)
    const h2 = trimmed.match(/^##\s+(.+)/)
    const h3 = trimmed.match(/^###\s+(.+)/)
    if (h1 || h2 || h3) {
      closeLists()
      if (h1) html += `<h1>${convertLegacyInlineToHtml(h1[1])}</h1>`
      else if (h2) html += `<h2>${convertLegacyInlineToHtml(h2[1])}</h2>`
      else html += `<h3>${convertLegacyInlineToHtml(h3[1])}</h3>`
      i += 1
      continue
    }

    const ordered = trimmed.match(/^(\d+)[.)]\s+(.+)$/)
    const unordered = trimmed.match(/^([-*•●◦○])\s+(.+)$/)
    if (ordered) {
      if (inUl) {
        html += '</ul>'
        inUl = false
      }
      if (!inOl) {
        html += '<ol>'
        inOl = true
      }
      html += `<li>${convertLegacyInlineToHtml(ordered[2])}</li>`
      i += 1
      continue
    }
    if (unordered) {
      if (inOl) {
        html += '</ol>'
        inOl = false
      }
      if (!inUl) {
        html += '<ul>'
        inUl = true
      }
      html += `<li>${convertLegacyInlineToHtml(unordered[2])}</li>`
      i += 1
      continue
    }

    closeLists()
    html += `<p>${convertLegacyInlineToHtml(line)}</p>`
    i += 1
  }

  closeLists()
  return html
}

function normalizeEditorContent(value) {
  const raw = String(value || '')
  if (!raw.trim()) return ''
  const looksHtml = /<(p|div|span|strong|em|h1|h2|h3|ul|ol|li|pre|code|img|video|br)\b/i.test(raw)
  return sanitizeEditorHtml(looksHtml ? raw : legacyTextToHtml(raw))
}

function normalizeTitleContent(value) {
  const raw = String(value || '')
  if (!raw.trim()) return ''
  const looksHtml = /<(span|strong|em|b|i|u|mark|font|p|div|h1|h2|h3|br)\b/i.test(raw)
  const normalized = looksHtml ? sanitizeEditorHtml(raw) : convertLegacyInlineToHtml(raw)
  return normalized
    .replace(/^<p>([\s\S]*)<\/p>$/i, '$1')
    .replace(/^<div>([\s\S]*)<\/div>$/i, '$1')
}

function stripHtmlForStats(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h1|h2|h3|h4|h5|h6|pre|code|ul|ol)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function dataUrlToFile(dataUrl, filename) {
  const res = await fetch(dataUrl)
  const blob = await res.blob()
  return new File([blob], filename, { type: 'image/png' })
}

async function svgToPngDataUrl(svg, width = 1600, height = 900) {
  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = reject
      i.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(img, 0, 0, width, height)
    return canvas.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function svgToFile(svg, filename) {
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  return new File([blob], filename, { type: 'image/svg+xml' })
}

function Write({ onSubmit, onCancel, initialValue, submitLabel, busy, onInlineUpload, draftKey }) {
  const handStyles = [
    { value: 'hand1', label: 'Hand 1' },
    { value: 'hand2', label: 'Hand 2' },
    { value: 'hand3', label: 'Hand 3' },
    { value: 'hand4', label: 'Hand 4' },
    { value: 'hand5', label: 'Hand 5' },
    { value: 'hand6', label: 'Hand 6' },
    { value: 'hand7', label: 'Hand 7' },
    { value: 'hand8', label: 'Hand 8' },
    { value: 'hand9', label: 'Hand 9' },
    { value: 'hand10', label: 'Hand 10' },
  ]

  const normalizedInitial = useMemo(
    () =>
      initialValue
        ? {
            title: normalizeTitleContent(initialValue.title || ''),
            content: normalizeEditorContent(initialValue.content || ''),
          }
        : null,
    [initialValue],
  )

  const [form, setForm] = useState(
    normalizedInitial || {
      title: '',
      content: '',
    },
  )
  const [inlineBusy, setInlineBusy] = useState(false)
  const [draftRestored, setDraftRestored] = useState(false)
  const [textColor, setTextColor] = useState('#0f4c81')
  const [bgColor, setBgColor] = useState('#fff59d')
  const [handStyle, setHandStyle] = useState('hand1')
  const [showFormatMenu, setShowFormatMenu] = useState(true)
  const [showPainter, setShowPainter] = useState(false)
  const [showDiagram, setShowDiagram] = useState(false)
  const [activeTarget, setActiveTarget] = useState('content')
  const [diagramCode, setDiagramCode] = useState(
    'flowchart TD\n  A[User] --> B[Amplify Hosting]\n  B --> C[App]\n  C --> D[Cognito]\n  C --> E[Data]\n  C --> F[Storage]',
  )
  const [diagramSvg, setDiagramSvg] = useState('')
  const [diagramErr, setDiagramErr] = useState('')
  const titleEditorRef = useRef(null)
  const editorRef = useRef(null)
  const attachInputRef = useRef(null)
  const painterCanvasRef = useRef(null)
  const painterWrapRef = useRef(null)
  const painterDrawingRef = useRef(false)
  const painterLastRef = useRef({ x: 0, y: 0 })
  const [paintColor, setPaintColor] = useState('#143a66')
  const [paintSize, setPaintSize] = useState(3)
  const [paintEraser, setPaintEraser] = useState(false)

  const updateEditorHtmlState = () => {
    const html = editorRef.current?.innerHTML || ''
    setForm((prev) => ({ ...prev, content: sanitizeEditorHtml(html) }))
  }

  const updateTitleHtmlState = () => {
    const html = titleEditorRef.current?.innerHTML || ''
    setForm((prev) => ({ ...prev, title: normalizeTitleContent(html) }))
  }

  const preserveSelection = (e) => {
    e.preventDefault()
  }

  const runCommand = (command, value = null, target = 'active') => {
    const isTitleTarget = target === 'title' || (target === 'active' && activeTarget === 'title')
    const editor =
      isTitleTarget
        ? titleEditorRef.current
        : target === 'content'
          ? editorRef.current
          : editorRef.current
    if (!editor) return
    editor.focus()
    document.execCommand(command, false, value)
    if (isTitleTarget) updateTitleHtmlState()
    else updateEditorHtmlState()
  }

  const wrapSelectionWithClass = (className) => {
    const editor = activeTarget === 'title' ? titleEditorRef.current : editorRef.current
    if (!editor) return
    editor.focus()
    const selection = window.getSelection()
    if (!selection || !selection.rangeCount) return
    const range = selection.getRangeAt(0)

    if (selection.isCollapsed) {
      const current = editor.innerHTML || ''
      if (!current.trim()) return
      editor.innerHTML = `<span class="${className}">${current}</span>`
      if (activeTarget === 'title') updateTitleHtmlState()
      else updateEditorHtmlState()
      return
    }

    const selectedText = range.toString()
    if (!selectedText.trim()) return
    const fragment = document.createElement('span')
    fragment.className = className
    fragment.textContent = selectedText
    range.deleteContents()
    range.insertNode(fragment)
    selection.removeAllRanges()
    if (activeTarget === 'title') updateTitleHtmlState()
    else updateEditorHtmlState()
  }

  const applyUnorderedStyle = (styleType) => {
    runCommand('insertUnorderedList', null, 'content')
    const selection = window.getSelection()
    if (!selection || !selection.anchorNode) return
    let node = selection.anchorNode
    while (node && node !== editorRef.current) {
      if (node.nodeName?.toLowerCase() === 'ul') {
        if (styleType === 'star') node.style.listStyleType = '"✶ "'
        else if (styleType === 'dash') node.style.listStyleType = '"- "'
        else node.style.listStyleType = styleType
        break
      }
      node = node.parentNode
    }
    updateEditorHtmlState()
  }

  const insertCodeTemplate = () => {
    runCommand('insertHTML', '<pre><code>// Write code here</code></pre><p><br></p>', 'content')
  }

  const insertCodeMarkerTemplate = () => {
    runCommand('insertHTML', '<pre><code>// Write code here</code></pre><p><br></p>', 'content')
  }

  const removeLastMediaNode = () => {
    const editor = editorRef.current
    if (!editor) return
    const media = editor.querySelectorAll('img[data-inline-media], video[data-inline-media]')
    if (!media.length) return
    media[media.length - 1].remove()
    updateEditorHtmlState()
  }

  const insertUploadedFile = async (file, kind) => {
    if (!file || !onInlineUpload) return
    setInlineBusy(true)
    try {
      const source = await onInlineUpload(file)
      if (kind === 'vid') {
        runCommand(
          'insertHTML',
          `<p><video data-inline-media="1" controls playsinline preload="metadata" src="${source}"></video></p><p><br></p>`,
          'content',
        )
      } else {
        runCommand(
          'insertHTML',
          `<p><img data-inline-media="1" src="${source}" alt="Inline media" loading="lazy" decoding="async" /></p><p><br></p>`,
          'content',
        )
      }
    } catch {
      alert('Could not upload file for inline insertion.')
    } finally {
      setInlineBusy(false)
    }
  }

  const autoAttachPainterImage = async () => {
    const canvas = painterCanvasRef.current
    if (!canvas) return
    try {
      const dataUrl = canvas.toDataURL('image/png')
      const file = await dataUrlToFile(dataUrl, `paint-${Date.now()}.png`)
      await insertUploadedFile(file, 'img')
    } catch {
      alert('Could not attach painter image.')
    }
  }

  const autoAttachDiagramImage = async () => {
    if (!diagramSvg) return
    try {
      const dataUrl = await svgToPngDataUrl(diagramSvg)
      const file = await dataUrlToFile(dataUrl, `diagram-${Date.now()}.png`)
      await insertUploadedFile(file, 'img')
    } catch {
      try {
        const svgFile = await svgToFile(diagramSvg, `diagram-${Date.now()}.svg`)
        await insertUploadedFile(svgFile, 'img')
      } catch {
        alert('Could not attach diagram image.')
      }
    }
  }

  const handleAttachPick = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const kind = file.type.startsWith('video/') ? 'vid' : 'img'
    void insertUploadedFile(file, kind)
    e.target.value = ''
  }

  const handlePaste = (e) => {
    const items = Array.from(e.clipboardData?.items || [])
    const imageItem = items.find((item) => item.type?.startsWith('image/'))
    if (!imageItem) return
    const file = imageItem.getAsFile()
    if (!file) return
    e.preventDefault()
    void insertUploadedFile(file, 'img')
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const file = e.dataTransfer?.files?.[0]
    if (!file) return
    const isImageOrVideo =
      file.type.startsWith('image/') || file.type.startsWith('video/')
    if (!isImageOrVideo) return
    const kind = file.type.startsWith('video/') ? 'vid' : 'img'
    void insertUploadedFile(file, kind)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const cleanedContent = sanitizeEditorHtml(form.content)
    const cleanedTitle = normalizeTitleContent(form.title)
    if (!stripHtmlForStats(cleanedTitle).trim() || !cleanedContent.trim() || busy || inlineBusy) return
    onSubmit({
      title: cleanedTitle,
      content: cleanedContent,
    })

    if (!initialValue) {
      setForm({ title: '', content: '' })
      if (editorRef.current) editorRef.current.innerHTML = ''
      if (titleEditorRef.current) titleEditorRef.current.innerHTML = ''
      if (draftKey) localStorage.removeItem(draftKey)
    }
  }

  useEffect(() => {
    if (!editorRef.current) return
    const next = sanitizeEditorHtml(form.content)
    if (editorRef.current.innerHTML !== next) {
      editorRef.current.innerHTML = next
    }
  }, [form.content])

  useEffect(() => {
    if (!titleEditorRef.current) return
    const next = normalizeTitleContent(form.title)
    if (titleEditorRef.current.innerHTML !== next) {
      titleEditorRef.current.innerHTML = next
    }
  }, [form.title])

  useEffect(() => {
    if (normalizedInitial) {
      setForm(normalizedInitial)
    }
  }, [normalizedInitial])

  useEffect(() => {
    if (initialValue || !draftKey) return
    const saved = localStorage.getItem(draftKey)
    if (!saved) return
    try {
      const parsed = JSON.parse(saved)
      if (parsed?.title || parsed?.content) {
        setForm({
          title: normalizeTitleContent(parsed.title || ''),
          content: normalizeEditorContent(parsed.content || ''),
        })
        setDraftRestored(true)
      }
    } catch {
      // ignore broken draft
    }
  }, [initialValue, draftKey])

  useEffect(() => {
    if (initialValue || !draftKey) return
    const payload = JSON.stringify({
      title: normalizeTitleContent(form.title),
      content: sanitizeEditorHtml(form.content),
      updatedAt: Date.now(),
    })
    localStorage.setItem(draftKey, payload)
  }, [form, draftKey, initialValue])

  useEffect(() => {
    if (!showPainter) return
    const canvas = painterCanvasRef.current
    const wrap = painterWrapRef.current
    if (!canvas || !wrap) return
    const dpr = Math.max(window.devicePixelRatio || 1, 1)
    const width = Math.max(wrap.clientWidth, 600)
    const height = 360
    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(height * dpr)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [showPainter])

  const paintPointerDown = (e) => {
    const canvas = painterCanvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    painterDrawingRef.current = true
    painterLastRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }

  const paintPointerMove = (e) => {
    if (!painterDrawingRef.current) return
    const canvas = painterCanvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const ctx = canvas.getContext('2d')
    ctx.strokeStyle = paintEraser ? '#ffffff' : paintColor
    ctx.lineWidth = paintSize
    ctx.beginPath()
    ctx.moveTo(painterLastRef.current.x, painterLastRef.current.y)
    ctx.lineTo(x, y)
    ctx.stroke()
    painterLastRef.current = { x, y }
  }

  const paintPointerUp = () => {
    painterDrawingRef.current = false
  }

  const clearPainter = () => {
    const canvas = painterCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight)
  }

  const generateDiagram = async () => {
    setDiagramErr('')
    try {
      const mermaidModule = await import('mermaid')
      const mermaid = mermaidModule.default
      mermaid.initialize({ startOnLoad: false, securityLevel: 'loose' })
      const id = `diag-${Math.random().toString(36).slice(2, 10)}`
      const out = await mermaid.render(id, diagramCode || 'graph TD\nA-->B')
      setDiagramSvg(out.svg)
    } catch {
      setDiagramErr('Diagram render failed. Please check Mermaid syntax.')
    }
  }

  useEffect(() => {
    if (!showDiagram) return
    void generateDiagram()
  }, [showDiagram])

  const handleEditorKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      const cleanedContent = sanitizeEditorHtml(form.content)
      const cleanedTitle = normalizeTitleContent(form.title)
      if (!stripHtmlForStats(cleanedTitle).trim() || !cleanedContent.trim() || busy || inlineBusy) return
      onSubmit({
        title: cleanedTitle,
        content: cleanedContent,
      })
      if (!initialValue && draftKey) localStorage.removeItem(draftKey)
    }
  }

  const plain = stripHtmlForStats(form.content)
  const wordCount = plain ? plain.split(/\s+/).length : 0
  const charCount = plain.length

  return (
    <form className="card writer" onSubmit={handleSubmit}>
      <h3>{submitLabel}</h3>
      {draftRestored ? (
        <p className="draft-pill">
          Draft restored from local autosave.
          <button
            type="button"
            className="ghost"
            onClick={() => {
              setForm({ title: '', content: '' })
              if (editorRef.current) editorRef.current.innerHTML = ''
              if (draftKey) localStorage.removeItem(draftKey)
              setDraftRestored(false)
            }}
          >
            Clear draft
          </button>
        </p>
      ) : null}

      <label>Title</label>
      <div
        ref={titleEditorRef}
        className="rich-title-editor"
        contentEditable
        suppressContentEditableWarning
        onInput={updateTitleHtmlState}
        onFocus={() => setActiveTarget('title')}
        data-placeholder="Write a strong title"
      />

      <label>Content</label>
      <div className="editor-ribbon">
        <div className="format-toolbar-shell">
          <button
            type="button"
            className="ghost format-toggle"
            onClick={() => setShowFormatMenu((prev) => !prev)}
            aria-expanded={showFormatMenu}
            aria-controls="writer-style-menu"
          >
            Format {showFormatMenu ? '▲' : '▼'}
          </button>
        </div>
        {showFormatMenu ? (
          <div id="writer-style-menu" className="inline-toolbar ribbon-groups">
            <div className="ribbon-group">
              <button type="button" className="ghost icon-tool" onMouseDown={preserveSelection} onClick={() => runCommand('bold')} disabled={inlineBusy || busy} title="Bold">B</button>
              <button type="button" className="ghost icon-tool" onMouseDown={preserveSelection} onClick={() => runCommand('italic')} disabled={inlineBusy || busy} title="Italic">I</button>
              <button type="button" className="ghost icon-tool" onMouseDown={preserveSelection} onClick={() => runCommand('formatBlock', 'H1')} disabled={inlineBusy || busy} title="Heading 1">H1</button>
              <button type="button" className="ghost icon-tool" onMouseDown={preserveSelection} onClick={() => runCommand('formatBlock', 'H2')} disabled={inlineBusy || busy} title="Heading 2">H2</button>
              <button type="button" className="ghost icon-tool" onMouseDown={preserveSelection} onClick={() => runCommand('insertOrderedList')} disabled={inlineBusy || busy} title="Numbered list">1.</button>
              <button type="button" className="ghost icon-tool" onMouseDown={preserveSelection} onClick={() => applyUnorderedStyle('disc')} disabled={inlineBusy || busy} title="Bullet list">•</button>
              <button type="button" className="ghost icon-tool" onMouseDown={preserveSelection} onClick={() => applyUnorderedStyle('circle')} disabled={inlineBusy || busy} title="Circle bullet list">◦</button>
              <button type="button" className="ghost icon-tool" onMouseDown={preserveSelection} onClick={() => applyUnorderedStyle('square')} disabled={inlineBusy || busy} title="Square bullet list">▪</button>
              <button type="button" className="ghost icon-tool" onMouseDown={preserveSelection} onClick={() => applyUnorderedStyle('star')} disabled={inlineBusy || busy} title="Star bullet list">*</button>
              <button type="button" className="ghost icon-tool" onMouseDown={preserveSelection} onClick={() => applyUnorderedStyle('dash')} disabled={inlineBusy || busy} title="Dash list">-</button>
              <label className="mini-field mini-field-icon" title="Text color">
                <span className="swatch-label">A</span>
                <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} />
              </label>
              <button type="button" className="ghost icon-tool" onMouseDown={preserveSelection} onClick={() => runCommand('foreColor', textColor)} disabled={inlineBusy || busy} title="Apply text color">Color</button>
              <label className="mini-field mini-field-icon" title="Highlight color">
                <span className="swatch-label">Bg</span>
                <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} />
              </label>
              <button type="button" className="ghost icon-tool" onMouseDown={preserveSelection} onClick={() => runCommand('hiliteColor', bgColor)} disabled={inlineBusy || busy} title="Apply highlight">Highlight</button>
              <span className="ribbon-caption">Text</span>
            </div>

            <div className="ribbon-group">
              <select
                className={`style-select ${handStyle}`}
                value={handStyle}
                onChange={(e) => setHandStyle(e.target.value)}
                title="Select handwriting style"
              >
                {handStyles.map((style) => (
                  <option key={style.value} value={style.value}>
                    {style.label}
                  </option>
                ))}
              </select>
              <button type="button" className={`ghost hand-sample ${handStyle}`} onMouseDown={preserveSelection} onClick={() => wrapSelectionWithClass(handStyle)} disabled={inlineBusy || busy} title="Apply selected handwriting">Sample</button>
              <button type="button" className="ghost hand-action icon-tool" onMouseDown={preserveSelection} onClick={() => wrapSelectionWithClass(handStyle)} disabled={inlineBusy || busy} title="Apply selected handwriting">Pen</button>
              <span className="ribbon-caption">Styles</span>
            </div>

            <div className="ribbon-group">
              <button type="button" className="ghost" onClick={insertCodeTemplate} disabled={inlineBusy || busy}>Insert Code</button>
              <button type="button" className="ghost" onClick={insertCodeMarkerTemplate} disabled={inlineBusy || busy}>Insert codestart/codeend</button>
              <button type="button" className="ghost" onClick={() => attachInputRef.current?.click()} disabled={inlineBusy || busy}>Attach Image/Video</button>
              <button type="button" className="ghost" onClick={removeLastMediaNode} disabled={inlineBusy || busy}>Remove Last Image/Video</button>
              <button type="button" className="ghost" onClick={() => setShowPainter(true)} disabled={inlineBusy || busy}>Painter</button>
              <button type="button" className="ghost" onClick={() => setShowDiagram(true)} disabled={inlineBusy || busy}>Architecture Diagram</button>
              <input
                ref={attachInputRef}
                type="file"
                accept="image/*,video/*"
                className="hidden-input"
                onChange={handleAttachPick}
              />
              <span className="ribbon-caption">Media & Diagrams</span>
            </div>
          </div>
        ) : null}
      </div>

      <div
        ref={editorRef}
        className="rich-editor"
        contentEditable
        suppressContentEditableWarning
        onInput={updateEditorHtmlState}
        onFocus={() => setActiveTarget('content')}
        onKeyDown={handleEditorKeyDown}
        onPaste={handlePaste}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        data-placeholder="Write your story with rich formatting..."
      />

      <small>
        Tip: WYSIWYG mode is on. No raw [color]/[hand] handlers shown in edit mode. Painter/Diagram exports auto-attach as images.
      </small>

      <div className="writer-stats">
        <span>{wordCount} words</span>
        <span>{charCount} chars</span>
      </div>

      <div className="button-row">
        <button type="submit" disabled={!stripHtmlForStats(form.title).trim() || !stripHtmlForStats(form.content).trim() || busy || inlineBusy}>
          {busy ? 'Saving...' : submitLabel}
        </button>
        {onCancel ? (
          <button className="ghost" type="button" onClick={onCancel} disabled={busy || inlineBusy}>
            Cancel
          </button>
        ) : null}
      </div>

      {showPainter ? (
        <div className="modal" onClick={() => setShowPainter(false)}>
          <div className="card painter-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Painter Tool</h3>
            <div className="painter-controls">
              <label>
                Color
                <input type="color" value={paintColor} onChange={(e) => setPaintColor(e.target.value)} disabled={paintEraser} />
              </label>
              <label>
                Brush
                <input type="range" min="1" max="24" value={paintSize} onChange={(e) => setPaintSize(Number(e.target.value))} />
              </label>
              <button type="button" className={`ghost ${paintEraser ? 'active-like' : ''}`} onClick={() => setPaintEraser((v) => !v)}>
                Eraser
              </button>
              <button type="button" className="ghost" onClick={clearPainter}>
                Clear
              </button>
            </div>
            <div ref={painterWrapRef} className="painter-canvas-wrap">
              <canvas
                ref={painterCanvasRef}
                className="painter-canvas"
                onPointerDown={paintPointerDown}
                onPointerMove={paintPointerMove}
                onPointerUp={paintPointerUp}
                onPointerLeave={paintPointerUp}
              />
            </div>
            <div className="button-row">
              <button
                type="button"
                onClick={async () => {
                  await autoAttachPainterImage()
                  setShowPainter(false)
                }}
              >
                Save & Auto Attach
              </button>
              <button type="button" className="ghost" onClick={() => setShowPainter(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showDiagram ? (
        <div className="modal" onClick={() => setShowDiagram(false)}>
          <div className="card diagram-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Architecture Diagram Builder</h3>
            <label>Mermaid Definition</label>
            <textarea
              rows={8}
              value={diagramCode}
              onChange={(e) => setDiagramCode(e.target.value)}
              placeholder="flowchart TD
A[User] --> B[App]"
            />
            <div className="button-row">
              <button type="button" onClick={() => void generateDiagram()}>
                Generate Preview
              </button>
              <button
                type="button"
                onClick={async () => {
                  await autoAttachDiagramImage()
                  setShowDiagram(false)
                }}
                disabled={!diagramSvg}
              >
                Save & Auto Attach
              </button>
              <button type="button" className="ghost" onClick={() => setShowDiagram(false)}>
                Close
              </button>
            </div>
            {diagramErr ? <p className="error">{diagramErr}</p> : null}
            {diagramSvg ? (
              <div className="diagram-preview" dangerouslySetInnerHTML={{ __html: diagramSvg }} />
            ) : (
              <p>Generate preview to attach diagram.</p>
            )}
          </div>
        </div>
      ) : null}
    </form>
  )
}

export default Write
