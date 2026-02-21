import { type ClientSchema, a, defineData } from '@aws-amplify/backend'

const schema = a
  .schema({
    Post: a
      .model({
        title: a.string().required(),
        content: a.string().required(),
        mediaType: a.string(),
        mediaUrl: a.string(),
        mediaPath: a.string(),
        authorSub: a.string().required(),
        authorName: a.string().required(),
        likes: a.hasMany('PostLike', 'postId'),
        comments: a.hasMany('Comment', 'postId'),
      })
      .authorization((allow) => [
        allow.publicApiKey().to(['read']),
        allow.authenticated().to(['read']),
        allow.owner().to(['create', 'update', 'delete', 'read']),
      ]),

    Comment: a
      .model({
        postId: a.id().required(),
        post: a.belongsTo('Post', 'postId'),
        text: a.string().required(),
        authorSub: a.string().required(),
        authorName: a.string().required(),
        likes: a.hasMany('CommentLike', 'commentId'),
      })
      .authorization((allow) => [
        allow.publicApiKey().to(['read']),
        allow.authenticated().to(['read', 'create', 'update', 'delete']),
      ]),

    CommentLike: a
      .model({
        commentId: a.id().required(),
        comment: a.belongsTo('Comment', 'commentId'),
        likerSub: a.string().required(),
      })
      .authorization((allow) => [
        allow.publicApiKey().to(['read']),
        allow.authenticated().to(['read', 'create', 'delete']),
      ]),

    PostLike: a
      .model({
        postId: a.id().required(),
        post: a.belongsTo('Post', 'postId'),
        likerSub: a.string().required(),
        likerName: a.string(),
      })
      .authorization((allow) => [
        allow.publicApiKey().to(['read']),
        allow.authenticated().to(['read', 'create', 'delete']),
      ]),
  })
  .authorization((allow) => [allow.authenticated()])

export type Schema = ClientSchema<typeof schema>

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    },
  },
})
