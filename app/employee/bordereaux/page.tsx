"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const MIN_YEAR = 2026;

const THEME = {
  bg: "#0b1220",
  surface: "#0f172a",
  card: "#111c33",
  card2: "#0e1930",
  border: "#24324f",
  text: "#e5e7eb",
  sub: "#a8b3cf",
  red: "#b40000",
  green: "#22c55e",
  amber: "#f59e0b",
  blue: "#60a5fa",
};

const S = {
  page: { minHeight: "100vh", background: THEME.bg, color: THEME.text, padding: 18, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" } as React.CSSProperties,
  container: { maxWidth: 980, margin: "18px auto", background: THEME.surface, border: `1px solid ${THEME.border}`, borderRadius: 18, padding: 18, boxShadow: "0 10px 30px rgba(0,0,0,0.25)" } as React.CSSProperties,
  h1: { margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: -0.3 } as React.CSSProperties,
  sub: { marginTop: 8, color: THEME.sub } as React.CSSProperties,
  card: { background: THEME.card, border: `1px solid ${THEME.border}`, borderRadius: 16, padding: 14, boxShadow: "0 6px 16px rgba(0,0,0,0.18)" } as React.CSSProperties,
  row: { display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" } as React.CSSProperties,
  label: { display: "block", fontWeight: 900, marginBottom: 6, color: THEME.sub } as React.CSSProperties,
  input: { width: "100%", padding: 10, borderRadius: 14, border: `1px solid ${THEME.border}`, background: THEME.card2, color: THEME.text, outline: "none" } as React.CSSProperties,
  btnPrimary: { padding: "12px 14px", fontWeight: 900, borderRadius: 14, border: `1px solid ${THEME.red}`, background: THEME.red, color: "#fff", cursor: "pointer" } as React.CSSProperties,
  btnGhost: { padding: "12px 14px", fontWeight: 900, borderRadius: 14, border: `1px solid ${THEME.border}`, background: THEME.card2, color: THEME.text, cursor: "pointer" } as React.CSSProperties,
  btnDisabled: { padding: "12px 14px", fontWeight: 900, borderRadius: 14, border: `1px solid ${THEME.border}`, background: "#0b1326", color: THEME.sub, cursor: "not-allowed" } as React.CSSProperties,
  sep: { height: 1, background: THEME.border, margin: "14px 0" } as React.CSSProperties,
  msg: { marginTop: 12, padding: "10px 12px", borderRadius: 12, border: `1px solid ${THEME.border}`, background: THEME.card2, fontWeight: 800 } as React.CSSProperties,
  link: { color: THEME.sub, fontWeight: 900, textDecoration: "none" } as React.CSSProperties,
  badge: (color: string) =>
    ({ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 999, border: `1px solid ${THEME.border}`, background: THEME.card2, fontWeight: 900 } as React.CSSProperties),
  dot: (color: string) => ({ width: 10, height: 10, borderRadius: 999, background: color, boxShadow: "0 0 0 4px rgba(255,255,255,0.03)" } as React.CSSProperties),
};

function ymNow() {
  return new Date().toISOString().slice(0, 7);
}
function currentYear() {
  return new Date().getFullYear();
}
function monthLabelFR(ym: string) {
  const [y, m] = ym.split("-").map((x) => parseInt(x, 10));
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("fr-CH", { month: "long", year: "numeric" });
}
function monthsOfYear(year: number) {
  const now = new Date();
  const maxMonth = year === now.getFullYear() ? now.getMonth() + 1 : 12;
  const out: string[] = [];
  for (let m = 1; m <= maxMonth; m++) {
    out.push(`${year}-${String(m).padStart(2, "0")}`);
  }
  return out;
}

async function openPdfWithToken(accessToken: string, url: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = await res.json();
      msg = j?.error || msg;
    } catch {}
    throw new Error(msg);
  }
  const blob = await res.blob();
  const objUrl = URL.createObjectURL(blob);
  window.open(objUrl, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(objUrl), 30000);
}

export default function EmployeeBordereauxPage() {
  const [checking, setChecking] = useState(true);
  const [session, setSession] = useState<any>(null);

  const yNow = currentYear();
  const defaultYear = Math.max(MIN_YEAR, yNow);
  const [year, setYear] = useState<number>(defaultYear);

  const months = useMemo(() => monthsOfYear(year), [year]);

  const [statusMap, setStatusMap] = useState<Map<string, "pending" | "approved">>(new Map());

  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecking(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function loadStatuses() {
    if (!session?.user?.id) return;
    setLoading(true);
    setMsg("");

    const from = `${year}-01`;
    const to = `${year}-12`;

    const { data, error } = await supabase
      .from("timesheet_months")
      .select("month,status")
      .eq("user_id", session.user.id)
      .gte("month", from)
      .lte("month", to);

    if (error) {
      setLoading(false);
      setMsg("Erreur chargement validations: " + error.message);
      return;
    }

    const m = new Map<string, "pending" | "approved">();
    for (const r of (data ?? []) as any[]) {
      m.set(String(r.month), String(r.status) as any);
    }
    setStatusMap(m);
    setLoading(false);
  }

  useEffect(() => {
    if (!session?.user?.id) return;
    loadStatuses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, year]);

  async function openMonthPDF(ym: string) {
    if (!session?.access_token) return;
    setLoading(true);
    setMsg("");
    try {
      const url = `/api/export/pdf?month=${encodeURIComponent(ym)}&employee=self&status=approved`;
      await openPdfWithToken(session.access_token, url);
      setMsg("✅ PDF ouvert (nouvel onglet).");
    } catch (e: any) {
      setMsg(`❌ ${String(e?.message ?? e)}`);
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (checking) return <main style={S.page}>Chargement...</main>;
  if (!session) {
    window.location.href = "/";
    return null;
  }

  const years = [];
  for (let y = MIN_YEAR; y <= yNow; y++) years.push(y);

  return (
    <main style={S.page}>
      <div style={S.container}>
        <div style={S.row}>
          <div>
            <h1 style={S.h1}>Mes bordereaux</h1>
            <p style={S.sub}>
              Tu peux ouvrir ton bordereau <b>uniquement quand l’admin a validé le mois</b>.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a href="/employee" style={S.link}>⬅ Menu</a>
            <button onClick={signOut} style={S.btnGhost}>Se déconnecter</button>
          </div>
        </div>

        <div style={{ ...S.card, marginTop: 14 }}>
          <div style={S.row}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <span style={S.badge(THEME.green)}><span style={S.dot(THEME.green)} />Validé</span>
              <span style={S.badge(THEME.amber)}><span style={S.dot(THEME.amber)} />En attente</span>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <label style={{ ...S.label, marginBottom: 0 }}>Année</label>
              <select value={year} onChange={(e) => setYear(parseInt(e.target.value, 10))} style={{ ...S.input, width: 140 }}>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>

              <button onClick={loadStatuses} style={S.btnGhost} disabled={loading}>🔄 Recharger</button>
            </div>
          </div>

          <div style={S.sep} />

          <div style={{ display: "grid", gap: 10 }}>
            {months.map((m) => {
              const st = statusMap.get(m) ?? "pending";
              const ok = st === "approved";
              return (
                <div key={m} style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", border: `1px solid ${THEME.border}`, borderRadius: 14, padding: 12, background: THEME.card2 }}>
                  <div>
                    <div style={{ fontWeight: 900 }}>{monthLabelFR(m)}</div>
                    <div style={{ marginTop: 6 }}>
                      {ok ? (
                        <span style={S.badge(THEME.green)}><span style={S.dot(THEME.green)} />Validé</span>
                      ) : (
                        <span style={S.badge(THEME.amber)}><span style={S.dot(THEME.amber)} />En attente</span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    {ok ? (
                      <button onClick={() => openMonthPDF(m)} style={S.btnPrimary} disabled={loading}>
                        📄 Ouvrir PDF
                      </button>
                    ) : (
                      <button style={S.btnDisabled} disabled>
                        ⛔ Pas disponible
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {msg && <div style={S.msg}>{msg}</div>}
        </div>
      </div>
    </main>
  );
}
