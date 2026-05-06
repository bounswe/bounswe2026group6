import "../styles/globals.css";
import type { Metadata } from "next";
import Script from "next/script";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { getThemeInitScript } from "@/lib/theme";

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
                <Script
                    id="neph-theme-init"
                    strategy="beforeInteractive"
                    dangerouslySetInnerHTML={{ __html: getThemeInitScript() }}
                />
                <ThemeProvider>
                    <ThemeToggle />
                    <main className="root-layout-content">{children}</main>
                    <SiteFooter />
                </ThemeProvider>
            </body>
        </html>
    );
}