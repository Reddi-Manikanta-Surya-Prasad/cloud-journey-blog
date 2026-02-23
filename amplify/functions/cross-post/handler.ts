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
                errors.push(`Dev.to: ${devRes.statusText}`)
            }
        } catch (err) {
            errors.push(`Dev.to Error: ${err.message}`)
        }
    }

    // 2. Medium API
    if (postToMedium && mediumToken) {
        try {
            // Step A: Get User ID
            const meRes = await fetch('https://api.medium.com/v1/me', {
                headers: {
                    Authorization: `Bearer ${mediumToken}`,
                    Accept: 'application/json',
                },
            })

            if (meRes.ok) {
                const meData = await meRes.json()
                const authorId = meData.data.id

                // Step B: Publish Post
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
                    errors.push(`Medium Publish: ${pubRes.statusText}`)
                }
            } else {
                errors.push(`Medium Auth: ${meRes.statusText}`)
            }
        } catch (err) {
            errors.push(`Medium Error: ${err.message}`)
        }
    }

    // 3. LinkedIn API (UGC Post)
    if (postToLinkedIn && linkedInToken) {
        try {
            // Step A: Get Person URN
            const meRes = await fetch('https://api.linkedin.com/v2/me', {
                headers: {
                    Authorization: `Bearer ${linkedInToken}`,
                },
            })

            if (meRes.ok) {
                const meData = await meRes.json()
                const personUrn = `urn:li:person:${meData.id}`

                // Step B: Create Share
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

                if (shareRes.ok) {
                    // LinkedIn API v2 often returns an empty body on 201 Created but sets the ID in a header.
                    results.linkedInUrl = 'https://www.linkedin.com/feed/' // Requires complex parsing to get exact post URL
                } else {
                    errors.push(`LinkedIn Share: ${shareRes.statusText}`)
                }
            } else {
                errors.push(`LinkedIn Auth: ${meRes.statusText}`)
            }
        } catch (err) {
            errors.push(`LinkedIn Error: ${err.message}`)
        }
    }

    // 4. Hashnode API
    if (postToHashnode && hashnodeToken) {
        // Hashnode implementation usually requires the user's publicationId which we don't have stored.
        // For now, tracking an error that we need to expand settings to include "Hashnode Publication ID".
        errors.push('Hashnode: Please provide a Publication ID in settings to publish (Coming soon).')
    }

    if (errors.length > 0) {
        results.error = errors.join(' | ')
    } else {
        results.error = null
    }

    return results
}
