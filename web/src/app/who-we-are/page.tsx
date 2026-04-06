import { AppShell } from "@/components/layout/AppShell";
import { SectionCard } from "@/components/ui/display/SectionCard";
import { SectionHeader } from "@/components/ui/display/SectionHeader";

export default function WhoWeArePage() {
    return (
        <AppShell title="Who We Are">
            <div className="who-we-are-grid">
                <SectionCard>
                    <SectionHeader
                        title="CMPE354 - Group 6"
                        subtitle="Neighborhood Emergency Preparedness Hub"
                    />

                    <p className="project-paragraph">
                        We are Computer Engineering students working on an offline-first
                        disaster preparedness and mutual aid platform for CMPE354.
                    </p>
                </SectionCard>

                <SectionCard>
                    <SectionHeader title="Team Members" subtitle="Group 6" />

                    <ul className="team-members-list">
                        <li>
                            <a
                                href="https://github.com/bounswe/bounswe2026group6/wiki/Berat-Say%C4%B1n"
                                target="_blank"
                                rel="noreferrer"
                                className="team-member-link"
                            >
                                Berat Sayin
                            </a>
                        </li>
                        <li>
                            <a
                                href="https://github.com/bounswe/bounswe2026group6/wiki/Rojhat-Deliba%C5%9F"
                                target="_blank"
                                rel="noreferrer"
                                className="team-member-link"
                            >
                                Rojhat Delibas
                            </a>
                        </li>
                        <li>
                            <a
                                href="https://github.com/bounswe/bounswe2026group6/wiki/Ethem-Erinc-Cengiz"
                                target="_blank"
                                rel="noreferrer"
                                className="team-member-link"
                            >
                                Ethem Erinc Cengiz
                            </a>
                        </li>
                        <li>
                            <a
                                href="https://github.com/bounswe/bounswe2026group6/wiki/G%C3%BClce-Tahtas%C4%B1z"
                                target="_blank"
                                rel="noreferrer"
                                className="team-member-link"
                            >
                                Gulce Tahtasiz
                            </a>
                        </li>
                        <li>
                            <a
                                href="https://github.com/bounswe/bounswe2026group6/wiki/Kagan-Can"
                                target="_blank"
                                rel="noreferrer"
                                className="team-member-link"
                            >
                                Kagan Can
                            </a>
                        </li>
                        <li>
                            <a
                                href="https://github.com/bounswe/bounswe2026group6/wiki/Mehmet-Can-G%C3%BCrb%C3%BCz"
                                target="_blank"
                                rel="noreferrer"
                                className="team-member-link"
                            >
                                Mehmet Can Gurbuz
                            </a>
                        </li>
                        <li>
                            <a
                                href="https://github.com/bounswe/bounswe2026group6/wiki/Alper-Kartkaya"
                                target="_blank"
                                rel="noreferrer"
                                className="team-member-link"
                            >
                                Alper Kartkaya
                            </a>
                        </li>
                    </ul>
                </SectionCard>
            </div>
        </AppShell>
    );
}
