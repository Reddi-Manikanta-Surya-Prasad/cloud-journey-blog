import { defineBackend } from '@aws-amplify/backend'
import * as iam from 'aws-cdk-lib/aws-iam'
import { auth } from './auth/resource'
import { data } from './data/resource'
import { storage } from './storage/resource'
import { listUsers } from './functions/list-users/resource'
import { sendDeletionEmail } from './functions/send-deletion-email/resource'
import { crossPost } from './functions/cross-post/resource'

const backend = defineBackend({
  auth,
  data,
  storage,
  listUsers,
  sendDeletionEmail,
  crossPost,
})


const listUsersLambda = backend.listUsers.resources.lambda
listUsersLambda.addEnvironment('USER_POOL_ID', backend.auth.resources.userPool.userPoolId)

listUsersLambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['cognito-idp:ListUsers'],
    resources: [backend.auth.resources.userPool.userPoolArn],
  })
)

const sendEmailLambda = backend.sendDeletionEmail.resources.lambda
sendEmailLambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['ses:SendEmail'],
    resources: ['*'], // Sandbox requires wide resource mapping or specific verified identities. Wide mapping is standard here. 
  })
)
