import { AppShell } from "@/components/layout/AppShell";
import { SectionCard } from "@/components/ui/display/SectionCard";
import { SectionHeader } from "@/components/ui/display/SectionHeader";

export default function AboutProjectPage() {
    return (
        <AppShell title="About Project">
            <SectionCard>
                <SectionHeader
                    title="About Our Project"
                    subtitle="Neighborhood Emergency Preparedness Hub"
                />

                <p className="project-paragraph">
                    Neighborhood Emergency Preparedness Hub supports disaster
                    preparedness and community resilience by helping individuals
                    prepare ahead of time and enabling neighbors to coordinate
                    mutual aid during emergencies.
                </p>

                <a
                    href="https://github.com/bounswe/bounswe2026group6/wiki"
                    target="_blank"
                    rel="noreferrer"
                    className="project-link"
                >
                    View Project Wiki
                </a>
            </SectionCard>
        </AppShell>
    );
}
