"use client";

import * as React from "react";

type ShowcaseSlide = {
    id: number;
    badge: string;
    title: string;
    description: string;
};

const slides: ShowcaseSlide[] = [
    {
        id: 1,
        badge: "Preparedness",
        title: "Keep emergency information ready before it is needed.",
        description:
            "NEPH helps users organize essential emergency details in a calm, accessible, and structured way before a crisis happens.",
    },
    {
        id: 2,
        badge: "Mutual Aid",
        title: "Coordinate community help with clear and simple request flows.",
        description:
            "The platform supports neighbors who need help and volunteers who are ready to assist through clean and understandable request matching.",
    },
    {
        id: 3,
        badge: "Offline-first",
        title: "Preserve key emergency actions even in disrupted conditions.",
        description:
            "NEPH is designed around reliability, so core emergency actions remain understandable and usable even when connectivity is limited.",
    },
];

export function AuthShowcase() {
    const [activeIndex, setActiveIndex] = React.useState(0);

    React.useEffect(() => {
        const interval = window.setInterval(() => {
            setActiveIndex((prev) => (prev + 1) % slides.length);
        }, 4500);

        return () => window.clearInterval(interval);
    }, []);

    const activeSlide = slides[activeIndex];

    return (
        <section
            className="relative hidden h-[580px] overflow-hidden rounded-[28px] p-8 text-white shadow-overlay lg:flex lg:flex-col"
            style={{
                background:
                    "linear-gradient(135deg, var(--hero-to) 0%, var(--hero-to) 38%, var(--hero-via) 68%, var(--hero-from) 100%)",
            }}
        >
            <div className="relative z-10 flex h-full flex-col">
                <div>
                    <div className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-white/80">
                        NEPH
                    </div>

                    <h2 className="max-w-md text-4xl font-bold leading-tight">
                        Be ready before an emergency becomes a crisis.
                    </h2>

                    <p className="mt-4 max-w-lg text-base leading-7 text-white/85">
                        Neighborhood Emergency Preparedness Hub helps users prepare,
                        organize emergency information, and support their community
                        through a calm and accessible experience.
                    </p>
                </div>

                <div className="mt-6 min-h-0 flex-1">
                    <div className="flex h-full flex-col rounded-[24px] border border-white/20 bg-white/12 p-5 backdrop-blur-sm">
                        <div className="mb-4 flex items-start justify-between gap-4">
                            <div>
                                <span className="inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-white/90">
                                    {activeSlide.badge}
                                </span>

                                <h3 className="mt-3 text-xl font-semibold leading-8">
                                    {activeSlide.title}
                                </h3>

                                <p className="mt-2 max-w-lg text-sm leading-6 text-white/80">
                                    {activeSlide.description}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="absolute bottom-3 left-8 z-20 flex items-center gap-2">
                {slides.map((slide, index) => (
                    <button
                        key={slide.id}
                        type="button"
                        onClick={() => setActiveIndex(index)}
                        className={`h-2.5 rounded-full transition-all ${
                            index === activeIndex
                                ? "w-8 bg-white"
                                : "w-2.5 bg-white/40 hover:bg-white/60"
                        }`}
                        aria-label={`Go to slide ${index + 1}`}
                    />
                ))}
            </div>

            <div
                className="absolute -left-16 bottom-0 h-40 w-40 rounded-full opacity-50"
                style={{ backgroundColor: "var(--hero-from)" }}
            />
            <div className="absolute right-8 top-10 h-28 w-28 rounded-full bg-white/10" />
            <div className="absolute bottom-16 right-14 h-16 w-16 rounded-full bg-white/10" />
        </section>
    );
}