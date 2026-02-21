<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/f2cfe553-0a7a-4241-920a-2a24d802c730

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Deploy (Production)

Use the production build output instead of serving source files directly.

1. Install dependencies:
   `npm install`
2. Build:
   `npm run build`
3. Run production server locally:
   `npm run start`

The app will be served from `dist/` on port `3000` (or `PORT` env var if set).

For static hosting (Cloudflare Pages / Netlify / object storage), upload only `dist/`.
Do not deploy the repository root `index.html` that references `/src/main.tsx`.
