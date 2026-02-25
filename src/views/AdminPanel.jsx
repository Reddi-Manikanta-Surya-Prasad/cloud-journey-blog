export default function AdminPanel({
    posts,
    comments,
    communityMessages,
    cognitoUsers,
    activeUsers,
    registeredUsers,
    blockedUserSubs,
    activeUsersByDay,
    adminTab,
    setAdminTab,
    deletePost,
    deleteComment,
    togglePostHidden,
    setUserBlocked,
    adminEditUser,
    adminTriggerPasswordReset,
    adminDeleteUser,
    adminResetAccount,
    replyToCommunityMessage,
    client,
    refreshData,
}) {
    return (
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
                <button className={`ghost ${adminTab === 'users' ? 'active-tab' : ''}`} onClick={() => setAdminTab('users')}>Users &amp; Stats</button>
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
    )
}
