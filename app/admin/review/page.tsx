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
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 900);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return isMobile;
}

export default function AdminReviewPage() {
  const isMobile = useIsMobile();
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
  const [showOnlyLogs, setShowOnlyLogs] = useState(false);
  const [showOnlyPendingDays, setShowOnlyPendingDays] = useState(false);

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
      setMsg("Erreur employés : " + error.message);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setMsg("Erreur chargement : " + (j?.error || res.statusText));
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
    for (const d of Object.keys(map)) {
      map[d].has_logs = logsSet.has(d);
    }

    setRows(map);
  }

  useEffect(() => {
    if (!session?.access_token || !employee) return;
    loadMonthData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token, month, employee]);

  const siteOptions = useMemo(() => {
    const active = sites.filter((s) => s.is_active !== false);
    return active.sort((a, b) => a.name.localeCompare(b.name));
  }, [sites]);

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
      setMsg("Erreur sauvegarde : " + (j?.error || res.statusText));
      return;
    }

    setMsg(`✅ Sauvegardé : ${date}`);
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
      setMsg("Erreur export PDF : " + String(e?.message ?? e));
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
      setMsg("Erreur export Excel : " + String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  async function setMonthApproval(nextStatus: Status) {
    if (!session?.access_token) return;

    const label = nextStatus === "approved" ? "valider" : "remettre en attente";
    const ok = window.confirm(`Tu veux ${label} le mois ${month} ?`);
    if (!ok) return;

    setLoading(true);
    setMsg("");

    const res = await fetch("/api/admin/timesheets/set-status", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user_id: employee, month, status: nextStatus }),
    });

    setLoading(false);

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setMsg("Erreur validation : " + (j?.error || res.statusText));
      return;
    }

    setMonthStatus(nextStatus);
    setMsg(nextStatus === "approved" ? "✅ Mois validé." : "✅ Mois remis en attente.");
    loadMonthData();
  }

  async function validateAndPdf() {
    if (monthStatus !== "approved") {
      await setMonthApproval("approved");
    }
    await exportPDF();
  }

  const workDays = Object.values(rows).filter((r) => r.day_type === "work").length;
  const logsDays = Object.values(rows).filter((r) => r.has_logs).length;
  const expenseDays = Object.values(rows).filter((r) => r.travel_chf > 0 || r.meals_qty > 0 || r.misc_chf > 0).length;

  const visibleDates = allDatesOfMonth(month).filter((d) => {
    const r = rows[d];
    if (!r) return false;
    if (showOnlyLogs && !r.has_logs) return false;
    if (showOnlyPendingDays && r.day_type === "work") return false;
    return true;
  });

  if (checking) return <main style={pageStyle}>Chargement…</main>;
  if (!session) return null;

  return (
    <main style={pageStyle}>
      <div style={{ ...containerStyle, padding: isMobile ? 14 : 20 }}>
        <div style={{ ...headerStyle, flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "center" }}>
          <div style={brandStyle}>
            <img src="/gaillard-logo.png" alt="Gaillard Jean-Paul SA" style={{ ...logoStyle, width: isMobile ? 104 : 180 }} />
            <div>
              <h1 style={{ ...titleStyle, fontSize: isMobile ? 28 : 32 }}>Contrôle bordereau</h1>
              <div style={subStyle}>Version premium admin — responsive mobile, validation plus claire et filtres rapides.</div>
            </div>
          </div>
          <a href="/admin" style={backLinkStyle}>⬅ Admin</a>
        </div>

        <div style={{ ...heroGridStyle, gridTemplateColumns: isMobile ? "1fr" : "1.1fr 0.9fr" }}>
          <div style={cardShell}>
            <div style={eyebrowStyle}>Pilotage</div>
            <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 900, lineHeight: 1.1 }}>
              {monthStatus === "approved" ? "Mois validé" : "Mois en attente"}
            </div>
            <div style={{ color: THEME.sub, marginTop: 8, fontWeight: 700 }}>
              Sélectionne l’employé, corrige les journées, puis valide et exporte le bordereau final.
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
              <span style={statusBadge(monthStatus)}>{monthStatus === "approved" ? "● Validé" : "● En attente"}</span>
              <span style={pillStyle(THEME.blue)}>{workDays} jours travail</span>
              <span style={pillStyle(THEME.amber)}>{logsDays} jours avec logs</span>
              <span style={pillStyle(THEME.green)}>{expenseDays} jours avec frais</span>
            </div>
          </div>

          <div style={cardShell}>
            <div style={eyebrowStyle}>Réglages du mois</div>
            <div style={{ ...fieldsGridStyle, gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr" }}>
              <div>
                <label style={labelStyle}>Mois</label>
                <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Employé</label>
                <select value={employee} onChange={(e) => setEmployee(e.target.value)} style={inputStyle}>
                  {employees.map((e) => (
                    <option key={e.user_id} value={e.user_id}>{e.full_name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <label style={labelStyle}>Option corrections</label>
              <label style={{ display: "flex", gap: 10, alignItems: "flex-start", color: THEME.sub, fontWeight: 800 }}>
                <input type="checkbox" checked={replaceLogs} onChange={(e) => setReplaceLogs(e.target.checked)} style={{ marginTop: 3 }} />
                Remplacer les logs du jour pour que l’export PDF / Excel reflète exactement les corrections faites ici.
              </label>
            </div>
          </div>
        </div>

        <div style={{ ...filtersWrapStyle, marginTop: 16 }}>
          <button onClick={() => setShowOnlyLogs((v) => !v)} style={showOnlyLogs ? btnSelected : btnGhost}>
            {showOnlyLogs ? "✓" : "○"} Jours avec logs
          </button>
          <button onClick={() => setShowOnlyPendingDays((v) => !v)} style={showOnlyPendingDays ? btnSelected : btnGhost}>
            {showOnlyPendingDays ? "✓" : "○"} Jours non travail
          </button>
          <button onClick={() => { setShowOnlyLogs(false); setShowOnlyPendingDays(false); }} style={btnGhost}>
            Réinitialiser filtres
          </button>
        </div>

        <div style={{ ...actionsGridStyle, gridTemplateColumns: isMobile ? "1fr" : "repeat(5, minmax(0,1fr))" }}>
          <button onClick={loadMonthData} style={btnGhost} disabled={loading}>🔄 Recharger</button>
          <button onClick={exportXLSX} style={btnPrimary} disabled={loading}>📗 Export Excel</button>
          <button onClick={exportPDF} style={btnGhost} disabled={loading}>📄 Export PDF</button>
          <button onClick={validateAndPdf} style={btnOk} disabled={loading}>✅ Valider + PDF</button>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <button onClick={() => setMonthApproval("approved")} style={btnOk} disabled={loading || monthStatus === "approved"}>✅ Valider</button>
            <button onClick={() => setMonthApproval("pending")} style={btnWarn} disabled={loading}>↩ Attente</button>
          </div>
        </div>

        {msg && <div style={messageStyle}>{msg}</div>}

        <div style={{ ...cardShell, marginTop: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <div style={eyebrowStyle}>Jours du mois</div>
              <h2 style={{ margin: "4px 0 0", fontSize: isMobile ? 22 : 26 }}>Correction journalière</h2>
            </div>
            <div style={{ color: THEME.sub, fontWeight: 800 }}>{visibleDates.length} jour(s) affiché(s)</div>
          </div>

          <div style={{ display: "grid", gap: 14, marginTop: 16 }}>
            {visibleDates.map((d) => {
              const r = rows[d];
              if (!r) return null;
              const showWork = r.day_type === "work";

              return (
                <div key={d} style={dayCardStyle(r.has_logs)}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 900, fontSize: 18 }}>{frLabel(d)}</div>
                      <div style={{ color: THEME.sub, fontWeight: 700 }}>{d}</div>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {r.has_logs && <span style={pillStyle(THEME.blue)}>Logs existants</span>}
                      <span style={statusChip(r.day_type)}>{labelDayType(r.day_type)}</span>
                    </div>
                  </div>

                  <div style={{ ...fieldsGridStyle, gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", marginTop: 14 }}>
                    <div>
                      <label style={labelStyle}>Type</label>
                      <select value={r.day_type} onChange={(e) => updateDay(d, { day_type: e.target.value as DayType })} style={inputStyle}>
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
                      <label style={labelStyle}>Chantier</label>
                      <select value={r.site_id ?? ""} onChange={(e) => updateDay(d, { site_id: e.target.value || null })} style={inputStyle} disabled={!showWork}>
                        <option value="">—</option>
                        {siteOptions.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <label style={labelStyle}>Note</label>
                    <input value={r.note ?? ""} onChange={(e) => updateDay(d, { note: e.target.value })} placeholder="Note si besoin…" style={inputStyle} />
                  </div>

                  <div style={{ ...fieldsGridStyle, gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, minmax(0,1fr))", marginTop: 12 }}>
                    <div>
                      <label style={labelStyle}>Début</label>
                      <input type="time" value={r.start_time ?? ""} onChange={(e) => updateDay(d, { start_time: e.target.value })} style={inputStyle} disabled={!showWork} />
                    </div>
                    <div>
                      <label style={labelStyle}>Fin</label>
                      <input type="time" value={r.end_time ?? ""} onChange={(e) => updateDay(d, { end_time: e.target.value })} style={inputStyle} disabled={!showWork} />
                    </div>
                    <div>
                      <label style={labelStyle}>Pause début</label>
                      <input type="time" value={r.break_start ?? ""} onChange={(e) => updateDay(d, { break_start: e.target.value })} style={inputStyle} disabled={!showWork} />
                    </div>
                    <div>
                      <label style={labelStyle}>Pause fin</label>
                      <input type="time" value={r.break_end ?? ""} onChange={(e) => updateDay(d, { break_end: e.target.value })} style={inputStyle} disabled={!showWork} />
                    </div>
                  </div>

                  <div style={{ ...fieldsGridStyle, gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0,1fr))", marginTop: 12 }}>
                    <div>
                      <label style={labelStyle}>Déplacement (CHF)</label>
                      <input type="number" step="0.01" value={r.travel_chf} onChange={(e) => updateDay(d, { travel_chf: Number(e.target.value || 0) })} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Repas (nb)</label>
                      <input type="number" step="1" value={r.meals_qty} onChange={(e) => updateDay(d, { meals_qty: Number(e.target.value || 0) })} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Frais divers (CHF)</label>
                      <input type="number" step="0.01" value={r.misc_chf} onChange={(e) => updateDay(d, { misc_chf: Number(e.target.value || 0) })} style={inputStyle} />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10, marginTop: 14 }}>
                    <button onClick={() => saveDay(d)} style={btnPrimary} disabled={loading}>💾 Sauver</button>
                    <button
                      onClick={() => {
                        updateDay(d, {
                          day_type: "work",
                          start_time: "07:00",
                          break_start: "12:00",
                          break_end: "13:00",
                          end_time: "17:00",
                        });
                      }}
                      style={btnGhost}
                      disabled={loading}
                    >
                      ↩ Défaut heures
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 14, color: THEME.sub, fontWeight: 800 }}>
            💡 Astuce : garde “Remplacer les logs” activé quand tu corriges une journée pour que l’export final corresponde exactement à l’écran admin.
          </div>
        </div>
      </div>
    </main>
  );
}

function labelDayType(t: DayType) {
  switch (t) {
    case "holiday": return "Férié";
    case "sick": return "Maladie";
    case "leave": return "Congé";
    case "accident": return "Accident";
    case "vacation": return "Vacances";
    case "other": return "Autre";
    default: return "Travail";
  }
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(180deg, #081121 0%, #0b1220 100%)",
  color: THEME.text,
  padding: 14,
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
};
const containerStyle: CSSProperties = {
  maxWidth: 1280,
  margin: "0 auto",
  background: THEME.surface,
  border: `1px solid ${THEME.border}`,
  borderRadius: 24,
  boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
};
const headerStyle: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 16, paddingBottom: 10 };
const brandStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" };
const logoStyle: CSSProperties = { height: "auto", borderRadius: 18, border: `1px solid ${THEME.border}`, boxShadow: "0 14px 36px rgba(0,0,0,0.28)" };
const titleStyle: CSSProperties = { margin: 0, fontWeight: 900, letterSpacing: -0.6 };
const subStyle: CSSProperties = { marginTop: 6, color: THEME.sub, fontWeight: 700 };
const backLinkStyle: CSSProperties = { color: THEME.sub, fontWeight: 900, textDecoration: "none", alignSelf: "center" };
const heroGridStyle: CSSProperties = { display: "grid", gap: 16, marginTop: 12 };
const cardShell: CSSProperties = { background: "linear-gradient(180deg, rgba(17,28,51,0.98) 0%, rgba(14,25,48,0.98) 100%)", border: `1px solid ${THEME.border}`, borderRadius: 20, padding: 16 };
const eyebrowStyle: CSSProperties = { color: THEME.sub, fontWeight: 900, textTransform: "uppercase", letterSpacing: 1.1, fontSize: 12 };
const fieldsGridStyle: CSSProperties = { display: "grid", gap: 12 };
const actionsGridStyle: CSSProperties = { display: "grid", gap: 12, marginTop: 16 };
const filtersWrapStyle: CSSProperties = { display: "flex", gap: 10, flexWrap: "wrap" };
const labelStyle: CSSProperties = { display: "block", color: THEME.sub, fontWeight: 900, marginBottom: 6 };
const inputStyle: CSSProperties = { width: "100%", padding: 12, borderRadius: 14, border: `1px solid ${THEME.border}`, background: THEME.card2, color: THEME.text, outline: "none" };
const btnPrimary: CSSProperties = { width: "100%", padding: "12px 14px", borderRadius: 14, border: `1px solid ${THEME.red}`, background: THEME.red, color: "#fff", fontWeight: 900, cursor: "pointer" };
const btnGhost: CSSProperties = { width: "100%", padding: "12px 14px", borderRadius: 14, border: `1px solid ${THEME.border}`, background: THEME.card2, color: THEME.text, fontWeight: 900, cursor: "pointer" };
const btnSelected: CSSProperties = { width: "auto", padding: "12px 14px", borderRadius: 14, border: `1px solid ${THEME.blue}`, background: "rgba(96,165,250,0.10)", color: THEME.text, fontWeight: 900, cursor: "pointer" };
const btnOk: CSSProperties = { width: "100%", padding: "12px 14px", borderRadius: 14, border: `1px solid ${THEME.green}`, background: "rgba(34,197,94,0.10)", color: THEME.text, fontWeight: 900, cursor: "pointer" };
const btnWarn: CSSProperties = { width: "100%", padding: "12px 14px", borderRadius: 14, border: `1px solid ${THEME.amber}`, background: "rgba(245,158,11,0.10)", color: THEME.text, fontWeight: 900, cursor: "pointer" };
const messageStyle: CSSProperties = { marginTop: 14, padding: "12px 14px", borderRadius: 14, border: `1px solid ${THEME.border}`, background: THEME.card2, fontWeight: 800, whiteSpace: "pre-wrap" };
const pillStyle = (color: string): CSSProperties => ({ borderRadius: 999, border: `1px solid ${color}55`, background: `${color}16`, color, fontWeight: 900, padding: "8px 12px" });
const statusBadge = (status: Status): CSSProperties => ({ display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 999, padding: "8px 12px", border: `1px solid ${status === "approved" ? "rgba(34,197,94,0.35)" : "rgba(245,158,11,0.35)"}`, background: status === "approved" ? "rgba(34,197,94,0.10)" : "rgba(245,158,11,0.10)", color: status === "approved" ? THEME.green : THEME.amber, fontWeight: 900 });
const statusChip = (type: DayType): CSSProperties => ({ borderRadius: 999, border: `1px solid ${type === "work" ? "rgba(34,197,94,0.30)" : "rgba(96,165,250,0.28)"}`, background: type === "work" ? "rgba(34,197,94,0.10)" : "rgba(96,165,250,0.10)", color: type === "work" ? THEME.green : THEME.blue, fontWeight: 900, padding: "8px 12px" });
const dayCardStyle = (hasLogs: boolean): CSSProperties => ({ background: hasLogs ? "rgba(96,165,250,0.08)" : "rgba(255,255,255,0.02)", border: `1px solid ${hasLogs ? "rgba(96,165,250,0.22)" : THEME.border}`, borderRadius: 18, padding: 14 });
