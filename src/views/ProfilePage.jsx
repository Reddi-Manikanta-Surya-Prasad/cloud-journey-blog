import { stripReadableText } from "../utils/richText";

export default function ProfilePage({
  currentUser,
  posts,
  savedPostIds,
  communityMessages,
  newMessageSubject,
  newMessageText,
  setNewMessageSubject,
  setNewMessageText,
  submitCommunityMessage,
  profileTab,
  profileForm,
  setProfileForm,
  saveProfile,
  showDeleteWarning,
  setShowDeleteWarning,
  deletionReason,
  setDeletionReason,
  requestDeletion,
  onOpenPost,
  profileRef,
}) {
  return (
    <section
      ref={profileRef}
      className="card profile-page"
      style={{
        minHeight: "600px",
        border: "none",
        background: "transparent",
        boxShadow: "none",
      }}
    >
      <div className="profile-tab-content" style={{ marginTop: "20px" }}>
        {profileTab === "posts" && (
          <div className="profile-post-list">
            <h3 style={{ marginTop: 0 }}>My Posts</h3>
            {posts.filter((p) => p.authorSub === currentUser.userId).length ===
            0 ? (
              <p>You haven't published any posts yet.</p>
            ) : null}
            {posts
              .filter((p) => p.authorSub === currentUser.userId)
              .map((p) => (
                <div
                  key={p.id}
                  className="card preview-card"
                  style={{ marginBottom: "12px", cursor: "pointer" }}
                  onClick={() => onOpenPost(p.id)}
                >
                  <h4 style={{ margin: "0 0 8px 0" }}>
                    {stripReadableText(p.title).slice(0, 50)}...
                  </h4>
                  <small>
                    {new Date(p.createdAt).toLocaleDateString()} •{" "}
                    {p.likes.length} Likes • {p.comments.length} Comments
                  </small>
                </div>
              ))}
          </div>
        )}
        {profileTab === "saved" && (
          <div className="profile-post-list">
            <h3 style={{ marginTop: 0 }}>Saved Articles</h3>
            {posts.filter((p) => savedPostIds.includes(p.id)).length === 0 ? (
              <p>You haven't saved any posts yet.</p>
            ) : null}
            {posts
              .filter((p) => savedPostIds.includes(p.id))
              .map((p) => (
                <div
                  key={p.id}
                  className="card preview-card"
                  style={{ marginBottom: "12px", cursor: "pointer" }}
                  onClick={() => onOpenPost(p.id)}
                >
                  <h4 style={{ margin: "0 0 8px 0" }}>
                    {stripReadableText(p.title).slice(0, 50)}...
                  </h4>
                  <small>
                    By {p.authorName} •{" "}
                    {new Date(p.createdAt).toLocaleDateString()}
                  </small>
                </div>
              ))}
          </div>
        )}
        {profileTab === "messages" && (
          <div className="profile-messages">
            <h3 style={{ marginTop: 0 }}>Community Messages</h3>
            <div
              className="message-history"
              style={{
                marginBottom: "24px",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              {communityMessages.filter((m) => m.userSub === currentUser.userId)
                .length === 0 ? (
                <p>No messages sent to admin yet.</p>
              ) : null}
              {communityMessages
                .filter((m) => m.userSub === currentUser.userId)
                .map((m) => (
                  <div
                    key={m.id}
                    className="card"
                    style={{
                      padding: "16px",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: "8px",
                      }}
                    >
                      <strong style={{ fontSize: "1.1rem" }}>
                        {m.subject}
                      </strong>
                      <span
                        className={`status-badge ${m.status.toLowerCase()}`}
                      >
                        {m.status}
                      </span>
                    </div>
                    <p style={{ margin: "0 0 12px 0", fontSize: "0.95rem" }}>
                      {m.text}
                    </p>
                    {m.replyText && (
                      <div
                        style={{
                          padding: "12px",
                          background: "var(--bg-shell)",
                          borderRadius: "6px",
                          borderLeft: "3px solid var(--accent)",
                        }}
                      >
                        <strong style={{ fontSize: "0.9rem" }}>
                          Admin Reply:
                        </strong>
                        <p style={{ margin: "4px 0 0 0", fontSize: "0.9rem" }}>
                          {m.replyText}
                        </p>
                        <small
                          style={{
                            display: "block",
                            marginTop: "8px",
                            opacity: 0.7,
                          }}
                        >
                          {new Date(m.repliedAt).toLocaleString()}
                        </small>
                      </div>
                    )}
                  </div>
                ))}
            </div>
            <form
              className="card"
              style={{ border: "2px solid var(--border)" }}
              onSubmit={submitCommunityMessage}
            >
              <h4 style={{ marginTop: 0 }}>Send a new message to Admin</h4>
              <input
                placeholder="Subject"
                value={newMessageSubject}
                onChange={(e) => setNewMessageSubject(e.target.value)}
                required
                style={{ marginBottom: "12px" }}
              />
              <textarea
                rows="3"
                placeholder="How can we help?"
                value={newMessageText}
                onChange={(e) => setNewMessageText(e.target.value)}
                required
                style={{ marginBottom: "12px" }}
              />
              <button
                type="submit"
                disabled={!newMessageSubject || !newMessageText}
              >
                Send Message
              </button>
            </form>
          </div>
        )}
        {profileTab === "settings" && (
          <form
            className="profile-settings-form"
            onSubmit={(e) => {
              e.preventDefault();
              saveProfile(e);
            }}
          >
            <h3 style={{ marginTop: 0 }}>Profile &amp; Account Setup</h3>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "16px",
                marginBottom: "12px",
              }}
            >
              <div>
                <label>Username *</label>
                <input
                  value={profileForm.username}
                  onChange={(e) =>
                    setProfileForm((prev) => ({
                      ...prev,
                      username: e.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div>
                <label>Email Address *</label>
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={(e) =>
                    setProfileForm((prev) => ({
                      ...prev,
                      email: e.target.value,
                    }))
                  }
                  required
                />
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "16px",
                marginBottom: "12px",
              }}
            >
              <div>
                <label>Full Name</label>
                <input
                  placeholder="e.g. John Doe"
                  value={profileForm.fullName}
                  onChange={(e) =>
                    setProfileForm((prev) => ({
                      ...prev,
                      fullName: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label>Profession / Title</label>
                <input
                  placeholder="e.g. Cloud Architect"
                  value={profileForm.profession}
                  onChange={(e) =>
                    setProfileForm((prev) => ({
                      ...prev,
                      profession: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "16px",
                marginBottom: "12px",
              }}
            >
              <div>
                <label>LinkedIn URL</label>
                <input
                  type="url"
                  placeholder="https://linkedin.com/in/..."
                  value={profileForm.linkedIn}
                  onChange={(e) =>
                    setProfileForm((prev) => ({
                      ...prev,
                      linkedIn: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label>Years of Experience</label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 5"
                  value={profileForm.yearsOfExperience}
                  onChange={(e) =>
                    setProfileForm((prev) => ({
                      ...prev,
                      yearsOfExperience: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "16px",
                marginBottom: "12px",
              }}
            >
              <div>
                <label>Credly / Certification URL</label>
                <input
                  type="url"
                  placeholder="https://www.credly.com/badges/..."
                  value={profileForm.credlyUrl}
                  onChange={(e) =>
                    setProfileForm((prev) => ({
                      ...prev,
                      credlyUrl: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <label>Bio (Short Introduction)</label>
            <textarea
              rows={3}
              placeholder="Tell the community about yourself..."
              value={profileForm.bio}
              onChange={(e) =>
                setProfileForm((prev) => ({ ...prev, bio: e.target.value }))
              }
              style={{ marginBottom: "12px", marginTop: "16px" }}
            />
            <div className="button-row" style={{ marginTop: "16px" }}>
              <button type="submit">Update Profile Details</button>
            </div>

            <hr style={{ margin: "32px 0", borderColor: "var(--border)" }} />
            <div
              className="danger-zone card"
              style={{ borderColor: "#ef4444" }}
            >
              <h4 style={{ color: "#ef4444", marginTop: 0 }}> Danger Zone</h4>
              <p style={{ fontSize: "0.9rem" }}>
                Permanently delete your account and all associated data.
              </p>
              <button
                type="button"
                className="danger"
                onClick={() => setShowDeleteWarning(true)}
              >
                Request Account Deletion
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
