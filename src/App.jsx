import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Amplify } from 'aws-amplify'
import {
  confirmSignUp,
  fetchUserAttributes,
  fetchAuthSession,
  getCurrentUser,
  resetPassword,
  signIn,
  signInWithRedirect,
  signOut,
  signUp,
  updateUserAttributes,
} from 'aws-amplify/auth'
import { generateClient } from 'aws-amplify/data'
import { getUrl, uploadData } from 'aws-amplify/storage'
import { Users, FileText, MessageSquare, ShieldAlert } from 'lucide-react'
import Write from './Write'
import outputs from '../amplify_outputs.json'
import cloudTechIcon from './assets/cloud-tech.svg'

Amplify.configure(outputs)
const client = generateClient()
window.client = client
const ADMIN_EMAILS = ['reddimani14@gmail.com']

function toStorageSafeName(name) {
  return name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '')
}

function toTitleCaseName(text) {
  return String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function deriveFriendlyUserName(user, attrs) {
  const explicitName = toTitleCaseName(attrs?.name)
  if (explicitName) return explicitName

  const given = toTitleCaseName(attrs?.given_name)
  const family = toTitleCaseName(attrs?.family_name)
  const full = `${given} ${family}`.trim()
  if (full) return full

  const email = String(attrs?.email || '')
  if (email.includes('@')) {
    const localPart = email.split('@')[0].replace(/[._-]+/g, ' ').trim()
    const fromEmail = toTitleCaseName(localPart)
    if (fromEmail) return fromEmail
  }

  const username = String(user?.username || '')
  if (/^google[_-]/i.test(username)) return 'Google User'
  return toTitleCaseName(username) || 'User'
}

function buildReadableParagraphs(rawText) {
  const text = (rawText || '').replace(/\r\n/g, '\n').trim()
  if (!text) return []

  const manualParagraphs = text
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean)

  if (manualParagraphs.length > 1) return manualParagraphs

  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean)

  if (sentences.length <= 3) return [text]

  const grouped = []
  for (let i = 0; i < sentences.length; i += 3) {
    grouped.push(sentences.slice(i, i + 3).join(' '))
  }
  return grouped
}

function sanitizeHandTagsForRender(text) {
  let next = String(text || '')
  next = next.replace(/\[(\/?)hand\]/g, (_, slash) => `[${slash}hand1]`)

  const re = /\[(\/?)hand(10|[1-9])\]/g
  const chunks = []
  const stack = []
  let last = 0
  let m
  while ((m = re.exec(next)) !== null) {
    chunks.push(next.slice(last, m.index))
    const closing = m[1] === '/'
    const style = `hand${m[2]}`
    if (!closing) {
      const marker = { style, text: m[0], keep: true }
      chunks.push(marker)
      stack.push(marker)
    } else if (stack.length && stack[stack.length - 1].style === style) {
      stack.pop()
      chunks.push(m[0])
    }
    last = re.lastIndex
  }
  chunks.push(next.slice(last))
  stack.forEach((marker) => {
    marker.keep = false
  })
  return chunks
    .map((part) => (typeof part === 'string' ? part : part.keep ? part.text : ''))
    .join('')
}

function renderInlineRichText(text, keyPrefix = 'rt') {
  const source = sanitizeHandTagsForRender(text)
  if (!source) return null

  const patterns = [
    {
      re: /\[color=([#a-zA-Z0-9(),.\s%-]+)\]([\s\S]*?)\[\/color\]/,
      render: (match, children, key) => (
        <span key={key} style={{ color: match[1].trim() }}>
          {children}
        </span>
      ),
    },
    {
      re: /\[bg=([#a-zA-Z0-9(),.\s%-]+)\]([\s\S]*?)\[\/bg\]/,
      render: (match, children, key) => (
        <span key={key} style={{ background: match[1].trim(), padding: '0 2px', borderRadius: '4px' }}>
          {children}
        </span>
      ),
    },
    {
      re: /\[(hand(?:10|[1-9])?)\]([\s\S]*?)\[\/\1\]/,
      render: (match, children, key) => (
        <span key={key} className={match[1] === 'hand' ? 'hand1' : match[1]}>
          {children}
        </span>
      ),
    },
    {
      re: /\*\*([^*]+)\*\*/,
      render: (_match, children, key) => <strong key={key}>{children}</strong>,
    },
    {
      re: /_([^_]+)_/,
      render: (_match, children, key) => <em key={key}>{children}</em>,
    },
  ]

  for (let i = 0; i < patterns.length; i += 1) {
    const { re, render } = patterns[i]
    const m = source.match(re)
    if (!m || m.index === undefined) continue
    const start = m.index
    const end = start + m[0].length
    const before = source.slice(0, start)
    const after = source.slice(end)
    const inner = m[2] ?? m[1]
    return [
      ...(before ? renderInlineRichText(before, `${keyPrefix}-b-${i}`) : []),
      render(m, renderInlineRichText(inner, `${keyPrefix}-m-${i}`), `${keyPrefix}-v-${i}`),
      ...(after ? renderInlineRichText(after, `${keyPrefix}-a-${i}`) : []),
    ]
  }

  return [source]
}

function sanitizePublishedHtml(html) {
  let next = String(html || '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript:/gi, '')

  // Normalize legacy <font color="..."> tags safely using DOM if available
  if (typeof document !== 'undefined') {
    const root = document.createElement('div')
    root.innerHTML = next
    root.querySelectorAll('font').forEach((el) => {
      const span = document.createElement('span')
      span.innerHTML = el.innerHTML
      if (el.color) span.style.color = el.color
      if (el.getAttribute('style')) {
        span.style.cssText += ';' + el.getAttribute('style')
      }
      if (el.size) span.style.fontSize = el.size
      if (el.face) span.style.fontFamily = el.face
      el.replaceWith(span)
    })
    next = root.innerHTML
  } else {
    // Basic fallback for SSR
    next = next.replace(
      /<font[^>]*color=(['"]?)([^"']+)\1[^>]*>([\s\S]*?)<\/font>/gi,
      '<span style="color:$2">$3</span>',
    )
  }

  return next
}

function isLikelyHtmlContent(content) {
  const source = String(content || '').trim()
  if (!source) return false
  return /<(p|div|span|strong|em|b|i|u|mark|font|h1|h2|h3|ul|ol|li|pre|code|img|video|br)\b/i.test(source)
}

function renderRichTitle(title, keyPrefix = 'title') {
  const source = String(title || '')
  if (!source.trim()) return null
  if (isLikelyHtmlContent(source)) {
    return (
      <span
        className="rich-title"
        dangerouslySetInnerHTML={{ __html: sanitizePublishedHtml(source) }}
      />
    )
  }
  return renderInlineRichText(source, keyPrefix)
}

function renderStyledTextBlock(text, keyPrefix = 'txt') {
  const lines = String(text || '').split('\n')
  const blocks = []
  let paraLines = []
  let listMode = null
  let listStart = 1
  let listItems = []

  const flushParagraph = (suffix) => {
    if (!paraLines.length) return
    const paragraphText = paraLines.join('\n')
    blocks.push(
      <p key={`${keyPrefix}-p-${suffix}`} style={{ whiteSpace: 'pre-wrap' }}>
        {renderInlineRichText(paragraphText, `${keyPrefix}-p-${suffix}`)}
      </p>,
    )
    paraLines = []
  }

  const flushList = (suffix) => {
    if (!listItems.length || !listMode) return
    if (listMode === 'ol') {
      blocks.push(
        <ol key={`${keyPrefix}-ol-${suffix}`} start={listStart}>
          {listItems.map((item, idx) => (
            <li key={`${keyPrefix}-oli-${suffix}-${idx}`}>
              {renderInlineRichText(item, `${keyPrefix}-oli-${suffix}-${idx}`)}
            </li>
          ))}
        </ol>,
      )
    } else {
      blocks.push(
        <ul key={`${keyPrefix}-ul-${suffix}`}>
          {listItems.map((item, idx) => (
            <li key={`${keyPrefix}-uli-${suffix}-${idx}`}>
              {renderInlineRichText(item, `${keyPrefix}-uli-${suffix}-${idx}`)}
            </li>
          ))}
        </ul>,
      )
    }
    listMode = null
    listItems = []
  }

  lines.forEach((rawLine, index) => {
    const line = rawLine.trimEnd()
    if (!line.trim()) {
      flushParagraph(index)
      flushList(index)
      return
    }

    const ordered = line.match(/^\s*(\d+)[.)]\s+(.+)$/)
    const unordered = line.match(/^\s*([-*•●◦○])\s+(.+)$/)
    if (ordered || unordered) {
      flushParagraph(index)
      const nextMode = ordered ? 'ol' : 'ul'
      if (listMode && listMode !== nextMode) flushList(index)
      if (!listMode) {
        listMode = nextMode
        listStart = ordered ? Number(ordered[1]) || 1 : 1
      }
      listItems.push((ordered ? ordered[2] : unordered[2]).trim())
      return
    }

    if (listMode) flushList(index)

    const h3 = line.match(/^###\s+(.+)/)
    const h2 = line.match(/^##\s+(.+)/)
    const h1 = line.match(/^#\s+(.+)/)
    if (h1 || h2 || h3) {
      flushParagraph(index)
      flushList(index)
      const headingText = (h1?.[1] || h2?.[1] || h3?.[1] || '').trim()
      const className = h1 ? 'rich-h1' : h2 ? 'rich-h2' : 'rich-h3'
      blocks.push(
        <div className={className} key={`${keyPrefix}-h-${index}`}>
          {renderInlineRichText(headingText, `${keyPrefix}-h-${index}`)}
        </div>,
      )
      return
    }

    paraLines.push(line)
  })

  flushParagraph('last')
  flushList('last')
  return blocks
}

const INLINE_MEDIA_RE = /^\[\[(img|vid):(.+)\]\]$/
const MD_IMAGE_RE = /^!\[[^\]]*]\(([^)]+)\)$/

function codeLineScore(line) {
  const trimmed = (line || '').trim()
  if (!trimmed) return 0
  let score = 0

  if (/^<\/?[a-zA-Z][\w:-]*[^>]*>$/.test(trimmed) || /^<!doctype/i.test(trimmed)) score += 3
  if (/^<([a-zA-Z][\w:-]*)\b[^>]*>.*<\/\1>$/.test(trimmed)) score += 3
  if (/^(import|export|const|let|var|function|class|return|def)\b/.test(trimmed)) score += 3
  if (/^(if|for|while|switch)\s*\(/.test(trimmed)) score += 3
  if (/=>|[{}()[\]]/.test(trimmed)) score += 1
  if (/;\s*$/.test(trimmed)) score += 1
  if (/^\s*["'][^"']+["']\s*:\s*/.test(trimmed)) score += 2
  if (/^(\/\/|\/\*|\*\/)/.test(trimmed)) score += 2
  if (/^[\w.-]+\.(tf|tfvars|js|jsx|ts|tsx|py|java|go|rb|php|json|yml|yaml|xml|html|css|sh)\b/.test(trimmed)) score += 2
  if (/^[|`~\-_/\\]{2,}/.test(trimmed) || /[|`~]{2,}/.test(trimmed)) score += 2

  return score
}

function isCodeContinuationLine(line) {
  const trimmed = (line || '').trim()
  if (!trimmed) return true
  if (codeLineScore(line) >= 2) return true
  if (/^<\/?[a-zA-Z][\w:-]*[^>]*>/.test(trimmed)) return true
  if (/^<([a-zA-Z][\w:-]*)\b[^>]*>.*<\/\1>$/.test(trimmed)) return true
  if (/=>|[{()}[\];]/.test(trimmed)) return true
  return false
}

function splitMixedTextIntoBlocks(text) {
  const lines = (text || '').split('\n')
  const blocks = []
  let textBuffer = []

  const flushText = () => {
    const value = textBuffer.join('\n').trim()
    if (value) blocks.push({ type: 'text', value })
    textBuffer = []
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const score = codeLineScore(line)

    if (!line.trim() || score < 3) {
      // If this line starts with an HTML tag, treat it as an html block not plain text
      if (/^<(h[1-6]|div|p|ul|ol|section|article|blockquote|table|figure|span|strong|em|font|mark)\b/i.test(line.trim())) {
        flushText()
        blocks.push({ type: 'html', value: line })
        continue
      }
      textBuffer.push(line)
      continue
    }

    let j = i
    let nonEmptyCodeLines = 0
    let strongLineFound = false
    let totalScore = 0

    while (j < lines.length) {
      const current = lines[j]
      const currentScore = codeLineScore(current)
      if (!isCodeContinuationLine(current)) break
      if (!current.trim()) {
        j += 1
        continue
      }
      nonEmptyCodeLines += 1
      totalScore += currentScore
      if (currentScore >= 4) strongLineFound = true
      j += 1
    }

    const avgScore = nonEmptyCodeLines ? totalScore / nonEmptyCodeLines : 0
    const shouldTreatAsCode =
      nonEmptyCodeLines >= 2
        ? strongLineFound || avgScore >= 2.8
        : nonEmptyCodeLines === 1 && strongLineFound
    if (!shouldTreatAsCode) {
      textBuffer.push(line)
      continue
    }

    flushText()
    const code = lines.slice(i, j).join('\n').trimEnd()
    if (code) blocks.push({ type: 'code', lang: 'auto', code })
    i = j - 1
  }

  flushText()
  return blocks
}

function parseContentBlocks(content) {
  if (isLikelyHtmlContent(content)) {
    return [{ type: 'html', value: sanitizePublishedHtml(content) }]
  }

  const lines = (content || '').split('\n')
  const blocks = []
  let textBuffer = []

  const flushText = () => {
    const text = textBuffer.join('\n')
    splitMixedTextIntoBlocks(text).forEach((block) => blocks.push(block))
    textBuffer = []
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const trimmed = line.trim()

    if (trimmed.toLowerCase().startsWith('codestart')) {
      flushText()
      const lang = trimmed.slice('codestart'.length).trim().toLowerCase() || 'auto'
      const codeLines = []
      i += 1
      while (i < lines.length && lines[i].trim().toLowerCase() !== 'codeend') {
        codeLines.push(lines[i])
        i += 1
      }
      const code = codeLines.join('\n').trimEnd()
      if (code) {
        blocks.push({ type: 'code', lang, code })
      }
      continue
    }

    if (trimmed.startsWith('```')) {
      flushText()
      const lang = trimmed.slice(3).trim().toLowerCase()
      const codeLines = []
      i += 1
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i])
        i += 1
      }
      const code = codeLines.join('\n').trim()
      if (code) {
        if (lang === 'mermaid') {
          blocks.push({ type: 'mermaid', code })
        } else {
          blocks.push({ type: 'code', lang: lang || 'text', code })
        }
      }
      continue
    }

    const match = trimmed.match(INLINE_MEDIA_RE)
    if (match) {
      flushText()
      blocks.push({ type: match[1] === 'img' ? 'image' : 'video', value: match[2].trim() })
    } else if (MD_IMAGE_RE.test(trimmed)) {
      flushText()
      const mdSrc = trimmed.match(MD_IMAGE_RE)?.[1]?.trim() || ''
      if (mdSrc) {
        const isVideo = /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(mdSrc)
        blocks.push({ type: isVideo ? 'video' : 'image', value: mdSrc })
      }
    } else {
      textBuffer.push(line)
    }
  }
  flushText()
  return blocks
}

function deriveCoverMedia(content) {
  if (isLikelyHtmlContent(content)) {
    const source = String(content || '')
    const img = source.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i)?.[1]
    if (img) {
      return {
        mediaType: 'image',
        mediaUrl: img.startsWith('media/') ? null : img,
        mediaPath: img.startsWith('media/') ? img : null,
      }
    }
    const vid =
      source.match(/<video[^>]+src=["']([^"']+)["'][^>]*>/i)?.[1] ||
      source.match(/<source[^>]+src=["']([^"']+)["'][^>]*>/i)?.[1]
    if (vid) {
      return {
        mediaType: 'video',
        mediaUrl: vid.startsWith('media/') ? null : vid,
        mediaPath: vid.startsWith('media/') ? vid : null,
      }
    }
    return { mediaType: null, mediaUrl: null, mediaPath: null }
  }

  const firstMedia = parseContentBlocks(content).find(
    (block) => block.type === 'image' || block.type === 'video',
  )
  if (!firstMedia) {
    return { mediaType: null, mediaUrl: null, mediaPath: null }
  }
  const isPath = firstMedia.value.startsWith('media/')
  return {
    mediaType: firstMedia.type === 'image' ? 'image' : 'video',
    mediaUrl: isPath ? null : firstMedia.value,
    mediaPath: isPath ? firstMedia.value : null,
  }
}

function stripReadableText(content) {
  if (isLikelyHtmlContent(content)) {
    return String(content || '')
      .replace(/<pre[\s\S]*?<\/pre>/gi, ' ')
      .replace(/<code[\s\S]*?<\/code>/gi, ' ')
      .replace(/<img[^>]*>/gi, ' ')
      .replace(/<video[\s\S]*?<\/video>/gi, ' ')
      .replace(/<source[^>]*>/gi, ' ')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/(p|div|li|h1|h2|h3|h4|h5|h6)>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  }

  return (content || '')
    .replace(/\[\[(img|vid):.+?\]\]/g, ' ')
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```[^\n]*\n?/g, ' '))
    .replace(/^\s*codestart[^\n]*$/gim, ' ')
    .replace(/^\s*codeend\s*$/gim, ' ')
}

function estimateReadMinutes(content) {
  const words = stripReadableText(content)
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean).length
  return Math.max(1, Math.ceil(words / 220))
}

function skillMeta(level) {
  const normalized = String(level || '').toLowerCase()
  if (normalized === 'advanced') {
    return { label: 'Advanced', icon: '\u{1F534}', cls: 'skill-advanced' }
  }
  if (normalized === 'intermediate') {
    return { label: 'Intermediate', icon: '\u{1F7E1}', cls: 'skill-intermediate' }
  }
  return { label: 'Beginner friendly', icon: '\u{1F7E2}', cls: 'skill-beginner' }
}

function progressMeta(status) {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'mastered') return { label: 'Mastered', icon: '\u2B50', cls: 'progress-mastered' }
  if (normalized === 'revisit') return { label: 'Revisit', icon: '\u{1F516}', cls: 'progress-revisit' }
  return { label: 'Read', icon: '\u2705', cls: 'progress-read' }
}

function detectCodeRuntimeHint(lang, code) {
  const lower = String(lang || '').toLowerCase()
  const sample = String(code || '').trim()
  if (lower.includes('bash') || lower.includes('shell') || lower.includes('sh')) {
    return {
      windows: 'PowerShell: .\\script.ps1 or bash script.sh',
      linux: 'bash script.sh',
      mac: 'bash script.sh',
    }
  }
  if (lower.includes('python') || /^def\s+\w+\(/m.test(sample)) {
    return {
      windows: 'python main.py',
      linux: 'python3 main.py',
      mac: 'python3 main.py',
    }
  }
  if (lower.includes('javascript') || lower.includes('js') || /console\.log\(/.test(sample)) {
    return {
      windows: 'node app.js',
      linux: 'node app.js',
      mac: 'node app.js',
    }
  }
  if (lower.includes('typescript') || /\.ts\b/m.test(sample)) {
    return {
      windows: 'npx tsx app.ts',
      linux: 'npx tsx app.ts',
      mac: 'npx tsx app.ts',
    }
  }
  if (lower.includes('terraform') || /^provider\s+"/m.test(sample) || /^resource\s+"/m.test(sample)) {
    return {
      windows: 'terraform init && terraform plan',
      linux: 'terraform init && terraform plan',
      mac: 'terraform init && terraform plan',
    }
  }
  return null
}

function contentToSpeechText(content) {
  const plain = stripReadableText(content || '')
    .replace(/\s+/g, ' ')
    .trim()
  return plain
}

function isOwnedByCurrentUser(currentUser, record) {
  if (!currentUser || !record) return false
  const userId = String(currentUser.userId || '')
  const username = String(currentUser.username || '')
  const authorSub = String(record.authorSub || '')
  if (authorSub && (authorSub === userId || authorSub === username)) return true

  const owner = String(record.owner || '')
  if (!owner) return false
  const ownerParts = owner.split('::').filter(Boolean)
  const candidates = [owner, ...ownerParts]
  return candidates.some((value) => value === userId || value === username)
}

function isLikelyCode(text) {
  const sample = (text || '').trim()
  if (!sample) return false
  const lines = sample.split('\n')
  const signalPatterns = [
    /\b(import|export|const|let|var|function|class|return|await|async)\b/,
    /\b(def|public|private|void|if|else|for|while|try|catch)\b/,
    /\b(from\s+['"`].+['"`])\b/,
    /=>|[{()}[\];]/,
    /^\s*[.#]?[a-zA-Z0-9_-]+\s*:\s*.+$/m,
  ]

  const signalHits = signalPatterns.reduce(
    (count, re) => count + (re.test(sample) ? 1 : 0),
    0,
  )

  const punctuation = (sample.match(/[{}()[\];=<>]/g) || []).length
  const likelyByDensity = punctuation >= 5 && sample.length <= 500

  if (lines.length >= 2) {
    return signalHits >= 1 || likelyByDensity
  }

  return signalHits >= 2 || likelyByDensity
}

function App() {
  const [currentUser, setCurrentUser] = useState(null)
  const [userAttrs, setUserAttrs] = useState({ email: '', name: '' })

  const [posts, setPosts] = useState([])
  const [comments, setComments] = useState([])
  const [commentLikes, setCommentLikes] = useState([])
  const [postLikes, setPostLikes] = useState([])

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [showAuth, setShowAuth] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [pendingConfirmEmail, setPendingConfirmEmail] = useState('')
  const [authForm, setAuthForm] = useState({ username: '', email: '', password: '', code: '' })
  const [authError, setAuthError] = useState('')

  const [showProfile, setShowProfile] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [profileTab, setProfileTab] = useState('posts')
  const [showDeleteWarning, setShowDeleteWarning] = useState(false)
  const [deletionReason, setDeletionReason] = useState('')
  const [profileForm, setProfileForm] = useState({
    username: '', email: '', bio: '', avatarUrl: '', fullName: '', profession: '',
    linkedIn: '', yearsOfExperience: '', credlyUrl: ''
  })
  const [communityMessages, setCommunityMessages] = useState([])
  const [newMessageText, setNewMessageText] = useState('')
  const [newMessageSubject, setNewMessageSubject] = useState('')

  const [showComposer, setShowComposer] = useState(false)
  const [editingPostId, setEditingPostId] = useState(null)
  const [composerConfig, setComposerConfig] = useState({
    level: '', topic: ''
  })

  const [savingPost, setSavingPost] = useState(false)
  const [activePostId, setActivePostId] = useState(null)
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const [adminTab, setAdminTab] = useState('users')
  const [isAdmin, setIsAdmin] = useState(false)
  const [headerScrolled, setHeaderScrolled] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [readNotificationIds, setReadNotificationIds] = useState([])
  const [deletedNotificationIds, setDeletedNotificationIds] = useState([])
  const [savedPostIds, setSavedPostIds] = useState([])
  const [followedAuthorSubs, setFollowedAuthorSubs] = useState([])
  const [postProgressMap, setPostProgressMap] = useState({})
  const [postReactionMap, setPostReactionMap] = useState({})
  const [mediaUrlCache, setMediaUrlCache] = useState({})
  const [moderations, setModerations] = useState([])
  const [userProfiles, setUserProfiles] = useState([])
  const [currentUserProfile, setCurrentUserProfile] = useState(null)
  const [cognitoUsers, setCognitoUsers] = useState([])
  const mediaUrlCacheRef = useRef({})
  const notificationWrapRef = useRef(null)
  const profileMenuRef = useRef(null)
  const profileRef = useRef(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortMode, setSortMode] = useState('latest')
  const [toasts, setToasts] = useState([])
  const [theme, setTheme] = useState(() => localStorage.getItem('blog_theme_v2') || 'interactive-canvas')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('blog_theme_v2', theme)
  }, [theme])

  useEffect(() => {
    bootstrap()
  }, [])

  useEffect(() => {
    const onScroll = () => setHeaderScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const navigate = useCallback((rawPath, replace = false) => {
    let path = rawPath.replace(/\/+$/, '') || '/'

    // Unauthenticated route guard
    if (!currentUser && (path === '/admin-dashboard' || path === '/profile' || path.startsWith('/home'))) {
      path = '/'
    }

    // Admin-only route guard
    if (path === '/admin-dashboard' && !isAdmin) {
      path = '/'
    }

    if (replace) {
      window.history.replaceState({ path }, '', path)
    } else {
      window.history.pushState({ path }, '', path)
    }

    setShowProfileMenu(false)
    setShowNotifications(false)

    if (path === '/admin-dashboard') {
      setShowAdminPanel(true)
      setShowProfile(false)
      setShowComposer(false)
      setActivePostId(null)
    } else if (path === '/profile') {
      setShowProfile(true)
      setShowAdminPanel(false)
      setShowComposer(false)
      setActivePostId(null)
    } else {
      setShowAdminPanel(false)
      setShowProfile(false)
    }
  }, [currentUser, isAdmin])

  useEffect(() => {
    const handlePopState = (e) => {
      let path = window.location.pathname.replace(/\/+$/, '') || '/'

      if (!currentUser && (path === '/admin-dashboard' || path === '/profile' || path.startsWith('/home'))) {
        return navigate('/', true)
      }
      if (path === '/admin-dashboard' && !isAdmin) {
        return navigate('/', true)
      }

      if (path === '/admin-dashboard') {
        setShowAdminPanel(true)
        setShowProfile(false)
      } else if (path === '/profile') {
        setShowProfile(true)
        setShowAdminPanel(false)
      } else {
        setShowAdminPanel(false)
        setShowProfile(false)
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [currentUser, isAdmin, navigate])

  useEffect(() => {
    const postIdFromUrl = new URLSearchParams(window.location.search).get('post')
    if (postIdFromUrl) setActivePostId(postIdFromUrl)
  }, [])

  const fetchCognitoUsers = async () => {
    try {
      const res = await client.queries.listCognitoUsers({ limit: 60 })
      console.log('RAW COGNITO RESPONSE:', res)
      const data = res.data
      if (data && (data.usersJson || data.listCognitoUsers?.usersJson)) {
        const rawJson = data.usersJson || data.listCognitoUsers?.usersJson
        const parsed = JSON.parse(rawJson)
        const mapped = parsed.map((cUser) => {
          const getAttr = (name) => cUser.Attributes?.find((a) => a.Name === name)?.Value || ''
          return {
            sub: getAttr('sub') || cUser.Username,
            name: getAttr('name') || getAttr('preferred_username') || cUser.Username,
            email: getAttr('email'),
            status: cUser.UserStatus,
            createdAt: cUser.UserCreateDate || new Date().toISOString()
          }
        })

        const uniqueByEmail = new Map()
        for (const u of mapped) {
          const key = u.email || u.sub
          if (!uniqueByEmail.has(key)) {
            uniqueByEmail.set(key, u)
          } else {
            // Prefer confirmed users if duplicate
            if (u.status === 'CONFIRMED' && uniqueByEmail.get(key).status !== 'CONFIRMED') {
              uniqueByEmail.set(key, u)
            }
          }
        }

        setCognitoUsers(Array.from(uniqueByEmail.values()))
      }
    } catch (err) {
      console.warn('Failed to fetch Cognito users:', err)
      alert('Cognito List Error: ' + (err.message || JSON.stringify(err)))
    }
  }

  useEffect(() => {
    if (isAdmin) fetchCognitoUsers()
  }, [isAdmin])

  useEffect(() => {
    if (!currentUser) return
    setProfileForm((prev) => ({
      ...prev,
      username: userAttrs.name || '',
      email: userAttrs.email || '',
      fullName: currentUserProfile?.fullName || '',
      profession: currentUserProfile?.profession || '',
      linkedIn: currentUserProfile?.linkedIn || '',
      yearsOfExperience: currentUserProfile?.yearsOfExperience || '',
      bio: currentUserProfile?.bio || '',
      credlyUrl: currentUserProfile?.credlyUrl || '',
      devToToken: currentUserProfile?.devToToken || '',
      hashnodeToken: currentUserProfile?.hashnodeToken || '',
      mediumToken: currentUserProfile?.mediumToken || '',
      linkedInToken: currentUserProfile?.linkedInToken || '',
      linkedInMemberId: currentUserProfile?.linkedInMemberId || '',
      linkedInClientId: currentUserProfile?.linkedInClientId || '',
      linkedInClientSecret: currentUserProfile?.linkedInClientSecret || '',
    }))
  }, [currentUser, userAttrs, currentUserProfile])

  useEffect(() => {
    if (!currentUser) {
      setReadNotificationIds([])
      setDeletedNotificationIds([])
      setSavedPostIds([])
      setFollowedAuthorSubs([])
      setPostProgressMap({})
      setPostReactionMap({})
      return
    }
    setReadNotificationIds(
      JSON.parse(localStorage.getItem(`blog_notification_read_${currentUser.userId}`) || '[]'),
    )
    setDeletedNotificationIds(
      JSON.parse(localStorage.getItem(`blog_notification_deleted_${currentUser.userId}`) || '[]'),
    )
    setSavedPostIds(
      JSON.parse(localStorage.getItem(`blog_saved_posts_${currentUser.userId}`) || '[]'),
    )
    setFollowedAuthorSubs(
      JSON.parse(localStorage.getItem(`blog_followed_authors_${currentUser.userId}`) || '[]'),
    )
    setPostProgressMap(
      JSON.parse(localStorage.getItem(`blog_progress_${currentUser.userId}`) || '{}'),
    )
    setPostReactionMap(
      JSON.parse(localStorage.getItem(`blog_reactions_${currentUser.userId}`) || '{}'),
    )
  }, [currentUser])

  useEffect(() => {
    if (!showNotifications) return

    const handleOutsideClick = (event) => {
      if (notificationWrapRef.current?.contains(event.target)) return
      setShowNotifications(false)
    }

    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('touchstart', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('touchstart', handleOutsideClick)
    }
  }, [showNotifications])

  useEffect(() => {
    if (!showProfileMenu) return

    const handleOutsideClick = (event) => {
      if (profileMenuRef.current?.contains(event.target)) return
      setShowProfileMenu(false)
    }

    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('touchstart', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('touchstart', handleOutsideClick)
    }
  }, [showProfileMenu])

  useEffect(() => {
    if (!showProfile) return

    const handleOutsideClick = (event) => {
      if (profileRef.current?.contains(event.target)) return
      if (event.target.closest('.profile-menu-wrap')) return
      setShowProfile(false)
    }

    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('touchstart', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('touchstart', handleOutsideClick)
    }
  }, [showProfile])

  useEffect(() => {
    mediaUrlCacheRef.current = mediaUrlCache
  }, [mediaUrlCache])

  const passwordScore = useMemo(() => {
    const p = authForm.password || ''
    let score = 0
    if (p.length >= 8) score += 1
    if (/[A-Z]/.test(p)) score += 1
    if (/[0-9]/.test(p)) score += 1
    if (/[^A-Za-z0-9]/.test(p)) score += 1
    return score
  }, [authForm.password])

  const commentsByPost = useMemo(() => {
    const grouped = {}
    comments.forEach((c) => {
      if (!grouped[c.postId]) grouped[c.postId] = []
      grouped[c.postId].push(c)
    })
    Object.values(grouped).forEach((arr) => {
      arr.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
    })
    return grouped
  }, [comments])

  const commentLikeMap = useMemo(() => {
    const grouped = {}
    commentLikes.forEach((l) => {
      if (!grouped[l.commentId]) grouped[l.commentId] = []
      grouped[l.commentId].push(l.likerSub)
    })
    return grouped
  }, [commentLikes])

  const postLikeMap = useMemo(() => {
    const grouped = {}
    postLikes.forEach((l) => {
      if (!grouped[l.postId]) grouped[l.postId] = []
      grouped[l.postId].push(l.likerSub)
    })
    return grouped
  }, [postLikes])

  const allDisplayPosts = useMemo(
    () =>
      posts.map((post) => ({
        ...post,
        likes: postLikeMap[post.id] || [],
        comments: (commentsByPost[post.id] || []).map((comment) => ({
          ...comment,
          likes: commentLikeMap[comment.id] || [],
        })),
      })),
    [posts, commentsByPost, commentLikeMap, postLikeMap],
  )

  const blockedUserSubs = useMemo(
    () => new Set(moderations.filter((m) => m.blocked).map((m) => m.userSub)),
    [moderations],
  )

  const visiblePosts = useMemo(
    () => allDisplayPosts.filter((post) => isAdmin || !post.hidden),
    [allDisplayPosts, isAdmin],
  )

  const displayPosts = useMemo(() => {
    const ordered = [...visiblePosts]
    if (sortMode === 'mostLiked') {
      ordered.sort((a, b) => b.likes.length - a.likes.length)
    } else if (sortMode === 'mostCommented') {
      ordered.sort((a, b) => b.comments.length - a.comments.length)
    } else {
      ordered.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
    }

    const query = searchQuery.trim().toLowerCase()
    if (!query) return ordered
    return ordered.filter((post) => {
      const haystack = `${post.title} ${post.content} ${post.authorName}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [visiblePosts, sortMode, searchQuery])

  const progressStats = useMemo(() => {
    const total = visiblePosts.length
    const read = visiblePosts.filter((p) => postProgressMap[p.id] === 'read').length
    const revisit = visiblePosts.filter((p) => postProgressMap[p.id] === 'revisit').length
    const mastered = visiblePosts.filter((p) => postProgressMap[p.id] === 'mastered').length
    return { total, read, revisit, mastered }
  }, [visiblePosts, postProgressMap])

  const editingPost = useMemo(
    () => allDisplayPosts.find((post) => post.id === editingPostId) || null,
    [allDisplayPosts, editingPostId],
  )

  const activePost = useMemo(
    () => visiblePosts.find((post) => post.id === activePostId) || null,
    [visiblePosts, activePostId],
  )

  const displayName =
    userAttrs.name ||
    (userAttrs.email ? toTitleCaseName(userAttrs.email.split('@')[0].replace(/[._-]+/g, ' ')) : '') ||
    (currentUser?.username && !/^google[_-]/i.test(currentUser.username) ? currentUser.username : '') ||
    'User'
  const postLikeNotifications = useMemo(() => {
    if (!currentUser) return []
    const myPostIds = new Set(
      posts.filter((post) => post.authorSub === currentUser.userId).map((post) => post.id),
    )
    if (!myPostIds.size) return []

    const postById = Object.fromEntries(posts.map((post) => [post.id, post]))
    return postLikes
      .filter((like) => myPostIds.has(like.postId) && like.likerSub !== currentUser.userId)
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .map((like) => ({
        id: like.id,
        createdAt: like.createdAt || '',
        text: `${like.likerName || 'Someone'} liked your post "${postById[like.postId]?.title || 'Untitled'}"`,
        postId: like.postId,
        targetType: 'post-like',
      }))
  }, [currentUser, posts, postLikes])

  const commentLikeNotifications = useMemo(() => {
    if (!currentUser) return []
    const myCommentIds = new Set(
      comments
        .filter((comment) => comment.authorSub === currentUser.userId)
        .map((comment) => comment.id),
    )
    if (!myCommentIds.size) return []
    const commentById = Object.fromEntries(comments.map((comment) => [comment.id, comment]))
    const postById = Object.fromEntries(posts.map((post) => [post.id, post]))
    return commentLikes
      .filter((like) => myCommentIds.has(like.commentId) && like.likerSub !== currentUser.userId)
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .map((like) => {
        const comment = commentById[like.commentId]
        return {
          id: `comment-like-${like.id}`,
          createdAt: like.createdAt || '',
          text: `${like.likerSub || 'Someone'} reacted to your comment on "${postById[comment?.postId]?.title || 'Untitled'}"`,
          postId: comment?.postId || '',
          commentId: like.commentId,
          targetType: 'comment-like',
        }
      })
  }, [currentUser, comments, posts, commentLikes])

  const commentNotifications = useMemo(() => {
    if (!currentUser) return []
    const myPostIds = new Set(
      posts.filter((post) => post.authorSub === currentUser.userId).map((post) => post.id),
    )
    if (!myPostIds.size) return []

    const postById = Object.fromEntries(posts.map((post) => [post.id, post]))
    return comments
      .filter(
        (comment) =>
          myPostIds.has(comment.postId) &&
          comment.authorSub !== currentUser.userId,
      )
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .map((comment) => ({
        id: `comment-${comment.id}`,
        createdAt: comment.createdAt || '',
        text: `${comment.authorName || 'Someone'} commented on "${postById[comment.postId]?.title || 'Untitled'}"`,
        postId: comment.postId,
        commentId: comment.id,
        targetType: 'comment',
      }))
  }, [currentUser, posts, comments])

  const followedAuthorNotifications = useMemo(() => {
    if (!currentUser || !followedAuthorSubs.length) return []
    const followed = new Set(followedAuthorSubs)
    return posts
      .filter(
        (post) =>
          followed.has(post.authorSub) &&
          post.authorSub !== currentUser.userId,
      )
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 25)
      .map((post) => ({
        id: `follow-post-${post.id}`,
        createdAt: post.createdAt || '',
        text: `${post.authorName || 'Author'} published "${post.title || 'Untitled'}"`,
        postId: post.id,
        targetType: 'followed-author-post',
      }))
  }, [currentUser, followedAuthorSubs, posts])

  const notifications = useMemo(
    () =>
      [...postLikeNotifications, ...commentLikeNotifications, ...commentNotifications, ...followedAuthorNotifications].sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
      ),
    [postLikeNotifications, commentLikeNotifications, commentNotifications, followedAuthorNotifications],
  )

  const userBadgesBySub = useMemo(() => {
    const badgesMap = new Map()
    const postsBySub = new Map()
    const likesBySub = new Map()

    posts.forEach((p) => {
      postsBySub.set(p.authorSub, (postsBySub.get(p.authorSub) || 0) + 1)
      likesBySub.set(p.authorSub, (likesBySub.get(p.authorSub) || 0) + (p.likes?.length || 0))
    })

    postsBySub.forEach((count, sub) => {
      const badges = []
      if (count >= 5) badges.push({ id: 'prolific', label: 'Prolific Writer', icon: '✍️' })
      if ((likesBySub.get(sub) || 0) >= 50) badges.push({ id: 'top', label: 'Top Contributor', icon: '🎯' })
      if (badges.length > 0) badgesMap.set(sub, badges)
    })

    return badgesMap
  }, [posts])

  const visibleNotifications = useMemo(
    () => notifications.filter((n) => !deletedNotificationIds.includes(n.id)),
    [notifications, deletedNotificationIds],
  )

  const unreadNotificationCount = useMemo(() => {
    return visibleNotifications.filter((n) => !readNotificationIds.includes(n.id)).length
  }, [visibleNotifications, readNotificationIds])

  const { registeredUsers, activeUsers } = useMemo(() => {
    const activeMap = new Map()
    const upsertActive = (sub, name, email = '') => {
      if (!sub) return
      const prev = activeMap.get(sub) || { sub, name: sub, email: '' }
      activeMap.set(sub, {
        sub,
        name: name || prev.name || sub,
        email: email || prev.email || '',
      })
    }
    posts.forEach((p) => upsertActive(p.authorSub, p.authorName || p.authorSub))
    comments.forEach((c) => upsertActive(c.authorSub, c.authorName || c.authorSub))
    postLikes.forEach((l) => upsertActive(l.likerSub, l.likerName || l.likerSub))

    const regMap = new Map()
    userProfiles.forEach((p) => {
      regMap.set(p.userSub, { sub: p.userSub, name: p.name, email: p.email })
    })

    if (currentUser?.userId) {
      const fallbackEmail = String(currentUser?.username || '').includes('@') ? currentUser.username : ''
      const meName = displayName || currentUser.userId
      const meEmail = userAttrs.email || fallbackEmail
      upsertActive(currentUser.userId, meName, meEmail)
      if (!regMap.has(currentUser.userId)) {
        regMap.set(currentUser.userId, { sub: currentUser.userId, name: meName, email: meEmail })
      }
    }

    return {
      registeredUsers: Array.from(regMap.values()),
      activeUsers: Array.from(activeMap.values()),
    }
  }, [posts, comments, postLikes, userProfiles, currentUser, displayName, userAttrs.email])

  const activeUsersByDay = useMemo(() => {
    const dayMap = new Map()
    const collect = (sub, createdAt) => {
      if (!sub || !createdAt) return
      const day = String(createdAt).slice(0, 10)
      if (!dayMap.has(day)) dayMap.set(day, new Set())
      dayMap.get(day).add(sub)
    }
    posts.forEach((p) => collect(p.authorSub, p.createdAt))
    comments.forEach((c) => collect(c.authorSub, c.createdAt))
    postLikes.forEach((l) => collect(l.likerSub, l.createdAt))
    return [...dayMap.entries()]
      .map(([day, users]) => ({ day, users: users.size }))
      .sort((a, b) => (a.day < b.day ? 1 : -1))
      .slice(0, 14)
  }, [posts, comments, postLikes])

  const showToast = useCallback((msg) => {
    const id = Date.now().toString(36)
    setToasts((prev) => [...prev, { id, msg }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 2500)
  }, [])

  async function bootstrap() {
    setLoading(true)
    try {
      const user = await getCurrentUser()
      const attrs = await fetchUserAttributes()
      const session = await fetchAuthSession()
      const groups = Array.isArray(session?.tokens?.idToken?.payload?.['cognito:groups'])
        ? session.tokens.idToken.payload['cognito:groups']
        : []
      const email = String(attrs?.email || '').toLowerCase()
      const adminByGroup = groups.includes('ADMINS')
      const adminByEmail = ADMIN_EMAILS.includes(email)
      setIsAdmin(adminByGroup || adminByEmail)
      const friendlyName = deriveFriendlyUserName(user, attrs)
      setCurrentUser(user)
      setUserAttrs({
        email: attrs.email || '',
        name: friendlyName,
      })

      try {
        if (client.models.UserProfile) {
          const { data: profiles } = await client.models.UserProfile.list({ filter: { userSub: { eq: user.userId } } })
          if (profiles && profiles.length > 0) {
            setCurrentUserProfile(profiles[0])
            await client.models.UserProfile.update({ id: profiles[0].id, name: friendlyName, email })
          } else {
            const created = await client.models.UserProfile.create({ userSub: user.userId, name: friendlyName, email })
            setCurrentUserProfile(created.data)
          }
        }
      } catch (err) {
        console.error('Failed to sync UserProfile', err)
      }

      await refreshData(false, 'userPool')

      const initialPath = window.location.pathname.replace(/\/+$/, '') || '/'
      if (initialPath === '/admin-dashboard') {
        if (adminByGroup || adminByEmail) {
          setShowAdminPanel(true)
        } else {
          navigate('/', true)
        }
      } else if (initialPath === '/profile') {
        setShowProfile(true)
      } else if (initialPath === '/' || initialPath === '') {
        navigate('/', true)
      }

    } catch {
      setCurrentUser(null)
      setUserAttrs({ email: '', name: '' })
      setIsAdmin(false)
      setModerations([])
      await refreshData(false, 'apiKey')

      let path = window.location.pathname.replace(/\/+$/, '') || '/'
      if (path === '/admin-dashboard' || path === '/profile' || path.startsWith('/home')) {
        navigate('/', true)
      } else if (path === '/' || path === '') {
        navigate('/', true)
      }
    } finally {
      setLoading(false)
    }
  }

  async function refreshData(withSpinner = true, authModeOverride = null) {
    if (withSpinner) setRefreshing(true)
    const readAuthMode = authModeOverride || (currentUser ? 'userPool' : 'apiKey')
    try {
      const [postRes, commentRes, commentLikeRes, postLikeRes, messageRes] = await Promise.all([
        client.models.Post.list({ authMode: readAuthMode }),
        client.models.Comment.list({ authMode: readAuthMode }),
        client.models.CommentLike.list({ authMode: readAuthMode }),
        client.models.PostLike.list({ authMode: readAuthMode }),
        (readAuthMode === 'userPool' && client.models.CommunityMessage) ? client.models.CommunityMessage.list({ authMode: 'userPool' }) : { data: [] }
      ])

      if (postRes.errors?.length || commentRes.errors?.length || commentLikeRes.errors?.length || postLikeRes.errors?.length) {
        throw new Error('Failed to fetch backend records.')
      }

      const cacheSnapshot = mediaUrlCacheRef.current
      const hydratedPosts = postRes.data.map((post) => {
        const cachedUrl = post.mediaPath ? cacheSnapshot[post.mediaPath] : ''
        return cachedUrl ? { ...post, mediaUrl: cachedUrl } : post
      })

      // Render text and metadata immediately, then resolve media in background.
      setPosts(hydratedPosts)
      setComments(commentRes.data)
      setCommentLikes(commentLikeRes.data)
      setPostLikes(postLikeRes.data)
      if (messageRes?.data) setCommunityMessages(messageRes.data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))

      if (readAuthMode === 'userPool' && isAdmin) {
        try {
          const [moderationRes, profilesRes] = await Promise.all([
            client.models.UserModeration?.list({ authMode: 'userPool' }) || { data: [] },
            client.models.UserProfile?.list({ authMode: 'userPool' }) || { data: [] },
          ])
          if (!moderationRes.errors?.length) setModerations(moderationRes.data || [])
          if (!profilesRes.errors?.length) setUserProfiles(profilesRes.data || [])
        } catch {
          setModerations([])
          setUserProfiles([])
        }
      } else if (!isAdmin) {
        setModerations([])
        setUserProfiles([])
      }

      const missingPaths = new Set()
      hydratedPosts.forEach((post) => {
        if (post.mediaPath && !cacheSnapshot[post.mediaPath]) missingPaths.add(post.mediaPath)
      })

      const inlinePaths = new Set()
      hydratedPosts.forEach((post) => {
        parseContentBlocks(post.content).forEach((block) => {
          if (
            (block.type === 'image' || block.type === 'video') &&
            block.value.startsWith('media/') &&
            !cacheSnapshot[block.value]
          ) {
            inlinePaths.add(block.value)
          }
        })
      })

      const allMissing = [...missingPaths, ...inlinePaths]
      if (allMissing.length) {
        const resolved = await Promise.all(
          allMissing.map(async (path) => {
            try {
              const urlOut = await getUrl({ path })
              return [path, urlOut.url.toString()]
            } catch {
              return null
            }
          }),
        )
        const additions = Object.fromEntries(resolved.filter(Boolean))
        if (Object.keys(additions).length) {
          setMediaUrlCache((prev) => ({ ...prev, ...additions }))
        }
      }
    } catch (err) {
      console.error(err)
      if (readAuthMode === 'apiKey') {
        setPosts([])
        setComments([])
        setCommentLikes([])
        setPostLikes([])
      } else {
        alert('Could not refresh data from backend.')
      }
    } finally {
      if (withSpinner) setRefreshing(false)
    }
  }

  const resolveMediaSource = useCallback(
    (source) => (source?.startsWith('media/') ? mediaUrlCache[source] || '' : source || ''),
    [mediaUrlCache],
  )

  function ensureAuth() {
    if (!currentUser) {
      setShowAuth(true)
      return false
    }
    if (blockedUserSubs.has(currentUser.userId)) {
      alert('Your account is blocked. Please contact admin.')
      return false
    }
    return true
  }

  function markNotificationsSeen() {
    if (!currentUser || !visibleNotifications.length) return
    const allIds = visibleNotifications.map((n) => n.id)
    const merged = Array.from(new Set([...readNotificationIds, ...allIds]))
    setReadNotificationIds(merged)
    localStorage.setItem(`blog_notification_read_${currentUser.userId}`, JSON.stringify(merged))
  }

  function markOneNotificationRead(id) {
    if (!currentUser || readNotificationIds.includes(id)) return
    const merged = [...readNotificationIds, id]
    setReadNotificationIds(merged)
    localStorage.setItem(`blog_notification_read_${currentUser.userId}`, JSON.stringify(merged))
  }

  function deleteNotification(id) {
    if (!currentUser) return
    const merged = Array.from(new Set([...deletedNotificationIds, id]))
    setDeletedNotificationIds(merged)
    localStorage.setItem(
      `blog_notification_deleted_${currentUser.userId}`,
      JSON.stringify(merged),
    )
  }

  function toggleSavePost(postId) {
    if (!ensureAuth()) return
    const exists = savedPostIds.includes(postId)
    const next = exists
      ? savedPostIds.filter((id) => id !== postId)
      : [...savedPostIds, postId]
    setSavedPostIds(next)
    localStorage.setItem(`blog_saved_posts_${currentUser.userId}`, JSON.stringify(next))
  }

  function setPostProgress(postId, status) {
    if (!ensureAuth()) return
    const normalized = String(status || '').toLowerCase()
    if (!['read', 'revisit', 'mastered'].includes(normalized)) return
    const next = { ...postProgressMap, [postId]: normalized }
    setPostProgressMap(next)
    localStorage.setItem(`blog_progress_${currentUser.userId}`, JSON.stringify(next))
  }

  const setPostReaction = (postId, reactionCode) => {
    if (!ensureAuth()) return
    const normalized = String(reactionCode || '').toLowerCase()
    if (!['confusing', 'aha', 'useful'].includes(normalized)) return

    setPostReactionMap((prev) => {
      const next = { ...prev, [postId]: reactionCode }
      try {
        localStorage.setItem(`blog_reactions_${currentUser?.userId || 'guest'}`, JSON.stringify(next))
      } catch {
        // no-op
      }
      return next
    })

    // Provide fun visual feedback
    const msgs = {
      confusing: '🤯 Thanks for the feedback! We\'ll try to make it clearer.',
      aha: '💡 Awesome! Glad it clicked for you.',
      useful: '🔥 Fantastic! Thanks for reading.'
    }
    showToast(msgs[reactionCode] || 'Feedback received.')
  }

  function toggleFollowAuthor(authorSub) {
    if (!ensureAuth() || !authorSub || authorSub === currentUser?.userId) return
    const exists = followedAuthorSubs.includes(authorSub)
    const next = exists
      ? followedAuthorSubs.filter((id) => id !== authorSub)
      : [...followedAuthorSubs, authorSub]
    setFollowedAuthorSubs(next)
    localStorage.setItem(`blog_followed_authors_${currentUser.userId}`, JSON.stringify(next))
  }

  function setPostQueryParam(postId) {
    const url = new URL(window.location.href)
    if (postId) {
      url.searchParams.set('post', postId)
    } else {
      url.searchParams.delete('post')
    }
    window.history.replaceState({}, '', url.toString())
  }

  function openNotificationTarget(notification) {
    if (!notification) return
    if (notification.postId) {
      setActivePostId(notification.postId)
      setPostQueryParam(notification.postId)
      setShowComposer(false)
      setEditingPostId(null)
      setShowProfile(false)
      setShowAdminPanel(false)
      setShowNotifications(false)
      if (notification.commentId) {
        setTimeout(() => {
          const el = document.getElementById(`comment-${notification.commentId}`)
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 120)
      }
      return
    }
    navigate('/')
  }

  function goHomeView() {
    navigate('/')
  }

  const handleAuthSubmit = async (e) => {
    e.preventDefault()
    setAuthError('')

    try {
      if (authMode === 'signup') {
        const email = authForm.email.trim().toLowerCase()
        const password = authForm.password
        const username = authForm.username.trim()

        if (!email || !password || !username) {
          setAuthError('Please fill all required fields.')
          return
        }

        const out = await signUp({
          username: email,
          password,
          options: {
            userAttributes: {
              email,
              name: username,
            },
          },
        })

        if (out.nextStep?.signUpStep === 'CONFIRM_SIGN_UP') {
          setPendingConfirmEmail(email)
          setAuthMode('confirm')
          return
        }

        setAuthMode('login')
        return
      }

      if (authMode === 'confirm') {
        await confirmSignUp({
          username: pendingConfirmEmail,
          confirmationCode: authForm.code.trim(),
        })
        setAuthMode('login')
        setAuthError('Account confirmed. Please login.')
        return
      }

      await signIn({
        username: authForm.email.trim().toLowerCase(),
        password: authForm.password,
      })

      setShowAuth(false)
      setAuthForm({ username: '', email: '', password: '', code: '' })
      await bootstrap()
    } catch (err) {
      setAuthError(err?.message || 'Authentication failed.')
    }
  }

  const handleLogout = async () => {
    await signOut()
    setCurrentUser(null)
    setIsAdmin(false)
    setModerations([])
    setUserAttrs({ email: '', name: '' })
    setPosts([])
    setComments([])
    setCommentLikes([])
    setPostLikes([])
    setActivePostId(null)
    setPostQueryParam('')
    setShowProfile(false)
    setShowComposer(false)
    setShowAdminPanel(false)
    setEditingPostId(null)
    setShowNotifications(false)
  }

  const handleGoogleLogin = async () => {
    try {
      await signInWithRedirect({ provider: 'Google' })
    } catch (err) {
      console.error(err)
      setAuthError('Could not start Google login.')
    }
  }

  const saveProfile = async (e) => {
    e.preventDefault()
    if (!ensureAuth()) return

    const nextName = profileForm.username.trim()
    const nextEmail = profileForm.email.trim().toLowerCase()

    if (!nextName || !nextEmail) return

    try {
      await updateUserAttributes({
        userAttributes: {
          name: nextName,
          email: nextEmail,
        },
      })

      const myPosts = posts.filter((p) => p.authorSub === currentUser.userId)
      const myComments = comments.filter((c) => c.authorSub === currentUser.userId)

      await Promise.all(
        myPosts.map((post) => client.models.Post.update({ id: post.id, authorName: nextName })),
      )
      await Promise.all(
        myComments.map((comment) =>
          client.models.Comment.update({ id: comment.id, authorName: nextName }),
        ),
      )

      if (currentUserProfile) {
        const up = await client.models.UserProfile.update({
          id: currentUserProfile.id,
          name: nextName,
          email: nextEmail,
          fullName: profileForm.fullName || '',
          profession: profileForm.profession || '',
          linkedIn: profileForm.linkedIn || '',
          yearsOfExperience: Number(profileForm.yearsOfExperience) || 0,
          bio: profileForm.bio || '',
          credlyUrl: profileForm.credlyUrl || '',
          devToToken: profileForm.devToToken || '',
          hashnodeToken: profileForm.hashnodeToken || '',
          mediumToken: profileForm.mediumToken || '',
          linkedInToken: profileForm.linkedInToken || '',
          linkedInMemberId: profileForm.linkedInMemberId || '',
          linkedInClientId: profileForm.linkedInClientId || '',
          linkedInClientSecret: profileForm.linkedInClientSecret || '',
        })
        setCurrentUserProfile(up.data)
      }

      setUserAttrs((prev) => ({ ...prev, name: nextName, email: nextEmail }))
      setShowProfile(false)
      await refreshData()
    } catch (err) {
      console.error(err)
      alert('Could not update profile.')
    }
  }

  const requestDeletion = async () => {
    if (!ensureAuth()) return
    try {
      const { data: profiles } = await client.models.UserProfile.list({ filter: { userSub: { eq: currentUser.userId } } })
      if (profiles && profiles.length > 0) {
        await client.models.UserProfile.update({ id: profiles[0].id, deleteRequested: true })
      } else {
        await client.models.UserProfile.create({ userSub: currentUser.userId, name: displayName, email: userAttrs.email, deleteRequested: true })
      }

      const postCount = posts.filter((p) => p.authorSub === currentUser.userId).length
      const commentCount = comments.filter((c) => c.authorSub === currentUser.userId).length
      const savedCount = savedPostIds.length

      await client.models.CommunityMessage.create({
        userSub: currentUser.userId,
        userName: displayName,
        subject: 'Account Deletion Request',
        text: `User ${userAttrs.email} has requested permanent account deletion. \nReason: ${deletionReason}`,
        status: 'OPEN'
      })

      setShowDeleteWarning(false)
      showToast('Account deletion requested. Support team has been notified.')

      try {
        await client.mutations.sendDeletionEmail({
          subject: 'Account Deletion Request',
          body: `I would like to request the permanent deletion of my account. Email: ${userAttrs.email}`,
          userEmail: userAttrs.email,
          reason: deletionReason || 'No reason provided by user.',
          postCount,
          commentCount,
          savedCount
        })
      } catch (emailErr) {
        console.error('Failed to dispatch SES email', emailErr)
      }

      await refreshData()
    } catch (err) {
      console.error(err)
      alert('Could not submit deletion request.')
    }
  }

  const submitCommunityMessage = async (e) => {
    e.preventDefault()
    if (!ensureAuth() || !newMessageSubject.trim() || !newMessageText.trim()) return
    try {
      await client.models.CommunityMessage.create({
        userSub: currentUser.userId,
        userName: displayName,
        subject: newMessageSubject.trim(),
        text: newMessageText.trim(),
        status: 'OPEN'
      })
      setNewMessageSubject('')
      setNewMessageText('')
      showToast('Message sent to admin!')
      await refreshData()
    } catch (err) {
      console.error(err)
      alert('Could not send message.')
    }
  }

  const replyToCommunityMessage = async (messageId, replyText) => {
    if (!isAdmin || !replyText.trim()) return
    try {
      await client.models.CommunityMessage.update({
        id: messageId,
        replyText: replyText.trim(),
        repliedAt: new Date().toISOString(),
        status: 'RESOLVED'
      })
      await refreshData()
    } catch (err) {
      console.error(err)
      alert('Could not send reply.')
    }
  }

  const uploadInlineMediaSource = async (file) => {
    const path = `media/${currentUser.userId}-${Date.now()}-${toStorageSafeName(file.name)}`

    await uploadData({
      path,
      data: file,
      options: { contentType: file.type || 'application/octet-stream' },
    }).result

    const urlOut = await getUrl({ path })
    setMediaUrlCache((prev) => ({ ...prev, [path]: urlOut.url.toString() }))
    return path
  }

  const createPost = async (payload) => {
    if (!ensureAuth()) return
    setSavingPost(true)

    try {
      const cover = deriveCoverMedia(payload.content)

      const out = await client.models.Post.create({
        title: payload.title,
        content: payload.content,
        skillLevel: payload.skillLevel || 'beginner',
        tldr: payload.tldr || '',
        beginnerSummary: payload.beginnerSummary || '',
        proSummary: payload.proSummary || '',
        whyMatters: payload.whyMatters || '',
        commonMistakes: payload.commonMistakes || '',
        timeToPracticeMins: Number(payload.timeToPracticeMins) || 0,
        nextTopicTitle: payload.nextTopicTitle || '',
        nextTopicUrl: payload.nextTopicUrl || '',
        roadmapUrl: payload.roadmapUrl || '',
        versionLabel: payload.versionLabel || '',
        mediaType: cover.mediaType,
        mediaUrl: cover.mediaUrl,
        mediaPath: cover.mediaPath,
        level: composerConfig.level,
        topic: composerConfig.topic,
        authorSub: currentUser.userId,
        authorName: displayName,
      })

      if (out.errors?.length) throw new Error(out.errors[0].message)


      setShowComposer(false)
      await refreshData()
    } catch (err) {
      console.error(err)
      alert('Could not create post.')
    } finally {
      setSavingPost(false)
    }
  }

  const updatePost = async (payload) => {
    if (!editingPostId || !ensureAuth()) return
    setSavingPost(true)

    try {
      const cover = deriveCoverMedia(payload.content)

      const out = await client.models.Post.update({
        id: editingPostId,
        title: payload.title,
        content: payload.content,
        skillLevel: payload.skillLevel || 'beginner',
        tldr: payload.tldr || '',
        beginnerSummary: payload.beginnerSummary || '',
        proSummary: payload.proSummary || '',
        whyMatters: payload.whyMatters || '',
        commonMistakes: payload.commonMistakes || '',
        timeToPracticeMins: Number(payload.timeToPracticeMins) || 0,
        nextTopicTitle: payload.nextTopicTitle || '',
        nextTopicUrl: payload.nextTopicUrl || '',
        roadmapUrl: payload.roadmapUrl || '',
        versionLabel: payload.versionLabel || '',
        mediaType: cover.mediaType,
        mediaUrl: cover.mediaUrl,
        mediaPath: cover.mediaPath,
        level: composerConfig.level,
        topic: composerConfig.topic,
        authorName: displayName,
      })

      if (out.errors?.length) throw new Error(out.errors[0].message)

      setEditingPostId(null)
      setShowComposer(false)
      await refreshData()
    } catch (err) {
      console.error(err)
      alert('Could not update post.')
    } finally {
      setSavingPost(false)
    }
  }

  const deletePost = async (postId) => {
    if (!ensureAuth()) return

    try {
      const postComments = comments.filter((c) => c.postId === postId)
      const commentIds = new Set(postComments.map((c) => c.id))

      await Promise.all(
        commentLikes
          .filter((l) => commentIds.has(l.commentId))
          .map((l) => client.models.CommentLike.delete({ id: l.id }, { authMode: 'userPool' })),
      )

      await Promise.all(postComments.map((c) => client.models.Comment.delete({ id: c.id }, { authMode: 'userPool' })))
      await Promise.all(
        postLikes
          .filter((l) => l.postId === postId)
          .map((l) => client.models.PostLike.delete({ id: l.id }, { authMode: 'userPool' })),
      )

      await client.models.Post.delete({ id: postId }, { authMode: 'userPool' })

      if (activePostId === postId) {
        setActivePostId(null)
        setPostQueryParam('')
      }
      if (editingPostId === postId) {
        setEditingPostId(null)
        setShowComposer(false)
      }

      await refreshData()
    } catch (err) {
      console.error(err)
      alert('Could not delete post.')
    }
  }

  const togglePostHidden = async (postId, hidden) => {
    if (!ensureAuth() || !isAdmin) return
    try {
      await client.models.Post.update({
        id: postId,
        hidden,
        hiddenReason: hidden ? 'Hidden by admin' : null,
      })
      if (!hidden && activePostId === postId) {
        // keep active if already open; visibility restored
      }
      await refreshData(false)
    } catch (err) {
      console.error(err)
      alert('Could not update post visibility.')
    }
  }

  const setUserBlocked = async (userSub, blocked, reason = '') => {
    if (!ensureAuth() || !isAdmin || !userSub) return
    try {
      const existing = moderations.find((m) => m.userSub === userSub || m.id === userSub)
      if (existing) {
        await client.models.UserModeration.update({
          id: existing.id,
          blocked,
          reason,
          updatedBySub: currentUser.userId,
          updatedByName: displayName,
        })
      } else {
        await client.models.UserModeration.create({
          id: userSub,
          userSub,
          blocked,
          reason,
          updatedBySub: currentUser.userId,
          updatedByName: displayName,
        })
      }
      await refreshData(false)
    } catch (err) {
      console.error(err)
      alert('Could not update user block status.')
    }
  }

  const adminEditUser = async (user) => {
    alert(`Editing ${user.email || user.sub} requires the AdminUpdateUserAttributes IAM policy backend which is not yet deployed.`)
  }

  const adminDeleteUser = async (user) => {
    if (!isAdmin || !user?.sub) return
    const ok = window.confirm(`Are you sure you want to delete ${user.email}? This will SOFT delete the user by blocking them and anonymizing their posts.`)
    if (!ok) return
    adminResetAccount(user)
  }

  const adminTriggerPasswordReset = async (user) => {
    if (!ensureAuth() || !isAdmin) return
    const defaultEmail = (user?.email || '').trim()
    const input = window.prompt('Enter user email for password reset', defaultEmail)
    if (!input) return
    const email = input.trim().toLowerCase()
    if (!email.includes('@')) {
      alert('Valid email is required.')
      return
    }
    try {
      await resetPassword({ username: email })
      alert(`Password reset code sent to ${email}.`)
    } catch (err) {
      console.error(err)
      alert('Could not trigger password reset. Check email and Cognito setup.')
    }
  }

  const adminResetAccount = async (user) => {
    if (!ensureAuth() || !isAdmin || !user?.sub) return
    const ok = window.confirm(
      'Soft reset this account? This blocks user and anonymizes their display names on posts/comments.',
    )
    if (!ok) return
    try {
      await setUserBlocked(user.sub, true, 'Account reset by admin')

      const ownedPosts = posts.filter((p) => p.authorSub === user.sub)
      const ownedComments = comments.filter((c) => c.authorSub === user.sub)

      await Promise.allSettled(
        ownedPosts.map((p) =>
          client.models.Post.update({
            id: p.id,
            authorName: 'Reset User',
          }),
        ),
      )
      await Promise.allSettled(
        ownedComments.map((c) =>
          client.models.Comment.update({
            id: c.id,
            authorName: 'Reset User',
          }),
        ),
      )
      await refreshData(false)
      alert('Account reset completed.')
    } catch (err) {
      console.error(err)
      alert('Could not reset account.')
    }
  }

  const togglePostLike = async (postId) => {
    if (!ensureAuth()) return

    try {
      const existing = postLikes.find(
        (like) => like.postId === postId && like.likerSub === currentUser.userId,
      )

      if (existing) {
        await client.models.PostLike.delete({ id: existing.id })
      } else {
        await client.models.PostLike.create({
          postId,
          likerSub: currentUser.userId,
          likerName: displayName,
        })
      }

      await refreshData(false)
    } catch (err) {
      console.error(err)
      alert('Could not update post like.')
    }
  }

  const sharePost = async (post) => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?post=${post.id}`

    try {
      await navigator.clipboard.writeText(shareUrl)
      alert('Blog link copied to clipboard.')
    } catch {
      alert('Could not copy link. Please allow clipboard permission.')
    }
  }

  const addComment = async (postId, text) => {
    if (!ensureAuth() || !text.trim()) return

    try {
      await client.models.Comment.create({
        postId,
        text: text.trim(),
        authorSub: currentUser.userId,
        authorName: displayName,
      })
      await refreshData(false)
    } catch (err) {
      console.error(err)
      alert('Could not add comment.')
    }
  }

  const updateComment = async (postId, commentId, text) => {
    if (!ensureAuth() || !text.trim()) return

    try {
      const target = comments.find((comment) => comment.id === commentId)
      if (!isOwnedByCurrentUser(currentUser, target)) {
        alert('Only the comment owner can edit this comment.')
        return
      }
      const out = await client.graphql({
        authMode: 'userPool',
        query: /* GraphQL */ `
          mutation UpdateCommentText($id: ID!, $text: String!) {
            updateComment(input: { id: $id, text: $text }) {
              id
            }
          }
        `,
        variables: { id: commentId, text: text.trim() },
      })
      if (out?.errors?.length) throw new Error(out.errors[0].message)
      await refreshData(false)
    } catch (err) {
      console.error(err)
      alert(`Could not update comment. ${err?.message || ''}`)
    }
  }

  const deleteComment = async (postId, commentId) => {
    if (!ensureAuth()) return

    try {
      const target = comments.find((comment) => comment.id === commentId)
      if (!isAdmin && !isOwnedByCurrentUser(currentUser, target)) {
        alert('Only the comment owner or admin can delete this comment.')
        return
      }
      const out = await client.graphql({
        authMode: 'userPool',
        query: /* GraphQL */ `
          mutation DeleteCommentById($id: ID!) {
            deleteComment(input: { id: $id }) {
              id
            }
          }
        `,
        variables: { id: commentId },
      })
      if (out?.errors?.length) throw new Error(out.errors[0].message)
      // Best-effort cleanup for dangling likes; do not block owner delete on these.
      await Promise.allSettled(
        commentLikes
          .filter((like) => like.commentId === commentId)
          .map((like) => client.models.CommentLike.delete({ id: like.id }, { authMode: 'userPool' })),
      )
      await refreshData(false)
    } catch (err) {
      console.error(err)
      alert(`Could not delete comment. ${err?.message || ''}`)
    }
  }

  const toggleCommentLike = async (postId, commentId) => {
    if (!ensureAuth()) return

    try {
      const existing = commentLikes.find(
        (like) => like.commentId === commentId && like.likerSub === currentUser.userId,
      )

      if (existing) {
        await client.models.CommentLike.delete({ id: existing.id })
      } else {
        await client.models.CommentLike.create({
          commentId,
          likerSub: currentUser.userId,
        })
      }

      await refreshData(false)
    } catch (err) {
      console.error(err)
      alert('Could not update comment like.')
    }
  }

  if (loading) {
    return (
      <div className="page-shell">
        <header className="app-header scrolled">
          <div className="header-left">
            <div>
              <h1>Cloud Journey</h1>
            </div>
          </div>
        </header>
        <main className="content-shell">
          <section className="card">
            <h3>Loading application...</h3>
          </section>
        </main>
      </div>
    )
  }

  return (
    <div className="page-shell">
      <header className={`app-header ${headerScrolled ? 'scrolled' : ''}`}>
        <div className="header-left">
          <button className="header-home" onClick={goHomeView} aria-label="Go to home">
            <img className="brand-icon-image" src={cloudTechIcon} alt="Cloud tech icon" loading="eager" decoding="async" />
          </button>
          <div className="header-brand-text" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <h1 style={{ fontSize: '1.2rem', margin: 0, fontWeight: 800, letterSpacing: '-0.5px' }}>Cloud Journey</h1>
            <p className="brand-tagline" style={{ fontSize: '11px', margin: 0, opacity: 0.85, fontWeight: 500 }}>write.share.grow</p>
          </div>
        </div>

        <div className="header-right">
          {currentUser && (
            <>
              <button
                className="theme-toggle-btn"
                onClick={() => setTheme(theme === 'interactive-canvas' ? 'crazy' : 'interactive-canvas')}
              >
                {theme === 'interactive-canvas' ? '🌞' : '👾'}
              </button>

              <div className="notification-wrap" ref={notificationWrapRef}>
                <button
                  className="ghost notification-btn"
                  onClick={() => {
                    setShowNotifications((prev) => !prev)
                    setShowProfileMenu(false)
                  }}
                  aria-label="Notifications"
                >
                  <span className="notification-icon">{'\uD83D\uDD14'}</span>
                  {unreadNotificationCount > 0 ? (
                    <span className="notification-badge">
                      {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                    </span>
                  ) : null}
                </button>

                {showNotifications ? (
                  <div className="notification-panel" style={{ right: 0, left: 'auto', minWidth: '300px' }}>
                    <h4>Notifications</h4>
                    {visibleNotifications.length ? (
                      <>
                        <div className="notification-actions">
                          <button type="button" className="ghost" onClick={markNotificationsSeen}>
                            Mark all as read
                          </button>
                        </div>
                        <ul>
                          {visibleNotifications.slice(0, 20).map((item) => (
                            <li key={item.id}>
                              <p>{item.text}</p>
                              <small>{new Date(item.createdAt).toLocaleString()}</small>
                              <div className="notification-item-actions">
                                {item.postId ? (
                                  <button
                                    type="button"
                                    className="ghost"
                                    onClick={() => openNotificationTarget(item)}
                                  >
                                    Open
                                  </button>
                                ) : null}
                                {!readNotificationIds.includes(item.id) ? (
                                  <button
                                    type="button"
                                    className="ghost"
                                    onClick={() => markOneNotificationRead(item.id)}
                                  >
                                    Mark as read
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  className="ghost"
                                  onClick={() => deleteNotification(item.id)}
                                >
                                  Delete
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : (
                      <p className="notification-empty">No notifications yet.</p>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="profile-menu-wrap" ref={profileMenuRef} style={{ position: 'relative' }}>
                <button
                  className="username-btn"
                  onClick={() => {
                    if (showProfile) {
                      setShowProfile(false)
                      setShowProfileMenu(false)
                    } else {
                      setShowProfileMenu((prev) => !prev)
                    }
                    setShowNotifications(false)
                  }}
                >
                  <span className="username-full">{displayName}</span>
                  <span className="username-initial">{displayName ? displayName.charAt(0).toUpperCase() : ''}</span>
                </button>
                {showProfileMenu && (
                  <div className="notification-panel profile-menu-panel" style={{ width: '200px', right: 0, left: 'auto' }}>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <li><button className="ghost" style={{ width: '100%', textAlign: 'left', padding: '8px' }} onClick={() => { navigate('/profile'); setProfileTab('posts'); }}>My Posts</button></li>
                      <li><button className="ghost" style={{ width: '100%', textAlign: 'left', padding: '8px' }} onClick={() => { navigate('/profile'); setProfileTab('saved'); }}>Saved Articles</button></li>
                      <li><button className="ghost" style={{ width: '100%', textAlign: 'left', padding: '8px' }} onClick={() => { navigate('/profile'); setProfileTab('messages'); }}>Messages</button></li>
                      <li><button className="ghost" style={{ width: '100%', textAlign: 'left', padding: '8px' }} onClick={() => { navigate('/profile'); setProfileTab('settings'); }}>Settings</button></li>
                      {isAdmin && (
                        <>
                          <hr style={{ margin: '4px 0', border: 'none', borderTop: '1px solid var(--border)' }} />
                          <li><button className="ghost" style={{ width: '100%', textAlign: 'left', padding: '8px' }} onClick={() => navigate('/admin-dashboard')}>Admin Dashboard</button></li>
                        </>
                      )}
                      <hr style={{ margin: '4px 0', border: 'none', borderTop: '1px solid var(--border)' }} />
                      <li><button className="ghost" style={{ width: '100%', textAlign: 'left', padding: '8px', color: '#ef4444' }} onClick={handleLogout}>Logout</button></li>
                    </ul>
                  </div>
                )}
              </div>
            </>
          )}
          {!currentUser && (
            <>
              <button
                className="theme-toggle-btn"
                onClick={() => setTheme(theme === 'interactive-canvas' ? 'crazy' : 'interactive-canvas')}
              >
                {theme === 'interactive-canvas' ? '🌞' : '👾'}
              </button>
              <button
                className="ghost"
                onClick={() => setShowAuth(true)}
                style={{ padding: '0 12px', minHeight: '32px', height: '32px', borderRadius: '8px', fontWeight: 'bold' }}
              >
                Login
              </button>
            </>
          )}
        </div>
      </header>

      <main className="content-shell">
        {(!showProfile && !showAdminPanel) ? (
          <section className="toolbar floating-toolbar">
            <div className="discover-row">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title, content, author..."
              />
              <select value={sortMode} onChange={(e) => setSortMode(e.target.value)}>
                <option value="latest">Latest</option>
                <option value="mostLiked">Most liked</option>
                <option value="mostCommented">Most commented</option>
              </select>
              {currentUser ? (
                <button
                  className="cta-publish"
                  onClick={() => {
                    const next = !showComposer
                    setShowComposer(next)
                    if (next) {
                      setComposerConfig({ level: '', topic: '' })
                    }
                    setEditingPostId(null)
                    setActivePostId(null)
                    setPostQueryParam('')
                  }}
                >
                  {showComposer ? 'Close Editor' : 'Publish your blog'}
                </button>
              ) : (
                <button className="cta-publish" onClick={() => setShowAuth(true)}>
                  Login to Create Blog
                </button>
              )}
            </div>

            {currentUser ? (
              <div className="learning-progress-strip">
                <span>Completed: {progressStats.mastered}/{progressStats.total || 0}</span>
                <span>Read: {progressStats.read}</span>
                <span>Revisit: {progressStats.revisit}</span>
                <span>Mastered: {progressStats.mastered}</span>
              </div>
            ) : null}

            <div className="button-row">
              {refreshing ? <span>Syncing...</span> : null}

              {activePost ? (
                <button
                  className="ghost"
                  onClick={() => {
                    setActivePostId(null)
                    setPostQueryParam('')
                    setShowComposer(false)
                    setEditingPostId(null)
                  }}
                >
                  Back to Blog Grid
                </button>
              ) : null}
            </div>
          </section>
        ) : null}

        {showProfile && currentUser ? (
          <section ref={profileRef} className="card profile-page" style={{ minHeight: '600px', border: 'none', background: 'transparent', boxShadow: 'none' }}>
            <div className="profile-tab-content" style={{ marginTop: '20px' }}>
              {profileTab === 'posts' && (
                <div className="profile-post-list">
                  <h3 style={{ marginTop: 0 }}>My Posts</h3>
                  {posts.filter(p => p.authorSub === currentUser.userId).length === 0 ? <p>You haven't published any posts yet.</p> : null}
                  {posts.filter(p => p.authorSub === currentUser.userId).map(p => (
                    <div key={p.id} className="card preview-card" style={{ marginBottom: '12px', cursor: 'pointer' }} onClick={() => { setShowProfile(false); setActivePostId(p.id); setPostQueryParam(p.id); }}>
                      <h4 style={{ margin: '0 0 8px 0' }}>{stripReadableText(p.title).slice(0, 50)}...</h4>
                      <small>{new Date(p.createdAt).toLocaleDateString()} • {p.likes.length} Likes • {p.comments.length} Comments</small>
                    </div>
                  ))}
                </div>
              )}
              {profileTab === 'saved' && (
                <div className="profile-post-list">
                  <h3 style={{ marginTop: 0 }}>Saved Articles</h3>
                  {posts.filter(p => savedPostIds.includes(p.id)).length === 0 ? <p>You haven't saved any posts yet.</p> : null}
                  {posts.filter(p => savedPostIds.includes(p.id)).map(p => (
                    <div key={p.id} className="card preview-card" style={{ marginBottom: '12px', cursor: 'pointer' }} onClick={() => { setShowProfile(false); setActivePostId(p.id); setPostQueryParam(p.id); }}>
                      <h4 style={{ margin: '0 0 8px 0' }}>{stripReadableText(p.title).slice(0, 50)}...</h4>
                      <small>By {p.authorName} • {new Date(p.createdAt).toLocaleDateString()}</small>
                    </div>
                  ))}
                </div>
              )}
              {profileTab === 'messages' && (
                <div className="profile-messages">
                  <h3 style={{ marginTop: 0 }}>Community Messages</h3>
                  <div className="message-history" style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {communityMessages.filter(m => m.userSub === currentUser.userId).length === 0 ? <p>No messages sent to admin yet.</p> : null}
                    {communityMessages.filter(m => m.userSub === currentUser.userId).map(m => (
                      <div key={m.id} className="card" style={{ padding: '16px', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <strong style={{ fontSize: '1.1rem' }}>{m.subject}</strong>
                          <span className={`status-badge ${m.status.toLowerCase()}`}>{m.status}</span>
                        </div>
                        <p style={{ margin: '0 0 12px 0', fontSize: '0.95rem' }}>{m.text}</p>
                        {m.replyText && (
                          <div style={{ padding: '12px', background: 'var(--bg-shell)', borderRadius: '6px', borderLeft: '3px solid var(--accent)' }}>
                            <strong style={{ fontSize: '0.9rem' }}>Admin Reply:</strong>
                            <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem' }}>{m.replyText}</p>
                            <small style={{ display: 'block', marginTop: '8px', opacity: 0.7 }}>{new Date(m.repliedAt).toLocaleString()}</small>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <form className="card" style={{ border: '2px solid var(--border)' }} onSubmit={submitCommunityMessage}>
                    <h4 style={{ marginTop: 0 }}>Send a new message to Admin</h4>
                    <input placeholder="Subject" value={newMessageSubject} onChange={e => setNewMessageSubject(e.target.value)} required style={{ marginBottom: '12px' }} />
                    <textarea rows="3" placeholder="How can we help?" value={newMessageText} onChange={e => setNewMessageText(e.target.value)} required style={{ marginBottom: '12px' }} />
                    <button type="submit" disabled={!newMessageSubject || !newMessageText}>Send Message</button>
                  </form>
                </div>
              )}
              {profileTab === 'settings' && (
                <form className="profile-settings-form" onSubmit={(e) => { e.preventDefault(); saveProfile(e); }}>
                  <h3 style={{ marginTop: 0 }}>Profile & Account Setup</h3>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '12px' }}>
                    <div>
                      <label>Username *</label>
                      <input value={profileForm.username} onChange={e => setProfileForm(prev => ({ ...prev, username: e.target.value }))} required />
                    </div>
                    <div>
                      <label>Email Address *</label>
                      <input type="email" value={profileForm.email} onChange={e => setProfileForm(prev => ({ ...prev, email: e.target.value }))} required />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '12px' }}>
                    <div>
                      <label>Full Name</label>
                      <input placeholder="e.g. John Doe" value={profileForm.fullName} onChange={e => setProfileForm(prev => ({ ...prev, fullName: e.target.value }))} />
                    </div>
                    <div>
                      <label>Profession / Title</label>
                      <input placeholder="e.g. Cloud Architect" value={profileForm.profession} onChange={e => setProfileForm(prev => ({ ...prev, profession: e.target.value }))} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '12px' }}>
                    <div>
                      <label>LinkedIn URL</label>
                      <input type="url" placeholder="https://linkedin.com/in/..." value={profileForm.linkedIn} onChange={e => setProfileForm(prev => ({ ...prev, linkedIn: e.target.value }))} />
                    </div>
                    <div>
                      <label>Years of Experience</label>
                      <input type="number" min="0" placeholder="e.g. 5" value={profileForm.yearsOfExperience} onChange={e => setProfileForm(prev => ({ ...prev, yearsOfExperience: e.target.value }))} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '12px' }}>
                    <div>
                      <label>Credly / Certification URL</label>
                      <input type="url" placeholder="https://www.credly.com/badges/..." value={profileForm.credlyUrl} onChange={e => setProfileForm(prev => ({ ...prev, credlyUrl: e.target.value }))} />
                    </div>
                  </div>

                  <hr style={{ margin: '32px 0 16px 0', borderColor: 'var(--border)' }} />
                  <h4 style={{ marginTop: 0 }}>API Tokens for Cross-Posting</h4>
                  <p style={{ fontSize: '0.9rem', marginBottom: '16px', opacity: 0.8 }}>Securely store your tokens to instantly publish blogs across Dev.to, Hashnode, Medium, and LinkedIn.</p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '12px' }}>
                    <div>
                      <label>Dev.to API Key</label>
                      <input type="password" placeholder="Dev.to Token" value={profileForm.devToToken} onChange={e => setProfileForm(prev => ({ ...prev, devToToken: e.target.value }))} />
                    </div>
                    <div>
                      <label>Hashnode PAT</label>
                      <input type="password" placeholder="Hashnode Token" value={profileForm.hashnodeToken} onChange={e => setProfileForm(prev => ({ ...prev, hashnodeToken: e.target.value }))} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '12px' }}>
                    <div>
                      <label>Medium Integration Token</label>
                      <input type="password" placeholder="Medium Token" value={profileForm.mediumToken} onChange={e => setProfileForm(prev => ({ ...prev, mediumToken: e.target.value }))} />
                    </div>
                    <div>
                      <label>LinkedIn Access Token</label>
                      <input type="password" placeholder="LinkedIn Access Token" value={profileForm.linkedInToken} onChange={e => setProfileForm(prev => ({ ...prev, linkedInToken: e.target.value }))} />
                    </div>
                    <div>
                      <label>LinkedIn App Client ID</label>
                      <input type="text" placeholder="e.g. 865kzlkgfobq9k (from Auth tab in Developer Portal)" value={profileForm.linkedInClientId} onChange={e => setProfileForm(prev => ({ ...prev, linkedInClientId: e.target.value }))} />
                    </div>
                    <div>
                      <label>LinkedIn App Client Secret</label>
                      <input type="password" placeholder="Primary Client Secret (from Auth tab in Developer Portal)" value={profileForm.linkedInClientSecret} onChange={e => setProfileForm(prev => ({ ...prev, linkedInClientSecret: e.target.value }))} />
                    </div>
                  </div>

                  <label>Bio (Short Introduction)</label>
                  <textarea rows={3} placeholder="Tell the community about yourself..." value={profileForm.bio} onChange={e => setProfileForm(prev => ({ ...prev, bio: e.target.value }))} style={{ marginBottom: '12px', marginTop: '16px' }} />
                  <div className="button-row" style={{ marginTop: '16px' }}>
                    <button type="submit">Update Profile Details</button>
                  </div>

                  <hr style={{ margin: '32px 0', borderColor: 'var(--border)' }} />
                  <div className="danger-zone card" style={{ borderColor: '#ef4444' }}>
                    <h4 style={{ color: '#ef4444', marginTop: 0 }}> Danger Zone</h4>
                    <p style={{ fontSize: '0.9rem' }}>Permanently delete your account and all associated data.</p>
                    <button type="button" className="danger" onClick={() => setShowDeleteWarning(true)}>Request Account Deletion</button>
                  </div>
                </form>
              )}
            </div>
          </section>
        ) : null}

        {showAdminPanel && isAdmin ? (
          <section className="card admin-panel">
            <h3>Admin Dashboard</h3>
            <div className="admin-metrics">
              <div className="admin-metric">
                <small>Total Users (known)</small>
                <strong>{cognitoUsers.length > 0 ? cognitoUsers.length : registeredUsers.length}</strong>
              </div>
              <div className="admin-metric">
                <small>Total Posts</small>
                <strong>{posts.length}</strong>
              </div>
              <div className="admin-metric">
                <small>Total Comments</small>
                <strong>{comments.length}</strong>
              </div>
              <div className="admin-metric">
                <small>Blocked Users</small>
                <strong>{blockedUserSubs.size}</strong>
              </div>
            </div>

            <h4>Active Users Per Day (last 14 days)</h4>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Active Users</th>
                  </tr>
                </thead>
                <tbody>
                  {activeUsersByDay.map((item) => (
                    <tr key={item.day}>
                      <td>{item.day}</td>
                      <td>{item.users}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="admin-tabs" style={{ marginBottom: '24px', display: 'flex', gap: '8px' }}>
              <button className={`ghost ${adminTab === 'users' ? 'active-tab' : ''}`} onClick={() => setAdminTab('users')}>Users & Stats</button>
              <button className={`ghost ${adminTab === 'messages' ? 'active-tab' : ''}`} onClick={() => setAdminTab('messages')}>Community Messages</button>
            </div>

            {adminTab === 'users' ? (
              <div className="admin-section">
                <h3>Registered Users</h3>
                <div className="table-wrapper">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Profile ID</th>
                        <th>Registration (IST)</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cognitoUsers.length === 0 ? <tr><td colSpan="7">No registered users found.</td></tr> : null}
                      {cognitoUsers.map((u) => {
                        const blocked = blockedUserSubs.has(u.sub)
                        let formattedIST = '-'
                        if (u.createdAt) {
                          try {
                            const d = new Date(u.createdAt)
                            formattedIST = d.toLocaleString('en-IN', {
                              timeZone: 'Asia/Kolkata',
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: false
                            })
                          } catch (_) { }
                        }
                        return (
                          <tr key={`reg-${u.sub}`}>
                            <td>{u.name || 'User'}</td>
                            <td>{u.email || '-'}</td>
                            <td>{u.sub}</td>
                            <td>{formattedIST}</td>
                            <td>
                              {blocked ? 'Blocked' : u.status === 'UNCONFIRMED' ? 'Unconfirmed' : u.status === 'EXTERNAL_PROVIDER' ? 'Google SSO' : 'Active'}
                            </td>
                            <td className="admin-actions">
                              <button className="ghost" onClick={() => adminEditUser(u)}>Edit</button>
                              <button className="ghost" onClick={() => adminTriggerPasswordReset(u)}>Password Reset</button>
                              {blocked ? (
                                <button className="ghost" onClick={() => setUserBlocked(u.sub, false)}>Unblock</button>
                              ) : (
                                <button className="danger" onClick={() => adminDeleteUser(u)}>Delete</button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <h3 style={{ marginTop: '30px' }}>Active Content Creators (Posts/Comments/Likes)</h3>
                <div className="table-wrapper">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Profile ID</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeUsers.length === 0 ? <tr><td colSpan="5">No active users.</td></tr> : null}
                      {activeUsers.map((u) => {
                        const blocked = blockedUserSubs.has(u.sub)
                        return (
                          <tr key={`act-${u.sub}`}>
                            <td>{u.name || 'User'}</td>
                            <td>{u.email || '-'}</td>
                            <td>{u.sub}</td>
                            <td>{blocked ? 'Blocked' : 'Active'}</td>
                            <td className="admin-actions">
                              <button className="ghost" onClick={() => adminTriggerPasswordReset(u)}>Reset Password</button>
                              <button className="ghost" onClick={() => adminResetAccount(u)}>Reset Account</button>
                              {blocked ? (
                                <button className="ghost" onClick={() => setUserBlocked(u.sub, false)}>Unblock</button>
                              ) : (
                                <button className="danger" onClick={() => setUserBlocked(u.sub, true, 'Blocked by admin')}>Block</button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <h4>Posts Moderation</h4>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Author</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {posts.map((p) => (
                        <tr key={p.id}>
                          <td>{p.title}</td>
                          <td>{p.authorName}</td>
                          <td>{p.hidden ? 'Hidden' : 'Visible'}</td>
                          <td className="admin-actions">
                            <button className="ghost" onClick={() => togglePostHidden(p.id, !p.hidden)}>
                              {p.hidden ? 'Unhide' : 'Hide'}
                            </button>
                            <button className="danger" onClick={() => deletePost(p.id)}>
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <h4>Comments Moderation</h4>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Post</th>
                        <th>Comment</th>
                        <th>Author</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comments.map((c) => (
                        <tr key={c.id}>
                          <td>{posts.find((p) => p.id === c.postId)?.title || 'Post'}</td>
                          <td>{c.text}</td>
                          <td>{c.authorName}</td>
                          <td>
                            <button className="danger" onClick={() => deleteComment(c.postId, c.id)}>
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {adminTab === 'messages' ? (
              <div className="admin-section">
                <h3>Community Messages</h3>
                <div className="table-wrapper">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Subject</th>
                        <th>Message</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {communityMessages.length === 0 ? <tr><td colSpan="5">No messages yet.</td></tr> : null}
                      {communityMessages.map((msg) => (
                        <tr key={msg.id}>
                          <td>{msg.userName}<br /><small>{msg.userSub}</small></td>
                          <td><strong>{msg.subject}</strong><br /><small>{new Date(msg.createdAt).toLocaleDateString()}</small></td>
                          <td style={{ maxWidth: '300px' }}>
                            <p style={{ margin: 0, fontSize: '0.9rem' }}>{msg.text}</p>
                            {msg.replyText && (
                              <div style={{ marginTop: '8px', padding: '8px', background: 'var(--bg-card)', borderRadius: '4px', borderLeft: '3px solid var(--accent)' }}>
                                <small><strong>Reply:</strong> {msg.replyText}</small>
                              </div>
                            )}
                          </td>
                          <td>
                            <span className={`status-badge ${msg.status.toLowerCase()}`}>{msg.status}</span>
                          </td>
                          <td className="admin-actions">
                            {msg.status !== 'RESOLVED' ? (
                              <button className="ghost" onClick={() => {
                                const reply = window.prompt(`Reply to ${msg.userName}:`)
                                if (reply) replyToCommunityMessage(msg.id, reply)
                              }}>Reply / Resolve</button>
                            ) : null}
                            <button className="danger" onClick={async () => {
                              if (window.confirm('Delete this message?')) {
                                await client.models.CommunityMessage.delete({ id: msg.id })
                                refreshData()
                              }
                            }}>Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {!showAdminPanel && (showComposer || editingPostId) && currentUser ? (
          <section className="writer-shell">
            <Write
              key={editingPostId || 'new'}
              submitLabel={editingPost ? 'Update Blog' : 'Publish Blog'}
              initialValue={editingPost || null}
              draftKey={`post-draft-${editingPostId || 'new'}`}
              onSubmit={editingPost ? updatePost : createPost}
              onInlineUpload={uploadInlineMediaSource}
              onCancel={() => {
                setEditingPostId(null)
                setShowComposer(false)
              }}
              busy={savingPost}
            />

          </section>
        ) : null}

        {!showAdminPanel && !showProfile && !activePost ? (
          <section className="posts-section">
            <div className="preview-grid">
              {displayPosts.map((post, index) => (
                <PostPreviewCard
                  key={post.id}
                  post={post}
                  progressStatus={postProgressMap[post.id] || ''}
                  featured={index === 0 && !searchQuery.trim()}
                  saved={savedPostIds.includes(post.id)}
                  currentUser={currentUser}
                  isFollowing={followedAuthorSubs.includes(post.authorSub)}
                  onToggleFollow={toggleFollowAuthor}
                  resolveMediaSource={resolveMediaSource}
                  userBadges={userBadgesBySub.get(post.authorSub) || []}
                  onOpen={() => {
                    setActivePostId(post.id)
                    setPostQueryParam(post.id)
                    setShowComposer(false)
                    setEditingPostId(null)
                  }}
                />
              ))}
            </div>
            {!displayPosts.length ? (
              <div className="card empty-state">
                <h3>No posts found</h3>
                <p>Try a different search keyword or clear filters.</p>
              </div>
            ) : null}
          </section>
        ) : null}
        {!showAdminPanel && !showProfile && activePost ? (
          <FullPostView
            post={activePost}
            currentUser={currentUser}
            resolveMediaSource={resolveMediaSource}
            onBack={() => {
              setActivePostId(null)
              setPostQueryParam('')
            }}
            onEdit={() => {
              setEditingPostId(activePost.id)
              setComposerStep('config')
              setComposerConfig({
                level: activePost.level || '', topic: activePost.topic || '',
                postToDevTo: false, postToHashnode: false, postToMedium: false, postToLinkedIn: false
              })
              setShowComposer(true)
              setActivePostId(null)
              setPostQueryParam('')
            }}
            onDelete={() => deletePost(activePost.id)}
            onTogglePostLike={() => togglePostLike(activePost.id)}
            onToggleSavePost={() => toggleSavePost(activePost.id)}
            saved={savedPostIds.includes(activePost.id)}
            isFollowing={followedAuthorSubs.includes(activePost.authorSub)}
            onToggleFollow={toggleFollowAuthor}
            onShare={() => sharePost(activePost)}
            onAddComment={addComment}
            onUpdateComment={updateComment}
            onDeleteComment={deleteComment}
            onToggleCommentLike={toggleCommentLike}
            progressStatus={postProgressMap[activePost.id] || ''}
            onSetProgress={setPostProgress}
            readerReaction={postReactionMap[activePost.id] || ''}
            onSetReaction={setPostReaction}
            userBadges={userBadgesBySub.get(activePost.authorSub) || []}
          />
        ) : null}
      </main>

      <footer className="site-footer">
        <p>
          &copy; 2026 All Rights Reserved{' '}
          <a
            href="https://www.linkedin.com/in/suryareddi/"
            target="_blank"
            rel="noreferrer"
          >
            RMSP
          </a>
        </p>
      </footer>

      {showDeleteWarning && (
        <div className="auth-overlay" onClick={() => setShowDeleteWarning(false)}>
          <div className="card auth-modal" style={{ maxWidth: '500px', border: '2px solid #ef4444' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ color: '#ef4444', marginTop: 0 }}>Request Account Deletion</h3>
            <p style={{ margin: '12px 0' }}>
              We're sorry to see you go. Deleting your account will permanently erase all your progress, posts, and saved articles.
            </p>
            <p style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '8px' }}>Please let us know why you are leaving (Optional):</p>
            <textarea
              rows="3"
              placeholder="Your feedback helps us improve..."
              value={deletionReason}
              onChange={(e) => setDeletionReason(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text)', marginBottom: '24px' }}
            />
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', alignItems: 'center' }}>
              <button type="button" className="ghost" onClick={() => setShowDeleteWarning(false)}>Cancel</button>
              <button type="button" className="danger" onClick={requestDeletion}>Confirm Deletion</button>
            </div>
          </div>
        </div>
      )}

      {
        showAuth ? (
          <div className="auth-overlay" onClick={() => setShowAuth(false)}>
            <form
              className="card auth-modal"
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleAuthSubmit}
            >


              <p className="auth-title">
                {authMode === 'signup'
                  ? 'Create your account'
                  : authMode === 'confirm'
                    ? 'Enter email confirmation code'
                    : 'Login to continue'}
              </p>

              {authMode === 'signup' ? (
                <>
                  <label>Username</label>
                  <input
                    value={authForm.username}
                    onChange={(e) => setAuthForm((prev) => ({ ...prev, username: e.target.value }))}
                  />
                </>
              ) : null}

              {authMode !== 'confirm' ? (
                <>
                  <label>Email</label>
                  <input
                    type="email"
                    value={authForm.email}
                    onChange={(e) => setAuthForm((prev) => ({ ...prev, email: e.target.value }))}
                  />

                  <label>Password</label>
                  <input
                    type="password"
                    value={authForm.password}
                    onChange={(e) => setAuthForm((prev) => ({ ...prev, password: e.target.value }))}
                  />

                  {authMode === 'signup' ? (
                    <div className="password-meter">
                      <span className={passwordScore >= 1 ? 'on' : ''} />
                      <span className={passwordScore >= 2 ? 'on' : ''} />
                      <span className={passwordScore >= 3 ? 'on' : ''} />
                      <span className={passwordScore >= 4 ? 'on' : ''} />
                    </div>
                  ) : null}
                </>
              ) : (
                <>
                  <label>Confirmation Code</label>
                  <input
                    value={authForm.code}
                    onChange={(e) => setAuthForm((prev) => ({ ...prev, code: e.target.value }))}
                  />
                </>
              )}

              {authError ? <p className="error">{authError}</p> : null}

              <div className="button-row">
                <button type="submit" className="auth-submit-btn">
                  {authMode === 'signup' ? 'Create Account' : authMode === 'confirm' ? 'Confirm' : 'Login'}
                </button>
                {authMode === 'confirm' ? (
                  <button className="ghost" type="button" onClick={() => setAuthMode('login')}>
                    Back
                  </button>
                ) : (
                  <button className="ghost" type="button" onClick={() => setShowAuth(false)}>
                    Close
                  </button>
                )}
              </div>

              {authMode !== 'confirm' ? (
                <div className="oauth-section">
                  <button type="button" className="google-auth-button" onClick={handleGoogleLogin}>
                    <svg viewBox="0 0 48 48" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                    </svg>
                    Continue with Google
                  </button>
                  <div className="auth-toggle-text">
                    {authMode === 'signup' ? (
                      <>
                        Already have an account?{' '}
                        <span
                          className="auth-link"
                          onClick={() => {
                            setAuthMode('login')
                            setAuthError('')
                          }}
                        >
                          Log in
                        </span>
                      </>
                    ) : (
                      <>
                        Don't have an account?{' '}
                        <span
                          className="auth-link"
                          onClick={() => {
                            setAuthMode('signup')
                            setAuthError('')
                          }}
                        >
                          Sign up
                        </span>
                      </>
                    )}
                  </div>
                </div>
              ) : null}
            </form>
          </div>
        ) : null
      }



      {
        showDeleteWarning && (
          <div className="auth-overlay delete-warning-overlay" style={{ zIndex: 3000 }}>
            <div className="card modal-warning" style={{ border: '2px solid #ef4444' }}>
              <h3 style={{ color: '#ef4444', marginTop: 0 }}>⚠️ Delete Account</h3>
              <p>Are you sure you want to permanently delete your account?</p>
              <p style={{ fontSize: '0.9rem', opacity: 0.8 }}>This action will permanently erase your posts, comments, progress, and profile information.</p>
              <p style={{ fontSize: '0.9rem', background: 'var(--bg-shell)', padding: '12px', borderRadius: '6px' }}>
                Admin will review and process this request via: <br /><strong>cloudjourney.blog@gmail.com</strong>
              </p>
              <div className="button-row" style={{ marginTop: '24px' }}>
                <button className="danger" onClick={requestDeletion}>Yes, request deletion</button>
                <button className="ghost" onClick={() => setShowDeleteWarning(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )
      }

      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className="toast">{t.msg}</div>
        ))}
      </div>
    </div >
  )
}

function RichHtml({ html, resolveMediaSource }) {
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

function PostPreviewCard({
  post,
  onOpen,
  progressStatus = '',
  featured = false,
  saved = false,
  currentUser,
  isFollowing = false,
  onToggleFollow,
  resolveMediaSource,
  userBadges = [],
}) {
  const readMinutes = estimateReadMinutes(post.content)
  const practiceMins = Number(post.timeToPracticeMins || 0)
  const skill = skillMeta(post.skillLevel)
  const progress = progressStatus ? progressMeta(progressStatus) : null
  const canFollowAuthor = currentUser && currentUser.userId !== post.authorSub
  const coverSource = post.mediaPath || post.mediaUrl || ''
  const coverType = post.mediaType === 'video' ? 'video' : 'image'
  const previewSnippet = stripReadableText(post.content).replace(/\s+/g, ' ').trim().slice(0, 160)
  return (
    <article
      className={`card preview-card ${featured ? 'featured' : ''}`}
      onClick={onOpen}
      role="button"
      tabIndex={0}
    >
      {coverSource ? (
        <InlineMedia
          type={coverType}
          source={coverSource}
          alt={post.title}
          resolveMediaSource={resolveMediaSource}
        />
      ) : (
        <div className="preview-placeholder preview-text-cover">
          <strong>{stripReadableText(post.title).replace(/\s+/g, ' ').trim().slice(0, 72) || 'Untitled'}</strong>
          <span>{previewSnippet || 'Open post to read details.'}</span>
        </div>
      )}
      <h4>{renderRichTitle(post.title, `card-title-${post.id}`)}</h4>
      <div className={`skill-pill ${skill.cls}`}>{skill.icon} {skill.label}</div>
      {progress ? <div className={`progress-pill ${progress.cls}`}>{progress.icon} {progress.label}</div> : null}
      <div className="by-follow-row">
        <small style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          By {post.authorName}
          {userBadges.map(b => (
            <span key={b.id} title={b.label} style={{ fontSize: '0.85em', padding: '2px 6px', background: 'var(--accent)', color: 'white', borderRadius: '12px' }}>
              {b.icon} {b.label}
            </span>
          ))}
        </small>
        {canFollowAuthor ? (
          <button
            type="button"
            className={`ghost follow-pill ${isFollowing ? 'is-following' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              onToggleFollow?.(post.authorSub)
            }}
          >
            {isFollowing ? 'Following' : '+ Follow'}
          </button>
        ) : null}
      </div>
      {saved ? <span className="saved-chip">Saved</span> : null}
      <div className="preview-meta">
        <span>{readMinutes} min read</span>
        {practiceMins > 0 ? <span>{practiceMins} min practice</span> : null}
        <span>{post.likes.length} likes</span>
        <span>{post.comments.length} comments</span>
      </div>
    </article>
  )
}

function FullPostView({
  post,
  currentUser,
  resolveMediaSource,
  onBack,
  onEdit,
  onDelete,
  onTogglePostLike,
  onToggleSavePost,
  saved,
  isFollowing,
  onToggleFollow,
  onShare,
  onAddComment,
  onUpdateComment,
  onDeleteComment,
  onToggleCommentLike,
  progressStatus = '',
  onSetProgress,
  readerReaction = '',
  onSetReaction,
  userBadges = [],
}) {
  const [commentText, setCommentText] = useState('')
  const [editingCommentId, setEditingCommentId] = useState(null)
  const [editingCommentText, setEditingCommentText] = useState('')
  const [openCommentMenuId, setOpenCommentMenuId] = useState(null)
  const [speaking, setSpeaking] = useState(false)
  const [depthMode, setDepthMode] = useState('beginner')
  const postRef = useRef(null)
  const [readProgress, setReadProgress] = useState(0)

  const canManagePost = currentUser?.userId === post.authorSub
  const canFollowAuthor = currentUser && currentUser.userId !== post.authorSub
  const canInteract = !!currentUser
  const canShare = true
  const canListen = true
  const postLiked = currentUser ? post.likes.includes(currentUser.userId) : false
  const contentBlocks = useMemo(() => parseContentBlocks(post.content), [post.content])
  const readMinutes = useMemo(() => estimateReadMinutes(post.content), [post.content])
  const practiceMins = Number(post.timeToPracticeMins || 0)
  const skill = skillMeta(post.skillLevel)
  const progress = progressMeta(progressStatus || 'read')
  const depthSummary =
    depthMode === 'pro' ? (post.proSummary || post.beginnerSummary || '') : (post.beginnerSummary || post.proSummary || '')
  const hasInlineMedia = useMemo(
    () => contentBlocks.some((block) => block.type === 'image' || block.type === 'video' || block.type === 'html'),
    [contentBlocks],
  )
  const coverSource = post.mediaPath || post.mediaUrl || ''
  const coverType = post.mediaType === 'video' ? 'video' : 'image'

  useEffect(() => {
    const handleProgress = () => {
      const el = postRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const viewport = window.innerHeight || 1
      const total = Math.max(el.scrollHeight + viewport, 1)
      const viewed = Math.min(Math.max(viewport - rect.top, 0), total)
      setReadProgress(Math.round((viewed / total) * 100))
    }

    handleProgress()
    window.addEventListener('scroll', handleProgress, { passive: true })
    window.addEventListener('resize', handleProgress)
    return () => {
      window.removeEventListener('scroll', handleProgress)
      window.removeEventListener('resize', handleProgress)
    }
  }, [post.id])

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  useEffect(() => {
    const handleClickOutsideMenu = (event) => {
      if (event.target.closest('.comment-menu-wrap')) return
      setOpenCommentMenuId(null)
    }
    document.addEventListener('mousedown', handleClickOutsideMenu)
    return () => document.removeEventListener('mousedown', handleClickOutsideMenu)
  }, [])

  const handleListenToggle = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      alert('Speech is not supported in this browser.')
      return
    }
    const synth = window.speechSynthesis
    if (speaking || synth.speaking) {
      synth.cancel()
      setSpeaking(false)
      return
    }
    const text = contentToSpeechText(post.content)
    if (!text) {
      alert('No readable text found for audio mode.')
      return
    }

    const speakNow = () => {
      const plainTitle = stripReadableText ? stripReadableText(post.title) : post.title.replace(/<[^>]+>/g, '')
      const utterance = new SpeechSynthesisUtterance(`${plainTitle}. ${text}`)
      utterance.rate = 1
      utterance.pitch = 1

      const voices = synth.getVoices ? synth.getVoices() : []
      if (voices.length) {
        const preferred =
          voices.find((v) => v.lang?.toLowerCase().startsWith((navigator.language || 'en').toLowerCase().split('-')[0])) ||
          voices.find((v) => v.default) ||
          voices[0]
        if (preferred) {
          utterance.voice = preferred
          utterance.lang = preferred.lang || navigator.language || 'en-US'
        }
      } else {
        utterance.lang = navigator.language || 'en-US'
      }

      utterance.onend = () => setSpeaking(false)
      utterance.onerror = () => setSpeaking(false)

      setSpeaking(true)
      synth.cancel()
      synth.resume?.()
      synth.speak(utterance)

      // Some mobile browsers ignore the first request; retry once if needed.
      setTimeout(() => {
        if (!synth.speaking && !synth.pending) {
          synth.speak(utterance)
        }
      }, 180)
    }

    speakNow()
  }

  const renderActionBar = () => (
    <div className="blog-action-bar">
      <div className="action-bar-group">
        <button
          className={`action-btn ${postLiked ? 'active like' : ''}`}
          onClick={onTogglePostLike}
          disabled={!canInteract}
          aria-label="Like post"
          title="Like"
        >
          <span className="icon">{postLiked ? '\u2665' : '\u2661'}</span>
          <span>{post.likes.length}</span>
        </button>
        <button
          className="action-btn"
          onClick={() => {
            const el = document.getElementById(`comment-box-${post.id}`)
            if (el) el.focus()
          }}
          disabled={!canInteract}
          aria-label="Comment"
          title="Comment"
        >
          <span className="icon">{'\u{1F4AC}'}</span>
          <span>{post.comments.length}</span>
        </button>
      </div>

      <div className="action-bar-group">
        <button
          className={`action-btn ${saved ? 'active save' : ''}`}
          onClick={onToggleSavePost}
          disabled={!canInteract}
          aria-label="Save post"
          title="Save"
        >
          <span className="icon">{saved ? '\u2605' : '\u2606'}</span>
        </button>
        <button
          className={`action-btn ${speaking ? 'active listen' : ''}`}
          onClick={handleListenToggle}
          disabled={!canListen}
          aria-label="Listen to post"
          title="Listen"
        >
          <span className="icon">{speaking ? '\u23F9' : '\u25B6'}</span>
        </button>
        <button
          className="action-btn"
          onClick={onShare}
          disabled={!canShare}
          aria-label="Copy share link"
          title="Copy link"
        >
          <span className="icon">{'\u{1F517}'}</span>
        </button>
        {canManagePost ? (
          <button
            className="action-btn"
            onClick={onEdit}
            aria-label="Edit post"
            title="Edit Post"
            style={{ fontWeight: 600, borderLeft: '1px solid var(--border)', paddingLeft: '16px', marginLeft: '6px' }}
          >
            <span className="icon">{"\u270E"}</span>
            Write
          </button>
        ) : null}
      </div>
    </div>
  )

  return (
    <article className="card full-post" ref={postRef}>
      <div className="reading-progress">
        <span style={{ width: `${readProgress}%` }} />
      </div>
      <div className="full-post-top">
        <button className="ghost" onClick={onBack}>Back to Feed</button>
        <div className={`progress-pill ${progress.cls}`}>{progress.icon} {progress.label}</div>
      </div>

      <div className="post-head">
        <div>
          <h2>{renderRichTitle(post.title, `full-title-${post.id}`)}</h2>
          <small>
            Owner: {post.authorName} | Created: {new Date(post.createdAt).toLocaleString()} | Updated: {new Date(post.updatedAt).toLocaleString()}
          </small>
          <div className={`skill-pill ${skill.cls}`}>{skill.icon} {skill.label}</div>
          {post.versionLabel ? <div className="version-pill">Updated: {post.versionLabel}</div> : null}
          <div className="post-insights">
            <span>{readMinutes} min read</span>
            {practiceMins > 0 ? <span>{practiceMins} min practice</span> : null}
            <span>{post.likes.length} likes</span>
            <span>{post.comments.length} comments</span>
          </div>
        </div>
        {canManagePost ? (
          <div className="button-row">
            <button className="ghost" onClick={onEdit}>Edit</button>
            <button className="danger" onClick={onDelete}>Delete</button>
          </div>
        ) : canFollowAuthor ? (
          <button
            type="button"
            className={`ghost follow-pill header-follow ${isFollowing ? 'is-following' : ''}`}
            onClick={() => onToggleFollow?.(post.authorSub)}
          >
            {isFollowing ? 'Following' : '+ Follow'}
          </button>
        ) : null}
      </div>

      {renderActionBar()}

      <div className="full-post-content">
        <div className="depth-toggle-row">
          <small>Explain mode:</small>
          {canInteract ? (
            <div className={`depth-toggle ${depthMode}`}>
              <button
                className={`ghost ${depthMode === 'beginner' ? 'active' : ''}`}
                onClick={() => setDepthMode('beginner')}
              >
                Beginner
              </button>
              <button
                className={`ghost ${depthMode === 'pro' ? 'active' : ''}`}
                onClick={() => setDepthMode('pro')}
              >
                Pro
              </button>
            </div>
          ) : null}
        </div>

        {(() => {
          const isOnline = post.authorSub.charCodeAt(0) % 2 === 0 || post.authorSub === currentUser?.userId
          return (
            <div className="author-meta">
              <span className="author-name" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {post.authorName || 'Unknown'}
                {userBadges.map(b => (
                  <span key={b.id} title={b.label} style={{ fontSize: '0.8em', padding: '2px 6px', background: 'var(--accent)', color: 'white', borderRadius: '12px', fontWeight: '500' }}>
                    {b.icon} {b.label}
                  </span>
                ))}
                <span className={`status-dot ${isOnline ? 'online' : 'offline'}`} title={isOnline ? 'Online' : 'Offline'} style={{ marginLeft: '4px' }} />
              </span>
              <span className="post-date">{new Date(post.createdAt || '').toLocaleDateString()}</span>
              {canManagePost ? (
                <div className="managed-actions">
                  <button className="ghost" onClick={onEdit}>
                    Edit
                  </button>
                  <button className="ghost text-danger" onClick={onDelete}>
                    Delete
                  </button>
                </div>
              ) : null}
              {canFollowAuthor ? (
                <button
                  className={`ghost follow-btn ${isFollowing ? 'following' : ''}`}
                  onClick={() => onToggleFollow(post.authorSub)}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
              ) : null}
            </div>
          )
        })()}
        {post.tldr ? (
          <section className="phase1-callout tldr">
            <h4>If You're Short on Time</h4>
            <p>{post.tldr}</p>
          </section>
        ) : null}
        {depthSummary ? (
          <section className="phase1-callout mode-summary">
            <h4>{depthMode === 'pro' ? 'Pro Mode Summary' : 'Beginner Mode Summary'}</h4>
            <p>{depthSummary}</p>
          </section>
        ) : null}
        {post.whyMatters ? (
          <section className="phase1-callout why-matters">
            <h4>Why This Matters in Real Life</h4>
            <p>{post.whyMatters}</p>
          </section>
        ) : null}
        {post.commonMistakes ? (
          <section className="phase1-callout gotchas">
            <h4>Mistakes & Gotchas</h4>
            <p>{post.commonMistakes}</p>
          </section>
        ) : null}
        {!hasInlineMedia && coverSource ? (
          <InlineMedia
            type={coverType}
            source={coverSource}
            alt={post.title}
            resolveMediaSource={resolveMediaSource}
          />
        ) : null}
        {contentBlocks.map((block, index) => {
          if (block.type === 'html') {
            return (
              <RichHtml
                key={`${post.id}-full-html-${index}`}
                html={block.value}
                resolveMediaSource={resolveMediaSource}
              />
            )
          }
          if (block.type === 'image') {
            return (
              <InlineMedia
                key={`${post.id}-full-image-${index}`}
                type="image"
                source={block.value}
                alt={post.title}
                resolveMediaSource={resolveMediaSource}
              />
            )
          }
          if (block.type === 'video') {
            return (
              <InlineMedia
                key={`${post.id}-full-video-${index}`}
                type="video"
                source={block.value}
                alt={post.title}
                resolveMediaSource={resolveMediaSource}
              />
            )
          }
          if (block.type === 'mermaid') {
            return <MermaidBlock key={`${post.id}-full-mermaid-${index}`} code={block.code} />
          }
          if (block.type === 'code') {
            return <CodeBlock key={`${post.id}-full-code-${index}`} code={block.code} lang={block.lang} />
          }
          return renderStyledTextBlock(block.value, `${post.id}-full-text-${index}`)
        })}
        {post.nextTopicTitle || post.nextTopicUrl || post.roadmapUrl ? (
          <section className="phase1-callout next-path">
            <h4>What to Learn Next</h4>
            {post.nextTopicTitle ? <p>{post.nextTopicTitle}</p> : null}
            <div className="next-links">
              {post.nextTopicUrl ? (
                <a href={post.nextTopicUrl} target="_blank" rel="noreferrer">
                  Next Blog
                </a>
              ) : null}
              {post.roadmapUrl ? (
                <a href={post.roadmapUrl} target="_blank" rel="noreferrer">
                  Roadmap
                </a>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>

      {renderActionBar()}

      {canInteract ? (
        <div className="phase2-row">
          <div className="phase2-block">
            <small>Progress tracker</small>
            <div className="button-row">
              <button className="ghost" onClick={() => onSetProgress?.(post.id, 'read')}>{'\u2705'} Read</button>
              <button className="ghost" onClick={() => onSetProgress?.(post.id, 'revisit')}>{'\u{1F516}'} Revisit</button>
              <button className="ghost" onClick={() => onSetProgress?.(post.id, 'mastered')}>{'\u2B50'} Mastered</button>
            </div>
          </div>
          <div className="phase2-block">
            <small>How was this post?</small>
            <div className="button-row">
              <button
                className={`ghost ${readerReaction === 'confusing' ? 'saved-active' : ''}`}
                onClick={() => onSetReaction?.(post.id, 'confusing')}
              >
                {'\u{1F92F}'} Confusing
              </button>
              <button
                className={`ghost ${readerReaction === 'aha' ? 'saved-active' : ''}`}
                onClick={() => onSetReaction?.(post.id, 'aha')}
              >
                {'\u{1F4A1}'} Aha!
              </button>
              <button
                className={`ghost ${readerReaction === 'useful' ? 'saved-active' : ''}`}
                onClick={() => onSetReaction?.(post.id, 'useful')}
              >
                {'\u{1F525}'} Useful
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {!canInteract ? (
        <p className="guest-action-hint">Login to like, comment, and save posts.</p>
      ) : null}

      <section className="comments">
        <h4>Comments</h4>

        {post.comments.map((comment) => {
          const mine = isOwnedByCurrentUser(currentUser, comment)
          const editing = editingCommentId === comment.id

          return (
            <div className="comment" id={`comment-${comment.id}`} key={comment.id}>
              <div className="comment-head">
                <strong>{comment.authorName}</strong>
                <div className="comment-menu-wrap">
                  <button
                    type="button"
                    className="ghost comment-menu-trigger"
                    aria-label="Comment options"
                    disabled={!canInteract}
                    onClick={() =>
                      setOpenCommentMenuId((prev) =>
                        prev === comment.id ? null : comment.id,
                      )
                    }
                  >
                    ...
                  </button>
                  {openCommentMenuId === comment.id ? (
                    <div className="comment-menu">
                      <button
                        type="button"
                        className="ghost"
                        disabled={!canInteract}
                        onClick={async () => {
                          const url = new URL(window.location.href)
                          url.searchParams.set('post', post.id)
                          url.hash = `comment-${comment.id}`
                          try {
                            await navigator.clipboard.writeText(url.toString())
                            alert('Comment link copied.')
                          } catch {
                            alert('Could not copy comment link.')
                          }
                          setOpenCommentMenuId(null)
                        }}
                      >
                        Copy link to comment
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        disabled={!canInteract || !mine}
                        title={mine ? 'Edit comment' : 'Only comment owner can edit'}
                        onClick={() => {
                          setEditingCommentId(comment.id)
                          setEditingCommentText(comment.text)
                          setOpenCommentMenuId(null)
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="ghost danger-lite"
                        disabled={!canInteract || !mine}
                        title={mine ? 'Delete comment' : 'Only comment owner can delete'}
                        onClick={() => {
                          onDeleteComment(post.id, comment.id)
                          setOpenCommentMenuId(null)
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
              {editing ? (
                <>
                  <textarea
                    rows={3}
                    value={editingCommentText}
                    onChange={(e) => setEditingCommentText(e.target.value)}
                  />
                  <div className="button-row">
                    <button
                      onClick={() => {
                        if (!editingCommentText.trim()) return
                        onUpdateComment(post.id, comment.id, editingCommentText)
                        setEditingCommentId(null)
                        setEditingCommentText('')
                      }}
                    >
                      Update
                    </button>
                    <button
                      className="ghost"
                      onClick={() => {
                        setEditingCommentId(null)
                        setEditingCommentText('')
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <p>{comment.text}</p>
              )}

            </div>
          )
        })}

        <div className="comment-box">
          <textarea
            id={`comment-box-${post.id}`}
            rows={3}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Add a comment"
          />
          <button
            onClick={() => {
              onAddComment(post.id, commentText)
              setCommentText('')
            }}
            disabled={!currentUser}
          >
            Comment
          </button>
        </div>
      </section>
    </article>
  )
}

function InlineMedia({ type, source, alt, resolveMediaSource }) {
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

function CodeBlock({ code, lang }) {
  const [html, setHtml] = useState('')
  const [copied, setCopied] = useState(false)
  const runHint = useMemo(() => detectCodeRuntimeHint(lang, code), [lang, code])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const mod = await import('highlight.js/lib/common')
        const hljs = mod.default
        const highlighted =
          lang && lang !== 'auto'
            ? hljs.highlight(code, { language: lang, ignoreIllegals: true }).value
            : hljs.highlightAuto(code).value
        if (!cancelled) setHtml(highlighted)
      } catch {
        if (!cancelled) setHtml(code.replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch])))
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [code, lang])

  return (
    <div className="code-block-shell">
      <div className="code-head">
        <span className="dot red" />
        <span className="dot yellow" />
        <span className="dot green" />
        <small>{lang || 'code'}</small>
        <button
          type="button"
          className="ghost code-copy-btn"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code)
              setCopied(true)
              setTimeout(() => setCopied(false), 1200)
            } catch {
              // no-op
            }
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="code-block">
        <code className="hljs" dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
      {runHint ? (
        <div className="code-run-hints">
          <span>Windows: <code>{runHint.windows}</code></span>
          <span>Linux: <code>{runHint.linux}</code></span>
          <span>Mac: <code>{runHint.mac}</code></span>
        </div>
      ) : null}
    </div>
  )
}

function MermaidBlock({ code }) {
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

export default App

