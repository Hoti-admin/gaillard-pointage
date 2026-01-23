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
  container: { maxWidth: 1100, margin: "18px auto", background: THEME.surface, border: `1px solid ${THEME.border}`, borderRadius: 18, padding: 18, boxShadow: "0 10px 30px rgba(0,0,0,0.25)" } as React.CSSProperties,
  h1: { margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: -0.3 } as React.CSSProperties,
  sub: { marginTop: 8, color: THEME.sub } as React.CSSProperties,
  card: { background: THEME.card, border: `1px solid ${THEME.border}`, borderRadius: 16, padding: 14, boxShadow: "0 6px 16px rgba(0,0,0,0.18)" } as React.CSSProperties,
  row: { display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" } as React.CSSProperties,
  label: { display: "block", fontWeight: 900, marginBottom: 6, color: THEME.sub } as React.CSSProperties,
  input: { width: "100%", padding: 10, borderRadius: 14, border: `1px solid ${THEME.border}`, background: THEME.card2, color: THEME.text, outline: "none" } as React.CSSProperties,
  btnPrimary: { padding: "12px 14px", fontWeight: 900, borderRadius: 14, border: `1px solid ${THEME.red}`, background: THEME.red, color: "#fff", cursor: "pointer" } as React.CSSProperties,
  btnGhost: { padding: "12px 14px", fontWeight: 900, borderRadius: 14, border: `1px solid ${THEME.border}`, background: THEME.card2, color: THEME.text, cursor: "pointer" } as React.CSSProperties,
  btnOk: { padding: "12px 14px", fontWeight: 900, borderRadius: 14, border: `1px solid ${THEME.green}`, background: "transparent", color: THEME.text, cursor: "pointer" } as React.CSSProperties,
  btnWarn: { padding: "12px 14px", fontWeight: 900, borderRadius: 14, border: `1px solid ${THEME.amber}`, background: "transparent", color: THEME.text, cursor: "pointer" } as React.CSSProperties,
  sep: { height: 1, background: THEME.border, margin: "14px 0" } as React.CSSProperties,
  msg: { marginTop: 12, padding: "10px 12px", borderRadius: 12, border: `1px solid ${THEME.border}`, background: THEME.card2, fontWeight: 800 } as React.CSSProperties,
  link: { color: THEME.sub, fontWeight: 900, textDecoration: "none" } as React.CSSProperties,
  badge: (color: string) => ({ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 999, border: `1px solid ${THEME.border}`, background: THEME.card2, fontWeight: 900 } as React.CSSProperties),
  dot: (color: string) => ({ width: 10, height: 10, borderRadius: 999, background: color, boxShadow: "0 0 0 4px rgba(255,255,255,0.03)" } as React.CSSProperties),
};

type Profile = { role: string; is_active: boolean; full_name: string | null };
type Emp = { user_id: string; full_name: string };
type SummaryRow = {
  user_id: string;
  full_name: string;
  total_hours: number;
  approved_hours: number;
  pending_hours: number;
  approved_months: number;
  pending_months: number;
};

function currentYear() {
  return new Date().getFullYear();
}
function monthsOfYear(year: number) {
  const now = new Date();
  const maxMonth = year === now.getFullYear() ? now.getMonth() + 1 : 12;
  const out: string[] = [];
  for (let m = 1; m <= maxMonth; m++) out.push(`${year}-${String(m).padStart(2, "0")}`);
  return out;
}

async function downloadWithToken(accessToken: string, url: string, fileName: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j?.error || res.statusText);
  }
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}

export default function AdminBordereauxPage() {
  const [checking, setChecking] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const yNow = currentYear();
  const [year, setYear] = useState<number>(Math.max(MIN_YEAR, yNow));
  const [employee, setEmployee] = useState<string>("all");
  const [month, setMonth] = useState<string>(`${Math.max(MIN_YEAR, yNow)}-01`);

  const months = useMemo(() => monthsOfYear(year), [year]);

  const [employees, setEmployees] = useState<Emp[]>([]);
  const empMap = useMemo(() => new Map(employees.map((e) => [e.user_id, e.full_name])), [employees]);

  const [statusMap, setStatusMap] = useState<Map<string, "pending" | "approved">>(new Map()); // month -> status (selected employee)
  const [summary, setSummary] = useState<SummaryRow[]>([]);
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

  useEffect(() => {
    if (!session?.user?.id) return;
    (async () => {
      const { data: prof } = await supabase.from("profiles").select("role,is_active,full_name").eq("user_id", session.user.id).single();
      setProfile((prof as any) ?? null);

      const { data: emps } = await supabase
        .from("profiles")
        .select("user_id,full_name,is_active")
        .eq("is_active", true)
        .order("full_name", { ascending: true });

      setEmployees(((emps ?? []) as any[]).map((e) => ({ user_id: String(e.user_id), full_name: String(e.full_name ?? "") })));
    })();
  }, [session?.user?.id]);

  const isAdmin = !!(profile?.is_active && profile?.role === "admin");

  async function loadSummary() {
    if (!session?.access_token) return;
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch(`/api/admin/timesheets/year-summary?year=${encodeURIComponent(String(year))}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || res.statusText);
      }
      const j = await res.json();
      setSummary((j?.rows ?? []) as SummaryRow[]);
    } catch (e: any) {
      setMsg("Erreur résumé: " + String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  async function loadEmployeeStatuses() {
    if (!session?.access_token) return;
    if (employee === "all") {
      setStatusMap(new Map());
      return;
    }

    setLoading(true);
    setMsg("");

    const res = await fetch(
      `/api/admin/timesheets/month-status?year=${encodeURIComponent(String(year))}&user_id=${encodeURIComponent(employee)}`,
      { headers: { Authorization: `Bearer ${session.access_token}` } }
    );

    setLoading(false);

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setMsg("Erreur statut: " + (j?.error || res.statusText));
      return;
    }
    const j = await res.json();
    const m = new Map<string, "pending" | "approved">();
    for (const r of (j?.rows ?? []) as any[]) m.set(String(r.month), String(r.status));
    setStatusMap(m);
  }

  useEffect(() => {
    if (!session?.access_token || !isAdmin) return;
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token, year, isAdmin]);

  useEffect(() => {
    if (!session?.access_token || !isAdmin) return;
    loadEmployeeStatuses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token, employee, year, isAdmin]);

  useEffect(() => {
    // ajuste le month quand on change d’année
    if (!months.includes(month)) setMonth(months[0] ?? `${year}-01`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  async function setStatus(newStatus: "approved" | "pending") {
    if (!session?.access_token) return;
    if (employee === "all") return;

    setLoading(true);
    setMsg("");

    const res = await fetch("/api/admin/timesheets/set-status", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: employee, month, status: newStatus }),
    });

    setLoading(false);

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setMsg("Erreur validation: " + (j?.error || res.statusText));
      return;
    }

    setMsg(newStatus === "approved" ? "✅ Mois validé." : "✅ Mois remis en attente.");
    await loadEmployeeStatuses();
    await loadSummary();
  }

  async function exportAnnualAll() {
    if (!session?.access_token) return;
    setLoading(true);
    setMsg("");
    try {
      await downloadWithToken(
        session.access_token,
        `/api/export/yearly-xlsx?year=${encodeURIComponent(String(year))}&employee=all`,
        `Annuel_${year}_TOUS.xlsx`
      );
      setMsg("✅ Export annuel téléchargé.");
    } catch (e: any) {
      setMsg("Erreur export: " + String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  if (checking) return <main style={S.page}>Chargement...</main>;
  if (!session) {
    window.location.href = "/";
    return null;
  }
  if (!isAdmin) {
    return (
      <main style={S.page}>
        <div style={S.container}>
          <h1 style={S.h1}>Admin — Bordereaux</h1>
          <p style={S.sub}>Accès admin uniquement.</p>
          <a href="/admin" style={S.link}>⬅ Retour admin</a>
        </div>
      </main>
    );
  }

  const years = [];
  for (let y = MIN_YEAR; y <= yNow; y++) years.push(y);

  const selectedStatus = employee !== "all" ? (statusMap.get(month) ?? "pending") : "pending";

  const totalYearAll = summary.reduce((a, r) => a + Number(r.total_hours ?? 0), 0);

  return (
    <main style={S.page}>
      <div style={S.container}>
        <div style={S.row}>
          <div>
            <h1 style={S.h1}>Admin — Bordereaux</h1>
            <p style={S.sub}>Valider les mois + Export annuel + Totaux heures année</p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a href="/admin" style={S.link}>⬅ Admin</a>
            <button onClick={exportAnnualAll} style={S.btnPrimary} disabled={loading}>
              📘 Export annuel (tous)
            </button>
            <button onClick={() => { loadSummary(); loadEmployeeStatuses(); }} style={S.btnGhost} disabled={loading}>
              🔄 Recharger
            </button>
          </div>
        </div>

        <div style={{ ...S.card, marginTop: 14 }}>
          <div style={S.row}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <span style={S.badge(THEME.green)}><span style={S.dot(THEME.green)} />Validé</span>
              <span style={S.badge(THEME.amber)}><span style={S.dot(THEME.amber)} />En attente</span>
            </div>
            <div style={{ fontWeight: 900, color: THEME.sub }}>
              Total heures (tous employés) {year} : <b style={{ color: THEME.text }}>{totalYearAll.toFixed(2)} h</b>
            </div>
          </div>

          <div style={S.sep} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 2fr", gap: 12 }}>
            <div>
              <label style={S.label}>Année</label>
              <select value={year} onChange={(e) => setYear(parseInt(e.target.value, 10))} style={S.input}>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            <div>
              <label style={S.label}>Employé (pour valider un mois)</label>
              <select value={employee} onChange={(e) => setEmployee(e.target.value)} style={S.input}>
                <option value="all">-- Choisir --</option>
                {employees.map((e) => <option key={e.user_id} value={e.user_id}>{e.full_name}</option>)}
              </select>
            </div>

            <div>
              <label style={S.label}>Mois</label>
              <select value={month} onChange={(e) => setMonth(e.target.value)} style={S.input}>
                {months.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          {employee !== "all" && (
            <>
              <div style={S.sep} />
              <div style={S.row}>
                <div>
                  Statut actuel :{" "}
                  {selectedStatus === "approved" ? (
                    <span style={S.badge(THEME.green)}><span style={S.dot(THEME.green)} />Validé</span>
                  ) : (
                    <span style={S.badge(THEME.amber)}><span style={S.dot(THEME.amber)} />En attente</span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button onClick={() => setStatus("approved")} style={S.btnOk} disabled={loading}>
                    ✅ Valider le mois
                  </button>
                  <button onClick={() => setStatus("pending")} style={S.btnWarn} disabled={loading}>
                    ↩ Remettre en attente
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <div style={{ ...S.card, marginTop: 14 }}>
          <h3 style={{ marginTop: 0 }}>Résumé annuel (heures)</h3>

          {summary.length === 0 ? (
            <p style={{ color: THEME.sub, margin: 0 }}>Aucune donnée.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {summary.map((r) => (
                <div key={r.user_id} style={{ background: THEME.card2, border: `1px solid ${THEME.border}`, borderRadius: 14, padding: 12 }}>
                  <div style={S.row}>
                    <div style={{ fontWeight: 900 }}>{r.full_name}</div>
                    <div style={{ color: THEME.sub, fontWeight: 900 }}>
                      Total {Number(r.total_hours).toFixed(2)}h — Validé {Number(r.approved_hours).toFixed(2)}h — En attente {Number(r.pending_hours).toFixed(2)}h — Mois validés {r.approved_months} — Mois en attente {r.pending_months}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {msg && <div style={S.msg}>{msg}</div>}
        </div>
      </div>
    </main>
  );
}
