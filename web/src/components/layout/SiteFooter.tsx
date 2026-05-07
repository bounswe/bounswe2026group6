import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";

const quickLinks = [
    { label: "News", href: "/news" },
    { label: "Emergency Numbers", href: "/emergency-numbers" },
];

const policyLinks = [
    { label: "Terms of Service", href: "/terms-of-service" },
    { label: "Privacy Policy", href: "/privacy-policy" },
];

export function SiteFooter() {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="site-footer">
            <PageContainer className="site-footer-inner">
                <div className="site-footer-grid">
                    <div>
                        <p className="site-footer-brand">NEPH</p>
                        <p className="site-footer-description">
                            Neighborhood Emergency Preparedness Hub helps communities stay ready,
                            connected, and informed before and during emergencies.
                        </p>
                    </div>

                    <div>
                        <h3 className="site-footer-title">Explore</h3>
                        <ul className="site-footer-list">
                            {quickLinks.map((item) => (
                                <li key={item.href}>
                                    <Link href={item.href} className="site-footer-link">
                                        {item.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div>
                        <h3 className="site-footer-title">Legal</h3>
                        <ul className="site-footer-list">
                            {policyLinks.map((item) => (
                                <li key={item.href}>
                                    <Link href={item.href} className="site-footer-link">
                                        {item.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                <div className="site-footer-bottom">
                    <p className="site-footer-copyright">© {currentYear} NEPH. All rights reserved.</p>
                </div>
            </PageContainer>
        </footer>
    );
}
