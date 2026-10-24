'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getConfig } from './config'
import { ADMIN_COOKIE, ADMIN_SESSION_MS, safeEqual, signAdminSession } from './crypto'

export interface LoginState {
  error?: string
}

/** Admin login: compares the password in constant time and sets a signed, httpOnly cookie. */
export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const admin = getConfig().admin
  if (!admin) {
    return {
      error: 'Admin login is off. Set FACTORY_ADMIN_PASSWORD and SESSION_SECRET to turn it on.',
    }
  }
  const password = String(formData.get('password') ?? '')
  if (!password || !safeEqual(password, admin.password)) {
    return { error: 'That password is not right. Check it and try again.' }
  }
  const expires = Date.now() + ADMIN_SESSION_MS
  const jar = await cookies()
  jar.set(ADMIN_COOKIE, signAdminSession(expires, admin.sessionSecret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(expires),
  })
  redirect('/factory')
}

export async function logoutAction(): Promise<void> {
  const jar = await cookies()
  jar.delete(ADMIN_COOKIE)
  redirect('/factory')
}
