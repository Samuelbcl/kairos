import { LoginForm } from "@/components/auth/login-form";
import { brandStyle, getHostBranding } from "@/lib/host-branding";

export async function generateMetadata() {
  const brand = await getHostBranding();
  return { title: `Connexion · ${brand.brandName}` };
}

export default async function LoginPage(props: PageProps<"/login">) {
  const params = await props.searchParams;
  const next = typeof params.next === "string" ? params.next : "/";
  const error = typeof params.error === "string" ? params.error : undefined;

  // Le client voit sa marque avant même de se connecter, pas la nôtre.
  const brand = await getHostBranding();

  return (
    <div style={brandStyle(brand)} className="w-full max-w-sm">
      <div className="mb-7 flex flex-col items-center gap-3 text-center">
        {brand.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={brand.logoUrl}
            alt={brand.brandName}
            className="h-10 max-w-40 object-contain"
          />
        ) : (
          <span className="grid size-10 place-items-center rounded-lg bg-primary text-base font-semibold text-primary-foreground">
            {brand.brandName.slice(0, 1).toUpperCase()}
          </span>
        )}

        <div>
          <h1 className="text-lg font-semibold tracking-tight">{brand.brandName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Le CRM qui te rappelle tes relances au bon moment.
          </p>
        </div>
      </div>

      <LoginForm next={next} initialError={error} />
    </div>
  );
}
