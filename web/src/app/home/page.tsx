"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { SectionCard } from "@/components/ui/display/SectionCard";
import { SectionHeader } from "@/components/ui/display/SectionHeader";
import { PrimaryButton } from "@/components/ui/buttons/PrimaryButton";
import { SecondaryButton } from "@/components/ui/buttons/SecondaryButton";
import {
    defaultEmergencyContacts,
    type EmergencyContact,
} from "../../lib/emergencyNumbers";
import { announcementToNewsItem, fetchAnnouncements, type NewsItem } from "@/lib/news";

type HeroSlide = {
    title: string;
    description: string;
    primaryCtaLabel: string;
    primaryCtaHref: string;
    secondaryCtaLabel?: string;
    secondaryCtaHref?: string;
    isMainSlide?: boolean;
};

const heroSlides: HeroSlide[] = [
    {
        title: "We care for you and every community around you",
        description:
            "NEPH helps people prepare, stay informed, and coordinate faster support before and during emergencies.",
        primaryCtaLabel: "Browse News",
        primaryCtaHref: "/news",
        secondaryCtaLabel: "Emergency Numbers",
        secondaryCtaHref: "/emergency-numbers",
        isMainSlide: true,
    },
    {
        title: "Preparedness starts before emergencies",
        description:
            "Keep your emergency profile, health details, and location preferences current so support teams can coordinate faster.",
        primaryCtaLabel: "Update Profile",
        primaryCtaHref: "/profile",
        secondaryCtaLabel: "View Announcements",
        secondaryCtaHref: "/news",
    },
    {
        title: "Report incidents from the mobile app",
        description:
            "Emergency requests are submitted through the NEPH mobile app so responders can receive faster, location-aware updates during critical moments.",
        primaryCtaLabel: "Download Mobile App",
        primaryCtaHref: "#",
    },
    {
        title: "Track local updates in one place",
        description:
            "Follow announcements, preparedness updates, and community coordination news from a single dashboard.",
        primaryCtaLabel: "Browse News",
        primaryCtaHref: "/news",
    },
];

export default function HomePage() {
    const router = useRouter();
    const [activeSlide, setActiveSlide] = React.useState(0);
    const [previewNews, setPreviewNews] = React.useState<NewsItem[]>([]);
    const [newsLoading, setNewsLoading] = React.useState(true);
    const [newsError, setNewsError] = React.useState("");

    React.useEffect(() => {
        const timer = setInterval(() => {
            setActiveSlide((prev) => (prev + 1) % heroSlides.length);
        }, 5000);

        return () => clearInterval(timer);
    }, []);

    React.useEffect(() => {
        let isMounted = true;

        async function loadPreviewNews() {
            setNewsLoading(true);
            setNewsError("");

            try {
                const announcements = await fetchAnnouncements({ limit: 3 });
                if (!isMounted) {
                    return;
                }
                setPreviewNews(announcements.map(announcementToNewsItem));
            } catch (err) {
                if (!isMounted) {
                    return;
                }
                setPreviewNews([]);
                setNewsError(err instanceof Error ? err.message : "Could not load latest announcements.");
            } finally {
                if (isMounted) {
                    setNewsLoading(false);
                }
            }
        }

        void loadPreviewNews();

        return () => {
            isMounted = false;
        };
    }, []);

    const currentSlide = heroSlides[activeSlide];
    const previewContacts = defaultEmergencyContacts.slice(0, 3);

    return (
        <AppShell>
            <div className="home-page">
                <section className="home-hero">
                    <div className="home-hero-grid">
                        <div className="home-hero-content">
                            <p className="home-hero-eyebrow">NEPH Emergency Hub</p>
                            <h1 className={`home-hero-title${currentSlide.isMainSlide ? " is-main" : ""}`}>
                                {currentSlide.title}
                            </h1>
                            <p className="home-hero-description">{currentSlide.description}</p>

                            <div className="home-hero-actions">
                                <PrimaryButton
                                    className="home-hero-primary-action"
                                    onClick={() => router.push(currentSlide.primaryCtaHref)}
                                >
                                    {currentSlide.primaryCtaLabel}
                                </PrimaryButton>

                                {currentSlide.secondaryCtaHref && currentSlide.secondaryCtaLabel ? (
                                    <SecondaryButton
                                        className="home-hero-secondary-action"
                                        onClick={() => router.push(currentSlide.secondaryCtaHref!)}
                                    >
                                        {currentSlide.secondaryCtaLabel}
                                    </SecondaryButton>
                                ) : null}
                            </div>
                        </div>

                        <div className="home-slide-panel">
                            <p className="home-slide-panel-title">Slide Overview</p>
                            <div className="home-slide-list">
                                {heroSlides.map((slide, index) => (
                                    <button
                                        key={slide.title}
                                        type="button"
                                        className={`home-slide-item ${index === activeSlide ? "is-active" : ""}`}
                                        onClick={() => setActiveSlide(index)}
                                    >
                                        {slide.title}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                <div className="home-sections-grid">
                    <SectionCard className="home-section-card">
                        <SectionHeader
                            title="Latest News"
                            subtitle="A short preview from announcements and community updates."
                        />

                        {newsLoading ? (
                            <div className="admin-empty-state">
                                <p>Loading latest announcements...</p>
                            </div>
                        ) : newsError ? (
                            <div className="admin-empty-state">
                                <p className="admin-error-text">{newsError}</p>
                            </div>
                        ) : previewNews.length === 0 ? (
                            <div className="admin-empty-state">
                                <p>No announcements have been published yet.</p>
                            </div>
                        ) : (
                            <div className="home-news-list">
                                {previewNews.map((item) => (
                                    <article key={item.id} className="home-news-card">
                                        <p className="home-news-category">{item.category}</p>
                                        <h3 className="home-news-title">{item.title}</h3>
                                        <p className="home-news-summary">{item.summary}</p>
                                    </article>
                                ))}
                            </div>
                        )}

                        <div className="home-news-action-wrap">
                            <SecondaryButton onClick={() => router.push("/news")}>View All News</SecondaryButton>
                        </div>
                    </SectionCard>

                    <SectionCard className="home-section-card">
                        <SectionHeader
                            title="Emergency Numbers"
                            subtitle="Quick-access contacts for emergencies."
                        />

                        <div className="home-emergency-list">
                            {previewContacts.map((item: EmergencyContact) => (
                                <article key={item.id} className="home-emergency-card">
                                    <div>
                                        <p className="home-contact-label">{item.label}</p>
                                        <p className="home-contact-hint">Emergency Contact</p>
                                    </div>
                                    <p className="home-contact-phone">{item.phone}</p>
                                </article>
                            ))}
                        </div>

                        <div className="home-emergency-actions">
                            <SecondaryButton onClick={() => router.push("/emergency-numbers")}>View Full List</SecondaryButton>
                        </div>
                    </SectionCard>
                </div>
            </div>
        </AppShell>
    );
}
