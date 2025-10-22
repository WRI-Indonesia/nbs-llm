import { useSearchParams, usePathname, useRouter } from "next/navigation"
import { useMemo, useCallback } from "react"

export function useQueryState<K extends string>(key: string, fallback: K) {
    const params = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()

    // Compute current value from the query string (or fallback)
    const value = useMemo(() => {
        const param = params?.get(key)
        return (param as K) || fallback
    }, [params, key, fallback])

    // Setter will replace the current URL without scrolling
    const setValue = useCallback(
        (next: K) => {
            const p = new URLSearchParams(params?.toString())
            if (next === fallback) {
                // Keep URLs tidy by removing the param when at fallback
                p.delete(key)
            } else {
                p.set(key, String(next))
            }
            const qs = p.toString()
            router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
        },
        [params, router, pathname, key, fallback],
    )

    return [value, setValue] as const
}