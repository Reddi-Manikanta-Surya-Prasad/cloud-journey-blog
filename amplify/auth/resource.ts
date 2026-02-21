import { defineAuth, secret } from '@aws-amplify/backend'

export const auth = defineAuth({
  loginWith: {
    email: true,
    externalProviders: {
      google: {
        clientId: secret('GOOGLE_CLIENT_ID'),
        clientSecret: secret('GOOGLE_CLIENT_SECRET'),
        scopes: ['openid', 'email', 'profile'],
      },
      callbackUrls: [
        'http://localhost:5173/',
        'https://clouddjourney.suryareddi.in/',
      ],
      logoutUrls: [
        'http://localhost:5173/',
        'https://clouddjourney.suryareddi.in/',
      ],
    },
  },
  userAttributes: {
    preferredUsername: {
      required: false,
      mutable: true,
    },
  },
})
