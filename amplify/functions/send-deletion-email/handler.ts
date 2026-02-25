import { env } from '$amplify/env/send-deletion-email'
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'

const ses = new SESClient()
const SES_SOURCE_EMAIL = 'support.cloudjourney@suryareddi.in' // SES-verified sender
const ADMIN_EMAILS = [
    'cloudjourney.blog@gmail.com',
    'cloudjourney@suryareddi.in',
]

export const handler = async (event) => {
    const { subject, body, userEmail, reason, postCount, commentCount, savedCount } = event.arguments || {}

    if (!subject || !body || !userEmail || !reason || postCount === undefined || commentCount === undefined || savedCount === undefined) {
        throw new Error('Missing required arguments for sending deletion email')
    }

    const logoUrl = 'https://cloudjourney.suryareddi.in/cloud-journey-icon.svg'
    const appUrl = 'https://cloudjourney.suryareddi.in/'

    const adminHtml = `
      <h2><a href="${appUrl}"><img src="${logoUrl}" alt="Cloud Journey Logo" width="100" /></a></h2>
      <h3 style="color: #ef4444;">Account Deletion Request</h3>
      <p><strong>User:</strong> ${userEmail}</p>
      <p><strong>Reason for Deletion:</strong></p>
      <blockquote style="border-left: 4px solid #ccc; padding-left: 10px; font-style: italic;">
        ${reason}
      </blockquote>
      <hr/>
      <h4>User Statistics:</h4>
      <ul>
        <li>Published Posts: ${postCount}</li>
        <li>Comments Made: ${commentCount}</li>
        <li>Saved Articles: ${savedCount}</li>
      </ul>
      <p><em>Reply to this email to contact the user directly.</em></p>
    `

    const userHtml = `
      <h2><a href="${appUrl}"><img src="${logoUrl}" alt="Cloud Journey Logo" width="100" /></a></h2>
      <h3 style="color: #ef4444;">Account Deletion Requested</h3>
      <p>Hello,</p>
      <p>We have received your request to permanently delete your Cloud Journey account.</p>
      <p><strong>Warning:</strong> Once this action is finalized by an administrator, it cannot be reversed. Your entire progress will be permanently erased. Here is a summary of the activity tied to your profile that will be deleted:</p>
      <ul>
        <li>Published Posts: ${postCount}</li>
        <li>Comments Made: ${commentCount}</li>
        <li>Saved Articles: ${savedCount}</li>
      </ul>
      <p>If you need any assistance or made this request in error, simply <strong>reply to this email</strong> and it will be sent directly to our admin team.</p>
      <br/>
      <p>Regards,</p>
      <p><strong>Cloud Journey Team</strong></p>
    `

    const adminParams = {
        Destination: { ToAddresses: ADMIN_EMAILS },
        Message: {
            Body: { Html: { Data: adminHtml } },
            Subject: { Data: `[ADMIN ALERT] ${subject}` }
        },
        Source: SES_SOURCE_EMAIL,
        ReplyToAddresses: [userEmail],
    }

    const userParams = {
        Destination: { ToAddresses: [userEmail] },
        Message: {
            Body: { Html: { Data: userHtml } },
            Subject: { Data: subject }
        },
        Source: SES_SOURCE_EMAIL,
        ReplyToAddresses: ADMIN_EMAILS,
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
