import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";

const navItems = [
    { label: "Profile", href: "/profile" },
    { label: "Privacy", href: "/privacy" },
    { label: "Security", href: "/security" },
];

export function TopNavbar() {
    return (
        <header className="border-b border-[#E7E7EA] bg-white">
            <PageContainer className="flex h-16 items-center justify-between">
                <Link href="/" className="text-lg font-bold text-[#D84A4A]">
                    NEPH
                </Link>

                <nav className="flex items-center gap-6">
                    {navItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className="text-sm font-medium text-[#2B2B33] transition-colors hover:text-[#D84A4A]"
                        >
                            {item.label}
                        </Link>
                    ))}
                </nav>

                <button className="text-sm font-medium text-[#D84A4A]">Logout</button>
            </PageContainer>
        </header>
    );
}
