/**
 * update_post_authors.mjs
 * 
 * Updates all posts with authorSub='seed-admin' (or authorName='Cloud Journey Team')
 * to the real admin Cognito userId and name 'Cloud Journey'.
 *
 * Run: node update_post_authors.mjs
 */

import { Amplify } from 'aws-amplify'
import { signIn, getCurrentUser } from 'aws-amplify/auth'
import { generateClient } from 'aws-amplify/data'
import { readFileSync } from 'fs'

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'))
Amplify.configure(outputs)

const EMAIL = 'cloudjourney@suryareddi.in'
const PASS = 'Cloudjourney@143'
const NEW_AUTHOR_NAME = 'Cloud Journey'

const client = generateClient()

async function main() {
    console.log('Signing in as admin...')
    await signIn({ username: EMAIL, password: PASS })

    const me = await getCurrentUser()
    const adminSub = me.userId   // real Cognito sub for this user
    console.log(`Admin userId: ${adminSub}`)
    console.log(`Will set authorSub → "${adminSub}", authorName → "${NEW_AUTHOR_NAME}"\n`)

    // List ALL posts (authMode userPool so ADMINS can read everything)
    const { data: posts, errors } = await client.models.Post.list({ authMode: 'userPool' })
    if (errors?.length) { console.error('List error:', errors); process.exit(1) }

    const targets = posts.filter(p =>
        p.authorSub === 'seed-admin' || p.authorName === 'Cloud Journey Team'
    )

    console.log(`Found ${targets.length} posts to update out of ${posts.length} total.\n`)

    for (const [i, post] of targets.entries()) {
        const { errors: upErr } = await client.models.Post.update(
            { id: post.id, authorSub: adminSub, authorName: NEW_AUTHOR_NAME },
            { authMode: 'userPool' }
        )
        if (upErr?.length) {
            console.error(`[${i + 1}/${targets.length}] FAIL: ${post.title}`, upErr)
        } else {
            console.log(`[${i + 1}/${targets.length}] ✓ Updated: ${post.title}`)
        }
        await new Promise(r => setTimeout(r, 300))
    }

    console.log('\nDone! All seeded posts now owned by Cloud Journey admin.')
}

main().catch(e => { console.error(e); process.exit(1) })
