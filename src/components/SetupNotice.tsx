import { DatabaseZap } from 'lucide-react'

/** Shown instead of the app when the Supabase environment variables are missing. */
export default function SetupNotice() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="glass-strong max-w-xl p-8">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-300 to-primary-600 text-white">
          <DatabaseZap className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-extrabold">Connect ROYAL POWER to Supabase</h1>
        <p className="mt-2 text-sm text-ink-soft">
          The app could not find its database settings. Create a <code className="rounded bg-primary-50 px-1.5 py-0.5">.env</code> file
          (or set environment variables in Netlify / Vercel) with:
        </p>
        <pre className="mt-4 overflow-x-auto rounded-xl bg-ink p-4 text-xs leading-relaxed text-primary-100">
{`VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_PUBLIC_KEY`}
        </pre>
        <p className="mt-4 text-sm text-ink-soft">
          Then run the SQL files in <code className="rounded bg-primary-50 px-1.5 py-0.5">supabase/migrations</code> and restart the
          dev server. The full walkthrough is in <b>README.md</b>.
        </p>
      </div>
    </div>
  )
}
