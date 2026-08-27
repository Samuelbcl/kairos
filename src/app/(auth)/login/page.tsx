import { LoginForm } from "@/components/auth/login-form";

export const metadata = { title: "Connexion" };

export default async function LoginPage(props: PageProps<"/login">) {
  const params = await props.searchParams;
  const next = typeof params.next === "string" ? params.next : "/";
  const error = typeof params.error === "string" ? params.error : undefined;

  return (
    <div className="w-full max-w-sm">
      <div className="mb-7 flex flex-col items-center gap-3 text-center">
        <span className="grid size-10 place-items-center rounded-lg bg-primary text-base font-semibold text-primary-foreground">
          K
        </span>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Kairos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Le CRM qui te rappelle tes relances au bon moment.
          </p>
        </div>
      </div>

      <LoginForm next={next} initialError={error} />
    </div>
  );
}
