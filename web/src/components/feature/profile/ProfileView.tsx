"use client";

import * as React from "react";
import { Avatar } from "@/components/ui/media/Avatar";
import { SectionCard } from "@/components/ui/display/SectionCard";
import { SectionHeader } from "@/components/ui/display/SectionHeader";
import { TextInput } from "@/components/ui/inputs/TextInput";
import { SelectInput } from "@/components/ui/inputs/SelectInput";
import { TextArea } from "@/components/ui/inputs/TextArea";
import { ToggleSwitch } from "@/components/ui/selection/ToggleSwitch";
import { PrimaryButton } from "@/components/ui/buttons/PrimaryButton";
import { bloodTypeOptions } from "@/lib/bloodTypes";

// ─── Types ────────────────────────────────────────────────────────────────────

type Neighborhood = { label: string; value: string };
type District = { label: string; neighborhoods: Neighborhood[] };
type City = { label: string; districts: Record<string, District> };
type Country = { label: string; cities: Record<string, City> };
type LocationData = Record<string, Country>;

type UploadedFile = { name: string; data: string };

type ProfileData = {
  fullName?: string;
  email?: string;
  phone?: string;
  height?: string;
  weight?: string;
  bloodType?: string;
  gender?: string;
  birthDate?: string;
  medicalHistory?: string;
  chronicDiseases?: string;
  chronicDiseasesFiles?: UploadedFile[];
  chronicDiseasesVerified?: boolean;
  allergies?: string;
  allergiesFiles?: UploadedFile[];
  allergiesVerified?: boolean;
  country?: string;
  city?: string;
  district?: string;
  neighborhood?: string;
  extraAddress?: string;
  shareLocation?: boolean;
};

// Fix 4: explicit map instead of string replace — typo-proof
const verifiedFieldMap = {
  chronicDiseasesFiles: "chronicDiseasesVerified",
  allergiesFiles: "allergiesVerified",
} as const;

// ─── Location Data ─────────────────────────────────────────────────────────────

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

// ─── Component ─────────────────────────────────────────────────────────────────

export default function ProfileView() {
  const [profile, setProfile] = React.useState<ProfileData | null>(null);
  const [uploading, setUploading] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState<number>(0);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const stored = localStorage.getItem("user");
    setProfile(stored ? (JSON.parse(stored) as ProfileData) : null);
    setLoading(false);
  }, []);

  // ── Guards ──────────────────────────────────────────────────────────────────

  if (loading) {
    return <p className="text-sm text-gray-500">Loading...</p>;
  }

  if (!profile) {
    return <p className="text-sm text-gray-500">No profile data found</p>;
  }

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleSave = () => {
    // TODO: Replace localStorage with a proper API call before production.
    const existing = JSON.parse(localStorage.getItem("user") || "{}") as ProfileData;
    localStorage.setItem("user", JSON.stringify({ ...existing, ...profile }));
  };

  // Fix 4: use verifiedFieldMap instead of string replace
  const handleFileUpload = (field: keyof typeof verifiedFieldMap, file: File) => {
    setUploading(field);
    setProgress(100);

    // TODO: Replace with actual file upload to backend/storage service.
    // Only storing file metadata here — base64 is intentionally NOT stored
    // in localStorage to avoid hitting browser storage limits.
    const verifiedField = verifiedFieldMap[field];

    // Fix 2: functional updater for null safety
    setProfile((prev) => {
      if (!prev) return prev;
      const existing = (prev[field] as UploadedFile[]) || [];
      return {
        ...prev,
        [field]: [...existing, { name: file.name, data: "" }],
        [verifiedField]: false,
      };
    });

    setUploading(null);
  };

  const removeFile = (field: keyof typeof verifiedFieldMap, index: number) => {
    setProfile((prev) => {
      if (!prev) return prev;
      const updated = [...((prev[field] as UploadedFile[]) || [])];
      updated.splice(index, 1);
      return { ...prev, [field]: updated };
    });
  };

  // ── Location Options ────────────────────────────────────────────────────────

  // Fix 1: runtime key guard + keyof cast
  const countryData =
    profile.country && profile.country in locationData
      ? locationData[profile.country as keyof LocationData]
      : undefined;

  const countryOptions = Object.entries(locationData).map(([key, val]) => ({
    label: val.label,
    value: key,
  }));

  const cityOptions = countryData
    ? Object.entries(countryData.cities).map(([key, val]) => ({
        label: val.label,
        value: key,
      }))
    : [];

  const districtOptions =
    profile.city && countryData?.cities?.[profile.city]
      ? Object.entries(countryData.cities[profile.city].districts).map(([key, val]) => ({
          label: val.label,
          value: key,
        }))
      : [];

  const neighborhoodOptions =
    profile.city &&
    profile.district &&
    countryData?.cities?.[profile.city]?.districts?.[profile.district]
      ? countryData.cities[profile.city].districts[profile.district].neighborhoods
      : [];

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex gap-10">

      {/* LEFT */}
      <div className="w-64 flex flex-col items-center gap-4">
        <Avatar size="lg" />
        <div className="text-center">
          <h2 className="text-lg font-semibold">{profile.fullName || "User"}</h2>
          <p className="text-sm text-gray-500">{profile.email || "No email"}</p>
        </div>
      </div>

      {/* RIGHT */}
      <div className="flex-1 flex flex-col gap-6">

        {/* ACCOUNT */}
        <SectionCard>
          <SectionHeader title="Account Information" />
          <p className="text-xs text-gray-400 mb-3">
            Your contact details are used for account access and emergency communication.
          </p>
          <div className="flex flex-col gap-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Email</span>
              <span>{profile.email || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Phone</span>
              <span>{profile.phone || "-"}</span>
            </div>
          </div>
        </SectionCard>

        {/* PHYSICAL */}
        <SectionCard>
          <SectionHeader title="Physical Information" />
          <p className="text-xs text-gray-400 mb-3">
            This information helps responders assess your physical condition in emergencies.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <TextInput
              id="height"
              label="Height (cm)"
              value={profile.height || ""}
              onChange={(e) =>
                setProfile((prev) => prev ? { ...prev, height: e.target.value } : prev)
              }
            />
            <TextInput
              id="weight"
              label="Weight (kg)"
              value={profile.weight || ""}
              onChange={(e) =>
                setProfile((prev) => prev ? { ...prev, weight: e.target.value } : prev)
              }
            />
            <SelectInput
              id="gender"
              label="Gender"
              value={profile.gender || ""}
              onChange={(e) =>
                setProfile((prev) => prev ? { ...prev, gender: e.target.value } : prev)
              }
              options={[
                { label: "Select", value: "" },
                { label: "Male", value: "male" },
                { label: "Female", value: "female" },
                { label: "Other", value: "other" },
              ]}
            />
            <TextInput
              id="birthDate"
              label="Date of Birth"
              type="date"
              value={profile.birthDate || ""}
              onChange={(e) =>
                setProfile((prev) => prev ? { ...prev, birthDate: e.target.value } : prev)
              }
            />
          </div>
        </SectionCard>

        {/* MEDICAL */}
        <SectionCard>
          <SectionHeader title="Medical Information" />
          <p className="text-xs text-gray-400 mb-3">
            In emergency situations, this information may help responders make faster and safer medical decisions.
          </p>

          <div className="flex flex-col gap-4">

          <SelectInput
          id="bloodType"
          label="Blood Type"
          value={profile.bloodType || ""}
          options={bloodTypeOptions}
          onChange={(e) =>
            setProfile((prev) => prev ? { ...prev, bloodType: e.target.value } : prev)
          }
        />

          <TextArea
            id="medicalHistory"
            label="Medical History"
            value={profile.medicalHistory || ""}
            onChange={(e) =>
              setProfile((prev) => prev ? { ...prev, medicalHistory: e.target.value } : prev)
            }
          />

          {/* CHRONIC DISEASES */}
          <div className="mt-4">
            <div className="flex justify-between mb-1">
              <span className="whitespace-nowrap">Chronic Diseases</span>
              <div className="flex gap-2 text-xs items-center">
                {/* Fix 5: removed flex layout classes from <p> */}
                <p className="text-xs text-gray-400">
                  If you declare a chronic condition, you must upload a supporting medical document.
                </p>
                <input
                  type="file"
                  id="chronic-upload"
                  className="hidden"
                  onChange={(e) =>
                    e.target.files?.[0] &&
                    handleFileUpload("chronicDiseasesFiles", e.target.files[0])
                  }
                />
                <label htmlFor="chronic-upload" className="cursor-pointer text-blue-600">
                  Upload
                </label>
              </div>
            </div>

            <TextInput
              id="chronic"
              value={profile.chronicDiseases || ""}
              onChange={(e) =>
                setProfile((prev) => prev ? { ...prev, chronicDiseases: e.target.value } : prev)
              }
            />

            {uploading === "chronicDiseasesFiles" && (
              <div className="mt-2 text-xs">Uploading... {progress}%</div>
            )}

            {profile.chronicDiseasesFiles?.map((file, index) => (
              <div key={index} className="mt-2 flex justify-between text-xs text-gray-600">
                <div className="flex flex-col">
                  <span>📄 {file.name}</span>
                  <span className="text-xs mt-1">
                    {profile.chronicDiseasesVerified ? (
                      <span className="text-green-600">Verified</span>
                    ) : (
                      <span className="text-red-500">Pending Verification</span>
                    )}
                  </span>
                </div>
                <button
                  onClick={() => removeFile("chronicDiseasesFiles", index)}
                  className="text-red-500"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          {/* ALLERGIES */}
          <div className="mt-4">
            <div className="flex justify-between mb-1">
              <span>Allergies</span>
              <div className="flex gap-2 text-xs items-center">
                {/* Fix 5: removed flex layout classes from <p> */}
                <p className="text-xs text-gray-400">
                  You may optionally add allergies. Verification is not required but recommended.
                </p>
                <input
                  type="file"
                  id="allergy-upload"
                  className="hidden"
                  onChange={(e) =>
                    e.target.files?.[0] &&
                    handleFileUpload("allergiesFiles", e.target.files[0])
                  }
                />
                <label htmlFor="allergy-upload" className="cursor-pointer text-blue-600">
                  Upload
                </label>
              </div>
            </div>

            <TextInput
              id="allergy"
              value={profile.allergies || ""}
              onChange={(e) =>
                setProfile((prev) => prev ? { ...prev, allergies: e.target.value } : prev)
              }
            />

            {uploading === "allergiesFiles" && (
              <div className="mt-2 text-xs">Uploading... {progress}%</div>
            )}

            {profile.allergiesFiles?.map((file, index) => (
              <div key={index} className="mt-2 flex justify-between text-xs text-gray-600">
                <div className="flex flex-col">
                  <span>📄 {file.name}</span>
                  <span className="text-xs mt-1">
                    {profile.allergiesVerified ? (
                      <span className="text-green-600">Verified</span>
                    ) : (
                      <span className="text-red-500">Pending Verification</span>
                    )}
                  </span>
                </div>
                <button
                  onClick={() => removeFile("allergiesFiles", index)}
                  className="text-red-500"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          </div>
        </SectionCard>

        {/* LOCATION */}
        <SectionCard>
          <SectionHeader title="Location" />
          <p className="text-xs text-gray-400 mb-3">
            Your location may help emergency services reach you faster.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <SelectInput
              id="country"
              label="Country"
              value={profile.country || ""}
              options={[{ label: "Select Country", value: "" }, ...countryOptions]}
              onChange={(e) =>
                setProfile((prev) =>
                  prev
                    ? { ...prev, country: e.target.value, city: "", district: "", neighborhood: "" }
                    : prev
                )
              }
            />

            {/* Fix 3: disabled until parent is selected */}
            <SelectInput
              id="city"
              label="City"
              value={profile.city || ""}
              disabled={!profile.country}
              options={[{ label: "Select City", value: "" }, ...cityOptions]}
              onChange={(e) =>
                setProfile((prev) =>
                  prev
                    ? { ...prev, city: e.target.value, district: "", neighborhood: "" }
                    : prev
                )
              }
            />
            <SelectInput
              id="district"
              label="District"
              value={profile.district || ""}
              disabled={!profile.city}
              options={[{ label: "Select District", value: "" }, ...districtOptions]}
              onChange={(e) =>
                setProfile((prev) =>
                  prev ? { ...prev, district: e.target.value, neighborhood: "" } : prev
                )
              }
            />
            <SelectInput
              id="neighborhood"
              label="Neighborhood"
              value={profile.neighborhood || ""}
              disabled={!profile.district}
              options={[{ label: "Select Neighborhood", value: "" }, ...neighborhoodOptions]}
              onChange={(e) =>
                setProfile((prev) =>
                  prev ? { ...prev, neighborhood: e.target.value } : prev
                )
              }
            />
            <TextInput
              id="extraAddress"
              label="Extra Address"
              value={profile.extraAddress || ""}
              onChange={(e) =>
                setProfile((prev) => prev ? { ...prev, extraAddress: e.target.value } : prev)
              }
            />
          </div>

          <div className="flex justify-between items-center mt-4">
            <span className="text-sm">Share Current Location</span>
            <ToggleSwitch
              checked={profile.shareLocation || false}
              onCheckedChange={(val) =>
                setProfile((prev) => prev ? { ...prev, shareLocation: val } : prev)
              }
            />
          </div>
        </SectionCard>

        {/* SAVE */}
        <div className="flex justify-end">
          <PrimaryButton onClick={handleSave}>Save Changes</PrimaryButton>
        </div>

      </div>
    </div>
  );
}
