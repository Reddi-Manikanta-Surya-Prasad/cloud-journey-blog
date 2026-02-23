import { defineFunction } from '@aws-amplify/backend'

export const crossPost = defineFunction({
    name: 'cross-post',
    entry: './handler.ts',
    timeoutSeconds: 30, // 30s timeout for bulk API calls
})
