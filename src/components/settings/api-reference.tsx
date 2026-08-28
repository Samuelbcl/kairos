import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ENDPOINTS = [
  { method: "GET", path: "/api/v1/companies", note: "?q=&limit=&offset=" },
  { method: "POST", path: "/api/v1/companies", note: "{ name, email, city, tags… }" },
  { method: "GET", path: "/api/v1/contacts", note: "?company_id=" },
  { method: "POST", path: "/api/v1/contacts", note: "{ first_name, email, company_id… }" },
  { method: "GET", path: "/api/v1/deals", note: "?status=open&stage_id=" },
  { method: "POST", path: "/api/v1/deals", note: "{ title, stage_id, value… }" },
  { method: "GET", path: "/api/v1/tasks", note: "?done=false&overdue=true" },
  { method: "POST", path: "/api/v1/tasks", note: "{ title, due_at, company_id… }" },
];

const METHOD_STYLES: Record<string, string> = {
  GET: "bg-info/10 text-info",
  POST: "bg-success/10 text-success",
};

export function ApiReference({ baseUrl }: { baseUrl: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Référence rapide</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div>
          <p className="mb-2 text-sm text-muted-foreground">
            Toutes les requêtes portent l&apos;en-tête d&apos;authentification :
          </p>
          <pre className="overflow-x-auto rounded-md border bg-surface p-3 font-mono text-xs">
            {`curl ${baseUrl}/api/v1/companies \\
  -H "Authorization: Bearer kai_ta_cle_ici"`}
          </pre>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody className="divide-y">
              {ENDPOINTS.map((endpoint) => (
                <tr key={`${endpoint.method}-${endpoint.path}`}>
                  <td className="py-2 pr-3 align-top">
                    <span
                      className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-medium ${METHOD_STYLES[endpoint.method]}`}
                    >
                      {endpoint.method}
                    </span>
                  </td>
                  <td className="py-2 pr-3 font-mono text-xs">{endpoint.path}</td>
                  <td className="py-2 font-mono text-xs text-muted-foreground">
                    {endpoint.note}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-muted-foreground">
          Réponses paginées : <code>{`{ data, count, limit, offset }`}</code>. Limite
          maximale 200 par appel. Une clé n&apos;accède qu&apos;aux données de son
          espace — même en cas de fuite, les autres espaces restent hors de portée.
        </p>
      </CardContent>
    </Card>
  );
}
