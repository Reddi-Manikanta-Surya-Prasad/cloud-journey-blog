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
import Write from './Write'
import outputs from '../amplify_outputs.json'
import cloudTechIcon from './assets/cloud-tech.svg'
import PostPreviewCard from './components/PostPreviewCard'
import FullPostView from './components/FullPostView'
import ProfilePage from './views/ProfilePage'
import AdminPanel from './views/AdminPanel'
import {
  toStorageSafeName,
  deriveFriendlyUserName,
  toTitleCaseName,
  deriveCoverMedia,
  parseContentBlocks,
  stripReadableText,
  isOwnedByCurrentUser,
} from './utils/richText'

Amplify.configure(outputs)
const client = generateClient()
window.client = client
const ADMIN_EMAILS = ['reddimani14@gmail.com']
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
      if (count >= 5) badges.push({ id: 'prolific', label: 'Prolific Writer', icon: 'âœï¸' })
      if ((likesBySub.get(sub) || 0) >= 50) badges.push({ id: 'top', label: 'Top Contributor', icon: 'ðŸŽ¯' })
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
          // Also scan HTML blocks for embedded media/ src attributes (rich-editor posts)
          if (block.type === 'html' && block.value) {
            const srcMatches = block.value.matchAll(/src=["'](media\/[^"']+)["']/gi)
            for (const m of srcMatches) {
              if (!cacheSnapshot[m[1]]) inlinePaths.add(m[1])
            }
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
      confusing: 'ðŸ¤¯ Thanks for the feedback! We\'ll try to make it clearer.',
      aha: 'ðŸ’¡ Awesome! Glad it clicked for you.',
      useful: 'ðŸ”¥ Fantastic! Thanks for reading.'
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
                {theme === 'interactive-canvas' ? '\ud83c\udf1e' : '\ud83d\udc7e'}
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
                {theme === 'interactive-canvas' ? '\ud83c\udf1e' : '\ud83d\udc7e'}
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
          <ProfilePage
            currentUser={currentUser}
            posts={allDisplayPosts}
            savedPostIds={savedPostIds}
            communityMessages={communityMessages}
            newMessageSubject={newMessageSubject}
            newMessageText={newMessageText}
            setNewMessageSubject={setNewMessageSubject}
            setNewMessageText={setNewMessageText}
            submitCommunityMessage={submitCommunityMessage}
            profileTab={profileTab}
            profileForm={profileForm}
            setProfileForm={setProfileForm}
            saveProfile={saveProfile}
            showDeleteWarning={showDeleteWarning}
            setShowDeleteWarning={setShowDeleteWarning}
            deletionReason={deletionReason}
            setDeletionReason={setDeletionReason}
            requestDeletion={requestDeletion}
            onOpenPost={(id) => { setShowProfile(false); setActivePostId(id); setPostQueryParam(id) }}
            profileRef={profileRef}
          />
        ) : null}

        {showAdminPanel && isAdmin ? (
          <AdminPanel
            posts={allDisplayPosts}
            comments={comments}
            communityMessages={communityMessages}
            cognitoUsers={cognitoUsers}
            activeUsers={activeUsers}
            registeredUsers={registeredUsers}
            blockedUserSubs={blockedUserSubs}
            activeUsersByDay={activeUsersByDay}
            adminTab={adminTab}
            setAdminTab={setAdminTab}
            deletePost={deletePost}
            deleteComment={deleteComment}
            togglePostHidden={togglePostHidden}
            setUserBlocked={setUserBlocked}
            adminEditUser={adminEditUser}
            adminTriggerPasswordReset={adminTriggerPasswordReset}
            adminDeleteUser={adminDeleteUser}
            adminResetAccount={adminResetAccount}
            replyToCommunityMessage={replyToCommunityMessage}
            client={client}
            refreshData={refreshData}
          />
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
        ) : null
        }

        {
          !showAdminPanel && !showProfile && !activePost ? (
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
          ) : null
        }
        {
          !showAdminPanel && !showProfile && activePost ? (
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
          ) : null
        }
      </main >

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

      {
        showDeleteWarning && (
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
        )
      }

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
              <h3 style={{ color: '#ef4444', marginTop: 0 }}>âš ï¸ Delete Account</h3>
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

export default App


