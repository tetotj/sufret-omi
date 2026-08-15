# Manus Dependencies and Integration Points

This document details every part of the Sufret Omi codebase that currently relies on Manus-managed services or SDKs, along with the replacement path for independent production deployment.

## 1. Manus OAuth Authentication
- **File Path:** `server/_core/sdk.ts`
- **Function/Component:** `OAuthService` (methods `getTokenByCode`, `getUserInfoByToken`, etc.) and `authenticateRequest`.
- **What it does:** Exchanges OAuth authorization codes with the Manus auth server, retrieves user profiles, and validates session tokens.
- **Replacement Path:** Replace with standard Auth0, Supabase Auth, Firebase Auth, or a self-hosted JWT authentication strategy.

## 2. Manus Forge S3 File Storage
- **File Path:** `server/storage.ts` and `server/_core/storageProxy.ts`
- **Function/Component:** `storagePut` and `storageProxy` Express handler.
- **What it does:** Requests presigned PUT/GET URLs from the Manus Forge API and proxies storage assets via `/manus-storage/*`.
- **Replacement Path:** Replace `server/storage.ts` with direct AWS S3 SDK calls (`@aws-sdk/client-s3`) using standard environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`).

## 3. Manus Environment Variables
- **File Path:** `server/_core/env.ts`
- **Function/Component:** `ENV` object.
- **What it does:** Reads `OAUTH_SERVER_URL`, `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY`, and `OWNER_OPEN_ID`.
- **Replacement Path:** Update environment variables in production to point to your independent identity provider and storage buckets.

## 4. Manus Hosting Assumptions
- **File Path:** `app.config.ts` and `package.json`
- **Function/Component:** Expo app slug and dev server scripts.
- **What it does:** Configures default mobile bundles and local development proxying.
- **Replacement Path:** None required for independent Expo builds; simply run `eas build` with your own Expo account credentials.
