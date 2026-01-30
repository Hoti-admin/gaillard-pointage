"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { supabase } from "@/lib/supabaseClient";

type TimesheetStatus = "pending" | "approved";

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

const S: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: THEME.bg,
    color: THEME.text,
    padding: 18,
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
  },
  container: {
    maxWidth: 920,
    margin: "18px auto",
    background: THEME.surface,
    border: `1px solid ${THEME.border}`,
    borderRadius: 18,
    padding: 18,
    boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
  },
  top: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  logo: {
    width: 190,
    height: "auto",
    borderRadius: 14,
    border: `1px solid ${THEME.border}`,
    filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.35))",
  },
  h1: { margin: 0, fontSize: 26, fontWeight: 900, letterSpacing: -0.3 },
  sub: { marginTop: 6, color: THEME.sub, fontWeight: 800 },

  card: {
    background: THEME.card,
    border: `1px solid ${THEME.border}`,
    borderRadius: 16,
    padding: 14,
    marginTop: 14,
  },

  row2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  row3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 },

  label: { display: "block", fontWeight: 900, marginBottom: 6, color: THEME.sub },
  select: {
    width: "100%",
    padding: 12,
    borderRadius: 14,
    border: `1px solid ${THEME.border}`,
    background: THEME.card2,
    color: THEME.text,
    outline: "none",
  },

  btnGhost: {
    width: "100%",
    padding: 12,
    fontWeight: 900,
    borderRadius: 14,
    border: `1px solid ${THEME.border}`,
    background: THEME.card2,
    color: THEME.text,
    cursor: "pointer",
  },
  btnDisabled: {
    width: "100%",
    padding: 12,
    fontWeight: 900,
    borderRadius: 14,
    border: `1px solid ${THEME.border}`,
    background: "rgba(255,255,255,0.04)",
    color: "rgba(229,231,235,0.5)",
    cursor: "not-allowed",
  },

  msg: {
    marginTop: 12,
    padding: "10px 12px",
    borderRadius: 14,
    border: `1px solid ${THEME.border}`,
    background: THEME.card2,
    fontWeight: 800,
    whiteSpace: "pre-wrap",
  },

  pills: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 },
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

export default function EmployeeBordereauxPage() {
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const now = new Date();
  const baseYear = Math.max(2026, now.getFullYear());

  const [year, setYear] = useState<number>(baseYear);
  const [month, setMonth] = useState<string>(`${baseYear}-${pad2(now.getMonth() + 1)}`);

  const [statusMap, setStatusMap] = useState<Map<string, TimesheetStatus>>(new Map());
  const [didAutoPick, setDidAutoPick] = useState(false);

  const yearOptions = useMemo(() => [baseYear, baseYear + 1, baseYear + 2], [baseYear]);

  const monthOptions = useMemo(() => {
    const out: { value: string; label: string }[] = [];
    for (let m = 1; m <= 12; m++) {
      const ym = `${year}-${pad2(m)}`;
      out.push({ value: ym, label: monthLabelFR(ym) });
    }
    return out;
  }, [year]);

  const thisStatus = statusMap.get(month) ?? "pending";
  const canDownload = thisStatus === "approved";

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
    const m = new Map<string, TimesheetStatus>();

    // ✅ NORMALISATION: on stocke toujours en "YYYY-MM"
    for (const r of (j?.rows ?? []) as any[]) {
      const st: TimesheetStatus = r?.status === "approved" ? "approved" : "pending";
      const mk = String(r.month ?? "").slice(0, 7);
      if (mk) m.set(mk, st);
    }

    setStatusMap(m);

    // ✅ Auto-pick : dernier mois validé si dispo
    if (!didAutoPick) {
      const approvedMonths = Array.from(m.entries())
        .filter(([, st]) => st === "approved")
        .map(([mo]) => mo)
        .sort();
      if (approvedMonths.length > 0) {
        const latest = approvedMonths[approvedMonths.length - 1];
        setMonth(latest);
      }
      setDidAutoPick(true);
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

  // ⚠️ suppose que tes exports acceptent employee=me
  async function exportPDF() {
    const url = `/api/employee/export/pdf?month=${encodeURIComponent(month)}`;

    await downloadAuthed(url, `Bordereau_${month}.pdf`);
  }

  async function exportXLSX() {
    const url = `/api/employee/export/xlsx?month=${encodeURIComponent(month)}`;

    await downloadAuthed(url, `Bordereau_${month}.xlsx`);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (checking) return;
    setDidAutoPick(false);
    setMonth(`${year}-${pad2(new Date().getMonth() + 1)}`);
    loadStatuses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  if (checking) return <main style={S.page}>Chargement…</main>;

  return (
    <main style={S.page}>
      <div style={S.container}>
        <div style={S.top}>
          <div style={S.brand}>
            <img src="/gaillard-logo.png" alt="Gaillard" style={S.logo} />
            <div>
              <h1 style={S.h1}>Mes bordereaux</h1>
              <div style={S.sub}>Téléchargement disponible uniquement quand le mois est validé</div>
            </div>
          </div>

          <a href="/employee" style={{ color: THEME.sub, fontWeight: 900, textDecoration: "none" }}>
            ⬅ Espace employé
          </a>
        </div>

        <div style={S.card}>
          <div style={S.row3}>
            <div>
              <label style={S.label}>Année</label>
              <select value={year} onChange={(e) => setYear(Number(e.target.value))} style={S.select}>
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={S.label}>Mois</label>
              <select value={month} onChange={(e) => setMonth(e.target.value)} style={S.select}>
                {monthOptions.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>

              <div style={{ marginTop: 6, color: THEME.sub, fontWeight: 900 }}>
                Statut :{" "}
                <span style={{ color: thisStatus === "approved" ? THEME.green : THEME.amber }}>
                  {thisStatus === "approved" ? "VALIDÉ ✅" : "EN ATTENTE ⏳"}
                </span>
              </div>
            </div>

            <div>
              <label style={S.label}>Téléchargements</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <button
                  onClick={exportXLSX}
                  style={canDownload ? S.btnGhost : S.btnDisabled}
                  disabled={!canDownload || loading}
                >
                  📗 Excel
                </button>
                <button
                  onClick={exportPDF}
                  style={canDownload ? S.btnGhost : S.btnDisabled}
                  disabled={!canDownload || loading}
                >
                  📄 PDF
                </button>
              </div>

              {!canDownload && (
                <div style={{ marginTop: 8, color: THEME.sub, fontWeight: 800 }}>
                  ➜ Ton admin doit valider le mois avant téléchargement.
                </div>
              )}
            </div>
          </div>

          <div style={{ ...S.row2, marginTop: 12 }}>
            <button onClick={loadStatuses} style={S.btnGhost} disabled={loading}>
              🔄 Recharger
            </button>
            <button onClick={signOut} style={S.btnGhost} disabled={loading}>
              Se déconnecter
            </button>
          </div>

          {msg.trim() && <div style={S.msg}>{msg}</div>}
        </div>

        <div style={S.card}>
          <h3 style={{ marginTop: 0 }}>Mois {year} (validés en vert)</h3>
          <div style={S.pills}>
            {Array.from({ length: 12 }).map((_, i) => {
              const ym = `${year}-${pad2(i + 1)}`;
              const st = statusMap.get(ym) ?? "pending";
              const bg = st === "approved" ? "rgba(34,197,94,0.16)" : "rgba(245,158,11,0.12)";
              const bd = st === "approved" ? THEME.green : THEME.amber;

              return (
                <button
                  key={ym}
                  onClick={() => setMonth(ym)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 14,
                    border: `1px solid ${bd}`,
                    background: bg,
                    color: THEME.text,
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  {monthLabelFR(ym)} — {st === "approved" ? "VALIDÉ" : "EN ATTENTE"}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
