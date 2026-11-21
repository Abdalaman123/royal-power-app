#!/usr/bin/env node
/**
 * Secure initial admin provisioning for ROYAL POWER.
 *
 * Runs ONLY on your machine / CI with the Supabase SERVICE ROLE key.
 * The admin credentials are never present in the frontend bundle.
 *
 *   1. cp .env.example .env     (fill in the values)
 *   2. npm run provision:admin
 *
 * The account is created with must_change_password = true: until the first
 * password change is completed the account has NO admin rights (see
 * public.is_admin() in migration 0002).
 */
import { createClient } from '@supabase/supabase-js'

try {
  process.loadEnvFile?.('.env')
} catch {
  /* .env is optional when variables are already exported */
}

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase()
const password = process.env.ADMIN_INITIAL_PASSWORD
const fullName = process.env.ADMIN_FULL_NAME || 'System Administrator'

const missing = Object.entries({
  'VITE_SUPABASE_URL (or SUPABASE_URL)': url,
  SUPABASE_SERVICE_ROLE_KEY: serviceKey,
  ADMIN_EMAIL: email,
  ADMIN_INITIAL_PASSWORD: password,
})
  .filter(([, v]) => !v)
  .map(([k]) => k)

if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`)
  process.exit(1)
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

async function findUserByEmail(target) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const hit = data.users.find((u) => (u.email || '').toLowerCase() === target)
    if (hit) return hit
    if (data.users.length < 200) break
  }
  return null
}

async function main() {
  let user = await findUserByEmail(email)

  if (user) {
    console.log(`User ${email} already exists – promoting to admin and resetting the initial password.`)
    const { data, error } = await admin.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
      app_metadata: { ...(user.app_metadata || {}), role: 'admin', must_change_password: true },
      user_metadata: { ...(user.user_metadata || {}), full_name: fullName },
    })
    if (error) throw error
    user = data.user
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role: 'admin', must_change_password: true },
      user_metadata: { full_name: fullName },
    })
    if (error) throw error
    user = data.user
    console.log(`Created auth user ${email}`)
  }

  // Make sure the profile row reflects the admin role (service role bypasses RLS and the profile guard trigger).
  const { data: prof } = await admin.from('profiles').select('pw_fingerprint').eq('id', user.id).maybeSingle()
  const row = { id: user.id, email, full_name: fullName, role: 'admin', must_change_password: true }
  if (!prof) {
    const { error } = await admin.from('profiles').insert(row)
    if (error) throw error
  } else {
    const { error } = await admin.from('profiles').update(row).eq('id', user.id)
    if (error) throw error
  }
  // After a password reset the stored fingerprint must match the NEW hash so the change can be verified later.
  const { error: fpError } = await admin.rpc('refresh_password_fingerprint', { p_user: user.id })
  if (fpError) throw new Error(`Could not refresh the password fingerprint (did you run migration 0002?): ${fpError.message}`)

  console.log('\nAdmin account ready.')
  console.log(`  Email   : ${email}`)
  console.log('  Password: (value of ADMIN_INITIAL_PASSWORD) – you will be forced to change it at first login.')
  console.log('\nNext: remove ADMIN_INITIAL_PASSWORD / SUPABASE_SERVICE_ROLE_KEY from .env and keep them out of your deploy settings.')
}

main().catch((e) => {
  console.error('Provisioning failed:', e.message || e)
  process.exit(1)
})
