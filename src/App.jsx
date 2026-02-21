import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Amplify } from 'aws-amplify'
import {
  confirmSignUp,
  fetchUserAttributes,
  fetchAuthSession,
  getCurrentUser,
  signIn,
  signInWithRedirect,
  signOut,
  signUp,
  updateUserAttributes,
} from 'aws-amplify/auth'
import { generateClient } from 'aws-amplify/data'
import { getUrl, uploadData } from 'aws-amplify/storage'
import Write from './Write'
import outputs from '../amplify_outputs.json'
import cloudTechIcon from './assets/cloud-tech.svg'

Amplify.configure(outputs)
const client = generateClient()
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
  return String(html || '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript:/gi, '')
}

function isLikelyHtmlContent(content) {
  const source = String(content || '').trim()
  if (!source) return false
  return /<(p|div|span|strong|em|h1|h2|h3|ul|ol|li|pre|code|img|video|br)\b/i.test(source)
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

function contentToSpeechText(content) {
  const blocks = parseContentBlocks(content || '')
  const chunks = blocks
    .map((block) => {
      if (block.type === 'text') return block.value
      if (block.type === 'code' || block.type === 'mermaid') return 'Code snippet.'
      return ''
    })
    .filter(Boolean)
  return chunks.join('\n\n').trim()
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
  const [profileForm, setProfileForm] = useState({ username: '', email: '', bio: '', avatarUrl: '' })

  const [showComposer, setShowComposer] = useState(false)
  const [editingPostId, setEditingPostId] = useState(null)
  const [savingPost, setSavingPost] = useState(false)
  const [activePostId, setActivePostId] = useState(null)
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [headerScrolled, setHeaderScrolled] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [readNotificationIds, setReadNotificationIds] = useState([])
  const [deletedNotificationIds, setDeletedNotificationIds] = useState([])
  const [savedPostIds, setSavedPostIds] = useState([])
  const [followedAuthorSubs, setFollowedAuthorSubs] = useState([])
  const [mediaUrlCache, setMediaUrlCache] = useState({})
  const [moderations, setModerations] = useState([])
  const mediaUrlCacheRef = useRef({})
  const notificationWrapRef = useRef(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortMode, setSortMode] = useState('latest')

  useEffect(() => {
    bootstrap()
  }, [])

  useEffect(() => {
    const onScroll = () => setHeaderScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const postIdFromUrl = new URLSearchParams(window.location.search).get('post')
    if (postIdFromUrl) setActivePostId(postIdFromUrl)
  }, [])

  useEffect(() => {
    if (!currentUser) return
    setProfileForm((prev) => ({
      ...prev,
      username: userAttrs.name || '',
      email: userAttrs.email || '',
    }))
  }, [currentUser, userAttrs])

  useEffect(() => {
    if (!currentUser) {
      setReadNotificationIds([])
      setDeletedNotificationIds([])
      setSavedPostIds([])
      setFollowedAuthorSubs([])
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
      }))
  }, [currentUser, posts, postLikes])

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
      }))
  }, [currentUser, posts, comments])

  const notifications = useMemo(
    () =>
      [...postLikeNotifications, ...commentNotifications].sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
      ),
    [postLikeNotifications, commentNotifications],
  )

  const visibleNotifications = useMemo(
    () => notifications.filter((n) => !deletedNotificationIds.includes(n.id)),
    [notifications, deletedNotificationIds],
  )

  const unreadNotificationCount = useMemo(() => {
    return visibleNotifications.filter((n) => !readNotificationIds.includes(n.id)).length
  }, [visibleNotifications, readNotificationIds])

  const adminUsers = useMemo(() => {
    const map = new Map()
    posts.forEach((p) => {
      if (p.authorSub) map.set(p.authorSub, p.authorName || p.authorSub)
    })
    comments.forEach((c) => {
      if (c.authorSub && !map.has(c.authorSub)) map.set(c.authorSub, c.authorName || c.authorSub)
    })
    postLikes.forEach((l) => {
      if (l.likerSub && !map.has(l.likerSub)) map.set(l.likerSub, l.likerName || l.likerSub)
    })
    return Array.from(map.entries()).map(([sub, name]) => ({ sub, name }))
  }, [posts, comments, postLikes])

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
      await refreshData(false, 'userPool')
    } catch {
      setCurrentUser(null)
      setUserAttrs({ email: '', name: '' })
      setIsAdmin(false)
      setModerations([])
      await refreshData(false, 'apiKey')
    } finally {
      setLoading(false)
    }
  }

  async function refreshData(withSpinner = true, authModeOverride = null) {
    if (withSpinner) setRefreshing(true)
    const readAuthMode = authModeOverride || (currentUser ? 'userPool' : 'apiKey')
    try {
      const [postRes, commentRes, commentLikeRes, postLikeRes] = await Promise.all([
        client.models.Post.list({ authMode: readAuthMode }),
        client.models.Comment.list({ authMode: readAuthMode }),
        client.models.CommentLike.list({ authMode: readAuthMode }),
        client.models.PostLike.list({ authMode: readAuthMode }),
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

      if (readAuthMode === 'userPool' && isAdmin) {
        try {
          const moderationRes = await client.models.UserModeration.list({ authMode: 'userPool' })
          if (!moderationRes.errors?.length) setModerations(moderationRes.data)
        } catch {
          setModerations([])
        }
      } else if (!isAdmin) {
        setModerations([])
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

  function goHomeView() {
    setActivePostId(null)
    setPostQueryParam('')
    setShowAdminPanel(false)
    setShowComposer(false)
    setEditingPostId(null)
    setShowProfile(false)
    setShowNotifications(false)
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

      setUserAttrs((prev) => ({ ...prev, name: nextName, email: nextEmail }))
      setShowProfile(false)
      await refreshData()
    } catch (err) {
      console.error(err)
      alert('Could not update profile.')
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
        mediaType: cover.mediaType,
        mediaUrl: cover.mediaUrl,
        mediaPath: cover.mediaPath,
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
        mediaType: cover.mediaType,
        mediaUrl: cover.mediaUrl,
        mediaPath: cover.mediaPath,
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
          .map((l) => client.models.CommentLike.delete({ id: l.id })),
      )

      await Promise.all(postComments.map((c) => client.models.Comment.delete({ id: c.id })))
      await Promise.all(
        postLikes
          .filter((l) => l.postId === postId)
          .map((l) => client.models.PostLike.delete({ id: l.id })),
      )

      await client.models.Post.delete({ id: postId })

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
          <div className="header-brand-text">
            <h1>Cloud Journey</h1>
            <p>Write. Share. Grow.</p>
          </div>
        </div>

        <div className="header-right">
          {currentUser ? (
            <button
              className="username-btn"
              onClick={() => {
                setShowProfile((v) => !v)
                setShowComposer(false)
                setShowNotifications(false)
              }}
            >
              {displayName}
            </button>
          ) : (
            <span className="guest-pill">Guest</span>
          )}

          {currentUser ? (
            <>
              <div className="notification-wrap" ref={notificationWrapRef}>
                <button
                  className="ghost notification-btn"
                  onClick={() => {
                    setShowNotifications((prev) => !prev)
                    setShowProfile(false)
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
                  <div className="notification-panel">
                    <h4>Notifications</h4>
                    {visibleNotifications.length ? (
                      <>
                        <div className="notification-actions">
                          <button type="button" className="ghost" onClick={markNotificationsSeen}>
                            Mark all as read
                          </button>
                        </div>
                        <ul>
                        {visibleNotifications.slice(0, 15).map((item) => (
                          <li key={item.id}>
                            <p>{item.text}</p>
                            <small>{new Date(item.createdAt).toLocaleString()}</small>
                            <div className="notification-item-actions">
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

              <button className="ghost" onClick={handleLogout} aria-label="Logout">
                Logout
              </button>
              {isAdmin ? (
                <button
                  className="ghost"
                  onClick={() => {
                    setShowAdminPanel((v) => !v)
                    setShowComposer(false)
                    setShowProfile(false)
                    setActivePostId(null)
                    setPostQueryParam('')
                  }}
                  aria-label="Admin dashboard"
                >
                  Admin
                </button>
              ) : null}
            </>
          ) : (
            <button className="ghost" onClick={() => setShowAuth(true)} aria-label="Login">
              Login
            </button>
          )}
        </div>
      </header>

      <main className="content-shell">
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
                  setShowComposer((v) => !v)
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

        {showAdminPanel && isAdmin ? (
          <section className="card admin-panel">
            <h3>Admin Dashboard</h3>
            <div className="admin-metrics">
              <div className="admin-metric">
                <small>Total Users (known)</small>
                <strong>{adminUsers.length}</strong>
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

            <h4>Users</h4>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Sub</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {adminUsers.map((u) => {
                    const blocked = blockedUserSubs.has(u.sub)
                    return (
                      <tr key={u.sub}>
                        <td>{u.name || 'User'}</td>
                        <td>{u.sub}</td>
                        <td>{blocked ? 'Blocked' : 'Active'}</td>
                        <td>
                          {blocked ? (
                            <button className="ghost" onClick={() => setUserBlocked(u.sub, false)}>
                              Unblock
                            </button>
                          ) : (
                            <button className="danger" onClick={() => setUserBlocked(u.sub, true, 'Blocked by admin')}>
                              Block
                            </button>
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

        {!showAdminPanel && !activePost ? (
          <section className="posts-section">
            <div className="preview-grid">
              {displayPosts.map((post, index) => (
                <PostPreviewCard
                  key={post.id}
                  post={post}
                  featured={index === 0 && !searchQuery.trim()}
                  saved={savedPostIds.includes(post.id)}
                  currentUser={currentUser}
                  isFollowing={followedAuthorSubs.includes(post.authorSub)}
                  onToggleFollow={toggleFollowAuthor}
                  resolveMediaSource={resolveMediaSource}
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
        {!showAdminPanel && activePost ? (
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

      {showAuth ? (
        <div className="auth-overlay" onClick={() => setShowAuth(false)}>
          <form
            className="card auth-modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleAuthSubmit}
          >
            {authMode !== 'confirm' ? (
              <div className="auth-switch">
                <button
                  type="button"
                  className={authMode === 'login' ? 'active' : ''}
                  onClick={() => {
                    setAuthMode('login')
                    setAuthError('')
                  }}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  className={authMode === 'signup' ? 'active' : ''}
                  onClick={() => {
                    setAuthMode('signup')
                    setAuthError('')
                  }}
                >
                  Sign Up
                </button>
              </div>
            ) : null}

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
              <button type="submit">
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
              <div className="button-row">
                <button type="button" className="ghost" onClick={handleGoogleLogin}>
                  Continue with Google
                </button>
              </div>
            ) : null}
          </form>
        </div>
      ) : null}

      {showProfile && currentUser ? (
        <div className="auth-overlay" onClick={() => setShowProfile(false)}>
          <form
            className="card auth-modal profile-modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={saveProfile}
          >
            <h3>{displayName}'s Profile</h3>
            <label>Username</label>
            <input
              value={profileForm.username}
              onChange={(e) => setProfileForm((prev) => ({ ...prev, username: e.target.value }))}
            />
            <label>Email</label>
            <input
              type="email"
              value={profileForm.email}
              onChange={(e) => setProfileForm((prev) => ({ ...prev, email: e.target.value }))}
            />
            <label>Bio</label>
            <textarea
              rows={4}
              value={profileForm.bio}
              onChange={(e) => setProfileForm((prev) => ({ ...prev, bio: e.target.value }))}
            />
            <div className="button-row">
              <button type="submit">Update Profile</button>
              <button className="ghost" type="button" onClick={() => setShowProfile(false)}>
                Close
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  )
}

function PostPreviewCard({
  post,
  onOpen,
  featured = false,
  saved = false,
  currentUser,
  isFollowing = false,
  onToggleFollow,
  resolveMediaSource,
}) {
  const readMinutes = estimateReadMinutes(post.content)
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
      <div className="by-follow-row">
        <small>By {post.authorName}</small>
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
}) {
  const [commentText, setCommentText] = useState('')
  const [editingCommentId, setEditingCommentId] = useState(null)
  const [editingCommentText, setEditingCommentText] = useState('')
  const [openCommentMenuId, setOpenCommentMenuId] = useState(null)
  const [speaking, setSpeaking] = useState(false)
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
  const hasInlineMedia = useMemo(
    () => contentBlocks.some((block) => block.type === 'image' || block.type === 'video'),
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
    if (!text) return

    const speakNow = () => {
      const utterance = new SpeechSynthesisUtterance(`${post.title}. ${text}`)
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

  return (
    <article className="card full-post" ref={postRef}>
      <div className="reading-progress">
        <span style={{ width: `${readProgress}%` }} />
      </div>
      <div className="full-post-top">
        <button className="ghost" onClick={onBack}>Back</button>
      </div>

      <div className="post-head">
        <div>
          <h2>{renderRichTitle(post.title, `full-title-${post.id}`)}</h2>
          <small>
            Owner: {post.authorName} | Created: {new Date(post.createdAt).toLocaleString()} | Updated: {new Date(post.updatedAt).toLocaleString()}
          </small>
          <div className="post-insights">
            <span>{readMinutes} min read</span>
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

      <div className="full-post-content">
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
              <div
                key={`${post.id}-full-html-${index}`}
                className="rich-html"
                dangerouslySetInnerHTML={{ __html: block.value }}
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
      </div>

      <div className="post-meta-actions">
        <button
          className={`ghost icon-action ${postLiked ? 'active-like' : ''}`}
          onClick={onTogglePostLike}
          disabled={!canInteract}
          aria-label="Like post"
          title="Like"
        >
          <span className="icon">{postLiked ? '\u2665' : '\u2661'}</span>
          <span>{post.likes.length}</span>
        </button>
        <button
          className="ghost icon-action"
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
        <button
          className="ghost icon-action"
          onClick={onShare}
          disabled={!canShare}
          aria-label="Copy share link"
          title="Copy link"
        >
          <span className="icon">{'\u{1F517}'}</span>
        </button>
        <button
          className={`ghost icon-action ${saved ? 'saved-active' : ''}`}
          onClick={onToggleSavePost}
          disabled={!canInteract}
          aria-label="Save post"
          title="Save"
        >
          <span className="icon">{saved ? '\u2605' : '\u2606'}</span>
        </button>
        <button
          className={`ghost icon-action ${speaking ? 'saved-active' : ''}`}
          onClick={handleListenToggle}
          disabled={!canListen}
          aria-label="Listen to post"
          title="Listen"
        >
          <span className="icon">{speaking ? '\u23F9' : '\u25B6'}</span>
          <span>{speaking ? 'Stop' : 'Listen'}</span>
        </button>
      </div>
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
      </div>
      <pre className="code-block">
        <code className="hljs" dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
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
