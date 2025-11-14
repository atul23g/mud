export async function getAccessToken(): Promise<string | undefined> {
  // If auth disabled, send no token
  // @ts-ignore
  if ((import.meta as any).env.VITE_DISABLE_AUTH === 'true') return undefined
  try {
    // Clerk injects a global when using ClerkProvider
    const anyWindow = window as any
    const session = anyWindow?.Clerk?.session
    if (session?.getToken) {
      const token = await session.getToken({ template: 'default' })
      return token || undefined
    }
  } catch {}
  return undefined
}
