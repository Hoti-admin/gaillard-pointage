"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { supabase } from "@/lib/supabaseClient";

type Status = "pending" | "approved";
type DayType = "work" | "holiday" | "sick" | "leave" | "accident" | "vacation" | "other";

type Site = { id: string; name: string; is_active: boolean };
type MonthDayRow = {
  work_date: string;
  day_type: DayType;
  note: string | null;
  site_id: string | null;
  start_time: string | null;
  break_start: string | null;
  break_end: string | null;
  end_time: string | null;
  travel_chf: number;
  meals_qty: number;
  misc_chf: number;
  has_logs: boolean;
};

const THEME = {
  bg: "#071120",
  surface: "#0c1730",
  card: "#101d38",
  card2: "#0a162c",
  border: "#223253",
  text: "#edf2ff",
  sub: "#a8b3cf",
  red: "#c1121f",
  green: "#22c55e",
  amber: "#f59e0b",
  blue: "#60a5fa",
};

const S: Record<string, CSSProperties | ((...args: any[]) => CSSProperties)> = {
  page: {
    minHeight: "100vh",
    background: "radial-gradient(circle at top, #102344 0%, #071120 45%, #050b16 100%)",
    color: THEME.text,
    padding: 16,
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
  },
  container: {
    maxWidth: 1380,
    margin: "0 auto",
  },
  shell: {
    background: "rgba(7,17,32,0.88)",
    border: `1px solid ${THEME.border}`,
    borderRadius: 24,
    padding: 18,
    boxShadow: "0 18px 50px rgba(0,0,0,0.35)",
    backdropFilter: "blur(12px)",
  },
  top: {
    display: "flex",
    justifyContent: "space-between",
    gap: 18,
    alignItems: "center",
    flexWrap: "wrap",
  },
  brand: {
    display: "flex",
    gap: 16,
    alignItems: "center",
    flexWrap: "wrap",
  },
  logo: {
    width: 148,
    height: "auto",
    borderRadius: 18,
    border: `1px solid ${THEME.border}`,
    boxShadow: "0 10px 30px rgba(0,0,0,0.28)",
    background: "#d0021b",
  },
  h1: { margin: 0, fontSize: 34, fontWeight: 900, letterSpacing: -0.8 },
  sub: { marginTop: 6, color: THEME.sub, fontWeight: 800, fontSize: 18 },
  adminLink: { color: THEME.sub, fontWeight: 900, textDecoration: "none", whiteSpace: "nowrap" },

  panel: {
    background: "linear-gradient(180deg, rgba(16,29,56,0.98) 0%, rgba(10,22,44,0.96) 100%)",
    border: `1px solid ${THEME.border}`,
    borderRadius: 20,
    padding: 16,
    marginTop: 16,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
  },
  controls: {
    display: "grid",
    gridTemplateColumns: "1.1fr 1.2fr .85fr 1.4fr",
    gap: 14,
    alignItems: "end",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 12,
    marginTop: 14,
  },
  statCard: {
    border: `1px solid ${THEME.border}`,
    borderRadius: 18,
    padding: 14,
    background: "rgba(255,255,255,0.02)",
  },
  statLabel: { color: THEME.sub, fontWeight: 800, fontSize: 13, marginBottom: 8 },
  statValue: { fontSize: 22, fontWeight: 900 },
  label: { display: "block", fontWeight: 900, color: THEME.sub, marginBottom: 8 },
  input: {
    width: "100%",
    padding: "12px 13px",
    borderRadius: 14,
    border: `1px solid ${THEME.border}`,
    background: THEME.card2,
    color: THEME.text,
    outline: "none",
    fontSize: 16,
  },
  select: {
    width: "100%",
    padding: "12px 13px",
    borderRadius: 14,
    border: `1px solid ${THEME.border}`,
    background: THEME.card2,
    color: THEME.text,
    outline: "none",
    fontSize: 16,
  },
  checkboxWrap: {
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    border: `1px solid ${THEME.border}`,
    borderRadius: 14,
    padding: 12,
    background: THEME.card2,
    minHeight: 52,
  },
  actions: {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: 12,
    marginTop: 16,
  },
  btn: {
    padding: "13px 14px",
    borderRadius: 16,
    border: `1px solid ${THEME.border}`,
    background: THEME.card2,
    color: THEME.text,
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 16,
    minHeight: 54,
  },
  btnRed: {
    padding: "13px 14px",
    borderRadius: 16,
    border: `1px solid ${THEME.red}`,
    background: THEME.red,
    color: "#fff",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 16,
    minHeight: 54,
  },
  btnGreen: {
    padding: "13px 14px",
    borderRadius: 16,
    border: `1px solid ${THEME.green}`,
    background: "rgba(34,197,94,0.08)",
    color: THEME.text,
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 16,
    minHeight: 54,
  },
  btnAmber: {
    padding: "13px 14px",
    borderRadius: 16,
    border: `1px solid ${THEME.amber}`,
    background: "rgba(245,158,11,0.08)",
    color: THEME.text,
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 16,
    minHeight: 54,
  },
  msg: {
    marginTop: 14,
    padding: "12px 14px",
    borderRadius: 16,
    border: `1px solid ${THEME.border}`,
    background: THEME.card2,
    fontWeight: 800,
    whiteSpace: "pre-wrap",
  },
  badge: (status: Status) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 9,
    padding: "9px 14px",
    borderRadius: 999,
    border: `1px solid ${status === "approved" ? THEME.green : THEME.amber}`,
    background: status === "approved" ? "rgba(34,197,94,0.10)" : "rgba(245,158,11,0.10)",
    fontWeight: 900,
  }),
  dot: (color: string) => ({ width: 10, height: 10, borderRadius: 999, background: color, display: "inline-block" }),
  rowsHead: { margin: "0 0 10px", fontSize: 22, fontWeight: 900 },
  rowsSub: { color: THEME.sub, fontWeight: 800, marginBottom: 14 },

  desktopWrap: {
    overflowX: "auto",
    borderRadius: 18,
    border: `1px solid ${THEME.border}`,
  },
  table: {
    width: "100%",
    minWidth: 1220,
    borderCollapse: "separate",
    borderSpacing: 0,
  },
  th: {
    textAlign: "left",
    padding: 12,
    background: THEME.card2,
    borderBottom: `1px solid ${THEME.border}`,
    color: THEME.sub,
    fontWeight: 900,
    position: "sticky",
    top: 0,
    zIndex: 1,
  },
  td: {
    padding: 12,
    borderBottom: `1px solid ${THEME.border}`,
    verticalAlign: "top",
  },
  fieldGrid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  mobileList: { display: "none" },
  mobileCard: {
    border: `1px solid ${THEME.border}`,
    borderRadius: 18,
    padding: 14,
    background: "rgba(255,255,255,0.02)",
    marginTop: 12,
  },
  mobileHeader: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 },
  mobileTitle: { fontSize: 20, fontWeight: 900 },
  note: { color: THEME.sub, fontWeight: 800, fontSize: 13 },
};

function ymNow() {
  return new Date().toISOString().slice(0, 7);
}
function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function daysInMonth(ym: string) {
  const [y, m] = ym.split("-").map((x) => parseInt(x, 10));
  return new Date(y, m, 0).getDate();
}
function allDatesOfMonth(ym: string) {
  const [y, m] = ym.split("-").map((x) => parseInt(x, 10));
  const n = daysInMonth(ym);
  const out: string[] = [];
  for (let d = 1; d <= n; d++) out.push(`${y}-${pad2(m)}-${pad2(d)}`);
  return out;
}
function frLabel(d: string) {
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("fr-CH", { weekday: "short", day: "2-digit", month: "2-digit" });
}
function monthLongFr(ym: string) {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("fr-CH", { month: "long", year: "numeric" });
}

export default function AdminReviewPage() {
  const [checking, setChecking] = useState(true);
  const [session, setSession] = useState<any>(null);

  const [month, setMonth] = useState(ymNow());
  const [employee, setEmployee] = useState<string>("");

  const [employees, setEmployees] = useState<Array<{ user_id: string; full_name: string }>>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [monthStatus, setMonthStatus] = useState<Status>("pending");

  const [rows, setRows] = useState<Record<string, MonthDayRow>>({});
  const [replaceLogs, setReplaceLogs] = useState(true);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecking(false);
      if (!data.session) window.location.href = "/";
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function loadEmployees() {
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id,full_name,is_active")
      .eq("is_active", true)
      .order("full_name", { ascending: true });

    if (error) {
      setMsg("Erreur employés: " + error.message);
      return;
    }
    const list = ((data ?? []) as any[]).map((p) => ({
      user_id: String(p.user_id),
      full_name: String(p.full_name ?? ""),
    }));
    setEmployees(list);
    if (!employee && list.length) setEmployee(list[0].user_id);
  }

  useEffect(() => {
    if (!session) return;
    loadEmployees();
  }, [session?.user?.id]);

  async function loadMonthData() {
    if (!session?.access_token || !employee) return;

    setLoading(true);
    setMsg("");

    const res = await fetch(
      `/api/admin/timesheets/month-data?month=${encodeURIComponent(month)}&user_id=${encodeURIComponent(employee)}`,
      { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" }
    );

    setLoading(false);

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setMsg("Erreur chargement: " + (j?.error || res.statusText));
      return;
    }

    const j = await res.json();

    setSites((j?.sites ?? []) as Site[]);
    setMonthStatus((j?.month_status ?? "pending") as Status);

    const map: Record<string, MonthDayRow> = {};
    for (const d of allDatesOfMonth(month)) {
      map[d] = {
        work_date: d,
        day_type: "work",
        note: null,
        site_id: null,
        start_time: "07:00",
        break_start: "12:00",
        break_end: "13:00",
        end_time: "17:00",
        travel_chf: 0,
        meals_qty: 0,
        misc_chf: 0,
        has_logs: false,
      };
    }

    for (const st of (j?.status_rows ?? []) as any[]) {
      const d = String(st.work_date);
      if (!map[d]) continue;
      map[d] = {
        ...map[d],
        day_type: (st.day_type ?? "work") as DayType,
        note: st.note ?? null,
        site_id: st.site_id ? String(st.site_id) : null,
        start_time: st.start_time ?? map[d].start_time,
        break_start: st.break_start ?? map[d].break_start,
        break_end: st.break_end ?? map[d].break_end,
        end_time: st.end_time ?? map[d].end_time,
      };
    }

    for (const ex of (j?.expense_rows ?? []) as any[]) {
      const d = String(ex.work_date);
      if (!map[d]) continue;
      map[d] = {
        ...map[d],
        travel_chf: Number(ex.travel_chf ?? 0),
        meals_qty: Number(ex.meals_qty ?? 0),
        misc_chf: Number(ex.misc_chf ?? 0),
      };
    }

    const logsSet = new Set<string>((j?.log_dates ?? []) as string[]);
    for (const d of Object.keys(map)) map[d].has_logs = logsSet.has(d);

    setRows(map);
  }

  useEffect(() => {
    if (!session?.access_token || !employee) return;
    loadMonthData();
  }, [session?.access_token, month, employee]);

  const siteOptions = useMemo(() => {
    const active = sites.filter((s) => s.is_active !== false);
    return active.sort((a, b) => a.name.localeCompare(b.name));
  }, [sites]);

  const monthRows = useMemo(() => allDatesOfMonth(month).map((d) => rows[d]).filter(Boolean), [month, rows]);
  const approvedCount = useMemo(() => monthRows.filter((r) => r?.day_type === "work").length, [monthRows]);
  const logsCount = useMemo(() => monthRows.filter((r) => r?.has_logs).length, [monthRows]);
  const totalMeals = useMemo(() => monthRows.reduce((sum, r) => sum + Number(r?.meals_qty ?? 0), 0), [monthRows]);
  const totalExpenses = useMemo(
    () => monthRows.reduce((sum, r) => sum + Number(r?.travel_chf ?? 0) + Number(r?.misc_chf ?? 0), 0),
    [monthRows]
  );

  function updateDay(date: string, patch: Partial<MonthDayRow>) {
    setRows((prev) => ({ ...prev, [date]: { ...prev[date], ...patch } }));
  }

  async function saveDay(date: string) {
    if (!session?.access_token) return;
    const r = rows[date];
    if (!r) return;

    setLoading(true);
    setMsg("");

    const res = await fetch("/api/admin/timesheets/upsert-day", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: employee,
        work_date: r.work_date,
        day_type: r.day_type,
        note: r.note,
        site_id: r.site_id,
        start_time: r.start_time,
        break_start: r.break_start,
        break_end: r.break_end,
        end_time: r.end_time,
        travel_chf: r.travel_chf,
        meals_qty: r.meals_qty,
        misc_chf: r.misc_chf,
        replace_logs: replaceLogs,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setMsg("Erreur sauvegarde: " + (j?.error || res.statusText));
      return;
    }

    setMsg(`✅ Sauvegardé: ${date}`);
    loadMonthData();
  }

  async function exportPDF() {
    if (!session?.access_token) return;
    setLoading(true);
    setMsg("");
    try {
      const url = `/api/export/pdf?month=${encodeURIComponent(month)}&employee=${encodeURIComponent(employee)}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${session.access_token}` } });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || res.statusText);
      }
      const blob = await res.blob();
      const u = URL.createObjectURL(blob);
      window.open(u, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(u), 30000);
      setMsg("✅ PDF ouvert.");
    } catch (e: any) {
      setMsg("Erreur export PDF: " + String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  async function exportXLSX() {
    if (!session?.access_token) return;
    setLoading(true);
    setMsg("");
    try {
      const url = `/api/export/xlsx?month=${encodeURIComponent(month)}&employee=${encodeURIComponent(employee)}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${session.access_token}` } });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || res.statusText);
      }
      const blob = await res.blob();
      const u = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = u;
      a.download = `Bordereau_${month}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(u), 30000);
      setMsg("✅ Excel téléchargé.");
    } catch (e: any) {
      setMsg("Erreur export Excel: " + String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  async function validateMonthOnly() {
    if (!session?.access_token) return;
    const ok = window.confirm(`Valider le mois ${monthLongFr(month)} ?`);
    if (!ok) return;

    setLoading(true);
    setMsg("");

    const res = await fetch("/api/admin/timesheets/set-status", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user_id: employee, month, status: "approved" }),
    });

    setLoading(false);

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setMsg("Erreur validation: " + (j?.error || res.statusText));
      return;
    }

    setMonthStatus("approved");
    setMsg("✅ Mois validé.");
    loadMonthData();
  }

  async function validateAndPdf() {
    if (!session?.access_token) return;
    if (monthStatus === "approved") {
      await exportPDF();
      return;
    }

    const ok = window.confirm(`Valider le mois ${monthLongFr(month)} et générer le PDF ?`);
    if (!ok) return;

    setLoading(true);
    setMsg("");

    const res = await fetch("/api/admin/timesheets/set-status", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user_id: employee, month, status: "approved" }),
    });

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setLoading(false);
      setMsg("Erreur validation: " + (j?.error || res.statusText));
      return;
    }

    setMonthStatus("approved");
    try {
      const url = `/api/export/pdf?month=${encodeURIComponent(month)}&employee=${encodeURIComponent(employee)}`;
      const pdfRes = await fetch(url, { headers: { Authorization: `Bearer ${session.access_token}` } });
      if (!pdfRes.ok) {
        const j = await pdfRes.json().catch(() => ({}));
        throw new Error(j?.error || pdfRes.statusText);
      }
      const blob = await pdfRes.blob();
      const u = URL.createObjectURL(blob);
      window.open(u, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(u), 30000);
      setMsg("✅ Mois validé + PDF généré.");
    } catch (e: any) {
      setMsg("✅ Mois validé, mais erreur PDF: " + String(e?.message ?? e));
    } finally {
      setLoading(false);
      loadMonthData();
    }
  }

  async function setPending() {
    if (!session?.access_token) return;
    const ok = window.confirm(`Remettre ${monthLongFr(month)} en attente ?`);
    if (!ok) return;
    setLoading(true);
    setMsg("");
    const res = await fetch("/api/admin/timesheets/set-status", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: employee, month, status: "pending" }),
    });
    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setMsg("Erreur: " + (j?.error || res.statusText));
    } else {
      setMsg("✅ Mois remis en attente.");
      setMonthStatus("pending");
      loadMonthData();
    }
  }

  if (checking) return <main style={S.page as CSSProperties}>Chargement…</main>;
  if (!session) return null;

  const stColor = monthStatus === "approved" ? THEME.green : THEME.amber;
  const selectedEmployeeName = employees.find((e) => e.user_id === employee)?.full_name ?? "—";

  return (
    <main style={S.page as CSSProperties}>
      <style jsx global>{`
        @media (max-width: 980px) {
          .gp-admin-controls { grid-template-columns: 1fr 1fr !important; }
          .gp-admin-actions { grid-template-columns: 1fr 1fr !important; }
          .gp-admin-stats { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 720px) {
          .gp-admin-shell { padding: 12px !important; border-radius: 18px !important; }
          .gp-admin-logo { width: 94px !important; }
          .gp-admin-title { font-size: 21px !important; line-height: 1.1; }
          .gp-admin-sub { font-size: 14px !important; }
          .gp-admin-panel { padding: 12px !important; border-radius: 16px !important; }
          .gp-admin-controls { grid-template-columns: 1fr !important; }
          .gp-admin-actions { grid-template-columns: 1fr !important; }
          .gp-admin-stats { grid-template-columns: 1fr 1fr !important; }
          .gp-admin-desktop { display: none !important; }
          .gp-admin-mobile { display: block !important; }
        }
      `}</style>

      <div style={S.container as CSSProperties}>
        <div style={S.shell as CSSProperties} className="gp-admin-shell">
          <div style={S.top as CSSProperties}>
            <div style={S.brand as CSSProperties}>
              <img src="/gaillard-logo.png" alt="Gaillard Jean-Paul SA" style={S.logo as CSSProperties} className="gp-admin-logo" />
              <div>
                <h1 style={S.h1 as CSSProperties} className="gp-admin-title">Contrôle bordereau (admin)</h1>
                <div style={S.sub as CSSProperties} className="gp-admin-sub">Corriger → contrôler → valider → exporter</div>
              </div>
            </div>
            <a href="/admin" style={S.adminLink as CSSProperties}>⬅ Admin</a>
          </div>

          <div style={S.panel as CSSProperties} className="gp-admin-panel">
            <div style={S.controls as CSSProperties} className="gp-admin-controls">
              <div>
                <label style={S.label as CSSProperties}>Mois</label>
                <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={S.input as CSSProperties} />
              </div>
              <div>
                <label style={S.label as CSSProperties}>Employé</label>
                <select value={employee} onChange={(e) => setEmployee(e.target.value)} style={S.select as CSSProperties}>
                  {employees.map((e) => (
                    <option key={e.user_id} value={e.user_id}>{e.full_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={S.label as CSSProperties}>Statut mois</label>
                <div style={(S.badge as any)(monthStatus)}>
                  <span style={(S.dot as any)(stColor)} />
                  {monthStatus === "approved" ? "Validé" : "En attente"}
                </div>
              </div>
              <div>
                <label style={S.label as CSSProperties}>Option corrections</label>
                <label style={S.checkboxWrap as CSSProperties}>
                  <input type="checkbox" checked={replaceLogs} onChange={(e) => setReplaceLogs(e.target.checked)} />
                  <span style={{ color: THEME.sub, fontWeight: 900, lineHeight: 1.35 }}>Remplacer les “logs” du jour pour que l’export reflète la correction.</span>
                </label>
              </div>
            </div>

            <div style={S.statsGrid as CSSProperties} className="gp-admin-stats">
              <div style={S.statCard as CSSProperties}>
                <div style={S.statLabel as CSSProperties}>Employé sélectionné</div>
                <div style={S.statValue as CSSProperties}>{selectedEmployeeName}</div>
              </div>
              <div style={S.statCard as CSSProperties}>
                <div style={S.statLabel as CSSProperties}>Mois</div>
                <div style={S.statValue as CSSProperties}>{monthLongFr(month)}</div>
              </div>
              <div style={S.statCard as CSSProperties}>
                <div style={S.statLabel as CSSProperties}>Jours travail</div>
                <div style={S.statValue as CSSProperties}>{approvedCount}</div>
              </div>
              <div style={S.statCard as CSSProperties}>
                <div style={S.statLabel as CSSProperties}>Logs / frais</div>
                <div style={S.statValue as CSSProperties}>{logsCount} logs · {totalMeals} repas · {totalExpenses.toFixed(2)} CHF</div>
              </div>
            </div>

            <div style={S.actions as CSSProperties} className="gp-admin-actions">
              <button onClick={loadMonthData} style={S.btn as CSSProperties} disabled={loading}>🔄 Recharger</button>
              <button onClick={exportXLSX} style={S.btnRed as CSSProperties} disabled={loading}>📗 Export Excel</button>
              <button onClick={exportPDF} style={S.btn as CSSProperties} disabled={loading}>📄 Export PDF</button>
              <button onClick={validateAndPdf} style={S.btnGreen as CSSProperties} disabled={loading}>✅ Valider + générer PDF</button>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <button onClick={validateMonthOnly} style={S.btnGreen as CSSProperties} disabled={loading || monthStatus === "approved"}>✅ Valider</button>
                <button onClick={setPending} style={S.btnAmber as CSSProperties} disabled={loading}>↩ En attente</button>
              </div>
            </div>

            {msg && <div style={S.msg as CSSProperties}>{msg}</div>}
          </div>

          <div style={S.panel as CSSProperties} className="gp-admin-panel">
            <div style={S.rowsHead as CSSProperties}>Jours du mois</div>
            <div style={S.rowsSub as CSSProperties}>Version mobile améliorée : sur téléphone chaque jour s’affiche en carte, donc plus de mise en page cassée.</div>

            <div style={S.desktopWrap as CSSProperties} className="gp-admin-desktop">
              <table style={S.table as CSSProperties}>
                <thead>
                  <tr>
                    <th style={S.th as CSSProperties}>Jour</th>
                    <th style={S.th as CSSProperties}>Type</th>
                    <th style={S.th as CSSProperties}>Chantier</th>
                    <th style={S.th as CSSProperties}>Heures</th>
                    <th style={S.th as CSSProperties}>Frais</th>
                    <th style={S.th as CSSProperties}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {allDatesOfMonth(month).map((d) => {
                    const r = rows[d];
                    if (!r) return null;
                    const showWork = r.day_type === "work";
                    return (
                      <tr key={d}>
                        <td style={S.td as CSSProperties}>
                          <div style={{ fontWeight: 900 }}>{frLabel(d)}</div>
                          <div style={{ color: THEME.sub, fontWeight: 800 }}>{d}</div>
                          {r.has_logs && <div style={{ marginTop: 6, color: THEME.sub, fontWeight: 900 }}>📌 Logs existants</div>}
                        </td>
                        <td style={S.td as CSSProperties}>
                          <select value={r.day_type} onChange={(e) => updateDay(d, { day_type: e.target.value as DayType })} style={S.select as CSSProperties}>
                            <option value="work">Travail</option>
                            <option value="holiday">Férié</option>
                            <option value="sick">Maladie</option>
                            <option value="leave">Congé</option>
                            <option value="accident">Accident</option>
                            <option value="vacation">Vacances</option>
                            <option value="other">Autre</option>
                          </select>
                          <input value={r.note ?? ""} onChange={(e) => updateDay(d, { note: e.target.value })} placeholder="Note (si Autre)…" style={{ ...(S.input as CSSProperties), marginTop: 8 }} />
                        </td>
                        <td style={S.td as CSSProperties}>
                          <select value={r.site_id ?? ""} onChange={(e) => updateDay(d, { site_id: e.target.value || null })} style={S.select as CSSProperties} disabled={!showWork}>
                            <option value="">—</option>
                            {siteOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        </td>
                        <td style={S.td as CSSProperties}>
                          <div style={S.fieldGrid2 as CSSProperties}>
                            <div>
                              <label style={S.label as CSSProperties}>Début</label>
                              <input type="time" value={r.start_time ?? ""} onChange={(e) => updateDay(d, { start_time: e.target.value })} style={S.input as CSSProperties} disabled={!showWork} />
                            </div>
                            <div>
                              <label style={S.label as CSSProperties}>Fin</label>
                              <input type="time" value={r.end_time ?? ""} onChange={(e) => updateDay(d, { end_time: e.target.value })} style={S.input as CSSProperties} disabled={!showWork} />
                            </div>
                          </div>
                          <div style={{ ...(S.fieldGrid2 as CSSProperties), marginTop: 10 }}>
                            <div>
                              <label style={S.label as CSSProperties}>Pause début</label>
                              <input type="time" value={r.break_start ?? ""} onChange={(e) => updateDay(d, { break_start: e.target.value })} style={S.input as CSSProperties} disabled={!showWork} />
                            </div>
                            <div>
                              <label style={S.label as CSSProperties}>Pause fin</label>
                              <input type="time" value={r.break_end ?? ""} onChange={(e) => updateDay(d, { break_end: e.target.value })} style={S.input as CSSProperties} disabled={!showWork} />
                            </div>
                          </div>
                        </td>
                        <td style={S.td as CSSProperties}>
                          <div style={S.fieldGrid2 as CSSProperties}>
                            <div>
                              <label style={S.label as CSSProperties}>Déplacement (CHF)</label>
                              <input type="number" step="0.01" value={r.travel_chf} onChange={(e) => updateDay(d, { travel_chf: Number(e.target.value || 0) })} style={S.input as CSSProperties} />
                            </div>
                            <div>
                              <label style={S.label as CSSProperties}>Repas (nb)</label>
                              <input type="number" step="1" value={r.meals_qty} onChange={(e) => updateDay(d, { meals_qty: Number(e.target.value || 0) })} style={S.input as CSSProperties} />
                            </div>
                          </div>
                          <div style={{ marginTop: 10 }}>
                            <label style={S.label as CSSProperties}>Frais divers (CHF)</label>
                            <input type="number" step="0.01" value={r.misc_chf} onChange={(e) => updateDay(d, { misc_chf: Number(e.target.value || 0) })} style={S.input as CSSProperties} />
                          </div>
                        </td>
                        <td style={S.td as CSSProperties}>
                          <button onClick={() => saveDay(d)} style={S.btnRed as CSSProperties} disabled={loading}>💾 Sauver</button>
                          <button onClick={() => updateDay(d, { day_type: "work", start_time: "07:00", break_start: "12:00", break_end: "13:00", end_time: "17:00" })} style={{ ...(S.btn as CSSProperties), marginTop: 10, width: "100%" }} disabled={loading}>↩ Défaut heures</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={S.mobileList as CSSProperties} className="gp-admin-mobile">
              {allDatesOfMonth(month).map((d) => {
                const r = rows[d];
                if (!r) return null;
                const showWork = r.day_type === "work";
                return (
                  <div key={d} style={S.mobileCard as CSSProperties}>
                    <div style={S.mobileHeader as CSSProperties}>
                      <div>
                        <div style={S.mobileTitle as CSSProperties}>{frLabel(d)}</div>
                        <div style={S.note as CSSProperties}>{d}</div>
                      </div>
                      <div style={(S.badge as any)(r.has_logs ? "approved" : "pending")}>
                        <span style={(S.dot as any)(r.has_logs ? THEME.blue : stColor)} />
                        {r.has_logs ? "Logs existants" : monthStatus === "approved" ? "Mois validé" : "À contrôler"}
                      </div>
                    </div>

                    <div style={{ display: "grid", gap: 10 }}>
                      <div>
                        <label style={S.label as CSSProperties}>Type</label>
                        <select value={r.day_type} onChange={(e) => updateDay(d, { day_type: e.target.value as DayType })} style={S.select as CSSProperties}>
                          <option value="work">Travail</option>
                          <option value="holiday">Férié</option>
                          <option value="sick">Maladie</option>
                          <option value="leave">Congé</option>
                          <option value="accident">Accident</option>
                          <option value="vacation">Vacances</option>
                          <option value="other">Autre</option>
                        </select>
                      </div>
                      <div>
                        <label style={S.label as CSSProperties}>Note</label>
                        <input value={r.note ?? ""} onChange={(e) => updateDay(d, { note: e.target.value })} placeholder="Note (si Autre)…" style={S.input as CSSProperties} />
                      </div>
                      <div>
                        <label style={S.label as CSSProperties}>Chantier</label>
                        <select value={r.site_id ?? ""} onChange={(e) => updateDay(d, { site_id: e.target.value || null })} style={S.select as CSSProperties} disabled={!showWork}>
                          <option value="">—</option>
                          {siteOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                      <div style={S.fieldGrid2 as CSSProperties}>
                        <div>
                          <label style={S.label as CSSProperties}>Début</label>
                          <input type="time" value={r.start_time ?? ""} onChange={(e) => updateDay(d, { start_time: e.target.value })} style={S.input as CSSProperties} disabled={!showWork} />
                        </div>
                        <div>
                          <label style={S.label as CSSProperties}>Fin</label>
                          <input type="time" value={r.end_time ?? ""} onChange={(e) => updateDay(d, { end_time: e.target.value })} style={S.input as CSSProperties} disabled={!showWork} />
                        </div>
                        <div>
                          <label style={S.label as CSSProperties}>Pause début</label>
                          <input type="time" value={r.break_start ?? ""} onChange={(e) => updateDay(d, { break_start: e.target.value })} style={S.input as CSSProperties} disabled={!showWork} />
                        </div>
                        <div>
                          <label style={S.label as CSSProperties}>Pause fin</label>
                          <input type="time" value={r.break_end ?? ""} onChange={(e) => updateDay(d, { break_end: e.target.value })} style={S.input as CSSProperties} disabled={!showWork} />
                        </div>
                      </div>
                      <div style={S.fieldGrid2 as CSSProperties}>
                        <div>
                          <label style={S.label as CSSProperties}>Déplacement (CHF)</label>
                          <input type="number" step="0.01" value={r.travel_chf} onChange={(e) => updateDay(d, { travel_chf: Number(e.target.value || 0) })} style={S.input as CSSProperties} />
                        </div>
                        <div>
                          <label style={S.label as CSSProperties}>Repas (nb)</label>
                          <input type="number" step="1" value={r.meals_qty} onChange={(e) => updateDay(d, { meals_qty: Number(e.target.value || 0) })} style={S.input as CSSProperties} />
                        </div>
                      </div>
                      <div>
                        <label style={S.label as CSSProperties}>Frais divers (CHF)</label>
                        <input type="number" step="0.01" value={r.misc_chf} onChange={(e) => updateDay(d, { misc_chf: Number(e.target.value || 0) })} style={S.input as CSSProperties} />
                      </div>
                      <div style={{ display: "grid", gap: 10 }}>
                        <button onClick={() => saveDay(d)} style={S.btnRed as CSSProperties} disabled={loading}>💾 Sauver</button>
                        <button onClick={() => updateDay(d, { day_type: "work", start_time: "07:00", break_start: "12:00", break_end: "13:00", end_time: "17:00" })} style={S.btn as CSSProperties} disabled={loading}>↩ Défaut heures</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 12, color: THEME.sub, fontWeight: 900 }}>
              💡 Conseil : laisse “Remplacer les logs” activé quand tu corriges un jour pour que le PDF et l’Excel reflètent bien la correction.
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
