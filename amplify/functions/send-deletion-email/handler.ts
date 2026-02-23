import { env } from '$amplify/env/send-deletion-email'
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'

const ses = new SESClient()
const ADMIN_EMAIL = 'cloudjourney.blog@gmail.com' // Verified organizational email

export const handler = async (event) => {
    const { subject, body, userEmail } = event.arguments || {}

    if (!subject || !body || !userEmail) {
        throw new Error('Subject, body, and userEmail are required')
    }

    const adminParams = {
        Destination: { ToAddresses: [ADMIN_EMAIL] },
        Message: {
            Body: { Text: { Data: body } },
            Subject: { Data: `[ADMIN ALERT] ${subject}` }
        },
        Source: ADMIN_EMAIL
    }

    const userParams = {
        Destination: { ToAddresses: [userEmail] },
        Message: {
            Body: { Text: { Data: body } },
            Subject: { Data: subject }
        },
        Source: ADMIN_EMAIL
    }

    let successCount = 0
    let errors = []

    try {
        await ses.send(new SendEmailCommand(adminParams))
        successCount++
    } catch (err: any) {
        console.error('Failed to send email to admin:', err)
        errors.push(err.message)
    }

    try {
        await ses.send(new SendEmailCommand(userParams))
        successCount++
    } catch (err: any) {
        console.error('Failed to send email to requester (Likely SES Sandbox unverified):', err)
        errors.push(err.message)
    }

    return {
        success: successCount > 0,
        error: errors.length ? errors.join(' | ') : null
    }
}
