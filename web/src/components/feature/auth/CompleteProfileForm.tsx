"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { TextInput } from "@/components/ui/inputs/TextInput";
import { SelectInput } from "@/components/ui/inputs/SelectInput";
import { TextArea } from "@/components/ui/inputs/TextArea";
import { ToggleSwitch } from "@/components/ui/selection/ToggleSwitch";
import { Checkbox } from "@/components/ui/selection/Checkbox";
import { ProfileInfoRow } from "../../ui/display/ProfileInfoRow";
import { SaveActionBar } from "../../ui/display/SaveActionBar";
import { HelperText } from "@/components/ui/display/HelperText";
import { LocationPicker, LocationPickerValue } from "@/components/feature/location";
import { bloodTypeOptions } from "@/lib/bloodTypes";
import { countryCodeOptions } from "@/lib/countryCodes";
import { expertiseOptions, professionOptions } from "@/lib/profileOptions";
import { getAccessToken, SIGNUP_DRAFT_KEY } from "@/lib/auth";
import { fetchLocationTree } from "@/lib/location";
import {
    findCityKeyByLabel,
    findCountryKeyByLabel,
    findDistrictKeyByLabel,
    findNeighborhoodValueByLabel,
    LocationTreeByCountry,
} from "@/lib/locationTree";
import {
    buildAddress,
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

type ProfileForm = {
    fullName: string;
    countryCode: string;
    phone: string;
    gender: string;
    height: string;
    weight: string;
    bloodType: string;
    age: string;
    medicalHistory: string;
    profession: string;
    expertise: string[];
    country: string;
    city: string;
    district: string;
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
    age: "",
    medicalHistory: "",
    profession: "",
    expertise: [],
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
    const [locationTree, setLocationTree] = React.useState<LocationTreeByCountry>({});
    const [locationTreeError, setLocationTreeError] = React.useState("");
    const [locationPickerValue, setLocationPickerValue] =
        React.useState<LocationPickerValue | null>(null);

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

    React.useEffect(() => {
        let mounted = true;

        async function loadLocationTree() {
            try {
                const response = await fetchLocationTree("TR");

                if (!mounted) {
                    return;
                }

                setLocationTree({ [response.countryCode.toLowerCase()]: response.tree });
                setLocationTreeError("");
            } catch (err) {
                if (!mounted) {
                    return;
                }

                setLocationTreeError(
                    err instanceof Error
                        ? err.message
                        : "Could not load location options."
                );
            }
        }

        void loadLocationTree();

        return () => {
            mounted = false;
        };
    }, []);

    React.useEffect(() => {
        if (!locationPickerValue) {
            return;
        }

        const countryKey = findCountryKeyByLabel(
            locationTree,
            locationPickerValue.administrative.country || ""
        );
        const cityKey = findCityKeyByLabel(
            locationTree,
            countryKey,
            locationPickerValue.administrative.city || ""
        );
        const districtKey = findDistrictKeyByLabel(
            locationTree,
            countryKey,
            cityKey,
            locationPickerValue.administrative.district || ""
        );
        const neighborhoods =
            locationTree[countryKey]?.cities[cityKey]?.districts[districtKey]?.neighborhoods ||
            [];
        const neighborhoodValue = findNeighborhoodValueByLabel(
            neighborhoods,
            locationPickerValue.administrative.neighborhood || ""
        );

        setForm((currentForm) => ({
            ...currentForm,
            country: countryKey || currentForm.country,
            city: cityKey || currentForm.city,
            district: districtKey || currentForm.district,
            neighborhood: neighborhoodValue || currentForm.neighborhood,
            extraAddress:
                locationPickerValue.administrative.extraAddress || currentForm.extraAddress,
        }));
    }, [locationPickerValue, locationTree]);

    const countryData = form.country ? locationTree[form.country] : undefined;

    const countryOptions = Object.entries(locationTree).map(([key, value]) => ({
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

        if (!form.age.trim()) {
            setError("Please enter your age.");
            return;
        }

        if (!form.bloodType) {
            setError("Please select your blood type.");
            return;
        }

        const expertiseAreas = form.expertise;
        const expertiseValidationError = validateExpertiseAreas(expertiseAreas);

        if (expertiseValidationError) {
            setError(expertiseValidationError);
            return;
        }

        const age = Number(form.age);
        if (!Number.isInteger(age) || age <= 0) {
            setError("Please enter a valid age.");
            return;
        }

        const resolvedCountryLabel =
            countryData?.label ||
            locationPickerValue?.administrative.country ||
            form.country ||
            "";
        const resolvedCityLabel =
            countryData?.cities[form.city]?.label ||
            locationPickerValue?.administrative.city ||
            form.city ||
            "";
        const resolvedDistrictLabel =
            countryData?.cities[form.city]?.districts[form.district]?.label ||
            locationPickerValue?.administrative.district ||
            form.district;
        const resolvedNeighborhoodLabel =
            countryData?.cities[form.city]?.districts[form.district]?.neighborhoods.find(
                (item) => item.value === form.neighborhood
            )?.label ||
            locationPickerValue?.administrative.neighborhood ||
            form.neighborhood;
        const resolvedExtraAddress =
            form.extraAddress ||
            locationPickerValue?.administrative.extraAddress ||
            "";
        const hasCoordinateSelection =
            typeof locationPickerValue?.latitude === "number" &&
            typeof locationPickerValue?.longitude === "number";
        const resolvedCountryCode =
            (locationPickerValue?.administrative.countryCode || "").trim().toUpperCase() ||
            (form.country || "").trim().toUpperCase() ||
            null;

        if (!form.height || !form.weight) {
            setError("Please fill in all required fields.");
            return;
        }

        if (!resolvedCountryLabel || !resolvedCityLabel) {
            setError("Please select your location from map or dropdown.");
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
                country: resolvedCountryLabel || null,
                city: resolvedCityLabel || null,
                address:
                    buildAddress({
                        district: resolvedDistrictLabel,
                        neighborhood: resolvedNeighborhoodLabel,
                        extraAddress: resolvedExtraAddress,
                    }) || null,
                latitude: hasCoordinateSelection
                    ? locationPickerValue.latitude
                    : undefined,
                longitude: hasCoordinateSelection
                    ? locationPickerValue.longitude
                    : undefined,
                displayAddress: locationPickerValue?.displayName || undefined,
                placeId: locationPickerValue?.placeId || undefined,
                administrative: {
                    countryCode: resolvedCountryCode,
                    country: resolvedCountryLabel || null,
                    city: resolvedCityLabel || null,
                    district: resolvedDistrictLabel || null,
                    neighborhood: resolvedNeighborhoodLabel || null,
                    extraAddress: resolvedExtraAddress || null,
                },
                coordinate: hasCoordinateSelection
                    ? {
                        latitude: locationPickerValue.latitude,
                        longitude: locationPickerValue.longitude,
                        accuracyMeters: locationPickerValue.accuracyMeters ?? null,
                        source: locationPickerValue.source || "profile_form",
                        capturedAt:
                            locationPickerValue.capturedAt ||
                            new Date().toISOString(),
                    }
                    : undefined,
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

            <ProfileInfoRow label="Age">
                <TextInput
                    id="age"
                    type="number"
                    inputMode="numeric"
                    value={form.age}
                    onChange={(e) =>
                        setForm({ ...form, age: e.target.value.replace(/\D/g, "").slice(0, 3) })
                    }
                />
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
                <SelectInput
                    id="profession"
                    options={professionOptions}
                    value={form.profession}
                    onChange={(e) =>
                        setForm({ ...form, profession: e.target.value })
                    }
                />

                <div className="flex flex-col gap-3">
                    <p className="text-sm font-medium text-[#2B2B33]">
                        Expertise (optional)
                    </p>
                    {expertiseOptions.map((option) => (
                        <Checkbox
                            key={option}
                            id={`expertise-${option}`}
                            label={option}
                            checked={form.expertise.includes(option)}
                            onCheckedChange={(checked) =>
                                setForm({
                                    ...form,
                                    expertise: checked
                                        ? [...form.expertise, option]
                                        : form.expertise.filter((item) => item !== option),
                                })
                            }
                        />
                    ))}
                </div>
            </ProfileInfoRow>

            <ProfileInfoRow label="Address">
                <LocationPicker
                    value={locationPickerValue}
                    onChange={setLocationPickerValue}
                    label="Select location from map or search"
                />

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
                    District and neighborhood are sent with their labels and merged into
                    the backend address field for compatibility.
                </HelperText>
                {locationTreeError ? (
                    <HelperText className="text-red-500">{locationTreeError}</HelperText>
                ) : null}
            </ProfileInfoRow>

            <div className="flex items-center justify-between">
                <span className="text-sm">Share Current Location</span>

                <ToggleSwitch
                    aria-label="Share Current Location"
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
