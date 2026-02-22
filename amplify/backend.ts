import { defineBackend } from '@aws-amplify/backend'
import * as iam from 'aws-cdk-lib/aws-iam'
import { auth } from './auth/resource'
import { data } from './data/resource'
import { storage } from './storage/resource'
import { listUsers } from './functions/list-users/resource'

const backend = defineBackend({
  auth,
  data,
  storage,
  listUsers,
})

const listUsersLambda = backend.listUsers.resources.lambda
listUsersLambda.addEnvironment('USER_POOL_ID', backend.auth.resources.userPool.userPoolId)

listUsersLambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['cognito-idp:ListUsers'],
    resources: [backend.auth.resources.userPool.userPoolArn],
  })
)
