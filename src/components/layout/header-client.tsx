'use client'

import { useAuth } from "@/hooks/useAuth"
import Link from "next/link"
import { signOut } from "next-auth/react"
import { Session } from "next-auth"
import Image from "next/image"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { LogOut, User, Settings } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { useMemo } from "react"

export const HeaderClient = ({ session }: { session: Session | null }) => {
    const pathname = usePathname()
    const router = useRouter()

    const { setOpen, setAuthMode } = useAuth()

    const isAdmin = useMemo(() => session?.user.role === 'ADMIN', [session?.user.role])

    return (
        <header className='absolute bg-white left-0 right-0 z-50 text-md text-black shadow-sm'>
            <div className="px-4 flex items-center justify-between py-2">
                <div className="flex items-center gap-x-8">
                    <Link href="/" className="text-md font-bold me-5">
                        NbS LLM
                    </Link>
                    <nav className="flex items-center gap-x-6">
                        {isAdmin && <Link href="/knowledge" className={pathname === '/knowledge' ? 'font-semibold' : ''}>
                            Knowledge
                        </Link>}
                        {session && <Link href="/chat-map" className={pathname === '/chat-map' ? 'font-semibold' : ''}>
                            Chat Map
                        </Link>}
                        {/* <Link href="#" className="text-white hover:text-gray-300 transition-colors">
                            Providers
                        </Link>
                        <Link href="#" className="text-white hover:text-gray-300 transition-colors">
                            Blog
                        </Link> */}
                    </nav>
                </div>

                {session && session.user ? (
                    <div className="flex items-center gap-x-3 me-0.5">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button className="hover:cursor-pointer">
                                    <div className="relative h-6 w-6 overflow-hidden rounded-full bg-white/10">
                                        {session.user.image ? (
                                            <Image
                                                src={session.user.image}
                                                alt={session.user.name || 'User'}
                                                fill
                                                sizes="24px"
                                                className="object-cover"
                                            />
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center text-xs">
                                                {session.user.name?.charAt(0).toUpperCase() ?? "U"}
                                            </div>
                                        )}
                                    </div>
                                    <span className="truncate max-w-[140px] text-sm">{session.user.name}</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56 bg-black text-white rounded-none">
                                <DropdownMenuLabel className="text-xs text-gray-300">
                                    <div className="font-medium text-white">{session.user.name}</div>
                                    {session.user.email && (
                                        <div className="truncate text-gray-400">{session.user.email}</div>
                                    )}
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator className="bg-white/10" />
                                <DropdownMenuGroup>
                                    <DropdownMenuItem className="focus:bg-white/20 focus:text-white" onClick={() => router.push('/profile/account/basic-details')}>
                                        <User className="mr-2 h-4 w-4" />
                                        <span>Profile</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="focus:bg-white/20 focus:text-white">
                                        <Settings className="mr-2 h-4 w-4" />
                                        <span>Settings</span>
                                    </DropdownMenuItem>
                                </DropdownMenuGroup>
                                <DropdownMenuSeparator className="bg-white/10" />
                                <DropdownMenuItem
                                    className="focus:bg-red-500 text-red-300 focus:text-white"
                                    onSelect={(e) => {
                                        e.preventDefault()
                                        signOut({ callbackUrl: "/" })
                                    }}
                                >
                                    <LogOut className="mr-2 h-4 w-4" />
                                    <span>Log out</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                ) : (
                    <div className="flex items-center gap-x-3 me-0.5">
                        <Button
                            onClick={() => {
                                setAuthMode("login")
                                setOpen(true)
                            }}
                            variant="outline"
                        >
                            Login
                        </Button>
                        <Button
                            onClick={() => {
                                setAuthMode("signup")
                                setOpen(true)
                            }}
                            color="black"
                        >
                            Get Started
                        </Button>
                    </div>
                )}
            </div>
        </header>
    )
}
