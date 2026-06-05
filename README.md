<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/e4837672-9d13-4016-b8fc-7f5a87acd484

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

---

## 🏗️ Production Deployment & Scalability Hardening

When deploying **HuurGo** to cloud providers (e.g., AWS, GCP, Vercel, Heroku, or Render), follow these architectural guidelines:

### 1. Database Engine Decoupling (SQLite to PostgreSQL/MySQL)
SQLite (`dev.db`) is file-based and runs inside local storage. For containerized or serverless deployments with ephemeral/stateless storage:
1. In [schema.prisma](file:///Users/korismailoglu/Documents/transporting/prisma/schema.prisma), swap the database provider:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
2. Set `DATABASE_URL` in your production environment variables (e.g., pointing to AWS RDS, Supabase, or Neon).
3. Run `npx prisma db push` or `npx prisma migrate deploy` in your build pipelines.

### 2. File Storage Decoupling (AWS S3 or Cloudflare R2)
Stateless container hosts do not retain disk writes under `./uploads`. For scaled environments:
- Refactor the local uploader in [api.ts](file:///Users/korismailoglu/Documents/transporting/server/routes/api.ts) (`POST /api/upload`) to stream buffers directly to an S3-compatible cloud storage bucket using `@aws-sdk/client-s3`.

### 3. Automatic Database Bootstrap Hooks
To ensure migrations are automatically applied on startup, adjust your startup entry script or package.json:
```bash
npx prisma db push && node dist/server.js
```
