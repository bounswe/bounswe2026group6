import "../styles/globals.css";
import type { Metadata } from "next";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { GuestThemeToggle } from "@/components/theme/GuestThemeToggle";
import { getThemeInitScript } from "@/lib/theme";
import { GoogleOAuthProvider } from "@react-oauth/google";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

function ConditionalGoogleProvider({
    clientId,
    children,
}: {
    clientId: string;
    children: React.ReactNode;
}) {
    if (!clientId) return <>{children}</>;
    return (
        <GoogleOAuthProvider clientId={clientId} locale="en">
            {children}
        </GoogleOAuthProvider>
    );
}

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
        <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
            <head>
                <script
                    id="theme-init"
                    dangerouslySetInnerHTML={{ __html: getThemeInitScript() }}
                />
            </head>
            <body className="root-layout-body">
                <ConditionalGoogleProvider clientId={GOOGLE_CLIENT_ID}>
                    <ThemeProvider>
                        <GuestThemeToggle />
                        <main className="root-layout-content">{children}</main>
                        <SiteFooter />
                    </ThemeProvider>
                </ConditionalGoogleProvider>
            </body>
        </html>
    );
}
