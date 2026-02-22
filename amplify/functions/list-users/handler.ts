import type { Schema } from '../../data/resource'
import { CognitoIdentityProviderClient, ListUsersCommand } from '@aws-sdk/client-cognito-identity-provider'

type Handler = Schema['listCognitoUsers']['functionHandler']

const client = new CognitoIdentityProviderClient()

export const handler: Handler = async (event) => {
    const userPoolId = process.env.USER_POOL_ID
    if (!userPoolId) {
        throw new Error('USER_POOL_ID is not set in environment.')
    }

    try {
        const command = new ListUsersCommand({
            UserPoolId: userPoolId,
            Limit: event.arguments?.limit || 60,
            PaginationToken: event.arguments?.nextToken || undefined,
        })

        const response = await client.send(command)

        // We stringify the entire array of user objects so GraphQL can return it as an AWSJSON scalar easily 
        return {
            usersJson: JSON.stringify(response.Users || []),
            nextToken: response.PaginationToken || null,
        }
    } catch (err) {
        console.error('Error listing Cognito users:', err)
        throw err
    }
}
