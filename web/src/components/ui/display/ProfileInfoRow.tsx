type ProfileInfoRowProps = {
  label: string;
  children: React.ReactNode;
};

export function ProfileInfoRow({ label, children }: ProfileInfoRowProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-[#2B2B33]">
        {label}
      </label>

      {children}
    </div>
  );
}