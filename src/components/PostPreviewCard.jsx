import InlineMedia from "./InlineMedia";
import {
  estimateReadMinutes,
  skillMeta,
  progressMeta,
  stripReadableText,
} from "../utils/richText";
import { renderRichTitle } from "../utils/richText.jsx";

export default function PostPreviewCard({
  post,
  onOpen,
  progressStatus = "",
  featured = false,
  saved = false,
  currentUser,
  isFollowing = false,
  onToggleFollow,
  resolveMediaSource,
  userBadges = [],
}) {
  const readMinutes = estimateReadMinutes(post.content);
  const practiceMins = Number(post.timeToPracticeMins || 0);
  const skill = skillMeta(post.skillLevel);
  const progress = progressStatus ? progressMeta(progressStatus) : null;
  const canFollowAuthor = currentUser && currentUser.userId !== post.authorSub;
  const coverSource = post.mediaPath || post.mediaUrl || "";
  const coverType = post.mediaType === "video" ? "video" : "image";
  const previewSnippet = stripReadableText(post.content)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  return (
    <article
      className={`card preview-card ${featured ? "featured" : ""}`}
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
          <strong>
            {stripReadableText(post.title)
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 72) || "Untitled"}
          </strong>
          <span>{previewSnippet || "Open post to read details."}</span>
        </div>
      )}
      <h4>{renderRichTitle(post.title, `card-title-${post.id}`)}</h4>
      <div className={`skill-pill ${skill.cls}`}>
        {skill.icon} {skill.label}
      </div>
      {progress ? (
        <div className={`progress-pill ${progress.cls}`}>
          {progress.icon} {progress.label}
        </div>
      ) : null}
      <div className="by-follow-row">
        <small
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            flexWrap: "wrap",
          }}
        >
          By {post.authorName}
          {userBadges.map((b) => (
            <span
              key={b.id}
              title={b.label}
              style={{
                fontSize: "0.85em",
                padding: "2px 6px",
                background: "var(--accent)",
                color: "white",
                borderRadius: "12px",
              }}
            >
              {b.icon} {b.label}
            </span>
          ))}
        </small>
        {canFollowAuthor ? (
          <button
            type="button"
            className={`ghost follow-pill ${isFollowing ? "is-following" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFollow?.(post.authorSub);
            }}
          >
            {isFollowing ? "Following" : "+ Follow"}
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
  );
}
