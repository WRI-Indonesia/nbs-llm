import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: Request) {
    const url = new URL(req.url);
    
    // Skip middleware for auth routes
    if (url.pathname.startsWith('/api/auth/')) {
        return NextResponse.next();
    }
    
    const token = await getToken({
        req: req as any,
        secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
        const url = new URL("/", req.url);
        return NextResponse.redirect(url);
    }

    return NextResponse.next();
}

export const config = {
    // match any path that has at least one char after the initial slash
    matcher: ["/((?!$|api|_next/static|_next/image|favicon.ico).*)"],
};