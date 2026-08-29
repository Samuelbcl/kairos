"use client";

/**
 * Dernier filet : une erreur dans le layout racine. Remplace tout le document,
 * donc il doit porter ses propres <html> et <body> et ne dépendre d'aucun
 * composant de l'app — celui qui vient peut-être de casser.
 */
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "24px",
          background: "#fafafa",
          color: "#18181b",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ maxWidth: "28rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.125rem", fontWeight: 600, margin: "0 0 8px" }}>
            Kairos n&apos;a pas pu afficher cette page
          </h1>
          <p style={{ fontSize: "0.9rem", color: "#6b7280", margin: "0 0 20px" }}>
            L&apos;incident a été enregistré. Réessaie&nbsp;; si ça persiste,
            recharge complètement la page.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: "8px 16px",
              fontSize: "0.9rem",
              color: "#fff",
              background: "#4f46e5",
              border: 0,
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}
