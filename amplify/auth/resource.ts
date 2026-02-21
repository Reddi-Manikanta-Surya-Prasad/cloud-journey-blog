import { defineAuth, secret } from '@aws-amplify/backend'

export const auth = defineAuth({
  groups: ['ADMINS'],
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
        'https://main.d14oin3rflwldw.amplifyapp.com/',
        'https://cloudjourney.suryareddi.in/',
        'https://clouddjourney.suryareddi.in/',
        'https://djourney.suryareddi.in/',
      ],
      logoutUrls: [
        'http://localhost:5173/',
        'https://main.d14oin3rflwldw.amplifyapp.com/',
        'https://cloudjourney.suryareddi.in/',
        'https://clouddjourney.suryareddi.in/',
        'https://djourney.suryareddi.in/',
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
