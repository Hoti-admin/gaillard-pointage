"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { supabase } from "@/lib/supabaseClient";

type TimesheetStatus = "pending" | "approved";
type StatusFilter = "all" | TimesheetStatus;

type EmployeeRow = {
  user_id: string;
  full_name: string | null;
  is_active: boolean | null;
  role?: string | null;
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
    flexWrap: "wrap" as const,
    alignItems: "center",
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap" as const,
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

  row3: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 12,
  },
  row2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },

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

  btnPrimary: {
    width: "100%",
    padding: 14,
    fontWeight: 900,
    borderRadius: 14,
    border: `1px solid ${THEME.red}`,
    background: THEME.red,
    color: "#fff",
    cursor: "pointer",
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
  btnOk: {
    width: "100%",
    padding: 12,
    fontWeight: 900,
    borderRadius: 14,
    border: `1px solid ${THEME.green}`,
    background: "rgba(34,197,94,0.18)",
    color: THEME.text,
    cursor: "pointer",
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

  pills: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap" as const,
    marginTop: 10,
  },
};

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function monthLabelFR(ym: string) {
  const [y, m] = ym.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("fr-CH", { month: "long", year: "numeric" });
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export default function AdminBordereauxPage() {
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const [isAdmin, setIsAdmin] = useState(false);

  const now = new Date();
  const baseYear = Math.max(2026, now.getFullYear());
  const [year, setYear] = useState<number>(baseYear);

  const [month, setMonth] = useState<string>(`${baseYear}-${pad2(now.getMonth() + 1)}`);
  const [employee, setEmployee] = useState<string>("all");
  const [status, setStatus] = useState<StatusFilter>("pending");

  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [statusMap, setStatusMap] = useState<Map<string, TimesheetStatus>>(new Map());

  const yearOptions = useMemo(() => {
    const y1 = Math.max(2026, now.getFullYear());
    return [y1, y1 + 1, y1 + 2];
  }, [now]);

  const monthOptions = useMemo(() => {
    const months: { value: string; label: string }[] = [];
    for (let m = 1; m <= 12; m++) {
      const ym = `${year}-${pad2(m)}`;
      months.push({ value: ym, label: monthLabelFR(ym) });
    }
    return months;
  }, [year]);

  const activeEmployees = useMemo(() => {
    return (employees ?? [])
      .filter((e) => e.is_active !== false)
      .sort((a, b) => String(a.full_name ?? "").localeCompare(String(b.full_name ?? "")));
  }, [employees]);

  async function ensureAdmin() {
    const { data } = await supabase.auth.getSession();
    const sess = data.session;
    if (!sess) {
      window.location.href = "/";
      return false;
    }

    const { data: prof, error } = await supabase
      .from("profiles")
      .select("role,is_active")
      .eq("user_id", sess.user.id)
      .single();

    if (error || !prof?.is_active || prof.role !== "admin") {
      window.location.href = "/employee";
      return false;
    }
    setIsAdmin(true);
    return true;
  }

  async function loadEmployees() {
    setMsg("");
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id,full_name,is_active,role")
      .order("full_name", { ascending: true });

    if (error) {
      setMsg("Erreur employés: " + error.message);
      return;
    }
    setEmployees((data ?? []) as any);
  }

  async function loadEmployeeStatuses() {
    setMsg("");
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;

    const res = await fetch(
      `/api/admin/timesheets/month-status?year=${encodeURIComponent(String(year))}&user_id=${encodeURIComponent(
        employee
      )}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
    );

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setMsg("Erreur statut: " + (j?.error || res.statusText));
      return;
    }

    const j = await res.json();
    const m = new Map<string, TimesheetStatus>();
    for (const r of (j?.rows ?? []) as any[]) {
      const st: TimesheetStatus = r?.status === "approved" ? "approved" : "pending";
      m.set(String(r.month), st);
    }
    setStatusMap(m);
  }

  async function setMonthStatus(newStatus: TimesheetStatus) {
    setMsg("");
    setLoading(true);

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setLoading(false);
      setMsg("Session expirée, reconnecte-toi.");
      return false;
    }

    const res = await fetch("/api/admin/timesheets/set-status", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        month,
        user_id: employee, // "all" ou uuid
        status: newStatus,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setMsg("Erreur validation: " + (j?.error || res.statusText));
      return false;
    }

    await loadEmployeeStatuses();
    setMsg(newStatus === "approved" ? "✅ Mois validé." : "✅ Mois remis en attente.");
    return true;
  }

  // ✅ téléchargement compatible iPhone
  async function downloadAuthed(url: string, filename: string) {
    setMsg("");
    const ios = isIOS();

    // iOS: ouvrir onglet tout de suite
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

  async function exportPDF() {
    const url =
      status === "all"
        ? `/api/export/pdf?month=${encodeURIComponent(month)}&employee=${encodeURIComponent(employee)}`
        : `/api/export/pdf?month=${encodeURIComponent(month)}&employee=${encodeURIComponent(
            employee
          )}&status=${encodeURIComponent(status)}`;

    const name =
      employee === "all"
        ? `Bordereau_${month}_TOUS.pdf`
        : `Bordereau_${month}.pdf`;

    await downloadAuthed(url, name);
  }

  async function exportXLSX() {
    const url =
      status === "all"
        ? `/api/export/xlsx?month=${encodeURIComponent(month)}&employee=${encodeURIComponent(employee)}`
        : `/api/export/xlsx?month=${encodeURIComponent(month)}&employee=${encodeURIComponent(
            employee
          )}&status=${encodeURIComponent(status)}`;

    const name =
      employee === "all"
        ? `Bordereau_${month}_TOUS.xlsx`
        : `Bordereau_${month}.xlsx`;

    await downloadAuthed(url, name);
  }

  async function exportYearly() {
    const url = `/api/export/yearly-xlsx?year=${encodeURIComponent(String(year))}`;
    await downloadAuthed(url, `Bordereaux_${year}.xlsx`);
  }

  async function validateAndPdf() {
    const ok = await setMonthStatus("approved");
    if (ok) await exportPDF();
  }

  useEffect(() => {
    (async () => {
      const ok = await ensureAdmin();
      setChecking(false);
      if (!ok) return;
      await loadEmployees();
      await loadEmployeeStatuses();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    // si on change l’année, on met le mois sur janvier
    setMonth(`${year}-01`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  useEffect(() => {
    if (!isAdmin) return;
    loadEmployeeStatuses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee, year, isAdmin]);

  if (checking) return <main style={S.page}>Chargement…</main>;

  const thisStatus = statusMap.get(month) ?? "pending";

  return (
    <main style={S.page}>
      <div style={S.container}>
        <div style={S.top}>
          <div style={S.brand}>
            <img src="/gaillard-logo.png" alt="Gaillard" style={S.logo} />
            <div>
              <h1 style={S.h1}>Admin — Bordereaux</h1>
              <div style={S.sub}>Exporter / Valider / Suivre les mois validés</div>
            </div>
          </div>

          <a href="/admin" style={{ color: THEME.sub, fontWeight: 900, textDecoration: "none" }}>
            ⬅ Retour admin
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
              <div style={{ marginTop: 6, color: THEME.sub, fontWeight: 800 }}>
                Statut actuel :{" "}
                <span style={{ color: thisStatus === "approved" ? THEME.green : THEME.amber }}>
                  {thisStatus === "approved" ? "VALIDÉ" : "EN ATTENTE"}
                </span>
              </div>
            </div>

            <div>
              <label style={S.label}>Employé</label>
              <select value={employee} onChange={(e) => setEmployee(e.target.value)} style={S.select}>
                <option value="all">Tous les employés</option>
                {activeEmployees.map((e) => (
                  <option key={e.user_id} value={e.user_id}>
                    {e.full_name || e.user_id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ ...S.row3, marginTop: 12 }}>
            <div>
              <label style={S.label}>Filtre statut export</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} style={S.select}>
                <option value="pending">pending (à valider)</option>
                <option value="approved">approved (validé)</option>
                <option value="all">all (tout)</option>
              </select>
            </div>

            <div>
              <label style={S.label}>Exports</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <button onClick={exportXLSX} style={S.btnGhost} disabled={loading}>
                  📗 Export Excel
                </button>
                <button onClick={exportPDF} style={S.btnGhost} disabled={loading}>
                  📄 Export PDF
                </button>
              </div>
            </div>

            <div>
              <label style={S.label}>Validation</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <button onClick={() => setMonthStatus("approved")} style={S.btnOk} disabled={loading}>
                  ✅ Valider ce mois
                </button>
                <button onClick={validateAndPdf} style={S.btnPrimary} disabled={loading}>
                  ✅ Valider + PDF
                </button>
              </div>
            </div>
          </div>

          <div style={{ ...S.row2, marginTop: 12 }}>
            <button onClick={loadEmployeeStatuses} style={S.btnGhost} disabled={loading}>
              🔄 Recharger statuts
            </button>
            <button onClick={exportYearly} style={S.btnGhost} disabled={loading}>
              📆 Export annuel (Excel)
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
              const bg =
                st === "approved" ? "rgba(34,197,94,0.16)" : "rgba(245,158,11,0.12)";
              const bd =
                st === "approved" ? THEME.green : THEME.amber;

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
