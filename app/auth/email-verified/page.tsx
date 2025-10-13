'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle, ArrowRight } from "lucide-react"

export default function EmailVerifiedPage() {
  const [countdown, setCountdown] = useState(5)
  const router = useRouter()

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          router.push('/schemas')
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            Email Verified!
          </CardTitle>
          <CardDescription className="text-gray-600">
            Your email has been successfully verified
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <h3 className="font-medium text-green-900">Verification Complete</h3>
                <p className="text-sm text-green-700 mt-1">
                  You now have full access to all features of Flow Schema Designer.
                </p>
              </div>
            </div>
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-600 mb-4">
              Redirecting to your dashboard in {countdown} seconds...
            </p>
            <Button
              onClick={() => router.push('/schemas')}
              className="w-full gap-2"
            >
              Go to Dashboard
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="text-center text-sm text-gray-500">
            <p>You can now:</p>
            <ul className="mt-2 space-y-1">
              <li>• Create and manage schemas</li>
              <li>• Join or create organizations</li>
              <li>• Access all premium features</li>
              <li>• Manage your profile</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
