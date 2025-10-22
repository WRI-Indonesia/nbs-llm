'use client'

import { SessionProvider, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { createContext, FormEvent, ReactNode, useState } from "react";
import { toast } from "sonner";

interface AuthContextProps {
    open: boolean;
    setOpen: (open: boolean) => void;
    isLoading: boolean;
    setIsLoading: (open: boolean) => void;
    authMode: "login" | "signup" | null;
    setAuthMode: (mode: "login" | "signup") => void;
    handleEmailLogin: (e: FormEvent<Element>) => Promise<void>;
    handleGoogleLogin: () => Promise<void>
}

export const AuthContext = createContext<AuthContextProps>({
    open: false,
    setOpen: () => { },
    isLoading: false,
    setIsLoading: () => { },
    authMode: null,
    setAuthMode: () => { },
    handleEmailLogin: async () => { },
    handleGoogleLogin: async () => { }
});


export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const router = useRouter();

    const [authMode, setAuthMode] = useState<"login" | "signup">("login");
    const [open, setOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)

        try {
            // Get form data from the form element
            const form = e.target as HTMLFormElement
            const formData = new FormData(form)
            const emailValue = formData.get('email') as string
            const passwordValue = formData.get('password') as string

            const result = await signIn('credentials', {
                email: emailValue,
                password: passwordValue,
                redirect: false,
            })

            if (result?.error) {
                toast.error('Invalid credentials')
            } else {
                toast.success('Login successful')
                setOpen(false)
                // reload page
                router.refresh()
            }
        } catch (error) {
            console.error('Login error:', error)
            toast.error('Login failed')
        } finally {
            setIsLoading(false)
        }
    }

    const handleGoogleLogin = async () => {
        setIsLoading(true)
        try {
            await signIn('google', { callbackUrl: '/' })
        } catch (error) {
            console.error('Google login error:', error)
            toast.error('Google login failed')
        } finally {
            setIsLoading(false)
        }
    }


    return (
        <AuthContext.Provider value={{
            authMode, setAuthMode, open, setOpen, handleEmailLogin, handleGoogleLogin,
            isLoading, setIsLoading
        }}>
            <SessionProvider>{children}</SessionProvider>
        </AuthContext.Provider>
    );
};
