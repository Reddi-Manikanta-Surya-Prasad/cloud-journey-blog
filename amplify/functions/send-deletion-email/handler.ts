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

    const logoUrl = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MTIgNTEyIiB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiI+DQogIDxkZWZzPg0KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iY2xvdWRHcmFkIiB4MT0iMCUiIHkxPSIwJSIgeDI9IjEwMCUiIHkyPSIxMDAlIj4NCiAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiM0ZmFjZmUiIC8+DQogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiMwMGYyZmUiIC8+DQogICAgPC9saW5lYXJHcmFkaWVudD4NCiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImJnR3JhZCIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMTAwJSI+DQogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjMTQxRTMwIiAvPg0KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjMjQzQjU1IiAvPg0KICAgIDwvbGluZWFyR3JhZGllbnQ+DQogICAgPGZpbHRlciBpZD0iZ2xvdyIgeD0iLTIwJSIgeT0iLTIwJSIgd2lkdGg9IjE0MCUiIGhlaWdodD0iMTQwJSI+DQogICAgICA8ZmVHYXVzc2lhbkJsdXIgc3RkRGV2aWF0aW9uPSIxNSIgcmVzdWx0PSJibHVyIiAvPg0KICAgICAgPGZlQ29tcG9zaXRlIGluPSJTb3VyY2VHcmFwaGljIiBpbjI9ImJsdXIiIG9wZXJhdG9yPSJvdmVyIiAvPg0KICAgIDwvZmlsdGVyPg0KICA8L2RlZnM+DQoNCiAgPCEtLSBCYWNrZ3JvdW5kIC0tPg0KICA8cmVjdCB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgcng9IjEyMCIgZmlsbD0idXJsKCNiZ0dyYWQpIiAvPg0KDQogIDwhLS0gQ2xvdWQgU2hhZG93L0dsb3cgLS0+DQogIDxwYXRoIGQ9Ik0xNjAgMzUyYTk2IDk2IDAgMCAxLTEzLjQtMTkxLjFBMTQ0IDE0NCAwIDAgMSA0MDggMjcyYTgwIDgwIDAgMCAxLTU2IDE1MkgxNjB6IiANCiAgICAgICAgZmlsbD0icmdiYSgwLCAyNDIsIDI1NCwgMC40KSIgZmlsdGVyPSJ1cmwoI2dsb3cpIiB0cmFuc2Zvcm09InRyYW5zbGF0ZSgwLCAyMCkiIC8+DQoNCiAgPCEtLSBNYWluIENsb3VkIFNoYXBlIC0tPg0KICA8cGF0aCBkPSJNMTYwIDMyMGE5NiA5NiAwIDAgMS0xMy40LTE5MS4xQTE0NCAxNDQgMCAwIDEgNDA4IDI0MGE4MCA4MCAwIDAgMS01NiAxNTJIMTYweiIgDQogICAgICAgIGZpbGw9InVybCgjY2xvdWRHcmFkKSIgLz4NCg0KICA8IS0tIFRlY2gvSm91cm5leSBDaXJjdWl0IExpbmUgb3ZlcmxheWluZyB0aGUgY2xvdWQgLS0+DQogIDxwYXRoIGQ9Ik0xMjAgMjgwIEwyMDAgMjgwIEwyNDAgMjIwIEwzMjAgMjIwIEwzNjAgMjgwIEw0MjAgMjgwIiANCiAgICAgICAgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmZmZmIiBzdHJva2Utd2lkdGg9IjI0IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIC8+DQogIA0KICA8Y2lyY2xlIGN4PSIyMDAiIGN5PSIyODAiIHI9IjE2IiBmaWxsPSIjZmZmZmZmIiAvPg0KICA8Y2lyY2xlIGN4PSIzNjAiIGN5PSIyODAiIHI9IjE2IiBmaWxsPSIjZmZmZmZmIiAvPg0KICA8Y2lyY2xlIGN4PSIyODAiIGN5PSIyMjAiIHI9IjIwIiBmaWxsPSIjZmZmZmZmIiAvPg0KPC9zdmc+DQo='
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
