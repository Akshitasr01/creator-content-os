import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// Production builds (Render Static Site, `npm run build`) must know where the
// backend and Supabase are; otherwise the site would silently call localhost.
const REQUIRED_IN_PRODUCTION = ['VITE_API_BASE_URL', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY']

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  if (command === 'build') {
    const env = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env }
    const missing = REQUIRED_IN_PRODUCTION.filter((name) => !String(env[name] || '').trim())
    if (missing.length) {
      throw new Error(`Missing environment variable(s) for the production build: ${missing.join(', ')}. ` +
        'Set them in Render (Static Site → Environment) or in frontend/.env.local.')
    }
    if (/localhost|127\.0\.0\.1/.test(env.VITE_API_BASE_URL) && process.env.RENDER) {
      throw new Error('VITE_API_BASE_URL points to localhost. Use the deployed backend URL (https://….onrender.com).')
    }
  }

  return {
    plugins: [react(), tailwindcss()],
  }
})
