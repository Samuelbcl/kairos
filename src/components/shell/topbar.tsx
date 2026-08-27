import { MobileNav } from "@/components/shell/mobile-nav";
import { UserMenu } from "@/components/shell/user-menu";
import { QuickAdd, QuickAddTrigger } from "@/components/command/quick-add";

type TopbarProps = {
  brandName: string;
  email: string;
  name: string;
};

export function Topbar({ brandName, email, name }: TopbarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-3 md:px-4">
      <MobileNav brandName={brandName} />
      <QuickAddTrigger />
      <QuickAdd />

      <div className="ml-auto flex items-center gap-1">
        <UserMenu email={email} name={name} />
      </div>
    </header>
  );
}
