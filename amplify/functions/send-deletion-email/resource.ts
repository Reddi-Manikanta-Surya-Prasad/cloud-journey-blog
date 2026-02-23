import { defineFunction } from '@aws-amplify/backend'

export const sendDeletionEmail = defineFunction({
    name: 'send-deletion-email',
    entry: './handler.ts'
})
