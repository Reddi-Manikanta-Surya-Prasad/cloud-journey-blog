const now = new Date().toISOString()

export const seedPosts = [
  {
    id: 'seed-1',
    authorId: 'seed-user',
    authorName: 'Admin',
    title: 'Welcome to your new blog app',
    content:
      'You can create, edit, update, and delete posts. Add image/video URLs and manage comments with likes.',
    mediaType: 'image',
    mediaUrl:
      'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=1200&q=80',
    likes: [],
    createdAt: now,
    updatedAt: now,
    comments: [],
  },
]

export const storageKeys = {
  users: 'blog_app_users_v1',
  posts: 'blog_app_posts_v1',
  session: 'blog_app_session_v1',
}
