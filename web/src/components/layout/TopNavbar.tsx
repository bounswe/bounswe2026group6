import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";

const navItems = [
    { label: "Profile", href: "/profile" },
    { label: "Privacy", href: "/privacy" },
    { label: "Security", href: "/security" },
];

export function TopNavbar() {
    return (
        <header className="border-b border-gray-200 bg-white">
            <PageContainer className="flex h-16 items-center justify-between">
                <Link href="/" className="text-lg font-bold text-red-500">
                    NEPH
                </Link>

                <nav className="flex items-center gap-6">
                    {navItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className="text-sm font-medium text-gray-800 transition-colors hover:text-red-500"
                        >
                            {item.label}
                        </Link>
                    ))}
                </nav>

                <button className="text-sm font-medium text-red-500">Logout</button>
            </PageContainer>
        </header>
    );
}
