import GoogleProvider from "next-auth/providers/google"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "./prisma"
import bcrypt from "bcryptjs"
import { getServerSession } from 'next-auth/next'
import { AuthOptions } from "next-auth"

export const authOptions: AuthOptions = {
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
        CredentialsProvider({
            name: "credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    return null
                }

                const user = await prisma.user.findUnique({
                    where: { email: credentials.email }
                })

                if (!user || !user.password) {
                    return null
                }

                const isValidPassword = await bcrypt.compare(credentials.password, user.password)
                if (!isValidPassword) {
                    return null
                }

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    image: user.image,
                    role: user.role,
                }
            }
        })
    ],
    session: {
        strategy: "jwt",
        maxAge: 1 * 24 * 60 * 60, // 1 days
        updateAge: 24 * 60 * 60, // 24 hours
    },
    jwt: {
        secret: process.env.NEXTAUTH_SECRET,
    },
    secret: process.env.NEXTAUTH_SECRET,
    callbacks: {
        async signIn({ user, account }: any) {
            if (account?.provider === 'google') {
                // Check if user exists in database
                const existingUser = await prisma.user.findUnique({
                    where: { email: user.email! }
                })
                
                if (!existingUser) {
                    // Create new user with default USER role
                    await prisma.user.create({
                        data: {
                            email: user.email!,
                            name: user.name,
                            image: user.image,
                            role: 'USER',
                        }
                    })
                }
            }
            return true
        },
        async jwt({ token, user, account }: any) {
            if (user) {
                token.id = user.id
                token.role = user.role
            } else if (token.email) {
                // For existing tokens, ensure we have the ID and role
                const dbUser = await prisma.user.findUnique({
                    where: { email: token.email as string }
                })
                if (dbUser) {
                    token.id = dbUser.id
                    token.role = dbUser.role
                }
            }
            return token
        },
        async session({ session, token }: any) {
            if (token) {
                session.user.id = token.id
                session.user.role = token.role
            }
            return session
        },
    },
}

export async function isAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions) as any
  
  if (!session?.user?.email) {
    return false
  }
  
  // Check if user has ADMIN role
  return session.user.role === 'ADMIN'
}

export async function getCurrentUser() {
  const session = await getServerSession(authOptions) as any
  
  if (!session?.user?.email) {
    return null
  }
  
  // If session doesn't have ID, fetch it from database
  if (!session.user.id) {
    const dbUser = await prisma.user.findUnique({
      where: { email: session.user.email }
    })
    
    if (dbUser) {
      session.user.id = dbUser.id
      session.user.role = dbUser.role
    }
  }
  
  return session.user
}
