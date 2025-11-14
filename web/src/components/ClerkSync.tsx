import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { API_BASE } from '../lib/api'
import { useUser } from '@clerk/clerk-react'

export default function ClerkSync({ children }: { children: React.ReactNode }) {
  const { user, isSignedIn } = useUser()
  const [done, setDone] = useState(false)

  useEffect(() => {
    const run = async () => {
      if (!isSignedIn || !user || done) return
      try {
        const email = user.emailAddresses?.[0]?.emailAddress
        await axios.post(`${API_BASE}/auth/clerk_sync`, {
          clerk_id: user.id,
          email,
        })
      } catch (e) {
        // ignore sync errors in UI
      } finally {
        setDone(true)
      }
    }
    run()
  }, [isSignedIn, user, done])

  return <>{children}</>
}
