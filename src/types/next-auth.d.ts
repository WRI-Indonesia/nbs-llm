// eslint-disable-next-line @typescript-eslint/no-unused-vars
import NextAuth from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      role: 'ADMIN' | 'USER'
    }
  }

  interface User {
    role: 'ADMIN' | 'USER'
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: 'ADMIN' | 'USER'
  }
}
