export type LoginResponse = {
    success: boolean
    user?: {
        id: string
        name: string | null
        email: string
        image?: string | null
        role: 'ADMIN' | 'USER'
    }
    error?: string
}
