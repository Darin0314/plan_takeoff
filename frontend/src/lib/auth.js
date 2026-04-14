const BASE = '/api'

async function req(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

export const authApi = {
  me:     ()           => req('GET',  '/auth/me'),
  login:  (email, pw)  => req('POST', '/auth/login',  { email, password: pw }),
  logout: ()           => req('POST', '/auth/logout'),
}
