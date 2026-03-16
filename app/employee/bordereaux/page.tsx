"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { supabase } from "@/lib/supabaseClient";

type TimesheetStatus = "pending" | "approved";
type MonthItem = {
  month: string;
  status: TimesheetStatus;
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

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function monthLabelFR(ym: string) {
  const [y, m] = ym.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("fr-CH", { month: "long", year: "numeric" });
}

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 768);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return isMobile;
}

export default function EmployeeBordereauxPage() {
  const isMobile = useIsMobile();
  const now = new Date();
  const currentYm = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;

  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<string>(currentYm);
  const [rows, setRows] = useState<MonthItem[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([now.getFullYear()]);

  const statusMap = useMemo(() => {
    const map = new Map<string, TimesheetStatus>();
    for (const row of rows) map.set(row.month, row.status);
    return map;
  }, [rows]);

  const monthOptions = useMemo(() => {
    return Array.from({ length: 12 }).map((_, i) => {
      const ym = `${selectedYear}-${pad2(i + 1)}`;
      return { value: ym, label: monthLabelFR(ym), status: statusMap.get(ym) ?? "pending" };
    });
  }, [selectedYear, statusMap]);

  const approvedRows = useMemo(
    () => rows.filter((r) => r.status === "approved").sort((a, b) => b.month.localeCompare(a.month)),
    [rows]
  );

  const selectedStatus = statusMap.get(selectedMonth) ?? "pending";
  const canDownloadSelected = selectedStatus === "approved";

  async function fetchStatuses(yearToLoad: number) {
    setLoading(true);
    setMsg("");

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setLoading(false);
      window.location.href = "/";
      return;
    }

    const res = await fetch(`/api/employee/timesheets/month-status?year=${yearToLoad}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    setLoading(false);

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setMsg("Erreur chargement bordereaux : " + (j?.error || res.statusText));
      return;
    }

    const j = await res.json();
    const nextRows: MonthItem[] = ((j?.rows ?? []) as any[])
      .map((r) => ({
        month: String(r?.month ?? "").slice(0, 7),
        status: r?.status === "approved" ? "approved" : "pending",
      }))
      .filter((r) => /^\d{4}-\d{2}$/.test(r.month));

    setRows(nextRows);

    const apiYears = ((j?.years ?? []) as string[])
      .filter((y) => /^\d{4}$/.test(String(y)))
      .map((y) => Number(y));

    const mergedYears = Array.from(
      new Set([now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1, ...apiYears])
    ).sort((a, b) => b - a);
    setAvailableYears(mergedYears);

    const approvedForYear = nextRows
      .filter((r) => r.status === "approved" && r.month.startsWith(`${yearToLoad}-`))
      .map((r) => r.month)
      .sort();

    if (approvedForYear.length > 0) {
      setSelectedMonth(approvedForYear[approvedForYear.length - 1]);
    } else {
      const fallback = `${yearToLoad}-${pad2(Math.min(12, now.getMonth() + 1))}`;
      setSelectedMonth(fallback);
    }
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
      setMsg("Erreur export : " + (j?.error || res.statusText));
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

  async function exportSelectedPDF() {
    await downloadAuthed(`/api/employee/export/pdf?month=${encodeURIComponent(selectedMonth)}`, `Bordereau_${selectedMonth}.pdf`);
  }

  async function exportSelectedXLSX() {
    await downloadAuthed(`/api/employee/export/xlsx?month=${encodeURIComponent(selectedMonth)}`, `Bordereau_${selectedMonth}.xlsx`);
  }

  async function exportRowPDF(month: string) {
    await downloadAuthed(`/api/employee/export/pdf?month=${encodeURIComponent(month)}`, `Bordereau_${month}.pdf`);
  }

  async function exportRowXLSX(month: string) {
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
      if (!data.session) {
        window.location.href = "/";
        return;
      }
      await fetchStatuses(selectedYear);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (checking) return;
    fetchStatuses(selectedYear);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear]);

  if (checking) return <main style={pageStyle}>Chargement…</main>;

  const approvedCount = approvedRows.length;
  const pendingCount = monthOptions.length - monthOptions.filter((m) => m.status === "approved").length;

  return (
    <main style={pageStyle}>
      <div style={{ ...containerStyle, padding: isMobile ? 14 : 20 }}>
        <div style={{ ...headerStyle, flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "center" }}>
          <div style={{ ...brandStyle, alignItems: isMobile ? "flex-start" : "center" }}>
            <img src="/gaillard-logo.png" alt="Gaillard" style={{ ...logoStyle, width: isMobile ? 96 : 180 }} />
            <div>
              <h1 style={{ ...titleStyle, fontSize: isMobile ? 28 : 32 }}>Mes bordereaux validés</h1>
              <div style={subStyle}>Par mois et par année, avec accès rapide au PDF et à l’Excel.</div>
            </div>
          </div>

          <a href="/employee" style={backLinkStyle}>
            ⬅ Espace employé
          </a>
        </div>

        <div style={{ ...heroStyle, gridTemplateColumns: isMobile ? "1fr" : "1.3fr 0.7fr" }}>
          <div style={cardShell}>
            <div style={eyebrowStyle}>Vue rapide</div>
            <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 900, lineHeight: 1.1 }}>
              {approvedCount > 0 ? `${approvedCount} bordereau${approvedCount > 1 ? "x" : ""} validé${approvedCount > 1 ? "s" : ""}` : "Aucun bordereau validé"}
            </div>
            <div style={{ color: THEME.sub, marginTop: 8, fontWeight: 700 }}>
              Sélectionne une année pour voir l’historique disponible et télécharge directement le mois voulu.
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
              <div style={statsPill(THEME.green)}>{approvedCount} validé{approvedCount > 1 ? "s" : ""}</div>
              <div style={statsPill(THEME.amber)}>{pendingCount} en attente</div>
              <div style={statsPill(THEME.blue)}Année {selectedYear}</div>
            </div>
          </div>

          <div style={cardShell}>
            <div style={eyebrowStyle}>Sélection</div>
            <div style={fieldBlockStyle}>
              <label style={labelStyle}>Année</label>
              <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} style={inputStyle}>
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ ...fieldBlockStyle, marginTop: 12 }}>
              <label style={labelStyle}>Mois</label>
              <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} style={inputStyle}>
                {monthOptions.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label} — {m.status === "approved" ? "Validé" : "En attente"}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={statusBadge(selectedStatus)}>{selectedStatus === "approved" ? "● Validé" : "● En attente"}</span>
              <span style={{ color: THEME.sub, fontWeight: 800 }}>{monthLabelFR(selectedMonth)}</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10, marginTop: 14 }}>
              <button onClick={exportSelectedPDF} style={canDownloadSelected ? actionBtnPrimary : actionBtnDisabled} disabled={!canDownloadSelected || loading}>
                📄 Voir / télécharger PDF
              </button>
              <button onClick={exportSelectedXLSX} style={canDownloadSelected ? actionBtnGhost : actionBtnDisabled} disabled={!canDownloadSelected || loading}>
                📗 Télécharger Excel
              </button>
            </div>

            {!canDownloadSelected && (
              <div style={hintStyle}>Ce mois n’est pas encore validé par l’administration.</div>
            )}
          </div>
        </div>

        <div style={{ ...gridStyle, gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", marginTop: 16 }}>
          <button onClick={() => fetchStatuses(selectedYear)} style={actionBtnGhost} disabled={loading}>
            🔄 Recharger
          </button>
          <button onClick={signOut} style={actionBtnGhost} disabled={loading}>
            Se déconnecter
          </button>
        </div>

        {msg.trim() && <div style={messageStyle}>{msg}</div>}

        <div style={{ ...cardShell, marginTop: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <div style={eyebrowStyle}>Historique</div>
              <h2 style={{ margin: "4px 0 0", fontSize: isMobile ? 22 : 26 }}>Bordereaux de {selectedYear}</h2>
            </div>
            <div style={{ color: THEME.sub, fontWeight: 800 }}>Les mois validés apparaissent avec accès direct au PDF et à l’Excel.</div>
          </div>

          <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
            {monthOptions
              .slice()
              .reverse()
              .map((item) => {
                const approved = item.status === "approved";
                return (
                  <div
                    key={item.value}
                    style={{
                      background: approved ? "rgba(34,197,94,0.10)" : "rgba(245,158,11,0.08)",
                      border: `1px solid ${approved ? "rgba(34,197,94,0.35)" : "rgba(245,158,11,0.24)"}`,
                      borderRadius: 18,
                      padding: isMobile ? 14 : 16,
                      display: "grid",
                      gridTemplateColumns: isMobile ? "1fr" : "1.2fr 0.8fr",
                      gap: 12,
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 900, fontSize: 18 }}>{item.label}</div>
                      <div style={{ color: THEME.sub, marginTop: 4, fontWeight: 700 }}>
                        Statut : <span style={{ color: approved ? THEME.green : THEME.amber }}>{approved ? "Validé" : "En attente"}</span>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
                      <button
                        onClick={() => exportRowPDF(item.value)}
                        style={approved ? actionBtnPrimary : actionBtnDisabled}
                        disabled={!approved || loading}
                      >
                        📄 PDF
                      </button>
                      <button
                        onClick={() => exportRowXLSX(item.value)}
                        style={approved ? actionBtnGhost : actionBtnDisabled}
                        disabled={!approved || loading}
                      >
                        📗 Excel
                      </button>
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

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(180deg, #081121 0%, #0b1220 100%)",
  color: THEME.text,
  padding: 14,
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
};

const containerStyle: CSSProperties = {
  maxWidth: 1120,
  margin: "0 auto",
  background: THEME.surface,
  border: `1px solid ${THEME.border}`,
  borderRadius: 24,
  boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
};

const headerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  paddingBottom: 10,
};

const brandStyle: CSSProperties = {
  display: "flex",
  gap: 14,
  flexWrap: "wrap",
};

const logoStyle: CSSProperties = {
  height: "auto",
  borderRadius: 18,
  border: `1px solid ${THEME.border}`,
  boxShadow: "0 14px 36px rgba(0,0,0,0.28)",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontWeight: 900,
  letterSpacing: -0.6,
};

const subStyle: CSSProperties = {
  marginTop: 6,
  color: THEME.sub,
  fontWeight: 700,
};

const backLinkStyle: CSSProperties = {
  color: THEME.sub,
  fontWeight: 900,
  textDecoration: "none",
  alignSelf: "center",
};

const heroStyle: CSSProperties = {
  display: "grid",
  gap: 16,
  marginTop: 12,
};

const gridStyle: CSSProperties = {
  display: "grid",
  gap: 12,
};

const cardShell: CSSProperties = {
  background: "linear-gradient(180deg, rgba(17,28,51,0.98) 0%, rgba(14,25,48,0.98) 100%)",
  border: `1px solid ${THEME.border}`,
  borderRadius: 20,
  padding: 16,
};

const eyebrowStyle: CSSProperties = {
  color: THEME.sub,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: 1.1,
  fontSize: 12,
};

const fieldBlockStyle: CSSProperties = { display: "block" };

const labelStyle: CSSProperties = {
  display: "block",
  color: THEME.sub,
  fontWeight: 900,
  marginBottom: 6,
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: 12,
  borderRadius: 14,
  border: `1px solid ${THEME.border}`,
  background: THEME.card2,
  color: THEME.text,
  outline: "none",
};

const actionBtnPrimary: CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 14,
  border: `1px solid ${THEME.red}`,
  background: THEME.red,
  color: "#fff",
  fontWeight: 900,
  cursor: "pointer",
};

const actionBtnGhost: CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 14,
  border: `1px solid ${THEME.border}`,
  background: THEME.card2,
  color: THEME.text,
  fontWeight: 900,
  cursor: "pointer",
};

const actionBtnDisabled: CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 14,
  border: `1px solid ${THEME.border}`,
  background: "rgba(255,255,255,0.05)",
  color: "rgba(229,231,235,0.45)",
  fontWeight: 900,
  cursor: "not-allowed",
};

const hintStyle: CSSProperties = {
  marginTop: 10,
  color: THEME.sub,
  fontWeight: 800,
};

const messageStyle: CSSProperties = {
  marginTop: 14,
  padding: "12px 14px",
  borderRadius: 14,
  border: `1px solid ${THEME.border}`,
  background: THEME.card2,
  fontWeight: 800,
  whiteSpace: "pre-wrap",
};

const statusBadge = (status: TimesheetStatus): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  borderRadius: 999,
  padding: "8px 12px",
  border: `1px solid ${status === "approved" ? "rgba(34,197,94,0.35)" : "rgba(245,158,11,0.35)"}`,
  background: status === "approved" ? "rgba(34,197,94,0.10)" : "rgba(245,158,11,0.10)",
  color: status === "approved" ? THEME.green : THEME.amber,
  fontWeight: 900,
});

const statsPill = (color: string): CSSProperties => ({
  borderRadius: 999,
  border: `1px solid ${color}55`,
  background: `${color}16`,
  color,
  fontWeight: 900,
  padding: "8px 12px",
});
