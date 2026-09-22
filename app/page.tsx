const BASE = "https://expense-tracker-blond-one-51.vercel.app";

const resources = [
  {
    name: "auth",
    endpoints: [
      ["POST /api/v1/auth/register", "create account"],
      ["POST /api/v1/auth/login", "get session cookie"],
      ["POST /api/v1/auth/logout", "end session"],
    ],
  },
  {
    name: "users",
    endpoints: [
      ["GET /api/v1/users/me", "current user"],
      ["PATCH /api/v1/users/me", "update current user"],
    ],
  },
  {
    name: "categories",
    endpoints: [
      ["GET/POST /api/v1/categories", "list (paginated, filtered, sorted) / create"],
      ["GET/PATCH/DELETE /api/v1/categories/{id}", "read / update / delete"],
    ],
  },
  {
    name: "payment-methods",
    endpoints: [
      ["GET/POST /api/v1/payment-methods", "list / create"],
      ["GET/PATCH/DELETE /api/v1/payment-methods/{id}", "read / update / delete"],
    ],
  },
  {
    name: "expenses",
    endpoints: [
      ["GET/POST /api/v1/expenses", "list (paginated, filtered, sorted) / create"],
      ["GET/PATCH/DELETE /api/v1/expenses/{id}", "read / update / delete"],
    ],
  },
  {
    name: "budgets",
    endpoints: [
      ["GET/POST /api/v1/budgets", "list / create"],
      ["GET/PATCH/DELETE /api/v1/budgets/{id}", "read / update / delete"],
    ],
  },
];

export default function Page() {
  return (
    <main style={{ minHeight: "100vh", background: "#0f1117", color: "#d5d8e0", fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace", padding: 40 }}>
      <h1 style={{ fontSize: 22, color: "#7ee787" }}>Expense Tracker API</h1>
      <p style={{ color: "#8b94a7", marginTop: 6 }}>Task 1 — REST API with a feature-complete set of endpoints. Deployed at <a style={{ color: "#79c0ff" }} href={BASE}>{BASE}</a>.</p>

      <section style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: 15, color: "#e6edf3" }}>Quick start</h2>
        <pre style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 8, padding: 16, overflowX: "auto", color: "#c9d1d9" }}>{`curl -s -c cookie.txt -H 'Content-Type: application/json' \\
  -d '{"email":"aric.kihn.151@example.com","password":"Password123!"}' \\
  ${BASE}/api/v1/auth/login

curl -s -b cookie.txt '${BASE}/api/v1/expenses?limit=3&offset=0'`}</pre>
      </section>

      <section style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: 15, color: "#e6edf3" }}>Endpoints</h2>
        {resources.map((r) => (
          <div key={r.name} style={{ marginBottom: 18 }}>
            <h3 style={{ fontSize: 13, color: "#ffa657", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{r.name}</h3>
            <table style={{ borderCollapse: "collapse", width: "100%", maxWidth: 760 }}>
              <tbody>
                {r.endpoints.map(([ep, desc]) => (
                  <tr key={ep}>
                    <td style={{ border: "1px solid #30363d", padding: "6px 10px", color: "#79c0ff", whiteSpace: "nowrap" }}>{ep}</td>
                    <td style={{ border: "1px solid #30363d", padding: "6px 10px", color: "#8b94a7" }}>{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </section>

      <p style={{ color: "#565e70", marginTop: 28, fontSize: 12 }}>All responses use an envelope {`{ ok | okList | fail }`}. Every list endpoint supports pagination, filtering and sorting. Requests are rate-limited per client IP (100 / 60 s).</p>
    </main>
  );
}