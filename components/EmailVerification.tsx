'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Mail, CheckCircle, AlertCircle, Loader2 } from "lucide-react"

interface EmailVerificationProps {
  userEmail?: string
  userName?: string
}

export default function EmailVerification({ userEmail, userName }: EmailVerificationProps) {
  const [isSending, setIsSending] = useState(false)
  const [isSent, setIsSent] = useState(false)
  const [error, setError] = useState('')

  const handleSendVerification = async () => {
    setIsSending(true)
    setError('')

    try {
      const response = await fetch('/api/auth/send-verification', {
        method: 'POST'
      })

      if (!response.ok) {
        const data = await response.json()
        
        // Handle specific error cases
        if (response.status === 400 && data.error === 'Email already verified') {
          setError('Your email is already verified. You can now access all features.')
          return
        }
        
        throw new Error(data.error || 'Failed to send verification email')
      }

      setIsSent(true)
    } catch (error: any) {
      setError(error.message || 'Something went wrong')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center mb-4">
            <Mail className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            Verify Your Email
          </CardTitle>
          <CardDescription className="text-gray-600">
            We've sent a verification link to your email address
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {userEmail && (
            <div className="text-center">
              <p className="text-sm text-gray-600">
                Check your inbox at:
              </p>
              <p className="font-medium text-gray-900">{userEmail}</p>
            </div>
          )}

          {!isSent ? (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-blue-900">Check your email</h3>
                    <p className="text-sm text-blue-700 mt-1">
                      Click the verification link in the email to activate your account and access all features.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-yellow-900">Important</h3>
                    <p className="text-sm text-yellow-700 mt-1">
                      The verification link will expire in 24 hours. If you don't see the email, check your spam folder.
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-center">
                <p className="text-sm text-gray-600 mb-3">
                  Didn't receive the email?
                </p>
                <Button
                  onClick={handleSendVerification}
                  disabled={isSending}
                  className="w-full"
                >
                  {isSending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Resend Verification Email'
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <h3 className="font-medium text-green-900">Email sent!</h3>
                  <p className="text-sm text-green-700 mt-1">
                    A new verification email has been sent to your inbox.
                  </p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <div>
                  <h3 className="font-medium text-red-900">Error</h3>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
              {error.includes('already verified') && (
                <div className="mt-3 text-center">
                  <Button 
                    onClick={() => window.location.href = '/schemas'}
                    className="w-full"
                  >
                    Go to Schemas
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="text-center text-sm text-gray-500">
            <p>
              After verifying your email, you'll have full access to all features including:
            </p>
            <ul className="mt-2 space-y-1">
              <li>• Creating and managing schemas</li>
              <li>• Organization features</li>
              <li>• Profile management</li>
              <li>• All premium features</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
