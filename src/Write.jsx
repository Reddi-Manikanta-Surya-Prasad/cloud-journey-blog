import { useEffect, useRef, useState } from 'react'

function sanitizeEditorHtml(html) {
  const raw = String(html || '')
  if (!raw.trim()) return ''
  let next = raw
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript:/gi, '')
  return next.trim()
}

function stripHtmlForStats(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h1|h2|h3|h4|h5|h6)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
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
  const titleRef = useRef(null)
  const editorRef = useRef(null)
  const attachInputRef = useRef(null)

  const updateEditorHtmlState = () => {
    const html = editorRef.current?.innerHTML || ''
    setForm((prev) => ({ ...prev, content: sanitizeEditorHtml(html) }))
  }

  const runCommand = (command, value = null) => {
    const editor = editorRef.current
    if (!editor) return
    editor.focus()
    document.execCommand(command, false, value)
    updateEditorHtmlState()
  }

  const wrapSelectionWithClass = (className) => {
    const editor = editorRef.current
    if (!editor) return
    editor.focus()
    const selection = window.getSelection()
    if (!selection || !selection.rangeCount) return
    const range = selection.getRangeAt(0)

    // If nothing selected, apply style to all editor content.
    if (selection.isCollapsed) {
      const current = editor.innerHTML || ''
      if (!current.trim()) return
      editor.innerHTML = `<span class="${className}">${current}</span>`
      updateEditorHtmlState()
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
    updateEditorHtmlState()
  }

  const applyUnorderedStyle = (styleType) => {
    runCommand('insertUnorderedList')
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
    runCommand(
      'insertHTML',
      '<pre><code>// Write code here</code></pre><p><br></p>',
    )
  }

  const insertCodeMarkerTemplate = () => {
    runCommand(
      'insertHTML',
      '<pre><code>// Write code here</code></pre><p><br></p>',
    )
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
        )
      } else {
        runCommand(
          'insertHTML',
          `<p><img data-inline-media="1" src="${source}" alt="Inline media" loading="lazy" decoding="async" /></p><p><br></p>`,
        )
      }
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
    const cleanedContent = sanitizeEditorHtml(form.content)
    if (!form.title.trim() || !cleanedContent.trim() || busy || inlineBusy) return

    onSubmit({
      title: form.title.trim(),
      content: cleanedContent,
    })

    if (!initialValue) {
      setForm({ title: '', content: '' })
      if (editorRef.current) editorRef.current.innerHTML = ''
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
    if (initialValue || !draftKey) return
    const saved = localStorage.getItem(draftKey)
    if (!saved) return
    try {
      const parsed = JSON.parse(saved)
      if (parsed?.title || parsed?.content) {
        setForm({
          title: parsed.title || '',
          content: sanitizeEditorHtml(parsed.content || ''),
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
      content: sanitizeEditorHtml(form.content),
      updatedAt: Date.now(),
    })
    localStorage.setItem(draftKey, payload)
  }, [form, draftKey, initialValue])

  const handleEditorKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      const cleanedContent = sanitizeEditorHtml(form.content)
      if (!form.title.trim() || !cleanedContent.trim() || busy || inlineBusy) return
      onSubmit({
        title: form.title.trim(),
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
      <input
        ref={titleRef}
        value={form.title}
        onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
        placeholder="Write a strong title"
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
              <button type="button" className="ghost icon-tool" onClick={() => runCommand('bold')} disabled={inlineBusy || busy} title="Bold">
                B
              </button>
              <button type="button" className="ghost icon-tool" onClick={() => runCommand('italic')} disabled={inlineBusy || busy} title="Italic">
                I
              </button>
              <button type="button" className="ghost icon-tool" onClick={() => runCommand('formatBlock', 'H1')} disabled={inlineBusy || busy} title="Heading 1">
                H1
              </button>
              <button type="button" className="ghost icon-tool" onClick={() => runCommand('formatBlock', 'H2')} disabled={inlineBusy || busy} title="Heading 2">
                H2
              </button>
              <button type="button" className="ghost icon-tool" onClick={() => runCommand('insertOrderedList')} disabled={inlineBusy || busy} title="Numbered list">
                1.
              </button>
              <button type="button" className="ghost icon-tool" onClick={() => applyUnorderedStyle('disc')} disabled={inlineBusy || busy} title="Bullet list">
                •
              </button>
              <button type="button" className="ghost icon-tool" onClick={() => applyUnorderedStyle('circle')} disabled={inlineBusy || busy} title="Circle bullet list">
                ◦
              </button>
              <button type="button" className="ghost icon-tool" onClick={() => applyUnorderedStyle('square')} disabled={inlineBusy || busy} title="Square bullet list">
                ▪
              </button>
              <button type="button" className="ghost icon-tool" onClick={() => applyUnorderedStyle('star')} disabled={inlineBusy || busy} title="Star bullet list">
                *
              </button>
              <button type="button" className="ghost icon-tool" onClick={() => applyUnorderedStyle('dash')} disabled={inlineBusy || busy} title="Dash list">
                -
              </button>
              <label className="mini-field mini-field-icon" title="Text color">
                <span className="swatch-label">A</span>
                <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} />
              </label>
              <button
                type="button"
                className="ghost icon-tool"
                onClick={() => runCommand('foreColor', textColor)}
                disabled={inlineBusy || busy}
                title="Apply text color"
              >
                Color
              </button>
              <label className="mini-field mini-field-icon" title="Highlight color">
                <span className="swatch-label">Bg</span>
                <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} />
              </label>
              <button
                type="button"
                className="ghost icon-tool"
                onClick={() => runCommand('hiliteColor', bgColor)}
                disabled={inlineBusy || busy}
                title="Apply highlight"
              >
                Highlight
              </button>
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
              <button
                type="button"
                className={`ghost hand-sample ${handStyle}`}
                onClick={() => wrapSelectionWithClass(handStyle)}
                disabled={inlineBusy || busy}
                title="Apply selected handwriting to selected text"
              >
                Sample
              </button>
              <button
                type="button"
                className="ghost hand-action icon-tool"
                onClick={() => wrapSelectionWithClass(handStyle)}
                disabled={inlineBusy || busy}
                title="Apply selected handwriting"
              >
                Pen
              </button>
              <span className="ribbon-caption">Styles</span>
            </div>

            <div className="ribbon-group">
              <button
                type="button"
                className="ghost"
                onClick={insertCodeTemplate}
                disabled={inlineBusy || busy}
              >
                Insert Code
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
                onClick={removeLastMediaNode}
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
              <span className="ribbon-caption">Media & Code</span>
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
        onKeyDown={handleEditorKeyDown}
        onPaste={handlePaste}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        data-placeholder="Write your story with rich formatting..."
      />

      <small>
        Tip: Rich editor mode enabled. You can style selected text directly, like Word/Google Docs. Ctrl+Enter to publish.
      </small>

      <div className="writer-stats">
        <span>{wordCount} words</span>
        <span>{charCount} chars</span>
      </div>

      <div className="button-row">
        <button type="submit" disabled={!form.title.trim() || !stripHtmlForStats(form.content).trim() || busy || inlineBusy}>
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
