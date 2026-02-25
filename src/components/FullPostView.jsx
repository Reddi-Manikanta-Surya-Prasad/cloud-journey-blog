import { useEffect, useMemo, useRef, useState } from 'react'
import InlineMedia from './InlineMedia'
import RichHtml from './RichHtml'
import CodeBlock from './CodeBlock'
import MermaidBlock from './MermaidBlock'
import {
    parseContentBlocks,
    estimateReadMinutes,
    skillMeta,
    progressMeta,
    stripReadableText,
    contentToSpeechText,
    isOwnedByCurrentUser,
} from '../utils/richText'
import { renderRichTitle, renderStyledTextBlock } from '../utils/richText.jsx'


export default function FullPostView({
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
    const coverSource = post.mediaPath || post.mediaUrl || ''
    const coverType = post.mediaType === 'video' ? 'video' : 'image'
    const hasInlineMedia = useMemo(
        () => contentBlocks.some((block) => {
            if (block.type === 'image' || block.type === 'video') return true
            if (block.type === 'html' && coverSource) {
                return block.value?.includes(coverSource)
            }
            return false
        }),
        [contentBlocks, coverSource],
    )

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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', margin: '10px 0 4px' }}>
                        <div style={{
                            width: 40, height: 40, borderRadius: '50%',
                            background: 'linear-gradient(135deg,#4facfe,#00f2fe)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 700, color: '#fff', fontSize: '1rem', flexShrink: 0,
                        }}>
                            {(post.authorName || 'U')[0].toUpperCase()}
                        </div>
                        <div>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{post.authorName || 'Unknown'}</div>
                            <div style={{ fontSize: '0.78rem', opacity: 0.55 }}>
                                Published {new Date(post.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                                {post.versionLabel ? ` · v${post.versionLabel}` : ''}
                            </div>
                        </div>
                        <div className={`skill-pill ${skill.cls}`} style={{ marginLeft: 4 }}>{skill.icon} {skill.label}</div>
                    </div>
                    <div className="post-insights" style={{ marginLeft: 2 }}>
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
                <div className="depth-toggle-row" style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0 8px', flexWrap: 'wrap' }}>
                    <small style={{ opacity: 0.6, fontWeight: 500, letterSpacing: '0.03em' }}>EXPLAIN MODE</small>
                    {canInteract ? (
                        <div style={{ display: 'flex', background: 'var(--bg-shell,#f0f0f0)', borderRadius: 99, padding: 3, gap: 2 }}>
                            <button
                                onClick={() => setDepthMode('beginner')}
                                style={{
                                    border: 'none', cursor: 'pointer', padding: '4px 16px',
                                    borderRadius: 99, fontWeight: 600, fontSize: '0.82rem',
                                    transition: 'all 0.2s',
                                    background: depthMode === 'beginner' ? 'var(--accent,#4facfe)' : 'transparent',
                                    color: depthMode === 'beginner' ? '#fff' : 'inherit',
                                    boxShadow: depthMode === 'beginner' ? '0 2px 8px rgba(79,172,254,0.4)' : 'none',
                                }}
                            >🟢 Beginner</button>
                            <button
                                onClick={() => setDepthMode('pro')}
                                style={{
                                    border: 'none', cursor: 'pointer', padding: '4px 16px',
                                    borderRadius: 99, fontWeight: 600, fontSize: '0.82rem',
                                    transition: 'all 0.2s',
                                    background: depthMode === 'pro' ? '#1a1a2e' : 'transparent',
                                    color: depthMode === 'pro' ? '#fff' : 'inherit',
                                    boxShadow: depthMode === 'pro' ? '0 2px 8px rgba(0,0,0,0.3)' : 'none',
                                }}
                            >⚫ Pro</button>
                        </div>
                    ) : null}
                </div>

                {(() => {
                    const isOnline = post.authorSub.charCodeAt(0) % 2 === 0 || post.authorSub === currentUser?.userId
                    return (
                        <div className="author-meta">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                {/* Name + dot tightly grouped so dot is always right next to name */}
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                    <span className="author-name">{post.authorName || 'Unknown'}</span>
                                    <span className={`status-dot ${isOnline ? 'online' : 'offline'}`} title={isOnline ? 'Online' : 'Offline'} />
                                </span>
                                {userBadges.map(b => (
                                    <span key={b.id} title={b.label} style={{ fontSize: '0.8em', padding: '2px 6px', background: 'var(--accent)', color: 'white', borderRadius: '12px', fontWeight: '500' }}>
                                        {b.icon} {b.label}
                                    </span>
                                ))}
                            </div>
                            <span className="post-date">{new Date(post.createdAt || '').toLocaleDateString()}</span>
                            {
                                canManagePost ? (
                                    <div className="managed-actions">
                                        <button className="ghost" onClick={onEdit}>
                                            Edit
                                        </button>
                                        <button className="ghost text-danger" onClick={onDelete}>
                                            Delete
                                        </button>
                                    </div>
                                ) : null
                            }
                            {
                                canFollowAuthor ? (
                                    <button
                                        className={`ghost follow-btn ${isFollowing ? 'following' : ''}`}
                                        onClick={() => onToggleFollow(post.authorSub)}
                                    >
                                        {isFollowing ? 'Following' : 'Follow'}
                                    </button>
                                ) : null
                            }
                        </div>
                    )
                })()}
                {post.tldr ? (
                    <section style={{
                        background: 'linear-gradient(135deg, rgba(79,172,254,0.12), rgba(0,242,254,0.08))',
                        border: '1px solid rgba(79,172,254,0.3)', borderRadius: 12,
                        padding: '14px 18px', margin: '16px 0',
                    }}>
                        <h4 style={{ margin: '0 0 6px', fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.65 }}>⚡ TL;DR</h4>
                        <p style={{ margin: 0, fontWeight: 500 }}>{post.tldr}</p>
                    </section>
                ) : null}
                {depthSummary ? (
                    <section style={{
                        background: depthMode === 'pro'
                            ? 'linear-gradient(135deg, rgba(26,26,46,0.15), rgba(50,50,100,0.1))'
                            : 'linear-gradient(135deg, rgba(52,211,153,0.1), rgba(16,185,129,0.08))',
                        border: `1px solid ${depthMode === 'pro' ? 'rgba(100,100,200,0.3)' : 'rgba(52,211,153,0.3)'}`,
                        borderRadius: 12, padding: '14px 18px', margin: '12px 0',
                    }}>
                        <h4 style={{ margin: '0 0 6px', fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.65 }}>
                            {depthMode === 'pro' ? '⚫ Pro Overview' : '🟢 Beginner Overview'}
                        </h4>
                        <p style={{ margin: 0 }}>{depthSummary}</p>
                    </section>
                ) : null}
                {post.whyMatters ? (
                    <section style={{
                        background: 'linear-gradient(135deg, rgba(251,191,36,0.1), rgba(245,158,11,0.07))',
                        border: '1px solid rgba(251,191,36,0.3)', borderRadius: 12,
                        padding: '14px 18px', margin: '12px 0',
                    }}>
                        <h4 style={{ margin: '0 0 6px', fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.65 }}>💡 Why This Matters</h4>
                        <p style={{ margin: 0 }}>{post.whyMatters}</p>
                    </section>
                ) : null}
                {post.commonMistakes ? (
                    <section style={{
                        background: 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(220,38,38,0.05))',
                        border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12,
                        padding: '14px 18px', margin: '12px 0',
                    }}>
                        <h4 style={{ margin: '0 0 6px', fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.65 }}>⚠️ Common Mistakes</h4>
                        <p style={{ margin: 0 }}>{post.commonMistakes}</p>
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

            {
                canInteract ? (
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
                ) : null
            }
            {
                !canInteract ? (
                    <p className="guest-action-hint">Login to like, comment, and save posts.</p>
                ) : null
            }

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
        </article >
    )
}
