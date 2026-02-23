import type { Schema } from '../../data/resource'

export const handler: Schema['crossPost']['functionHandler'] = async (event) => {
    const {
        title,
        content,
        tldr,
        canonicalUrl,
        devToToken,
        hashnodeToken,
        mediumToken,
        linkedInToken,
        linkedInMemberId,
        linkedInClientId,
        linkedInClientSecret,
        postToDevTo,
        postToHashnode,
        postToMedium,
        postToLinkedIn,
    } = event.arguments

    const results: {
        devToUrl?: string
        hashnodeUrl?: string
        mediumUrl?: string
        linkedInUrl?: string
        error?: string
    } = {}

    const errors: string[] = []

    // 1. Dev.to API
    if (postToDevTo && devToToken) {
        try {
            const devRes = await fetch('https://dev.to/api/articles', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'api-key': devToToken,
                },
                body: JSON.stringify({
                    article: {
                        title,
                        body_markdown: content,
                        published: true,
                        canonical_url: canonicalUrl,
                        description: tldr || '',
                    },
                }),
            })

            if (devRes.ok) {
                const devData = await devRes.json()
                results.devToUrl = devData.url
            } else {
                const errBody = await devRes.text()
                errors.push(`Dev.to: ${devRes.status} - ${errBody.slice(0, 200)}`)
            }
        } catch (err) {
            errors.push(`Dev.to Error: ${err.message}`)
        }
    }

    // 2. Medium API
    if (postToMedium && mediumToken) {
        try {
            const meRes = await fetch('https://api.medium.com/v1/me', {
                headers: {
                    Authorization: `Bearer ${mediumToken}`,
                    Accept: 'application/json',
                },
            })

            if (meRes.ok) {
                const meData = await meRes.json()
                const authorId = meData.data.id

                const pubRes = await fetch(`https://api.medium.com/v1/users/${authorId}/posts`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        Authorization: `Bearer ${mediumToken}`,
                    },
                    body: JSON.stringify({
                        title,
                        contentFormat: 'markdown',
                        content: `# ${title}\n\n${content}\n\n*Originally published at [Cloud Journey](${canonicalUrl})*`,
                        canonicalUrl,
                        publishStatus: 'public',
                    }),
                })

                if (pubRes.ok) {
                    const pubData = await pubRes.json()
                    results.mediumUrl = pubData.data.url
                } else {
                    const errBody = await pubRes.text()
                    errors.push(`Medium Publish: ${pubRes.status} - ${errBody.slice(0, 200)}`)
                }
            } else {
                const errBody = await meRes.text()
                errors.push(`Medium Auth: ${meRes.status} - ${errBody.slice(0, 200)}`)
            }
        } catch (err) {
            errors.push(`Medium Error: ${err.message}`)
        }
    }

    // 3. LinkedIn API (UGC Post)
    if (postToLinkedIn && linkedInToken) {
        try {
            // Resolve the member ID: prefer manually stored id, then introspection, then error
            let resolvedMemberId = linkedInMemberId || ''

            if (!resolvedMemberId && linkedInClientId && linkedInClientSecret) {
                // Use token introspection to auto-resolve the member ID
                const credentials = Buffer.from(`${linkedInClientId}:${linkedInClientSecret}`).toString('base64')
                const introRes = await fetch('https://www.linkedin.com/oauth/v2/introspectToken', {
                    method: 'POST',
                    headers: {
                        Authorization: `Basic ${credentials}`,
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: `token=${encodeURIComponent(linkedInToken)}`,
                })

                if (introRes.ok) {
                    const introData = await introRes.json()
                    // authorized_user is the full URN e.g. "urn:li:member:123456789"
                    const urn: string = introData.authorized_user || ''
                    resolvedMemberId = urn.replace('urn:li:member:', '')
                } else {
                    const errBody = await introRes.text()
                    errors.push(`LinkedIn Introspection: ${introRes.status} - ${errBody.slice(0, 200)}`)
                }
            }

            if (!resolvedMemberId) {
                errors.push('LinkedIn: Could not resolve member ID. Please add your LinkedIn Client ID and Secret in Profile Settings.')
            } else {
                const personUrn = `urn:li:person:${resolvedMemberId}`
                const shareText = `New Blog Post: ${title}\n\n${tldr ? `Highlights: ${tldr}\n\n` : ''}Read the full article here: ${canonicalUrl}`

                const shareRes = await fetch('https://api.linkedin.com/v2/ugcPosts', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${linkedInToken}`,
                        'Content-Type': 'application/json',
                        'X-Restli-Protocol-Version': '2.0.0',
                    },
                    body: JSON.stringify({
                        author: personUrn,
                        lifecycleState: 'PUBLISHED',
                        specificContent: {
                            'com.linkedin.ugc.ShareContent': {
                                shareCommentary: {
                                    text: shareText,
                                },
                                shareMediaCategory: 'ARTICLE',
                                media: [
                                    {
                                        status: 'READY',
                                        originalUrl: canonicalUrl,
                                        title: {
                                            text: title,
                                        },
                                    },
                                ],
                            },
                        },
                        visibility: {
                            'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
                        },
                    }),
                })

                if (shareRes.ok || shareRes.status === 201) {
                    results.linkedInUrl = 'https://www.linkedin.com/feed/'
                } else {
                    const errBody = await shareRes.text()
                    errors.push(`LinkedIn Share: ${shareRes.status} - ${errBody.slice(0, 300)}`)
                }
            }
        } catch (err) {
            errors.push(`LinkedIn Error: ${err.message}`)
        }
    }

    // 4. Hashnode API
    if (postToHashnode && hashnodeToken) {
        errors.push('Hashnode: Please provide a Publication ID in settings to publish (Coming soon).')
    }

    if (errors.length > 0) {
        results.error = errors.join(' | ')
    }

    return results
}
