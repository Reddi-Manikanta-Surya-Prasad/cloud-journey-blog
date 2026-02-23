import { env } from '$amplify/env/send-deletion-email'
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'

const ses = new SESClient()
const ADMIN_EMAIL = 'reddimani14@gmail.com' // Using the known verified email

export const handler = async (event) => {
    const { subject, body } = event.arguments || {}

    if (!subject || !body) {
        throw new Error('Subject and body are required')
    }

    const params = {
        Destination: { ToAddresses: [ADMIN_EMAIL] },
        Message: {
            Body: { Text: { Data: body } },
            Subject: { Data: subject }
        },
        Source: ADMIN_EMAIL // Both source and destination use the verified email
    }

    try {
        await ses.send(new SendEmailCommand(params))
        return { success: true }
    } catch (err) {
        console.error('Failed to send email:', err)
        return { success: false, error: err.message }
    }
}
