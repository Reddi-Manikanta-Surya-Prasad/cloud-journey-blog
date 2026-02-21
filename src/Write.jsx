import { useEffect, useRef, useState } from 'react'

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

  const [form, setForm] = useState(
    initialValue || {
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
  const textareaRef = useRef(null)
  const attachInputRef = useRef(null)
  const selectionRef = useRef({ start: 0, end: 0 })

  const preserveSelection = (e) => {
    e.preventDefault()
  }

  const captureSelection = () => {
    const ta = textareaRef.current
    if (!ta) return
    selectionRef.current = {
      start: ta.selectionStart ?? 0,
      end: ta.selectionEnd ?? 0,
    }
  }

  const insertAtCursor = (text) => {
    const ta = textareaRef.current
    const value = form.content || ''
    if (!ta) {
      setForm((prev) => ({ ...prev, content: `${value}\n${text}\n` }))
      return
    }

    const start = ta.selectionStart ?? value.length
    const end = ta.selectionEnd ?? value.length
    const next = `${value.slice(0, start)}${text}${value.slice(end)}`
    setForm((prev) => ({ ...prev, content: next }))

    requestAnimationFrame(() => {
      ta.focus()
      const pos = start + text.length
      ta.setSelectionRange(pos, pos)
    })
  }

  const insertCodeTemplate = () => {
    insertAtCursor('\n```js\n// Write code here\n```\n')
  }

  const insertCodeMarkerTemplate = () => {
    insertAtCursor('\ncodestart js\n// Write code here\ncodeend\n')
  }

  const wrapSelection = (prefix, suffix, placeholder = 'text') => {
    const ta = textareaRef.current
    const value = form.content || ''
    if (!ta) {
      insertAtCursor(`${prefix}${placeholder}${suffix}`)
      return
    }

    let start = ta.selectionStart ?? value.length
    let end = ta.selectionEnd ?? value.length
    if (start === end && selectionRef.current.end > selectionRef.current.start) {
      start = selectionRef.current.start
      end = selectionRef.current.end
    }
    const selected = value.slice(start, end) || placeholder
    const replacement = `${prefix}${selected}${suffix}`
    const next = `${value.slice(0, start)}${replacement}${value.slice(end)}`
    setForm((prev) => ({ ...prev, content: next }))

    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(start, start + replacement.length)
      captureSelection()
    })
  }

  const removeLastMediaToken = () => {
    setForm((prev) => {
      const content = prev.content || ''
      const matches = [...content.matchAll(/\n?\[\[(img|vid):.+?\]\]\n?/g)]
      if (!matches.length) return prev
      const last = matches[matches.length - 1]
      const start = last.index
      const end = start + last[0].length
      const next = `${content.slice(0, start)}${content.slice(end)}`
      return { ...prev, content: next.replace(/\n{3,}/g, '\n\n') }
    })
  }

  const normalizeHandwritingTags = (text) => {
    let next = String(text || '')
    next = next.replace(/(\[hand(?:10|[1-9])\])(?:\s*\1)+/g, '$1')
    next = next.replace(/(\[\/hand(?:10|[1-9])\])(?:\s*\1)+/g, '$1')
    return next
  }

  const applyHandStyle = (style) => {
    setHandStyle(style)
    const ta = textareaRef.current
    const value = form.content || ''
    let start = ta?.selectionStart ?? value.length
    let end = ta?.selectionEnd ?? value.length
    if (start === end && selectionRef.current.end > selectionRef.current.start) {
      start = selectionRef.current.start
      end = selectionRef.current.end
    }
    // Docs-like fallback: if no selection, apply style to the whole content.
    if (start === end && value.trim()) {
      start = 0
      end = value.length
    }
    if (start === end) return

    const selected = value.slice(start, end)
    const cleaned = selected
      .replace(/\[hand(?:10|[1-9])\]/g, '')
      .replace(/\[\/hand(?:10|[1-9])\]/g, '')
    const replacement = `[${style}]${cleaned}[/${style}]`
    const next = `${value.slice(0, start)}${replacement}${value.slice(end)}`
    setForm((prev) => ({ ...prev, content: next }))

    requestAnimationFrame(() => {
      if (!ta) return
      ta.focus()
      ta.setSelectionRange(start, start + replacement.length)
      captureSelection()
    })
  }

  const insertUploadedFile = async (file, kind) => {
    if (!file || !onInlineUpload) return
    setInlineBusy(true)
    try {
      const source = await onInlineUpload(file)
      insertAtCursor(`\n[[${kind}:${source}]]\n`)
    } catch {
      alert('Could not upload file for inline insertion.')
    } finally {
      setInlineBusy(false)
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
    if (!form.title.trim() || !form.content.trim() || busy || inlineBusy) return
    const cleanedContent = normalizeHandwritingTags(form.content)

    onSubmit({
      title: form.title.trim(),
      content: cleanedContent,
    })

    if (!initialValue) {
      setForm({ title: '', content: '' })
      if (draftKey) localStorage.removeItem(draftKey)
    }
  }

  useEffect(() => {
    if (initialValue || !draftKey) return
    const saved = localStorage.getItem(draftKey)
    if (!saved) return
    try {
      const parsed = JSON.parse(saved)
      if (parsed?.title || parsed?.content) {
        setForm({
          title: parsed.title || '',
          content: parsed.content || '',
        })
        setDraftRestored(true)
      }
    } catch {
      // Ignore corrupted draft payload.
    }
  }, [initialValue, draftKey])

  useEffect(() => {
    if (initialValue || !draftKey) return
    const payload = JSON.stringify({
      title: form.title,
      content: form.content,
      updatedAt: Date.now(),
    })
    localStorage.setItem(draftKey, payload)
  }, [form, draftKey, initialValue])

  const handleEditorKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      if (!form.title.trim() || !form.content.trim() || busy || inlineBusy) return
      onSubmit({
        title: form.title.trim(),
        content: form.content,
      })
      if (!initialValue && draftKey) localStorage.removeItem(draftKey)
      return
    }

    if (e.key !== 'Tab') return
    e.preventDefault()
    const ta = textareaRef.current
    const value = form.content || ''
    if (!ta) return
    const start = ta.selectionStart ?? value.length
    const end = ta.selectionEnd ?? value.length
    const next = `${value.slice(0, start)}  ${value.slice(end)}`
    setForm((prev) => ({ ...prev, content: next }))
    requestAnimationFrame(() => {
      ta.focus()
      const pos = start + 2
      ta.setSelectionRange(pos, pos)
    })
  }

  const wordCount = form.content.trim() ? form.content.trim().split(/\s+/).length : 0
  const charCount = form.content.length

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
              if (draftKey) localStorage.removeItem(draftKey)
              setDraftRestored(false)
            }}
          >
            Clear draft
          </button>
        </p>
      ) : null}
      <label>Title</label>
      <input
        value={form.title}
        onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
        placeholder="Write a strong title"
      />

      <label>Content</label>
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
        <div id="writer-style-menu" className="inline-toolbar">
          <button type="button" className="ghost icon-tool" onMouseDown={preserveSelection} onClick={() => wrapSelection('**', '**', 'bold text')} disabled={inlineBusy || busy} title="Bold">
            B
          </button>
          <button type="button" className="ghost icon-tool" onMouseDown={preserveSelection} onClick={() => wrapSelection('_', '_', 'italic text')} disabled={inlineBusy || busy} title="Italic">
            I
          </button>
          <button type="button" className="ghost icon-tool" onMouseDown={preserveSelection} onClick={() => wrapSelection('\n# ', '', 'Heading 1')} disabled={inlineBusy || busy} title="Heading 1">
            H1
          </button>
          <button type="button" className="ghost icon-tool" onMouseDown={preserveSelection} onClick={() => wrapSelection('\n## ', '', 'Heading 2')} disabled={inlineBusy || busy} title="Heading 2">
            H2
          </button>
          <label className="mini-field mini-field-icon" title="Text color">
            A
            <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} />
          </label>
          <button
            type="button"
            className="ghost icon-tool"
            onMouseDown={preserveSelection}
            onClick={() => wrapSelection(`[color=${textColor}]`, '[/color]', 'colored text')}
            disabled={inlineBusy || busy}
            title="Apply text color"
          >
            Color
          </button>
          <label className="mini-field mini-field-icon" title="Highlight color">
            Bg
            <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} />
          </label>
          <button
            type="button"
            className="ghost icon-tool"
            onMouseDown={preserveSelection}
            onClick={() => wrapSelection(`[bg=${bgColor}]`, '[/bg]', 'highlighted text')}
            disabled={inlineBusy || busy}
            title="Apply highlight"
          >
            Highlight
          </button>
          <select
            className={`style-select ${handStyle}`}
            value={handStyle}
            onChange={(e) => applyHandStyle(e.target.value)}
            title="Select handwriting style"
          >
            {handStyles.map((style) => (
              <option key={style.value} value={style.value}>
                {style.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={`ghost hand-sample ${handStyle}`}
            onMouseDown={preserveSelection}
            onClick={() => applyHandStyle(handStyle)}
            disabled={inlineBusy || busy}
            title="Apply selected handwriting to selected text"
          >
            Sample
          </button>
          <button
            type="button"
            className="ghost hand-action icon-tool"
            onMouseDown={preserveSelection}
            onClick={() => applyHandStyle(handStyle)}
            disabled={inlineBusy || busy}
            title="Wrap selected text with handwriting style"
          >
            Pen
          </button>
        </div>
      ) : null}
      <div className="button-row">
        <button
          type="button"
          className="ghost"
          onClick={insertCodeTemplate}
          disabled={inlineBusy || busy}
        >
          Insert Code Block
        </button>
        <button
          type="button"
          className="ghost"
          onClick={insertCodeMarkerTemplate}
          disabled={inlineBusy || busy}
        >
          Insert codestart/codeend
        </button>
        <button
          type="button"
          className="ghost"
          onClick={() => attachInputRef.current?.click()}
          disabled={inlineBusy || busy}
        >
          Attach Image/Video
        </button>
        <button
          type="button"
          className="ghost"
          onClick={removeLastMediaToken}
          disabled={inlineBusy || busy}
        >
          Remove Last Image/Video
        </button>
        <input
          ref={attachInputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden-input"
          onChange={handleAttachPick}
        />
      </div>
      <textarea
        ref={textareaRef}
        rows={14}
        value={form.content}
        onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
        onKeyDown={handleEditorKeyDown}
        onKeyUp={captureSelection}
        onMouseUp={captureSelection}
        onSelect={captureSelection}
        onFocus={captureSelection}
        onPaste={handlePaste}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        placeholder="Write your story. Use codestart ... codeend for IDE-style code section. Paste screenshot/image (Ctrl+V) at cursor."
      />

      <small>
        Tip: Use **bold**, _italic_, # headings, [color=#hex]text[/color], [bg=#hex]text[/bg], [hand1..hand10]text[/...]. Ctrl+Enter to publish. Ctrl+V for screenshot/image.
      </small>

      <div className="writer-stats">
        <span>{wordCount} words</span>
        <span>{charCount} chars</span>
      </div>

      <div className="button-row">
        <button type="submit" disabled={!form.title.trim() || !form.content.trim() || busy || inlineBusy}>
          {busy ? 'Saving...' : submitLabel}
        </button>
        {onCancel ? (
          <button className="ghost" type="button" onClick={onCancel} disabled={busy || inlineBusy}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  )
}

export default Write
