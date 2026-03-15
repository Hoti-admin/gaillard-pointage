"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Status = "pending" | "approved";
type DayType = "work" | "holiday" | "sick" | "leave" | "accident" | "vacation" | "other";

type Site = { id: string; name: string; is_active: boolean };
type MonthDayRow = {
  work_date: string; // YYYY-MM-DD
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
};

const S: any = {
  page: { minHeight: "100vh", background: THEME.bg, color: THEME.text, padding: 18, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" },
  container: { maxWidth: 1200, margin: "18px auto", background: THEME.surface, border: `1px solid ${THEME.border}`, borderRadius: 18, padding: 18, boxShadow: "0 10px 30px rgba(0,0,0,0.25)" },
  top: { display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" },
  brand: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" },
  logo: { width: 220, height: "auto", display: "block", filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.35))" },
  h1: { margin: 0, fontSize: 26, fontWeight: 900, letterSpacing: -0.3 },
  sub: { marginTop: 6, color: THEME.sub, fontWeight: 800 },

  card: { background: THEME.card, border: `1px solid ${THEME.border}`, borderRadius: 16, padding: 14, marginTop: 14, boxShadow: "0 6px 16px rgba(0,0,0,0.18)" },
  row: { display: "grid", gridTemplateColumns: "220px 1fr 1fr 1fr", gap: 12, alignItems: "end" },
  row2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "end" },
  rowBtns: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" },
  label: { display: "block", fontWeight: 900, marginBottom: 6, color: THEME.sub },
  input: { width: "100%", padding: 10, borderRadius: 12, border: `1px solid ${THEME.border}`, background: THEME.card2, color: THEME.text, outline: "none" },
  select: { width: "100%", padding: 10, borderRadius: 12, border: `1px solid ${THEME.border}`, background: THEME.card2, color: THEME.text, outline: "none" },

  btnPrimary: { padding: "12px 14px", fontWeight: 900, borderRadius: 14, border: `1px solid ${THEME.red}`, background: THEME.red, color: "#fff", cursor: "pointer" },
  btnGhost: { padding: "12px 14px", fontWeight: 900, borderRadius: 14, border: `1px solid ${THEME.border}`, background: THEME.card2, color: THEME.text, cursor: "pointer" },
  btnOk: { padding: "12px 14px", fontWeight: 900, borderRadius: 14, border: `1px solid ${THEME.green}`, background: "transparent", color: THEME.text, cursor: "pointer" },
  btnWarn: { padding: "12px 14px", fontWeight: 900, borderRadius: 14, border: `1px solid ${THEME.amber}`, background: "transparent", color: THEME.text, cursor: "pointer" },

  msg: { marginTop: 12, padding: "10px 12px", borderRadius: 12, border: `1px solid ${THEME.border}`, background: THEME.card2, fontWeight: 800 },

  table: { width: "100%", borderCollapse: "separate", borderSpacing: 0, overflow: "hidden" },
  th: { textAlign: "left", padding: 10, background: THEME.card2, borderBottom: `1px solid ${THEME.border}`, color: THEME.sub, fontWeight: 900, position: "sticky", top: 0, zIndex: 1 },
  td: { padding: 10, borderBottom: `1px solid ${THEME.border}`, verticalAlign: "top" },
  badge: (st: Status) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 12px",
    borderRadius: 999,
    border: `1px solid ${THEME.border}`,
    background: THEME.card2,
    fontWeight: 900,
  }),
  dot: (color: string) => ({ width: 10, height: 10, borderRadius: 999, background: color }),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  async function loadMonthData() {
    if (!session?.access_token || !employee) return;

    setLoading(true);
    setMsg("");

    const res = await fetch(
      `/api/admin/timesheets/month-data?month=${encodeURIComponent(month)}&user_id=${encodeURIComponent(employee)}`,
      { headers: { Authorization: `Bearer ${session.access_token}` } }
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

    const ok = window.confirm(`Valider le mois ${month} ?`);
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
    await loadMonthData();
  }

  // ✅ NOUVEAU : Valider + générer PDF
  async function validateAndPdf() {
    if (!session?.access_token) return;

    // si déjà validé → juste PDF
    if (monthStatus === "approved") {
      await exportPDF();
      return;
    }

    const ok = window.confirm(`Valider le mois ${month} et générer le PDF ?`);
    if (!ok) return;

    setLoading(true);
    setMsg("");

    // 1) valider
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

    // 2) ouvrir PDF
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

      setMonthStatus("approved");
      setMsg("✅ Mois validé + PDF généré.");
    } catch (e: any) {
      setMsg("✅ Mois validé, mais erreur PDF: " + String(e?.message ?? e));
    } finally {
      setLoading(false);
      loadMonthData();
    }
  }

  if (checking) return <main style={S.page}>Chargement…</main>;
  if (!session) return null;

  const stColor = monthStatus === "approved" ? THEME.green : THEME.amber;

  return (
    <main style={S.page}>
      <div style={S.container}>
        <div style={S.top}>
          <div style={S.brand}>
            <img src="/gaillard-logo.png" alt="Gaillard Jean-Paul SA" style={S.logo} />
            <div>
              <h1 style={S.h1}>Contrôle bordereau (admin)</h1>
              <div style={S.sub}>Corriger → contrôler → valider → exporter</div>
            </div>
          </div>
          <a href="/admin" style={{ color: THEME.sub, fontWeight: 900, textDecoration: "none" }}>⬅ Admin</a>
        </div>

        <div style={S.card}>
          <div style={S.row}>
            <div>
              <label style={S.label}>Mois</label>
              <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={S.input} />
            </div>

            <div>
              <label style={S.label}>Employé</label>
              <select value={employee} onChange={(e) => setEmployee(e.target.value)} style={S.select}>
                {employees.map((e) => (
                  <option key={e.user_id} value={e.user_id}>
                    {e.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={S.label}>Statut mois</label>
              <div style={S.badge(monthStatus)}>
                <span style={S.dot(stColor)} />
                {monthStatus === "approved" ? "Validé" : "En attente"}
              </div>
            </div>

            <div>
              <label style={S.label}>Option corrections</label>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 900, color: THEME.sub }}>
                  <input
                    type="checkbox"
                    checked={replaceLogs}
                    onChange={(e) => setReplaceLogs(e.target.checked)}
                  />
                  Remplacer les “logs” du jour (pour que l’export reflète la correction)
                </label>
              </div>
            </div>
          </div>

          <div style={{ height: 1, background: THEME.border, margin: "14px 0" }} />

          <div style={S.rowBtns}>
            <button onClick={loadMonthData} style={S.btnGhost} disabled={loading}>🔄 Recharger</button>

            <button onClick={exportXLSX} style={S.btnPrimary} disabled={loading}>📗 Export Excel</button>
            <button onClick={exportPDF} style={S.btnGhost} disabled={loading}>📄 Export PDF</button>

            {/* ✅ NOUVEAU BOUTON 1-CLIC */}
            <button onClick={validateAndPdf} style={S.btnOk} disabled={loading}>
              ✅ Valider + générer PDF
            </button>

            <div style={{ flex: 1 }} />

            <button onClick={validateMonthOnly} style={S.btnOk} disabled={loading || monthStatus === "approved"}>
              ✅ Valider le mois
            </button>

            <button
              onClick={async () => {
                const ok = window.confirm(`Remettre ${month} en attente ?`);
                if (!ok) return;
                setLoading(true); setMsg("");
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
                  setMonthStatus("pending");
                  setMsg("✅ Mois remis en attente.");
                  await loadMonthData();
                }
              }}
              style={S.btnWarn}
              disabled={loading}
            >
              ↩ En attente
            </button>
          </div>

          {msg && <div style={S.msg}>{msg}</div>}
        </div>

        <div style={S.card}>
          <h3 style={{ marginTop: 0 }}>Jours du mois</h3>

          <div style={{ overflowX: "auto", borderRadius: 14, border: `1px solid ${THEME.border}` }}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Jour</th>
                  <th style={S.th}>Type</th>
                  <th style={S.th}>Chantier</th>
                  <th style={S.th}>Heures</th>
                  <th style={S.th}>Frais</th>
                  <th style={S.th}>Action</th>
                </tr>
              </thead>

              <tbody>
                {allDatesOfMonth(month).map((d) => {
                  const r = rows[d];
                  if (!r) return null;

                  const showWork = r.day_type === "work";

                  return (
                    <tr key={d}>
                      <td style={S.td}>
                        <div style={{ fontWeight: 900 }}>{frLabel(d)}</div>
                        <div style={{ color: THEME.sub, fontWeight: 800 }}>{d}</div>
                        {r.has_logs && (
                          <div style={{ marginTop: 6, color: THEME.sub, fontWeight: 900 }}>
                            📌 Logs existants
                          </div>
                        )}
                      </td>

                      <td style={S.td}>
                        <select
                          value={r.day_type}
                          onChange={(e) => updateDay(d, { day_type: e.target.value as DayType })}
                          style={S.select}
                        >
                          <option value="work">Travail</option>
                          <option value="holiday">Férié</option>
                          <option value="sick">Maladie</option>
                          <option value="leave">Congé</option>
                          <option value="accident">Accident</option>
                          <option value="vacation">Vacances</option>
                          <option value="other">Autre</option>
                        </select>

                        <input
                          value={r.note ?? ""}
                          onChange={(e) => updateDay(d, { note: e.target.value })}
                          placeholder="Note (si Autre)…"
                          style={{ ...S.input, marginTop: 8 }}
                        />
                      </td>

                      <td style={S.td}>
                        <select
                          value={r.site_id ?? ""}
                          onChange={(e) => updateDay(d, { site_id: e.target.value || null })}
                          style={S.select}
                          disabled={!showWork}
                        >
                          <option value="">—</option>
                          {siteOptions.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td style={S.td}>
                        <div style={S.row2}>
                          <div>
                            <label style={S.label}>Début</label>
                            <input
                              type="time"
                              value={r.start_time ?? ""}
                              onChange={(e) => updateDay(d, { start_time: e.target.value })}
                              style={S.input}
                              disabled={!showWork}
                            />
                          </div>
                          <div>
                            <label style={S.label}>Fin</label>
                            <input
                              type="time"
                              value={r.end_time ?? ""}
                              onChange={(e) => updateDay(d, { end_time: e.target.value })}
                              style={S.input}
                              disabled={!showWork}
                            />
                          </div>
                        </div>

                        <div style={{ ...S.row2, marginTop: 10 }}>
                          <div>
                            <label style={S.label}>Pause début</label>
                            <input
                              type="time"
                              value={r.break_start ?? ""}
                              onChange={(e) => updateDay(d, { break_start: e.target.value })}
                              style={S.input}
                              disabled={!showWork}
                            />
                          </div>
                          <div>
                            <label style={S.label}>Pause fin</label>
                            <input
                              type="time"
                              value={r.break_end ?? ""}
                              onChange={(e) => updateDay(d, { break_end: e.target.value })}
                              style={S.input}
                              disabled={!showWork}
                            />
                          </div>
                        </div>
                      </td>

                      <td style={S.td}>
                        <div style={S.row2}>
                          <div>
                            <label style={S.label}>Déplacement (CHF)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={r.travel_chf}
                              onChange={(e) => updateDay(d, { travel_chf: Number(e.target.value || 0) })}
                              style={S.input}
                            />
                          </div>
                          <div>
                            <label style={S.label}>Repas (nb)</label>
                            <input
                              type="number"
                              step="1"
                              value={r.meals_qty}
                              onChange={(e) => updateDay(d, { meals_qty: Number(e.target.value || 0) })}
                              style={S.input}
                            />
                          </div>
                        </div>

                        <div style={{ marginTop: 10 }}>
                          <label style={S.label}>Frais divers (CHF)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={r.misc_chf}
                            onChange={(e) => updateDay(d, { misc_chf: Number(e.target.value || 0) })}
                            style={S.input}
                          />
                        </div>
                      </td>

                      <td style={S.td}>
                        <button onClick={() => saveDay(d)} style={S.btnPrimary} disabled={loading}>
                          💾 Sauver
                        </button>

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
                          style={{ ...S.btnGhost, marginTop: 10, width: "100%" }}
                          disabled={loading}
                        >
                          ↩ Défaut heures
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 10, color: THEME.sub, fontWeight: 900 }}>
            💡 Conseil : si tu corriges un jour, laisse “Remplacer les logs” activé → comme ça l’export PDF/Excel affiche tes corrections.
          </div>
        </div>
      </div>
    </main>
  );
}
