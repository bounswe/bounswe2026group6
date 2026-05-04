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
import {
    LocationPicker,
    LocationPickerValue,
    StreetAddressInput,
} from "@/components/feature/location";
import { bloodTypeOptions } from "@/lib/bloodTypes";
import { countryCodeOptions } from "@/lib/countryCodes";
import { expertiseOptions, professionOptions } from "@/lib/profileOptions";
import { getAccessToken, SIGNUP_DRAFT_KEY } from "@/lib/auth";
import { fetchLocationTree, searchLocations } from "@/lib/location";
import {
    LocationTreeByCountry,
    resolvePickerLocation,
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
    validateExpertiseAreas,
} from "@/lib/profile";

type ProfileForm = {
    firstName: string;
    lastName: string;
    countryCode: string;
    phone: string;
    gender: string;
    height: string;
    weight: string;
    bloodType: string;
    dateOfBirth: string;
    medicalHistory: string;
    chronicDiseases: string;
    allergies: string;
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
    firstName: "",
    lastName: "",
    countryCode: "+90",
    phone: "",
    gender: "",
    height: "",
    weight: "",
    bloodType: "",
    dateOfBirth: "",
    medicalHistory: "",
    chronicDiseases: "",
    allergies: "",
    profession: "",
    expertise: [],
    country: "",
    city: "",
    district: "",
    neighborhood: "",
    extraAddress: "",
    shareLocation: false,
};

const FRESH_DEVICE_CAPTURE_MAX_AGE_MS = 5 * 60 * 1000;

function isFreshCurrentDeviceSelection(value: LocationPickerValue | null) {
    if (!value || value.source !== "current_device") {
        return false;
    }

    if (!value.capturedAt) {
        return false;
    }

    const capturedAtMs = Date.parse(value.capturedAt);
    if (Number.isNaN(capturedAtMs)) {
        return false;
    }

    return Date.now() - capturedAtMs <= FRESH_DEVICE_CAPTURE_MAX_AGE_MS;
}

function toPickerValueFromSearchItem(item: {
    placeId: string;
    displayName: string;
    latitude: number;
    longitude: number;
    administrative: LocationPickerValue["administrative"];
}): LocationPickerValue {
    return {
        placeId: item.placeId,
        displayName: item.displayName,
        latitude: item.latitude,
        longitude: item.longitude,
        source: "dropdown_sync",
        capturedAt: new Date().toISOString(),
        accuracyMeters: null,
        administrative: item.administrative,
    };
}

function splitLegacyFullName(fullName: string) {
    const normalized = fullName.trim().replace(/\s+/g, " ");
    if (!normalized) {
        return { firstName: "", lastName: "" };
    }

    const parts = normalized.split(" ");
    const firstName = parts.shift() || "";
    return {
        firstName,
        lastName: parts.join(" "),
    };
}

export default function CompleteProfileForm() {
    const router = useRouter();
    const [form, setForm] = React.useState<ProfileForm>(initialForm);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState("");
    const [locationTree, setLocationTree] = React.useState<LocationTreeByCountry>({});
    const [locationTreeError, setLocationTreeError] = React.useState("");
    const [locationPickerValue, setLocationPickerValue] =
        React.useState<LocationPickerValue | null>(null);
    const dropdownSyncRequestIdRef = React.useRef(0);

    React.useEffect(() => {
        const savedDraft = sessionStorage.getItem(SIGNUP_DRAFT_KEY);

        if (!savedDraft) {
            return;
        }

        try {
            const parsed = JSON.parse(savedDraft) as Partial<ProfileForm>;
            const fallbackName = splitLegacyFullName((parsed as { fullName?: string }).fullName || "");

            setForm((currentForm) => ({
                ...currentForm,
                firstName: parsed.firstName || fallbackName.firstName || currentForm.firstName,
                lastName: parsed.lastName || fallbackName.lastName || currentForm.lastName,
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

    const applyPickerToForm = React.useCallback(
        (picker: LocationPickerValue) => {
            if (!Object.keys(locationTree).length) {
                return;
            }

            const resolved = resolvePickerLocation(
                locationTree,
                picker.administrative,
                picker.displayName || ""
            );

            setForm((currentForm) => ({
                ...currentForm,
                country: resolved.countryKey || currentForm.country,
                city: resolved.cityKey || currentForm.city,
                district: resolved.districtKey || currentForm.district,
                neighborhood: resolved.neighborhoodValue || currentForm.neighborhood,
                extraAddress: resolved.extraAddress || currentForm.extraAddress,
            }));
        },
        [locationTree]
    );

    const handleLocationPickerChange = React.useCallback(
        (next: LocationPickerValue | null) => {
            setLocationPickerValue(next);

            if (!next) {
                return;
            }

            applyPickerToForm(next);
        },
        [applyPickerToForm]
    );

    const syncPickerFromDropdowns = React.useCallback(
        (nextForm: ProfileForm) => {
            if (!nextForm.country || !nextForm.city) {
                return;
            }

            const country = locationTree[nextForm.country];
            const city = country?.cities[nextForm.city];

            if (!country || !city) {
                return;
            }

            const district = nextForm.district
                ? city.districts[nextForm.district]
                : undefined;
            const neighborhood =
                nextForm.neighborhood && district
                    ? district.neighborhoods.find(
                        (item) => item.value === nextForm.neighborhood
                    )
                    : undefined;

            const query = [
                neighborhood?.label,
                district?.label,
                city.label,
                country.label,
            ]
                .filter(Boolean)
                .join(", ");

            if (!query) {
                return;
            }

            const currentRequestId = ++dropdownSyncRequestIdRef.current;

            void (async () => {
                try {
                    const response = await searchLocations({
                        q: query,
                        countryCode: nextForm.country.toUpperCase() || "TR",
                        limit: 1,
                    });

                    if (currentRequestId !== dropdownSyncRequestIdRef.current) {
                        return;
                    }

                    const first = response.items[0];
                    if (!first) {
                        return;
                    }

                    setLocationPickerValue(toPickerValueFromSearchItem(first));
                } catch {
                    // Keep current picker; dropdown selection still wins on save.
                }
            })();
        },
        [locationTree]
    );

    const updateLocationField = React.useCallback(
        (patch: Partial<ProfileForm>) => {
            setForm((currentForm) => {
                const nextForm = { ...currentForm, ...patch };
                syncPickerFromDropdowns(nextForm);
                return nextForm;
            });
        },
        [syncPickerFromDropdowns]
    );

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

        const firstName = form.firstName.trim();
        const lastName = form.lastName.trim();

        if (!firstName) {
            setError("Please enter your first name.");
            return;
        }

        if (!lastName) {
            setError("Please enter your last name.");
            return;
        }

        if (!form.phone.trim()) {
            setError("Please enter your phone number.");
            return;
        }

        if (!form.dateOfBirth) {
            setError("Please select your date of birth.");
            return;
        }

        if (!form.bloodType) {
            setError("Please select your blood type.");
            return;
        }

        const expertiseAreas = form.expertise.filter((area) =>
            expertiseOptions.includes(area)
        );
        const expertiseValidationError = validateExpertiseAreas(expertiseAreas);

        if (expertiseValidationError) {
            setError(expertiseValidationError);
            return;
        }

        const dateOfBirth = new Date(form.dateOfBirth);
        if (Number.isNaN(dateOfBirth.getTime()) || dateOfBirth > new Date()) {
            setError("Please select a valid date of birth.");
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

        if (form.shareLocation && !isFreshCurrentDeviceSelection(locationPickerValue)) {
            setError(
                "To enable Share Current Location, click Use Current Location first so we can save a fresh device location."
            );
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
                dateOfBirth: form.dateOfBirth,
                gender: form.gender || null,
                height: Number(form.height),
                weight: Number(form.weight),
            });

            await patchMyHealth(token, {
                medicalConditions: parseListField(form.medicalHistory),
                chronicDiseases: parseListField(form.chronicDiseases),
                allergies: parseListField(form.allergies),
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
                displayAddress: locationPickerValue?.displayName ?? undefined,
                placeId: locationPickerValue?.placeId ?? undefined,
                administrative: {
                    countryCode: resolvedCountryCode,
                    country: resolvedCountryLabel || null,
                    city: resolvedCityLabel || null,
                    district: resolvedDistrictLabel || null,
                    neighborhood: resolvedNeighborhoodLabel || null,
                    extraAddress: resolvedExtraAddress || null,
                    postalCode: locationPickerValue?.administrative.postalCode ?? null,
                },
                coordinate: hasCoordinateSelection
                    ? {
                        latitude: locationPickerValue.latitude,
                        longitude: locationPickerValue.longitude,
                        accuracyMeters: locationPickerValue.accuracyMeters ?? null,
                        source: locationPickerValue.source ?? "profile_form",
                        capturedAt:
                            locationPickerValue.capturedAt ??
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextInput
                    id="firstName"
                    label="First Name"
                    value={form.firstName}
                    onChange={(e) =>
                        setForm({
                            ...form,
                            firstName: e.target.value,
                        })
                    }
                />

                <TextInput
                    id="lastName"
                    label="Last Name"
                    value={form.lastName}
                    onChange={(e) =>
                        setForm({
                            ...form,
                            lastName: e.target.value,
                        })
                    }
                />
            </div>

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
                    id="dateOfBirth"
                    type="date"
                    value={form.dateOfBirth}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) =>
                        setForm({ ...form, dateOfBirth: e.target.value })
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
                    placeholder="Medical history"
                    value={form.medicalHistory}
                    onChange={(e) =>
                        setForm({ ...form, medicalHistory: e.target.value })
                    }
                />
            </ProfileInfoRow>

            <ProfileInfoRow label="Chronic Diseases">
                <TextArea
                    id="chronicDiseases"
                    placeholder="Optional"
                    value={form.chronicDiseases}
                    onChange={(e) =>
                        setForm({ ...form, chronicDiseases: e.target.value })
                    }
                />
            </ProfileInfoRow>

            <ProfileInfoRow label="Allergies">
                <TextArea
                    id="allergies"
                    placeholder="Optional"
                    value={form.allergies}
                    onChange={(e) =>
                        setForm({ ...form, allergies: e.target.value })
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
                    onChange={handleLocationPickerChange}
                    label="Select location from map or search"
                />

                <SelectInput
                    id="country"
                    options={[{ label: "Select Country", value: "" }, ...countryOptions]}
                    value={form.country}
                    onChange={(e) =>
                        updateLocationField({
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
                        updateLocationField({
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
                        updateLocationField({
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
                        updateLocationField({
                            neighborhood: e.target.value,
                        })
                    }
                />

                <StreetAddressInput
                    id="extraAddress"
                    label="Extra Address"
                    placeholder="Start typing a street name"
                    value={form.extraAddress}
                    countryCode={(form.country || "TR").toUpperCase()}
                    scope={{
                        country: countryData?.label,
                        city: countryData?.cities[form.city]?.label,
                        district:
                            countryData?.cities[form.city]?.districts[form.district]
                                ?.label,
                        neighborhood: neighborhoodOptions.find(
                            (item) => item.value === form.neighborhood
                        )?.label,
                    }}
                    onChange={(next) =>
                        setForm((currentForm) => ({
                            ...currentForm,
                            extraAddress: next,
                        }))
                    }
                    onSelectSuggestion={(item) => {
                        setLocationPickerValue(toPickerValueFromSearchItem(item));
                    }}
                />
                <HelperText>
                    Pick a spot on the map or start typing a street to see suggestions
                    in your selected area. Selecting a suggestion moves the map pin.
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
