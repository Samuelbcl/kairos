export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-surface px-4 py-10">
      {children}
    </div>
  );
}
