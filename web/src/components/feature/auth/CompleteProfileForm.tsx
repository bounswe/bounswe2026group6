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
    calculateAgeFromBirthDate,
    parseListField,
    patchMyHealth,
    patchMyLocation,
    patchMyPhysical,
    patchMyPrivacy,
    patchMyProfession,
    patchMyProfile,
    putMyExpertiseAreas,
    splitFullName,
    validateExpertiseAreas,
} from "@/lib/profile";
import { useTurkishLocations } from "@/lib/useTurkishLocations";

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
    profession: string;
    expertise: string;
    provinceCode: string;
    province: string;
    districtId: string;
    district: string;
    neighborhoodId: string;
    neighborhood: string;
    extraAddress: string;
    shareLocation: boolean;
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
    profession: "",
    expertise: "",
    provinceCode: "",
    province: "",
    districtId: "",
    district: "",
    neighborhoodId: "",
    neighborhood: "",
    extraAddress: "",
    shareLocation: false,
};

export default function CompleteProfileForm() {
    const router = useRouter();
    const [form, setForm] = React.useState<ProfileForm>(initialForm);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState("");
    const {
        provinces,
        districts,
        neighborhoods,
        loadingProvinces,
        loadingDistricts,
        loadingNeighborhoods,
        provinceError,
        districtError,
        neighborhoodError,
        retryProvinces,
        retryDistricts,
        retryNeighborhoods,
    } = useTurkishLocations({
        provinceCode: form.provinceCode,
        districtId: form.districtId,
    });

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

    const provinceOptions = provinces.map((province) => ({
        label: province.name,
        value: province.code,
    }));
    const districtOptions = districts.map((district) => ({
        label: district.name,
        value: district.id,
    }));
    const neighborhoodOptions = neighborhoods.map((neighborhood) => ({
        label: neighborhood.name,
        value: neighborhood.id,
    }));

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

        const expertiseAreas = parseListField(form.expertise);
        const expertiseValidationError = validateExpertiseAreas(expertiseAreas);

        if (expertiseValidationError) {
            setError(expertiseValidationError);
            return;
        }

        const age = calculateAgeFromBirthDate(form.birthDate);

        if (age === null) {
            setError("Please enter a valid date of birth.");
            return;
        }

        if (
            !form.height ||
            !form.weight ||
            !form.provinceCode ||
            !form.districtId ||
            !form.neighborhoodId
        ) {
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
                age,
                gender: form.gender || null,
                height: Number(form.height),
                weight: Number(form.weight),
            });

            await patchMyHealth(token, {
                medicalConditions: parseListField(form.medicalHistory),
                bloodType: form.bloodType || null,
            });

            await patchMyLocation(token, {
                provinceCode: form.provinceCode,
                districtId: form.districtId,
                neighborhoodId: form.neighborhoodId,
                extraAddress: form.extraAddress.trim() || null,
            });

            await patchMyPrivacy(token, {
                locationSharingEnabled: form.shareLocation,
            });

            await patchMyProfession(token, {
                profession: form.profession.trim() || null,
            });

            await putMyExpertiseAreas(token, {
                expertiseAreas,
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

            <ProfileInfoRow label="Profession">
                <TextInput
                    id="profession"
                    placeholder="Your profession"
                    value={form.profession}
                    onChange={(e) =>
                        setForm({ ...form, profession: e.target.value })
                    }
                />

                <TextArea
                    id="expertise"
                    label="Expertise (optional)"
                    placeholder="Comma-separated expertise areas"
                    value={form.expertise}
                    onChange={(e) =>
                        setForm({ ...form, expertise: e.target.value })
                    }
                />
            </ProfileInfoRow>

            <ProfileInfoRow label="Address">
                <SelectInput
                    id="country"
                    label="Province"
                    options={[{ label: "Select Province", value: "" }, ...provinceOptions]}
                    value={form.provinceCode}
                    disabled={loadingProvinces}
                    helperText={
                        loadingProvinces
                            ? "Loading provinces..."
                            : provinceError || undefined
                    }
                    onChange={(e) =>
                        setForm({
                            ...form,
                            provinceCode: e.target.value,
                            province: "",
                            districtId: "",
                            district: "",
                            neighborhoodId: "",
                            neighborhood: "",
                        })
                    }
                />

                <SelectInput
                    id="district"
                    label="District"
                    options={[{ label: "Select District", value: "" }, ...districtOptions]}
                    value={form.districtId}
                    disabled={!form.provinceCode || loadingDistricts}
                    helperText={
                        !form.provinceCode
                            ? "Select a province first."
                            : loadingDistricts
                                ? "Loading districts..."
                                : districtError ||
                                  (districtOptions.length === 0
                                      ? "No districts found for this province."
                                      : undefined)
                    }
                    onChange={(e) =>
                        setForm({
                            ...form,
                            districtId: e.target.value,
                            district: "",
                            neighborhoodId: "",
                            neighborhood: "",
                        })
                    }
                />

                <SelectInput
                    id="neighborhood"
                    label="Neighborhood"
                    options={[
                        { label: "Select Neighborhood", value: "" },
                        ...neighborhoodOptions,
                    ]}
                    value={form.neighborhoodId}
                    disabled={!form.districtId || loadingNeighborhoods}
                    helperText={
                        !form.districtId
                            ? "Select a district first."
                            : loadingNeighborhoods
                                ? "Loading neighborhoods..."
                                : neighborhoodError ||
                                  (neighborhoodOptions.length === 0
                                      ? "No neighborhoods found for this district."
                                      : undefined)
                    }
                    onChange={(e) =>
                        setForm({
                            ...form,
                            neighborhoodId: e.target.value,
                            neighborhood: "",
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
                {provinceError ? (
                    <button
                        type="button"
                        onClick={() => void retryProvinces()}
                        className="text-left text-xs font-semibold text-[color:var(--primary-500)] hover:underline"
                    >
                        Retry loading provinces
                    </button>
                ) : null}
                {districtError ? (
                    <button
                        type="button"
                        onClick={() => void retryDistricts()}
                        className="text-left text-xs font-semibold text-[color:var(--primary-500)] hover:underline"
                    >
                        Retry loading districts
                    </button>
                ) : null}
                {neighborhoodError ? (
                    <button
                        type="button"
                        onClick={() => void retryNeighborhoods()}
                        className="text-left text-xs font-semibold text-[color:var(--primary-500)] hover:underline"
                    >
                        Retry loading neighborhoods
                    </button>
                ) : null}
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
