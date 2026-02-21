# Amplify Backend + ZIP Deploy Guide

## 1) Install dependencies

```bash
npm install
```

## 2) Provision backend (Auth + Data + Storage)

This project already contains Gen 2 backend definitions in `amplify/`:
- `amplify/auth/resource.ts` (Cognito)
- `amplify/data/resource.ts` (AppSync + DynamoDB)
- `amplify/storage/resource.ts` (S3)

From project root:

```bash
npm run ampx:sandbox
```

What this does:
- creates backend resources in your AWS account
- generates/updates `amplify_outputs.json` in project root

Keep `ampx sandbox` running while testing locally.

## 3) Run locally

```bash
npm run dev
```

## 4) Build frontend for manual ZIP deployment

```bash
npm run build
```

This outputs static files in `dist/`.

## 5) Deploy frontend manually as ZIP in Amplify Hosting

1. Zip the **contents** of `dist/` (not the parent folder).
2. In AWS Amplify Hosting, choose manual deploy and upload that ZIP.
3. Set rewrite rule for SPA:
   - Source address: `</^[^.]+$|\\.(?!(css|gif|ico|jpg|js|png|txt|svg|webp|map)$)([^.]+$)/>`
   - Target address: `/index.html`
   - Type: `200 (Rewrite)`

## 6) Backend for production (important)

Sandbox is for development. For production:
- create a production backend environment and deploy backend resources using Amplify Gen 2 deployment workflow (`ampx` pipeline deploy).
- generate production `amplify_outputs.json` from that deployed backend.
- rebuild frontend (`npm run build`) so deployed app points to production backend.

## Storage behavior in this app

- User selects image/video file in editor.
- File uploads to S3 path: `media/<userSub>/<timestamp>-<filename>`.
- Returned S3 URL is saved in Post record and rendered in feed.

## Security notes

- Auth uses Cognito User Pool email sign-in.
- Data uses authenticated user access with owner controls for posts/comments edits.
- Storage uses authenticated read/write/delete under `media/*`.

## If login/signup fails

- Ensure `amplify_outputs.json` exists and has real values.
- Ensure backend is deployed in the same AWS account/region you expect.
- Rebuild app after updating outputs: `npm run build`.
