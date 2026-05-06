type ProfileInfoRowProps = {
  label: string;
  children: React.ReactNode;
};

export function ProfileInfoRow({ label, children }: ProfileInfoRowProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-[color:var(--text-primary)]">
        {label}
      </label>

      {children}
    </div>
  );
}