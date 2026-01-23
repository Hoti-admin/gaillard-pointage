"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Status = "pending" | "approved";
type Profile = { role: string; is_active: boolean; full_name: string | null };
type Emp = { user_id: string; full_name: string };

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
};

const S: any = {
  page: {
    minHeight: "100vh",
    background: THEME.bg,
    color: THEME.text,
    padding: 18,
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
  },
  container: {
    maxWidth: 1100,
    margin: "18px auto",
    background: THEME.surface,
    border: `1px solid ${THEME.border}`,
    borderRadius: 18,
    padding: 18,
    boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
  },
  top: { display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" },
  brand: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" },
  logo: { width: 220, height: "auto", display: "block", filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.35))" },
  h1: { margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: -0.3 },
  sub: { marginTop: 6, color: THEME.sub, fontWeight: 800 },

  card: { background: THEME.card, border: `1px solid ${THEME.border}`, borderRadius: 16, padding: 14, marginTop: 14 },
  label: { display: "block", fontWeight: 900, marginBottom: 6, color: THEME.sub },
  input: {
    width: "100%",
    padding: 12,
    borderRadius: 14,
    border: `1px solid ${THEME.border}`,
    background: THEME.card2,
    color: THEME.text,
    outline: "none",
  },
  row: { display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12, alignItems: "end" },
  rowBtns: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" },

  btnPrimary: { padding: "12px 14px", fontWeight: 900, borderRadius: 14, border: `1px solid ${THEME.red}`, background: THEME.red, color: "#fff", cursor: "pointer" },
  btnGhost: { padding: "12px 14px", fontWeight: 900, borderRadius: 14, border: `1px solid ${THEME.border}`, background: THEME.card2, color: THEME.text, cursor: "pointer" },
  btnOk: { padding: "12px 14px", fontWeight: 900, borderRadius: 14, border: `1px solid ${THEME.green}`, background: "transparent", color: THEME.text, cursor: "pointer" },
  btnWarn: { padding: "12px 14px", fontWeight: 900, borderRadius: 14, border: `1px solid ${THEME.amber}`, background: "transparent", color: THEME.text, cursor: "pointer" },

  msg: { marginTop: 12, padding: "10px 12px", borderRadius: 12, border: `1px solid ${THEME.border}`, background: THEME.card2, fontWeight: 800 },

  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 12, marginTop: 14 },

  monthCard: {
    background: THEME.card2,
    border: `1px solid ${THEME.border}`,
    borderRadius: 14,
    padding: 12,
  },

  badge: (status: Status) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 12px",
    borderRadius: 999,
    border: `1px solid ${THEME.border}`,
    background: THEME.card,
    fontWeight: 900,
  }),
  dot: (color: string) => ({ width: 10, height: 10, borderRadius: 999, background: color }),
  link: { color: THEME.sub, fontWeight: 900, textDecoration: "none" },
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function nowYear() {
  return new Date().getFullYear();
}
function monthKey(year: number, m: number) {
  return `${year}-${pad2(m)}`;
}
const MONTHS_FR = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

async function downloadWithToken(accessToken: string, url: string, fileName: string, openInNewTab = false) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j?.error || res.statusText);
  }
  const blob = await res.blob();
  const objUrl = URL.createObjectURL(blob);

  if (openInNewTab) {
    window.open(objUrl, "_blank", "noopener,noreferrer");
  } else {
    const a = document.createElement("a");
    a.href = objUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  setTimeout(() => URL.revokeObjectURL(objUrl), 30000);
}

export default function AdminBordereauxPage() {
  const [checking, setChecking] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [employees, setEmployees] = useState<Emp[]>([]);
  const [employee, setEmployee] = useState<string>(""); // user_id
  const [year, setYear] = useState<number>(Math.max(2026, nowYear()));

  // ✅ plus de Map => Record (plus simple + zéro bug TS)
  const [statusByMonth, setStatusByMonth] = useState<Record<string, Status>>({});

  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const isAdmin = !!(profile?.is_active && profile?.role === "admin");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecking(false);
      if (!data.session) window.location.href = "/";
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function loadProfileAndEmployees() {
    if (!session?.user?.id) return;

    const { data: prof } = await supabase
      .from("profiles")
      .select("role,is_active,full_name")
      .eq("user_id", session.user.id)
      .single();

    setProfile((prof as any) ?? null);

    const { data: emps, error } = await supabase
      .from("profiles")
      .select("user_id,full_name,is_active")
      .eq("is_active", true)
      .order("full_name", { ascending: true });

    if (error) {
      setMsg("Erreur chargement employés: " + error.message);
      return;
    }

    const list = ((emps ?? []) as any[]).map((e) => ({ user_id: String(e.user_id), full_name: String(e.full_name ?? "") }));
    setEmployees(list);

    if (!employee && list.length > 0) setEmployee(list[0].user_id);
  }

  useEffect(() => {
    if (!session?.user?.id) return;
    loadProfileAndEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  async function loadEmployeeStatuses() {
    if (!session?.access_token || !isAdmin) return;
    if (!employee) return;

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

    const j = await res.json().catch(() => ({}));

    // ✅ FIX TS : on force "approved" sinon "pending"
    const obj: Record<string, Status> = {};
    for (const r of (j?.rows ?? []) as any[]) {
      const mk = String(r.month ?? "");
      const stRaw = String(r.status ?? "pending");
      const st: Status = stRaw === "approved" ? "approved" : "pending";
      if (mk) obj[mk] = st;
    }
    setStatusByMonth(obj);
  }

  useEffect(() => {
    if (!session?.access_token || !isAdmin) return;
    loadEmployeeStatuses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token, year, employee, isAdmin]);

  async function setMonthStatus(mk: string, status: Status) {
    if (!session?.access_token) return;
    if (!employee) return;

    const empName = employees.find((e) => e.user_id === employee)?.full_name ?? employee;
    const ok = window.confirm(status === "approved"
      ? `Valider ${mk} pour ${empName} ?`
      : `Remettre en attente ${mk} pour ${empName} ?`
    );
    if (!ok) return;

    setLoading(true);
    setMsg("");

    const res = await fetch("/api/admin/timesheets/set-status", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user_id: employee, month: mk, status }),
    });

    setLoading(false);

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setMsg("Erreur validation: " + (j?.error || res.statusText));
      return;
    }

    setStatusByMonth((prev) => ({ ...prev, [mk]: status }));
    setMsg(status === "approved" ? `✅ Mois validé (${mk}).` : `✅ Mois remis en attente (${mk}).`);
  }

  async function exportPDF(mk: string) {
    if (!session?.access_token) return;
    setLoading(true);
    setMsg("");
    try {
      const url = `/api/export/pdf?month=${encodeURIComponent(mk)}&employee=${encodeURIComponent(employee)}`;
      await downloadWithToken(session.access_token, url, `Bordereau_${mk}.pdf`, true);
      setMsg("✅ PDF ouvert (nouvel onglet).");
    } catch (e: any) {
      setMsg("Erreur export PDF: " + String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  async function exportXLSX(mk: string) {
    if (!session?.access_token) return;
    setLoading(true);
    setMsg("");
    try {
      const url = `/api/export/xlsx?month=${encodeURIComponent(mk)}&employee=${encodeURIComponent(employee)}`;
      await downloadWithToken(session.access_token, url, `Bordereau_${mk}.xlsx`);
      setMsg("✅ Excel téléchargé.");
    } catch (e: any) {
      setMsg("Erreur export Excel: " + String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  if (checking) return <main style={S.page}>Chargement...</main>;
  if (!session) return null;

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

  const empName = employees.find((e) => e.user_id === employee)?.full_name ?? "";

  return (
    <main style={S.page}>
      <div style={S.container}>
        <div style={S.top}>
          <div style={S.brand}>
            <img src="/gaillard-logo.png" alt="Gaillard Jean-Paul SA" style={S.logo} />
            <div>
              <h1 style={S.h1}>Admin — Bordereaux (année)</h1>
              <div style={S.sub}>Valider un mois + exporter PDF/Excel (par employé).</div>
            </div>
          </div>

          <a href="/admin" style={S.link}>⬅ Admin</a>
        </div>

        <div style={S.card}>
          <div style={S.row}>
            <div>
              <label style={S.label}>Année</label>
              <input
                type="number"
                value={year}
                min={2026}
                max={nowYear() + 1}
                onChange={(e) => setYear(Math.max(2026, Number(e.target.value || 2026)))}
                style={S.input}
              />
            </div>

            <div>
              <label style={S.label}>Employé</label>
              <select value={employee} onChange={(e) => setEmployee(e.target.value)} style={S.input}>
                {employees.map((e) => (
                  <option key={e.user_id} value={e.user_id}>
                    {e.full_name}
                  </option>
                ))}
              </select>
              {empName && <div style={{ marginTop: 8, color: THEME.sub, fontWeight: 900 }}>Sélection: <b style={{ color: THEME.text }}>{empName}</b></div>}
            </div>
          </div>

          <div style={{ height: 1, background: THEME.border, margin: "14px 0" }} />

          <div style={S.rowBtns}>
            <button onClick={loadEmployeeStatuses} style={S.btnGhost} disabled={loading}>
              🔄 Recharger statuts
            </button>
          </div>

          {msg && <div style={S.msg}>{msg}</div>}
        </div>

        <div style={S.grid}>
          {MONTHS_FR.map((label, idx) => {
            const m = idx + 1;
            const mk = monthKey(year, m);
            const st = (statusByMonth[mk] ?? "pending") as Status;
            const color = st === "approved" ? THEME.green : THEME.amber;

            return (
              <div key={mk} style={S.monthCard}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                  <div style={{ fontWeight: 900, fontSize: 16 }}>{label} {year}</div>
                  <span style={S.badge(st)}>
                    <span style={S.dot(color)} />
                    {st === "approved" ? "Validé" : "En attente"}
                  </span>
                </div>

                <div style={{ height: 1, background: THEME.border, margin: "10px 0" }} />

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button onClick={() => exportXLSX(mk)} style={S.btnPrimary} disabled={loading}>
                    📗 Excel
                  </button>
                  <button onClick={() => exportPDF(mk)} style={S.btnGhost} disabled={loading}>
                    📄 PDF
                  </button>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                  <button onClick={() => setMonthStatus(mk, "approved")} style={S.btnOk} disabled={loading}>
                    ✅ Valider
                  </button>
                  <button onClick={() => setMonthStatus(mk, "pending")} style={S.btnWarn} disabled={loading}>
                    ↩ En attente
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
