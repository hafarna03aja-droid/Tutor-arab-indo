<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/16v8ziH-r7nBUWTmbOcEESsSPBvXY_DPS

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Deploy to Vercel

### Option 1: Deploy via Vercel CLI

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Login to Vercel:
   ```bash
   vercel login
   ```

3. Deploy:
   ```bash
   vercel
   ```

4. Set environment variables:
   ```bash
   vercel env add GEMINI_API_KEY
   ```

### Option 2: Deploy via GitHub Integration

1. Push your code to GitHub repository
2. Go to [Vercel Dashboard](https://vercel.com/dashboard)
3. Click "New Project"
4. Import your GitHub repository
5. Add environment variable:
   - Name: `GEMINI_API_KEY`
   - Value: Your Gemini API key
6. Click "Deploy"

### Environment Variables

Pastikan untuk mengatur environment variable berikut di Vercel Dashboard:

- `GEMINI_API_KEY`: API key untuk Google Gemini AI

### Build Configuration

Proyek ini menggunakan Vite untuk build process. Vercel akan secara otomatis mendeteksi dan menggunakan konfigurasi yang tepat dari `vercel.json`.
