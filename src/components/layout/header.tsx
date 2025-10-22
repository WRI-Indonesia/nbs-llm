import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { HeaderClient } from "./header-client"
import { AuthModal } from "./auth-modal"

export const Header = async () => {
    const session = await getServerSession(authOptions)

    return (
        <div>
            <AuthModal />
            <HeaderClient session={session} />
        </div>
    )
}