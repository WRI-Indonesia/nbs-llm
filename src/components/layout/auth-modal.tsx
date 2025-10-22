"use client"

import Link from "next/link"
import { FcGoogle } from "react-icons/fc"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    DialogHeader,
    DialogFooter,
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription,
    DialogClose,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/hooks/useAuth"
import { Label } from "@/components/ui/label"

export const AuthModal = () => {
    const {
        open,
        setOpen,
        authMode,
        setAuthMode,
        handleEmailLogin,
        handleGoogleLogin,
        isLoading,
    } = useAuth()

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-md bg-black/80 backdrop-blur-md text-white border-white/10 rounded-none">
                {authMode === "login" ? (
                    <>
                        <DialogHeader>
                            <DialogTitle>Welcome back</DialogTitle>
                            <DialogDescription className="text-gray-300">
                                Sign in to continue to NbS LLM.
                            </DialogDescription>
                        </DialogHeader>

                        <form
                            className={`grid gap-4 pt-2 transition-opacity ${isLoading ? "opacity-50" : ""}`}
                            onSubmit={handleEmailLogin}
                        >
                            <fieldset disabled={isLoading} className="grid gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="email" className="text-gray-200">
                                        Email
                                    </Label>
                                    <Input
                                        id="email"
                                        name="email"
                                        type="email"
                                        placeholder="you@company.com"
                                        className="bg-white/5 border-white/10 text-white placeholder:text-gray-400"
                                        required
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="password" className="text-gray-200">
                                            Password
                                        </Label>
                                        <Link
                                            href="/auth/forgot"
                                            className="text-xs text-gray-300 hover:text-white"
                                        >
                                            Forgot?
                                        </Link>
                                    </div>
                                    <Input
                                        id="password"
                                        name="password"
                                        type="password"
                                        placeholder="********"
                                        className="bg-white/5 border-white/10 text-white placeholder:text-gray-400"
                                        required
                                    />
                                </div>

                                <DialogFooter className="mt-2 flex justify-end gap-2">
                                    <Button
                                        type="submit"
                                        className="h-8 px-3 bg-white hover:bg-gray-200 text-black text-sm flex items-center gap-2"
                                    >
                                        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                                        {isLoading ? "Loading..." : "Continue"}
                                    </Button>

                                    <Button
                                        type="button"
                                        className="h-8 px-3 bg-transparent border border-white/20 text-white hover:bg-white/10 text-sm"
                                        onClick={() => setOpen(false)}
                                    >
                                        Cancel
                                    </Button>
                                </DialogFooter>
                            </fieldset>
                        </form>

                        <div className="relative my-4">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-white/10" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-black/80 px-2 text-gray-300">or</span>
                            </div>
                        </div>

                        <Button
                            className="w-full h-10 bg-transparent border border-white/20 text-white hover:bg-white/10 text-sm flex items-center justify-center gap-2"
                            onClick={handleGoogleLogin}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" /> Connecting...
                                </>
                            ) : (
                                <>
                                    <FcGoogle size={16} /> Continue with Google
                                </>
                            )}
                        </Button>

                        <p className="mt-3 text-center text-xs text-gray-400">
                            Don’t have an account?{" "}
                            <button
                                onClick={() => setAuthMode("signup")}
                                className="text-white underline hover:text-gray-200"
                                disabled={isLoading}
                            >
                                Sign up
                            </button>
                        </p>
                    </>
                ) : (
                    <>
                        <DialogHeader>
                            <DialogTitle>Create your account</DialogTitle>
                            <DialogDescription className="text-gray-300">
                                Join NbS LLM today.
                            </DialogDescription>
                        </DialogHeader>

                        <form
                            className={`grid gap-4 pt-2 transition-opacity ${isLoading ? "opacity-50" : ""}`}
                            onSubmit={handleEmailLogin}
                        >
                            <fieldset disabled={isLoading} className="grid gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="name" className="text-gray-200">
                                        Full name
                                    </Label>
                                    <Input
                                        id="name"
                                        name="name"
                                        type="text"
                                        placeholder="John Doe"
                                        className="bg-white/5 border-white/10 text-white placeholder:text-gray-400"
                                        required
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="email" className="text-gray-200">
                                        Email
                                    </Label>
                                    <Input
                                        id="email"
                                        name="email"
                                        type="email"
                                        placeholder="you@company.com"
                                        className="bg-white/5 border-white/10 text-white placeholder:text-gray-400"
                                        required
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="password" className="text-gray-200">
                                        Password
                                    </Label>
                                    <Input
                                        id="password"
                                        name="password"
                                        type="password"
                                        placeholder="********"
                                        className="bg-white/5 border-white/10 text-white placeholder:text-gray-400"
                                        required
                                    />
                                </div>

                                <DialogFooter className="mt-2 flex justify-end gap-2">
                                    <Button
                                        type="submit"
                                        className="h-8 px-3 bg-white hover:bg-gray-200 text-black text-sm flex items-center gap-2"
                                    >
                                        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                                        {isLoading ? "Registering..." : "Register"}
                                    </Button>

                                    <DialogClose asChild>
                                        <Button
                                            type="button"
                                            className="h-8 px-3 bg-transparent border border-white/20 text-white hover:bg-white/10 text-sm"
                                        >
                                            Cancel
                                        </Button>
                                    </DialogClose>
                                </DialogFooter>
                            </fieldset>
                        </form>

                        <div className="relative my-4">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-white/10" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-black/80 px-2 text-gray-300">or</span>
                            </div>
                        </div>

                        <Button
                            className="w-full h-10 bg-transparent border border-white/20 text-white hover:bg-white/10 text-sm flex items-center justify-center gap-2"
                            onClick={handleGoogleLogin}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" /> Connecting...
                                </>
                            ) : (
                                <>
                                    <FcGoogle size={16} /> Continue with Google
                                </>
                            )}
                        </Button>

                        <p className="mt-3 text-center text-xs text-gray-400">
                            Already have an account?{" "}
                            <button
                                onClick={() => setAuthMode("login")}
                                className="text-white underline hover:text-gray-200"
                                disabled={isLoading}
                            >
                                Log in
                            </button>
                        </p>
                    </>
                )}
            </DialogContent>
        </Dialog>
    )
}
