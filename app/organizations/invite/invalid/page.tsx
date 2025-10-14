'use client'

import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { XCircle, Home, ArrowLeft } from 'lucide-react'
import Header from '@/components/Header'

export default function InvalidInvitationPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardContent className="text-center py-12">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
            
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Invalid Invitation
            </h1>
            
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              This invitation link is invalid, expired, or has already been used. 
              Please contact the organization administrator for a new invitation.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button 
                onClick={() => router.push('/')}
                className="flex items-center gap-2"
              >
                <Home className="h-4 w-4" />
                Go Home
              </Button>
              
              <Button 
                variant="outline"
                onClick={() => router.back()}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Go Back
              </Button>
            </div>
            
            <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-medium text-blue-900 mb-2">Need Help?</h3>
              <p className="text-blue-800 text-sm">
                If you believe this is an error, please contact the person who sent you this invitation 
                or reach out to our support team.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
