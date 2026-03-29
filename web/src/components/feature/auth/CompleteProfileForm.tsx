"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { TextInput } from "@/components/ui/inputs/TextInput";
import { SelectInput } from "@/components/ui/inputs/SelectInput";
import { TextArea } from "@/components/ui/inputs/TextArea";
import { ToggleSwitch } from "@/components/ui/selection/ToggleSwitch";
import { ProfileInfoRow } from "../../ui/display/ProfileInfoRow";
import { SaveActionBar } from "../../ui/display/SaveActionBar";
import { HelperText } from "@/components/ui/display/HelperText";
import { bloodTypeOptions } from "@/lib/bloodTypes";
import { countryCodeOptions } from "@/lib/countryCodes";
import { getAccessToken, SIGNUP_DRAFT_KEY } from "@/lib/auth";
import {
    buildAddress,
    parseListField,
    patchMyHealth,
    patchMyLocation,
    patchMyPhysical,
    patchMyPrivacy,
    patchMyProfile,
    splitFullName,
} from "@/lib/profile";

type ProfileForm = {
    fullName: string;
    countryCode: string;
    phone: string;
    gender: string;
    height: string;
    weight: string;
    bloodType: string;
    birthDate: string;
    medicalHistory: string;
    country: string;
    city: string;
    district: string;
    neighborhood: string;
    extraAddress: string;
    shareLocation: boolean;
};

type Neighborhood = {
    label: string;
    value: string;
};

type District = {
    label: string;
    neighborhoods: Neighborhood[];
};

type City = {
    label: string;
    districts: Record<string, District>;
};

type Country = {
    label: string;
    cities: Record<string, City>;
};

type LocationData = Record<string, Country>;

const locationData: LocationData = {
    tr: {
        label: "Turkey",
        cities: {
            istanbul: {
                label: "Istanbul",
                districts: {
                    kadikoy: {
                        label: "Kadıköy",
                        neighborhoods: [
                            { label: "Bostancı", value: "bostanci" },
                            { label: "Erenköy", value: "erenkoy" },
                        ],
                    },
                    besiktas: {
                        label: "Beşiktaş",
                        neighborhoods: [
                            { label: "Balmumcu", value: "balmumcu" },
                            { label: "Kuruçeşme", value: "kurucesme" },
                        ],
                    },
                },
            },
            ankara: {
                label: "Ankara",
                districts: {
                    cankaya: {
                        label: "Çankaya",
                        neighborhoods: [{ label: "Anıttepe", value: "anittepe" }],
                    },
                },
            },
        },
    },
};

const initialForm: ProfileForm = {
    fullName: "",
    countryCode: "+90",
    phone: "",
    gender: "",
    height: "",
    weight: "",
    bloodType: "",
    birthDate: "",
    medicalHistory: "",
    country: "",
    city: "",
    district: "",
    neighborhood: "",
    extraAddress: "",
    shareLocation: false,
};

export default function CompleteProfileForm() {
    const router = useRouter();
    const [form, setForm] = React.useState<ProfileForm>(initialForm);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState("");

    React.useEffect(() => {
        const savedDraft = sessionStorage.getItem(SIGNUP_DRAFT_KEY);

        if (!savedDraft) {
            return;
        }

        try {
            const parsed = JSON.parse(savedDraft) as Partial<ProfileForm>;

            setForm((currentForm) => ({
                ...currentForm,
                fullName: parsed.fullName || currentForm.fullName,
                countryCode: parsed.countryCode || currentForm.countryCode,
                phone: parsed.phone || currentForm.phone,
            }));
        } catch {
            sessionStorage.removeItem(SIGNUP_DRAFT_KEY);
        }
    }, []);

    const countryData = locationData[form.country] ?? undefined;

    const countryOptions = Object.entries(locationData).map(([key, value]) => ({
        label: value.label,
        value: key,
    }));

    const cityOptions =
        form.country && countryData
            ? Object.entries(countryData.cities).map(([key, value]) => ({
                label: value.label,
                value: key,
            }))
            : [];

    const districtOptions =
        form.city && countryData?.cities[form.city]
            ? Object.entries(countryData.cities[form.city].districts).map(
                ([key, value]) => ({
                    label: value.label,
                    value: key,
                })
            )
            : [];

    const neighborhoodOptions =
        form.city &&
            form.district &&
            countryData?.cities[form.city]?.districts[form.district]
            ? countryData.cities[form.city].districts[form.district].neighborhoods
            : [];

    const handleSave = async () => {
        setError("");

        if (!form.fullName.trim()) {
            setError("Please enter your full name.");
            return;
        }

        const { firstName, lastName } = splitFullName(form.fullName);

        if (!firstName || !lastName) {
            setError("Please enter both first and last name.");
            return;
        }

        if (!form.phone.trim()) {
            setError("Please enter your phone number.");
            return;
        }

        if (!form.birthDate) {
            setError("Please enter your date of birth.");
            return;
        }

        if (!form.bloodType) {
            setError("Please select your blood type.");
            return;
        }

        if (!form.height || !form.weight || !form.country || !form.city) {
            setError("Please fill in all required fields.");
            return;
        }

        const token = getAccessToken();

        if (!token) {
            setError("Your session has expired. Please log in again before completing your profile.");
            return;
        }

        try {
            setLoading(true);

            await patchMyProfile(token, {
                firstName,
                lastName,
                phoneNumber: `${form.countryCode}${form.phone.trim()}`,
            });

            await patchMyPhysical(token, {
                gender: form.gender || null,
                height: Number(form.height),
                weight: Number(form.weight),
            });

            await patchMyHealth(token, {
                medicalConditions: parseListField(form.medicalHistory),
                bloodType: form.bloodType || null,
            });

            await patchMyLocation(token, {
                country: countryData?.label || form.country,
                city: countryData?.cities[form.city]?.label || form.city,
                address:
                    buildAddress({
                        district: form.district,
                        neighborhood: form.neighborhood,
                        extraAddress: form.extraAddress,
                    }) || null,
            });

            await patchMyPrivacy(token, {
                locationSharingEnabled: form.shareLocation,
            });

            sessionStorage.removeItem(SIGNUP_DRAFT_KEY);
            router.push("/profile");
        } catch (err) {
            const baseMessage =
                err instanceof Error && err.message
                    ? err.message
                    : "Could not save your profile.";

            setError(
                `${baseMessage} Some sections may already be saved because the backend currently updates profile data in separate requests. Please review your profile and try again.`
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="mx-auto flex w-full max-w-md flex-col gap-5">
            <TextInput
                id="fullName"
                label="Full Name"
                value={form.fullName}
                onChange={(e) =>
                    setForm({
                        ...form,
                        fullName: e.target.value,
                    })
                }
            />

            <div className="grid grid-cols-[120px_1fr] gap-3">
                <div className="w-[120px]">
                    <SelectInput
                        id="profile-country-code"
                        label="Code"
                        value={form.countryCode}
                        onChange={(e) =>
                            setForm({
                                ...form,
                                countryCode: e.target.value,
                            })
                        }
                        options={countryCodeOptions}
                        placeholder="Select"
                    />
                </div>

                <TextInput
                    id="phone"
                    label="Phone Number"
                    type="tel"
                    inputMode="numeric"
                    value={form.phone}
                    onChange={(e) =>
                        setForm({
                            ...form,
                            phone: e.target.value.replace(/\D/g, ""),
                        })
                    }
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <TextInput
                    id="height"
                    label="Height (cm)"
                    value={form.height}
                    onChange={(e) => {
                        const value = e.target.value;

                        if (/^\d{0,3}$/.test(value)) {
                            setForm({ ...form, height: value });
                        }
                    }}
                />

                <TextInput
                    id="weight"
                    label="Weight (kg)"
                    value={form.weight}
                    onChange={(e) => {
                        const value = e.target.value;

                        if (/^\d{0,3}$/.test(value)) {
                            setForm({ ...form, weight: value });
                        }
                    }}
                />
            </div>

            <ProfileInfoRow label="Gender">
                <SelectInput
                    id="gender"
                    options={[
                        { label: "Select Gender", value: "" },
                        { label: "Male", value: "male" },
                        { label: "Female", value: "female" },
                        { label: "Other", value: "other" },
                    ]}
                    value={form.gender}
                    onChange={(e) =>
                        setForm({ ...form, gender: e.target.value })
                    }
                />
            </ProfileInfoRow>

            <ProfileInfoRow label="Date of Birth">
                <TextInput
                    id="birthDate"
                    type="date"
                    value={form.birthDate}
                    onChange={(e) =>
                        setForm({ ...form, birthDate: e.target.value })
                    }
                />
                <HelperText>
                    Date of birth is kept in the form for now, but the current backend
                    profile API only stores age-related physical data.
                </HelperText>
            </ProfileInfoRow>

            <ProfileInfoRow label="Blood Type">
                <SelectInput
                    id="bloodType"
                    options={bloodTypeOptions}
                    value={form.bloodType}
                    onChange={(e) =>
                        setForm({ ...form, bloodType: e.target.value })
                    }
                />
            </ProfileInfoRow>

            <ProfileInfoRow label="Medical History">
                <TextArea
                    id="medicalHistory"
                    placeholder="Chronic diseases, allergies, or other important notes"
                    value={form.medicalHistory}
                    onChange={(e) =>
                        setForm({ ...form, medicalHistory: e.target.value })
                    }
                />
            </ProfileInfoRow>

            <ProfileInfoRow label="Address">
                <SelectInput
                    id="country"
                    options={[{ label: "Select Country", value: "" }, ...countryOptions]}
                    value={form.country}
                    onChange={(e) =>
                        setForm({
                            ...form,
                            country: e.target.value,
                            city: "",
                            district: "",
                            neighborhood: "",
                        })
                    }
                />

                <SelectInput
                    id="city"
                    options={[{ label: "Select City", value: "" }, ...cityOptions]}
                    value={form.city}
                    onChange={(e) =>
                        setForm({
                            ...form,
                            city: e.target.value,
                            district: "",
                            neighborhood: "",
                        })
                    }
                />

                <SelectInput
                    id="district"
                    options={[{ label: "Select District", value: "" }, ...districtOptions]}
                    value={form.district}
                    onChange={(e) =>
                        setForm({
                            ...form,
                            district: e.target.value,
                            neighborhood: "",
                        })
                    }
                />

                <SelectInput
                    id="neighborhood"
                    options={[
                        { label: "Select Neighborhood", value: "" },
                        ...neighborhoodOptions,
                    ]}
                    value={form.neighborhood}
                    onChange={(e) =>
                        setForm({
                            ...form,
                            neighborhood: e.target.value,
                        })
                    }
                />

                <TextInput
                    id="extraAddress"
                    placeholder="Street, building, etc. (optional)"
                    value={form.extraAddress}
                    onChange={(e) =>
                        setForm({
                            ...form,
                            extraAddress: e.target.value,
                        })
                    }
                />
                <HelperText>
                    District and neighborhood are flattened into the backend address field
                    until dedicated backend fields exist.
                </HelperText>
            </ProfileInfoRow>

            <div className="flex items-center justify-between">
                <span className="text-sm">Share Current Location</span>

                <ToggleSwitch
                    checked={form.shareLocation}
                    onCheckedChange={(value) =>
                        setForm({ ...form, shareLocation: value })
                    }
                />
            </div>

            {error ? <HelperText className="text-red-500">{error}</HelperText> : null}

            <SaveActionBar onSave={handleSave} loading={loading} />
        </div>
    );
}