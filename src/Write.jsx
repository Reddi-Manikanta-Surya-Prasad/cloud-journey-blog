import { useEffect, useRef, useState } from 'react'

function Write({ onSubmit, onCancel, initialValue, submitLabel, busy, onInlineUpload, draftKey }) {
  const [form, setForm] = useState(
    initialValue || {
      title: '',
      content: '',
    },
  )
  const [inlineBusy, setInlineBusy] = useState(false)
  const [draftRestored, setDraftRestored] = useState(false)
  const textareaRef = useRef(null)
  const attachInputRef = useRef(null)

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

    onSubmit({
      title: form.title.trim(),
      content: form.content,
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
        onPaste={handlePaste}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        placeholder="Write your story. Use codestart ... codeend for IDE-style code section. Paste screenshot/image (Ctrl+V) at cursor."
      />

      <small>
        Tip: Use `codestart js` and `codeend` for code. Ctrl+Enter to publish. Ctrl+V for screenshot/image.
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
