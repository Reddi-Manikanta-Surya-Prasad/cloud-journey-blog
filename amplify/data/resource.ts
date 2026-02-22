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
        hidden: a.boolean(),
        hiddenReason: a.string(),
        skillLevel: a.string(),
        tldr: a.string(),
        beginnerSummary: a.string(),
        proSummary: a.string(),
        whyMatters: a.string(),
        commonMistakes: a.string(),
        timeToPracticeMins: a.integer(),
        nextTopicTitle: a.string(),
        nextTopicUrl: a.string(),
        roadmapUrl: a.string(),
        versionLabel: a.string(),
        authorSub: a.string().required(),
        authorName: a.string().required(),
        likes: a.hasMany('PostLike', 'postId'),
        comments: a.hasMany('Comment', 'postId'),
      })
      .authorization((allow) => [
        allow.publicApiKey().to(['read']),
        allow.authenticated().to(['read']),
        allow.owner().to(['create', 'update', 'delete', 'read']),
        allow.groups(['ADMINS']).to(['read', 'update', 'delete']),
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
        allow.groups(['ADMINS']).to(['read', 'update', 'delete']),
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

    UserProfile: a
      .model({
        userSub: a.string().required(),
        email: a.string().required(),
        name: a.string().required(),
      })
      .authorization((allow) => [
        allow.owner().to(['create', 'update', 'read']),
        allow.groups(['ADMINS']).to(['read', 'update', 'delete']),
        allow.authenticated().to(['read']),
      ]),

    UserModeration: a
      .model({
        // Use userSub as id so one moderation record exists per user.
        id: a.id().required(),
        userSub: a.string().required(),
        blocked: a.boolean().required(),
        reason: a.string(),
        updatedBySub: a.string(),
        updatedByName: a.string(),
      })
      .authorization((allow) => [
        allow.groups(['ADMINS']).to(['create', 'read', 'update', 'delete']),
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
