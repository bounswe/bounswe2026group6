"use client";

import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { PageContainer } from "@/components/layout/PageContainer";
import { useTheme } from "@/components/theme/ThemeProvider";
import { clearAccessToken, getAccessToken } from "@/lib/auth";
import { useAuthSession } from "@/lib/authSession";
import { fetchUnreadNotificationCount } from "@/lib/notifications";
import { fetchMyProfile } from "@/lib/profile";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

const navItemsOrdered = [
    { label: "Home", href: "/home" },
    { label: "News", href: "/news" },
    { label: "Emergency Numbers", href: "/emergency-numbers" },
    { label: "Help Request Map", href: "/crisis-map" },
    { label: "Gathering Areas", href: "/gathering-areas" },
    { label: "Admin", href: "/admin", requiresAdmin: true },
    { label: "Profile", href: "/profile" },
    { label: "Privacy & Security", href: "/privacy-security" },
];

const guestAllowedPaths = new Set([
    "/home",
    "/news",
    "/emergency-numbers",
    "/crisis-map",
    "/gathering-areas",
]);

function resolveUserInitials(email: string | null | undefined) {
    const localPart = (email || "").trim().split("@")[0] || "";
    const parts = localPart
        .split(/[^a-zA-Z0-9]+/)
        .map((part) => part.trim())
        .filter(Boolean);

    if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }

    if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase();
    }

    return "PP";
}

function resolveNameInitials(firstName?: string | null, lastName?: string | null) {
    const first = (firstName || "").trim();
    const last = (lastName || "").trim();

    if (first && last) {
        return `${first[0]}${last[0]}`.toUpperCase();
    }

    if (first) {
        return first.slice(0, 2).toUpperCase();
    }

    if (last) {
        return last.slice(0, 2).toUpperCase();
    }

    return null;
}

export function TopNavbar() {
    const router = useRouter();
    const pathname = usePathname();
    const { state, refresh } = useAuthSession();
    const [unreadCount, setUnreadCount] = React.useState(0);
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);
    const [avatarInitials, setAvatarInitials] = React.useState("PP");
    const menuRef = React.useRef<HTMLDivElement | null>(null);
    const isAuthenticated = state.phase === "authenticated";
    const isAdmin = Boolean(state.user?.isAdmin);

    React.useEffect(() => {
        if (!isAuthenticated) {
            setAvatarInitials("PP");
            return;
        }

        const token = getAccessToken();
        if (!token) {
            setAvatarInitials(resolveUserInitials(state.user?.email));
            return;
        }

        let cancelled = false;

        void fetchMyProfile(token)
            .then((profileResponse) => {
                if (cancelled) {
                    return;
                }

                const profileInitials = resolveNameInitials(
                    profileResponse.profile.firstName,
                    profileResponse.profile.lastName
                );

                setAvatarInitials(
                    profileInitials || resolveUserInitials(state.user?.email)
                );
            })
            .catch(() => {
                if (cancelled) {
                    return;
                }

                setAvatarInitials(resolveUserInitials(state.user?.email));
            });

        return () => {
            cancelled = true;
        };
    }, [isAuthenticated, state.user?.email]);

    React.useEffect(() => {
        const syncUnreadCount = () => {
            if (!isAuthenticated) {
                setUnreadCount(0);
                return;
            }

            const token = getAccessToken();
            if (!token) {
                setUnreadCount(0);
                return;
            }

            void fetchUnreadNotificationCount(token)
                .then((result) => {
                    setUnreadCount(result.unreadCount || 0);
                })
                .catch(() => {
                    setUnreadCount(0);
                });
        };
        syncUnreadCount();

        const handleStorage = (event: StorageEvent) => {
            if (event.key === null || event.key === "neph_access_token") {
                void refresh();
                syncUnreadCount();
            }
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                void refresh();
                syncUnreadCount();
            }
        };
        const handleFocus = () => {
            void refresh();
            syncUnreadCount();
        };
        const handleAuthChanged = () => {
            void refresh();
            syncUnreadCount();
        };

        window.addEventListener("storage", handleStorage);
        window.addEventListener("focus", handleFocus);
        window.addEventListener("neph-auth-changed", handleAuthChanged);
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            window.removeEventListener("storage", handleStorage);
            window.removeEventListener("focus", handleFocus);
            window.removeEventListener("neph-auth-changed", handleAuthChanged);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, [isAuthenticated, refresh]);

    React.useEffect(() => {
        setIsMenuOpen(false);
    }, [pathname]);

    React.useEffect(() => {
        const handleOutsideClick = (event: MouseEvent) => {
            if (!menuRef.current) return;
            if (!menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };

        document.addEventListener("click", handleOutsideClick);
        return () => {
            document.removeEventListener("click", handleOutsideClick);
        };
    }, []);

    const handleLogout = () => {
        clearAccessToken();
        void refresh({ force: true });
        router.replace("/login");
    };

    const navItems = navItemsOrdered.filter((item) => {
        if (!isAuthenticated) {
            return guestAllowedPaths.has(item.href);
        }

        if (item.requiresAdmin) {
            return isAdmin;
        }

        return true;
    });
    const notificationAriaLabel =
        isAuthenticated && unreadCount > 0
            ? `Notifications (${unreadCount} unread)`
            : "Notifications";

    const { isDarkTheme } = useTheme();

    return (
        <header className="top-navbar">
            <PageContainer className="top-navbar-inner">
                <Link href="/home" className="top-navbar-brand">
                    NEPH
                    <Image
                        src={isDarkTheme ? "/dark_neph_logo_only.png" : "/neph_logo_only.png"}
                        alt="NEPH icon"
                        width={48}
                        height={48}
                        className="top-navbar-brand-logo"
                    />
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

                <div className="top-navbar-right">
                    {isAuthenticated ? <ThemeToggle variant="navbar" /> : null}
                    <Link
                        href="/notifications"
                        className={`top-navbar-notification-button${pathname === "/notifications" || pathname.startsWith("/notifications/") ? " is-active" : ""}`}
                        aria-label={notificationAriaLabel}
                    >
                        <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            aria-hidden="true"
                        >
                            <path
                                d="M6.5 9.5C6.5 6.46243 8.96243 4 12 4C15.0376 4 17.5 6.46243 17.5 9.5V12.4C17.5 13.1675 17.7436 13.9152 18.196 14.5351L19.2 15.9105C19.7298 16.6362 19.2117 17.6667 18.3128 17.6667H5.6872C4.78835 17.6667 4.27019 16.6362 4.79998 15.9105L5.80404 14.5351C6.25637 13.9152 6.5 13.1675 6.5 12.4V9.5Z"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                            <path
                                d="M10 19.1667C10.3522 20.0112 11.1147 20.5833 12 20.5833C12.8853 20.5833 13.6478 20.0112 14 19.1667"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                        {isAuthenticated && unreadCount > 0 ? (
                            <>
                                <span className="top-navbar-notification-dot" aria-hidden="true" />
                                <span className="sr-only">{unreadCount} unread notifications</span>
                            </>
                        ) : null}
                    </Link>

                    <div className="top-navbar-user-menu" ref={menuRef}>
                    <button
                        type="button"
                        className="top-navbar-avatar-button"
                        onClick={(event) => {
                            event.stopPropagation();
                            setIsMenuOpen((prev) => !prev);
                        }}
                        aria-label="Open user menu"
                        aria-expanded={isMenuOpen}
                    >
                        {isAuthenticated ? (
                            avatarInitials
                        ) : (
                            <svg
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                aria-hidden="true"
                            >
                                <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8" />
                                <path d="M4.5 20C5.2 16.8 8.2 14.5 12 14.5C15.8 14.5 18.8 16.8 19.5 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                            </svg>
                        )}
                    </button>

                    {isMenuOpen ? (
                        <div className="top-navbar-dropdown" onClick={(event) => event.stopPropagation()}>
                            {isAuthenticated ? (
                                <>
                                    <Link
                                        href="/profile"
                                        className="top-navbar-dropdown-item"
                                        onClick={() => setIsMenuOpen(false)}
                                    >
                                        Profile
                                    </Link>

                                    <button
                                        type="button"
                                        className="top-navbar-dropdown-item is-danger"
                                        onClick={handleLogout}
                                    >
                                        Logout
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        type="button"
                                        className="top-navbar-dropdown-item is-login"
                                        onClick={() => {
                                            setIsMenuOpen(false);
                                            router.push(`/login?returnTo=${encodeURIComponent(pathname)}`);
                                        }}
                                    >
                                        Log In
                                    </button>

                                    <button
                                        type="button"
                                        className="top-navbar-dropdown-item is-signup"
                                        onClick={() => {
                                            setIsMenuOpen(false);
                                            router.push("/signup");
                                        }}
                                    >
                                        Create Account
                                    </button>
                                </>
                            )}
                        </div>
                    ) : null}
                    </div>
                </div>
            </PageContainer>
        </header>
    );
}
