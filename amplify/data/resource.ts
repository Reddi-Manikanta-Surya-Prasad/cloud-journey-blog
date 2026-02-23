import { type ClientSchema, a, defineData } from '@aws-amplify/backend'
import { listUsers } from '../functions/list-users/resource'
import { sendDeletionEmail } from '../functions/send-deletion-email/resource'

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
        level: a.string(),    // Beginner, Intermediate, Advanced, Pro
        topic: a.string(),    // Custom user-defined string topic
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
        devToUrl: a.string(),
        hashnodeUrl: a.string(),
        mediumUrl: a.string(),
        linkedInUrl: a.string(),
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
        fullName: a.string(),
        profession: a.string(),
        linkedIn: a.string(),
        yearsOfExperience: a.integer(),
        bio: a.string(),
        deleteRequested: a.boolean(),
        credlyUrl: a.string(),
        devToToken: a.string(),
        hashnodeToken: a.string(),
        mediumToken: a.string(),
        linkedInToken: a.string(),
        linkedInMemberId: a.string(),
        linkedInClientId: a.string(),
        linkedInClientSecret: a.string(),
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

    CommunityMessage: a
      .model({
        userSub: a.string().required(),
        userName: a.string().required(),
        subject: a.string().required(),
        text: a.string().required(),
        replyText: a.string(),
        repliedAt: a.datetime(),
        status: a.string().required(), // e.g. OPEN, RESOLVED
      })
      .authorization((allow) => [
        allow.owner().to(['create', 'read']),
        allow.groups(['ADMINS']).to(['read', 'update', 'delete']),
      ]),

    listCognitoUsers: a
      .query()
      .arguments({
        limit: a.integer(),
        nextToken: a.string(),
      })
      .returns(
        a.customType({
          usersJson: a.string().required(),
          nextToken: a.string(),
        })
      )
      .handler(a.handler.function(listUsers))
      .authorization((allow) => [allow.groups(['ADMINS'])]),

    sendDeletionEmail: a
      .mutation()
      .arguments({
        subject: a.string().required(),
        body: a.string().required(),
        userEmail: a.string().required(),
        reason: a.string().required(),
        postCount: a.integer().required(),
        commentCount: a.integer().required(),
        savedCount: a.integer().required()
      })
      .returns(
        a.customType({
          success: a.boolean().required(),
          error: a.string(),
        })
      )
      .handler(a.handler.function(sendDeletionEmail))
      .authorization((allow) => [allow.authenticated()]),
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
