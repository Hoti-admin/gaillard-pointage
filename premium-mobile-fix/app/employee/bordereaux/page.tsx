"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { supabase } from "@/lib/supabaseClient";

type TimesheetStatus = "pending" | "approved";
type MonthRow = { month: string; status: TimesheetStatus; approved_at?: string | null };

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
  shell: {
    maxWidth: 1160,
    margin: "0 auto",
    background: "rgba(7,17,32,0.88)",
    border: `1px solid ${THEME.border}`,
    borderRadius: 24,
    padding: 18,
    boxShadow: "0 18px 50px rgba(0,0,0,0.35)",
    backdropFilter: "blur(12px)",
  },
  top: { display: "flex", justifyContent: "space-between", gap: 18, flexWrap: "wrap", alignItems: "center" },
  brand: { display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" },
  logo: { width: 128, height: "auto", borderRadius: 18, border: `1px solid ${THEME.border}`, boxShadow: "0 10px 28px rgba(0,0,0,0.28)" },
  h1: { margin: 0, fontSize: 34, fontWeight: 900, letterSpacing: -0.7 },
  sub: { marginTop: 6, color: THEME.sub, fontWeight: 800, fontSize: 18 },
  back: { color: THEME.sub, fontWeight: 900, textDecoration: "none" },
  panel: {
    background: "linear-gradient(180deg, rgba(16,29,56,0.98) 0%, rgba(10,22,44,0.96) 100%)",
    border: `1px solid ${THEME.border}`,
    borderRadius: 20,
    padding: 16,
    marginTop: 16,
  },
  filters: { display: "grid", gridTemplateColumns: "1fr 1fr 1.4fr", gap: 14, alignItems: "end" },
  stats: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginTop: 14 },
  statCard: { border: `1px solid ${THEME.border}`, borderRadius: 18, padding: 14, background: "rgba(255,255,255,0.02)" },
  statLabel: { color: THEME.sub, fontWeight: 800, fontSize: 13, marginBottom: 8 },
  statValue: { fontSize: 22, fontWeight: 900 },
  label: { display: "block", fontWeight: 900, color: THEME.sub, marginBottom: 8 },
  select: { width: "100%", padding: "12px 13px", borderRadius: 14, border: `1px solid ${THEME.border}`, background: THEME.card2, color: THEME.text, outline: "none", fontSize: 16 },
  btn: { padding: "13px 14px", borderRadius: 16, border: `1px solid ${THEME.border}`, background: THEME.card2, color: THEME.text, cursor: "pointer", fontWeight: 900, fontSize: 16, minHeight: 54 },
  btnDisabled: { padding: "13px 14px", borderRadius: 16, border: `1px solid ${THEME.border}`, background: "rgba(255,255,255,0.04)", color: "rgba(237,242,255,0.45)", cursor: "not-allowed", fontWeight: 900, fontSize: 16, minHeight: 54 },
  btnBlue: { padding: "13px 14px", borderRadius: 16, border: `1px solid ${THEME.blue}`, background: "rgba(96,165,250,0.08)", color: THEME.text, cursor: "pointer", fontWeight: 900, fontSize: 16, minHeight: 54 },
  msg: { marginTop: 14, padding: "12px 14px", borderRadius: 16, border: `1px solid ${THEME.border}`, background: THEME.card2, fontWeight: 800, whiteSpace: "pre-wrap" },
  monthGrid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginTop: 14 },
  monthCard: { border: `1px solid ${THEME.border}`, borderRadius: 18, padding: 14, background: "rgba(255,255,255,0.02)", display: "grid", gap: 12 },
  monthTop: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" },
  monthTitle: { fontSize: 20, fontWeight: 900, textTransform: "capitalize" },
  monthSub: { color: THEME.sub, fontWeight: 800, fontSize: 13 },
  badge: (status: TimesheetStatus) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 999,
    border: `1px solid ${status === "approved" ? THEME.green : THEME.amber}`,
    background: status === "approved" ? "rgba(34,197,94,0.10)" : "rgba(245,158,11,0.10)",
    fontWeight: 900,
    whiteSpace: "nowrap",
  }),
  dot: (color: string) => ({ width: 10, height: 10, borderRadius: 999, background: color, display: "inline-block" }),
  rowButtons: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  helper: { color: THEME.sub, fontWeight: 800, lineHeight: 1.4 },
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function monthLabelFR(ym: string) {
  const [y, m] = ym.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("fr-CH", { month: "long", year: "numeric" });
}
function shortMonthLabelFR(ym: string) {
  const [y, m] = ym.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("fr-CH", { month: "long" });
}
function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export default function EmployeeBordereauxPage() {
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const now = new Date();
  const currentYear = now.getFullYear();
  const [year, setYear] = useState<number>(currentYear);
  const [rows, setRows] = useState<MonthRow[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(`${currentYear}-${pad2(now.getMonth() + 1)}`);

  const yearOptions = useMemo(() => [currentYear - 1, currentYear, currentYear + 1, currentYear + 2], [currentYear]);

  const statusMap = useMemo(() => {
    const map = new Map<string, TimesheetStatus>();
    rows.forEach((r) => map.set(String(r.month).slice(0, 7), r.status === "approved" ? "approved" : "pending"));
    return map;
  }, [rows]);

  const monthCards = useMemo(() => {
    return Array.from({ length: 12 }).map((_, i) => {
      const ym = `${year}-${pad2(i + 1)}`;
      const found = rows.find((r) => String(r.month).slice(0, 7) === ym);
      return {
        month: ym,
        status: found?.status === "approved" ? "approved" : "pending",
        approved_at: found?.approved_at ?? null,
      } as MonthRow;
    });
  }, [rows, year]);

  const approvedCount = useMemo(() => monthCards.filter((m) => m.status === "approved").length, [monthCards]);
  const pendingCount = 12 - approvedCount;
  const latestApproved = useMemo(() => {
    const approved = monthCards.filter((m) => m.status === "approved").map((m) => m.month).sort();
    return approved.length ? approved[approved.length - 1] : null;
  }, [monthCards]);

  async function loadStatuses() {
    setMsg("");
    setLoading(true);

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setLoading(false);
      window.location.href = "/";
      return;
    }

    const res = await fetch(`/api/employee/timesheets/month-status?year=${encodeURIComponent(String(year))}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setMsg("Erreur statut: " + (j?.error || res.statusText));
      return;
    }

    const j = await res.json();
    const nextRows: MonthRow[] = ((j?.rows ?? []) as any[]).map((r) => ({
      month: String(r?.month ?? "").slice(0, 7),
      status: r?.status === "approved" ? "approved" : "pending",
      approved_at: r?.approved_at ?? null,
    }));
    setRows(nextRows);

    const approved = nextRows.filter((r) => r.status === "approved").map((r) => r.month).sort();
    if (approved.length > 0) setSelectedMonth(approved[approved.length - 1]);
    else setSelectedMonth(`${year}-${pad2(now.getMonth() + 1)}`);
  }

  async function downloadAuthed(url: string, filename: string) {
    setMsg("");
    const ios = isIOS();
    const popup = ios ? window.open("about:blank", "_blank") : null;

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      if (popup) popup.close();
      setMsg("Session expirée. Reconnecte-toi.");
      return;
    }

    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      if (popup) popup.close();
      setMsg("Erreur export: " + (j?.error || res.statusText));
      return;
    }

    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);

    if (ios) {
      if (popup) popup.location.href = blobUrl;
      else window.location.href = blobUrl;
    } else {
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }

    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  }

  async function exportPDF(month: string) {
    await downloadAuthed(`/api/employee/export/pdf?month=${encodeURIComponent(month)}`, `Bordereau_${month}.pdf`);
  }
  async function exportXLSX(month: string) {
    await downloadAuthed(`/api/employee/export/xlsx?month=${encodeURIComponent(month)}`, `Bordereau_${month}.xlsx`);
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      setChecking(false);
      if (!data.session) window.location.href = "/";
      else loadStatuses();
    })();
  }, []);

  useEffect(() => {
    if (checking) return;
    loadStatuses();
  }, [year]);

  if (checking) return <main style={S.page as CSSProperties}>Chargement…</main>;

  return (
    <main style={S.page as CSSProperties}>
      <style jsx global>{`
        @media (max-width: 980px) {
          .gp-emp-filters { grid-template-columns: 1fr 1fr !important; }
          .gp-emp-filters .full { grid-column: 1 / -1; }
          .gp-emp-stats { grid-template-columns: 1fr 1fr !important; }
          .gp-emp-months { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 720px) {
          .gp-emp-shell { padding: 12px !important; border-radius: 18px !important; }
          .gp-emp-logo { width: 96px !important; }
          .gp-emp-title { font-size: 22px !important; line-height: 1.1; }
          .gp-emp-sub { font-size: 14px !important; }
          .gp-emp-panel { padding: 12px !important; border-radius: 16px !important; }
          .gp-emp-filters { grid-template-columns: 1fr !important; }
          .gp-emp-stats { grid-template-columns: 1fr 1fr !important; }
          .gp-emp-months { grid-template-columns: 1fr !important; }
          .gp-emp-actions { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div style={S.shell as CSSProperties} className="gp-emp-shell">
        <div style={S.top as CSSProperties}>
          <div style={S.brand as CSSProperties}>
            <img src="/gaillard-logo.png" alt="Gaillard" style={S.logo as CSSProperties} className="gp-emp-logo" />
            <div>
              <h1 style={S.h1 as CSSProperties} className="gp-emp-title">Mes bordereaux validés</h1>
              <div style={S.sub as CSSProperties} className="gp-emp-sub">Historique premium par mois et par année · PDF et Excel accessibles dès validation</div>
            </div>
          </div>
          <a href="/employee" style={S.back as CSSProperties}>⬅ Espace employé</a>
        </div>

        <div style={S.panel as CSSProperties} className="gp-emp-panel">
          <div style={S.filters as CSSProperties} className="gp-emp-filters">
            <div>
              <label style={S.label as CSSProperties}>Année</label>
              <select value={year} onChange={(e) => setYear(Number(e.target.value))} style={S.select as CSSProperties}>
                {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label as CSSProperties}>Dernier mois validé</label>
              <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} style={S.select as CSSProperties}>
                {monthCards.map((m) => (
                  <option key={m.month} value={m.month}>{monthLabelFR(m.month)} — {m.status === "approved" ? "VALIDÉ" : "EN ATTENTE"}</option>
                ))}
              </select>
            </div>
            <div className="full">
              <label style={S.label as CSSProperties}>Actions rapides</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }} className="gp-emp-actions">
                <button onClick={loadStatuses} style={S.btn as CSSProperties} disabled={loading}>🔄 Recharger</button>
                <button onClick={signOut} style={S.btn as CSSProperties} disabled={loading}>Se déconnecter</button>
                <button onClick={() => latestApproved ? exportPDF(latestApproved) : null} style={latestApproved ? S.btnBlue as CSSProperties : S.btnDisabled as CSSProperties} disabled={!latestApproved || loading}>📄 Dernier PDF validé</button>
              </div>
            </div>
          </div>

          <div style={S.stats as CSSProperties} className="gp-emp-stats">
            <div style={S.statCard as CSSProperties}>
              <div style={S.statLabel as CSSProperties}>Année sélectionnée</div>
              <div style={S.statValue as CSSProperties}>{year}</div>
            </div>
            <div style={S.statCard as CSSProperties}>
              <div style={S.statLabel as CSSProperties}>Mois validés</div>
              <div style={S.statValue as CSSProperties}>{approvedCount}</div>
            </div>
            <div style={S.statCard as CSSProperties}>
              <div style={S.statLabel as CSSProperties}>Mois en attente</div>
              <div style={S.statValue as CSSProperties}>{pendingCount}</div>
            </div>
            <div style={S.statCard as CSSProperties}>
              <div style={S.statLabel as CSSProperties}>Dernier validé</div>
              <div style={S.statValue as CSSProperties}>{latestApproved ? shortMonthLabelFR(latestApproved) : "—"}</div>
            </div>
          </div>

          {msg && <div style={S.msg as CSSProperties}>{msg}</div>}
        </div>

        <div style={S.panel as CSSProperties} className="gp-emp-panel">
          <div style={{ fontSize: 22, fontWeight: 900 }}>Historique {year}</div>
          <div style={{ color: THEME.sub, fontWeight: 800, marginTop: 6 }}>Les mois validés s’ouvrent et se téléchargent directement. Les mois en attente restent visibles pour garder un historique clair.</div>

          <div style={S.monthGrid as CSSProperties} className="gp-emp-months">
            {monthCards.map((m) => {
              const isApproved = m.status === "approved";
              const isSelected = selectedMonth === m.month;
              return (
                <div key={m.month} style={{ ...(S.monthCard as CSSProperties), borderColor: isSelected ? THEME.blue : THEME.border, boxShadow: isSelected ? "0 0 0 1px rgba(96,165,250,0.35) inset" : undefined }}>
                  <div style={S.monthTop as CSSProperties}>
                    <div>
                      <div style={S.monthTitle as CSSProperties}>{shortMonthLabelFR(m.month)}</div>
                      <div style={S.monthSub as CSSProperties}>{m.month}</div>
                    </div>
                    <div style={(S.badge as any)(m.status)}>
                      <span style={(S.dot as any)(isApproved ? THEME.green : THEME.amber)} />
                      {isApproved ? "Validé" : "En attente"}
                    </div>
                  </div>

                  <div style={S.helper as CSSProperties}>
                    {isApproved
                      ? `Disponible au téléchargement${m.approved_at ? ` · validé le ${new Date(m.approved_at).toLocaleDateString("fr-CH")}` : ""}`
                      : "Le bordereau apparaîtra en téléchargement dès validation par l’administration."}
                  </div>

                  <div style={S.rowButtons as CSSProperties}>
                    <button onClick={() => exportPDF(m.month)} style={isApproved ? S.btn as CSSProperties : S.btnDisabled as CSSProperties} disabled={!isApproved || loading}>📄 Voir PDF</button>
                    <button onClick={() => exportXLSX(m.month)} style={isApproved ? S.btn as CSSProperties : S.btnDisabled as CSSProperties} disabled={!isApproved || loading}>📗 Excel</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
