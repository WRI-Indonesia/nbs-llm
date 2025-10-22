"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ReactNode } from "react";

export interface BreadcrumbItem {
    label: string;
    href?: string;
    icon?: ReactNode;
    onClick?: () => void;
}

export interface BreadcrumbProps {
    items?: BreadcrumbItem[];
    showHome?: boolean;
    homeHref?: string;
    separator?: ReactNode;
    className?: string;
}

export function Breadcrumb({
    items,
    showHome = true,
    homeHref = "/dashboard",
    separator = <ChevronRight className="w-4 h-4 text-neutral-400" />,
    className = ""
}: BreadcrumbProps) {
    const pathname = usePathname();

    // If custom items are provided, use them
    if (items) {
        return (
            <nav className={`flex items-center gap-2 text-sm ${className}`}>
                {showHome && (
                    <>
                        <Link
                            href={homeHref}
                            className="text-neutral-600 hover:text-neutral-900 transition-colors"
                        >
                            Home
                        </Link>
                        {items.length > 0 && separator}
                    </>
                )}

                {items.map((item, i) => {
                    const isLast = i === items.length - 1;
                    const content = item.label;

                    return (
                        <div key={`${item.label}-${i}`} className="flex items-center gap-2">
                            {isLast ? (
                                <span className="font-semibold text-neutral-900">
                                    {content}
                                </span>
                            ) : (
                                <>
                                    {item.href ? (
                                        <Link
                                            href={item.href}
                                            className="text-neutral-600 hover:text-neutral-900 transition-colors"
                                        >
                                            {content}
                                        </Link>
                                    ) : item.onClick ? (
                                        <button
                                            onClick={item.onClick}
                                            className="text-neutral-600 hover:text-neutral-900 transition-colors"
                                        >
                                            {content}
                                        </button>
                                    ) : (
                                        <span className="text-neutral-600">
                                            {content}
                                        </span>
                                    )}
                                    {separator}
                                </>
                            )}
                        </div>
                    );
                })}
            </nav>
        );
    }

    // Auto-generate from pathname
    const segments = pathname.split("/").filter(Boolean);

    const formatLabel = (s: string) =>
        s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, " ");

    const buildPath = (index: number) => {
        return "/" + segments.slice(0, index + 1).join("/");
    };

    return (
        <nav className={`flex items-center gap-2 text-sm ${className}`}>
            {showHome && (
                <>
                    <Link
                        href={homeHref}
                        className="text-neutral-600 hover:text-neutral-900 transition-colors"
                    >
                        Home
                    </Link>
                    {segments.length > 0 && separator}
                </>
            )}

            {segments.map((segment, i) => {
                const isLast = i === segments.length - 1;
                const href = buildPath(i);

                return (
                    <div key={`${segment}-${i}`} className="flex items-center gap-2">
                        {isLast ? (
                            <span className="font-semibold text-neutral-900">
                                {formatLabel(segment)}
                            </span>
                        ) : (
                            <>
                                <Link
                                    href={href}
                                    className="text-neutral-600 hover:text-neutral-900 transition-colors"
                                >
                                    {formatLabel(segment)}
                                </Link>
                                {separator}
                            </>
                        )}
                    </div>
                );
            })}
        </nav>
    );
}
