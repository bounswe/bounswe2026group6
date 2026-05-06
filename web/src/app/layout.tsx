import "../styles/globals.css";
import type { Metadata } from "next";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
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
            <head>
                <script dangerouslySetInnerHTML={{ __html: getThemeInitScript() }} />
            </head>
            <body className="root-layout-body">
                <ThemeProvider>
                    <main className="root-layout-content">{children}</main>
                    <SiteFooter />
                </ThemeProvider>
            </body>
        </html>
    );
}