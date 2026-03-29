"use client";

import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";
import { clearAccessToken } from "@/lib/auth";

const navItems = [
    { label: "Home", href: "/home" },
    { label: "News", href: "/news" },
    { label: "Emergency Numbers", href: "/emergency-numbers" },
    { label: "Profile", href: "/profile" },
    { label: "Privacy", href: "/privacy" },
    { label: "Security", href: "/security" },
];

export function TopNavbar() {
    const router = useRouter();
    const pathname = usePathname();
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);
    const menuRef = React.useRef<HTMLDivElement | null>(null);

    React.useEffect(() => {
        const handleOutsideClick = (event: MouseEvent) => {
            if (!menuRef.current) return;
            if (!menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };

        document.addEventListener("mousedown", handleOutsideClick);
        return () => {
            document.removeEventListener("mousedown", handleOutsideClick);
        };
    }, []);

    const handleLogout = () => {
        clearAccessToken();
        router.replace("/login");
    };

    return (
        <header className="top-navbar">
            <PageContainer className="top-navbar-inner">
                <Link href="/home" className="top-navbar-brand">
                    NEPH
                </Link>

                <nav className="top-navbar-nav">
                    {navItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`top-navbar-nav-item${pathname === item.href || pathname.startsWith(`${item.href}/`) ? " is-active" : ""}`}
                        >
                            {item.label}
                        </Link>
                    ))}
                </nav>

                <div className="top-navbar-user-menu" ref={menuRef}>
                    <button
                        type="button"
                        className="top-navbar-avatar-button"
                        onClick={() => setIsMenuOpen((prev) => !prev)}
                        aria-label="Open user menu"
                    >
                        NP
                    </button>

                    {isMenuOpen ? (
                        <div className="top-navbar-dropdown">
                            <Link
                                href="/profile"
                                className="top-navbar-dropdown-item"
                                onClick={() => setIsMenuOpen(false)}
                            >
                                Profile
                            </Link>

                            <button
                                type="button"
                                className="top-navbar-dropdown-item"
                                onClick={() => {
                                    setIsMenuOpen(false);
                                    router.push("/login");
                                }}
                            >
                                Switch Account
                            </button>

                            <button
                                type="button"
                                className="top-navbar-dropdown-item is-danger"
                                onClick={handleLogout}
                            >
                                Logout
                            </button>
                        </div>
                    ) : null}
                </div>
            </PageContainer>
        </header>
    );
}
