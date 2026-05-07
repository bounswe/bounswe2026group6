import type { NextConfig } from "next";

const configuredApiBaseUrl =
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://localhost:8000/api";

const backendApiBaseUrl = configuredApiBaseUrl.startsWith("http")
    ? configuredApiBaseUrl.replace(/\/$/, "")
    : "http://localhost:8000/api";

const nextConfig: NextConfig = {
    reactStrictMode: true,
    async redirects() {
        return [
            {
                source: "/about-project",
                destination: "/home",
                permanent: true,
            },
            {
                source: "/who-we-are",
                destination: "/home",
                permanent: true,
            },
            {
                source: "/donate",
                destination: "/home",
                permanent: true,
            },
        ];
    },
    async rewrites() {
        return [
            {
                source: "/api/:path*",
                destination: `${backendApiBaseUrl}/:path*`,
            },
        ];
    },
};

export default nextConfig;
