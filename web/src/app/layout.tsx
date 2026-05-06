import "../styles/globals.css";
import type { Metadata } from "next";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export const metadata: Metadata = {
    title: "NEPH",
    description: "Neighborhood Emergency Preparedness Hub",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className="root-layout-body">
                <ThemeProvider>
                    <ThemeToggle />
                    <main className="root-layout-content">{children}</main>
                    <SiteFooter />
                </ThemeProvider>
            </body>
        </html>
    );
}