import { SettingsNav } from "@/components/settings/settings-nav";

export default function SettingsLayout({ children }: LayoutProps<"/settings">) {
  return (
    <div className="flex flex-col gap-5">
      <SettingsNav />
      <div>{children}</div>
    </div>
  );
}
