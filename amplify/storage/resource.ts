import { defineStorage } from '@aws-amplify/backend'

export const storage = defineStorage({
  name: 'blogMedia',
  access: (allow) => ({
    'media/*': [
      allow.guest.to(['read']),
      allow.authenticated.to(['read', 'write', 'delete']),
    ],
  }),
})
