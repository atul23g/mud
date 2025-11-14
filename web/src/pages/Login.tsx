import React, { useEffect } from 'react'
import { SignedOut, SignedIn, SignIn, useUser } from '@clerk/clerk-react'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const { isSignedIn } = useUser()
  const navigate = useNavigate()

  useEffect(() => {
    if (isSignedIn) {
      navigate('/upload', { replace: true })
    }
  }, [isSignedIn, navigate])

  return (
    <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <SignedOut>
        <SignIn
          afterSignInUrl="/upload"
          appearance={{
            variables: {
              colorBackground: 'transparent',
              colorPrimary: '#0ea5e9',
              colorText: '#1f2937',
              colorInputBackground: '#ffffff',
              colorInputText: '#111827',
              borderRadius: '12px',
              fontSize: '16px',
            },
            elements: {
              card: { background: 'transparent', boxShadow: 'none', border: 'none' },
              footer: { display: 'none' },
              formButtonPrimary: {
                backgroundColor: '#0ea5e9',
                color: '#ffffff',
                border: 'none',
                boxShadow: '0 2px 0 rgba(0,0,0,0.05)'
              },
              formFieldInput: {
                backgroundColor: '#ffffff',
                border: '1px solid #e5e7eb',
                color: '#111827'
              },
              headerTitle: { color: '#111827' },
              headerSubtitle: { color: '#4b5563' },
              dividerText: { color: '#6b7280' },
              socialButtonsBlockButton: {
                backgroundColor: '#ffffff',
                border: '1px solid #e5e7eb',
                color: '#111827'
              },
            },
          }}
        />
      </SignedOut>
      <SignedIn />
    </div>
  )
}
