"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type DayType = "work" | "holiday" | "sick" | "leave" | "accident" | "vacation" | "other";
type Site = { id: string; name: string; is_active: boolean };
type StatusRow = {
  work_date: string;
  day_type: DayType;
  note: string | null;
  site_id: string | null;
  start_time: string | null;
  break_start: string | null;
  break_end: string | null;
  end_time: string | null;
};
type LogRow = {
  work_date: string;
  site_id: string | null;
  segment_type: "work" | "pause";
  started_at: string;
  ended_at: string | null;
};

const THEME = {
  bg: "#0b1220",          // ardoise très foncé (fond global)
  surface: "#0f172a",     // surface (container)
  card: "#111c33",        // cartes
  card2: "#0e1930",       // cartes secondaires
  border: "#24324f",      // bordures
  text: "#e5e7eb",        // texte principal
  sub: "#a8b3cf",         // texte secondaire
  muted: "#8b97b6",
  red: "#b40000",         // rouge Gaillard
  red2: "#d11a1a",
  green: "#22c55e",
  amber: "#f59e0b",
};

function fmtHM(iso: string) {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}
function minutesBetween(aIso: string, bIso: string) {
  const a = new Date(aIso).getTime();
  const b = new Date(bIso).getTime();
  return Math.max(0, Math.round((b - a) / 60000));
}
function labelDayType(t: DayType) {
  switch (t) {
    case "holiday":
      return "Férié";
    case "sick":
      return "Maladie";
    case "leave":
      return "Congé";
    case "accident":
      return "Accident";
    case "vacation":
      return "Vacances";
    case "other":
      return "Autre";
    default:
      return "Travail";
  }
}
function badgeColor(t: DayType) {
  switch (t) {
    case "holiday":
      return THEME.red2;
    case "sick":
      return THEME.amber;
    case "leave":
      return "#60a5fa";
    case "accident":
      return "#fb7185";
    case "vacation":
      return "#a78bfa";
    case "other":
      return "#94a3b8";
    default:
      return THEME.green;
  }
}

const S = {
  page: {
    minHeight: "100vh",
    background: THEME.bg,
    color: THEME.text,
    padding: 18,
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
  } as React.CSSProperties,
  container: {
    maxWidth: 920,
    margin: "18px auto",
    background: THEME.surface,
    border: `1px solid ${THEME.border}`,
    borderRadius: 18,
    padding: 18,
    boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
  } as React.CSSProperties,
  h1: { margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: -0.3 } as React.CSSProperties,
  sub: { marginTop: 8, color: THEME.sub } as React.CSSProperties,
  card: {
    background: THEME.card,
    border: `1px solid ${THEME.border}`,
    borderRadius: 16,
    padding: 14,
    boxShadow: "0 6px 16px rgba(0,0,0,0.18)",
  } as React.CSSProperties,
  row: { display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" } as React.CSSProperties,
  title: { margin: 0, fontSize: 16, fontWeight: 900 } as React.CSSProperties,
  pill: (color: string) =>
    ({
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "6px 12px",
      borderRadius: 999,
      border: `1px solid ${THEME.border}`,
      background: THEME.card2,
      fontWeight: 900,
    } as React.CSSProperties),
  dot: (color: string) =>
    ({
      width: 10,
      height: 10,
      borderRadius: 999,
      background: color,
      boxShadow: `0 0 0 4px rgba(255,255,255,0.03)`,
    } as React.CSSProperties),
  btnPrimary: {
    padding: "12px 14px",
    fontWeight: 900,
    borderRadius: 14,
    border: `1px solid ${THEME.red}`,
    background: THEME.red,
    color: "#fff",
    cursor: "pointer",
  } as React.CSSProperties,
  btnGhost: {
    padding: "12px 14px",
    fontWeight: 900,
    borderRadius: 14,
    border: `1px solid ${THEME.border}`,
    background: THEME.card2,
    color: THEME.text,
    cursor: "pointer",
  } as React.CSSProperties,
  btnOutlineRed: {
    padding: "12px 14px",
    fontWeight: 900,
    borderRadius: 14,
    border: `1px solid ${THEME.red2}`,
    background: "transparent",
    color: THEME.text,
    cursor: "pointer",
  } as React.CSSProperties,
  link: { color: "#ffffff", fontWeight: 900, textDecoration: "none" } as React.CSSProperties,
  smallLink: { color: THEME.sub, fontWeight: 900, textDecoration: "none" } as React.CSSProperties,
  sep: { height: 1, background: THEME.border, margin: "14px 0" } as React.CSSProperties,
  logCard: {
    background: THEME.card2,
    border: `1px solid ${THEME.border}`,
    borderRadius: 14,
    padding: 12,
  } as React.CSSProperties,
  rightText: { fontWeight: 900, color: THEME.sub } as React.CSSProperties,
  msg: {
    marginTop: 12,
    padding: "10px 12px",
    borderRadius: 12,
    border: `1px solid ${THEME.border}`,
    background: THEME.card2,
    color: THEME.text,
    fontWeight: 800,
  } as React.CSSProperties,
};

export default function EmployeeTodayPage() {
  const [session, setSession] = useState<any>(null);
  const [checking, setChecking] = useState(true);
  const [msg, setMsg] = useState("");

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [sites, setSites] = useState<Site[]>([]);
  const siteMap = useMemo(() => new Map(sites.map((s) => [s.id, s.name])), [sites]);

  const [status, setStatus] = useState<StatusRow | null>(null);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecking(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function loadAll() {
    if (!session?.user?.id) return;
    setLoading(true);
    setMsg("");

    const { data: sData } = await supabase
      .from("sites")
      .select("id,name,is_active")
      .eq("is_active", true)
      .order("name", { ascending: true });
    setSites((sData ?? []) as any);

    const { data: st, error: stErr } = await supabase
      .from("daily_status")
      .select("work_date,day_type,note,site_id,start_time,break_start,break_end,end_time")
      .eq("user_id", session.user.id)
      .eq("work_date", today)
      .maybeSingle();

    if (stErr) {
      setMsg("Erreur statut: " + stErr.message);
      setStatus(null);
    } else {
      setStatus((st as any) ?? null);
    }

    const { data: lData, error: lErr } = await supabase
      .from("daily_site_logs")
      .select("work_date,site_id,segment_type,started_at,ended_at")
      .eq("user_id", session.user.id)
      .eq("work_date", today)
      .order("started_at", { ascending: true });

    if (lErr) {
      setMsg("Erreur logs: " + lErr.message);
      setLogs([]);
    } else {
      setLogs((lData ?? []) as any);
    }

    setLoading(false);
  }

  useEffect(() => {
    if (!session?.user?.id) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  async function markHoliday() {
    if (!session?.user?.id) return;
    setLoading(true);
    setMsg("");

    const { error } = await supabase
      .from("daily_status")
      .upsert(
        {
          user_id: session.user.id,
          work_date: today,
          day_type: "holiday",
          note: null,
          site_id: null,
          start_time: null,
          break_start: null,
          break_end: null,
          end_time: null,
        },
        { onConflict: "user_id,work_date" }
      );

    if (error) {
      setMsg("Erreur: " + error.message);
      setLoading(false);
      return;
    }

    setMsg("✅ Journée marquée comme Férié (visible dans Excel/PDF).");
    await loadAll();
    setLoading(false);
  }

  async function setWork() {
    if (!session?.user?.id) return;
    setLoading(true);
    setMsg("");

    const { error } = await supabase
      .from("daily_status")
      .upsert(
        {
          user_id: session.user.id,
          work_date: today,
          day_type: "work",
          note: null,
          site_id: null,
          start_time: null,
          break_start: null,
          break_end: null,
          end_time: null,
        },
        { onConflict: "user_id,work_date" }
      );

    if (error) {
      setMsg("Erreur: " + error.message);
      setLoading(false);
      return;
    }

    setMsg("✅ Journée repassée en Travail.");
    await loadAll();
    setLoading(false);
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

  const nowIso = new Date().toISOString();
  let totalWorkMin = 0;
  for (const l of logs) {
    if (l.segment_type !== "work") continue;
    const end = l.ended_at ?? nowIso;
    totalWorkMin += minutesBetween(l.started_at, end);
  }
  const totalWorkH = totalWorkMin / 60;

  const dayType = (status?.day_type ?? "work") as DayType;
  const badge = badgeColor(dayType);

  return (
    <main style={S.page}>
      <div style={S.container}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 style={S.h1}>Aujourd&apos;hui</h1>
            <p style={S.sub}>
              Date : <b>{today}</b>
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <a href="/employee" style={S.smallLink}>⬅ Menu</a>
            <button onClick={signOut} style={S.btnGhost}>Se déconnecter</button>
          </div>
        </div>

        <div style={{ ...S.card, marginTop: 14 }}>
          <div style={S.row}>
            <div>
              <p style={S.title}>Statut du jour</p>
              <div style={{ marginTop: 8 }}>
                <span style={S.pill(badge)}>
                  <span style={S.dot(badge)} />
                  {labelDayType(dayType)}
                </span>
              </div>
              <p style={{ marginTop: 10, marginBottom: 0, color: THEME.sub }}>
                Marquer <b>Férié</b> remplit la case dans les exports.
                Si tu travailles quand même, utilise <b>Pointage normal</b> : les heures seront comptées.
              </p>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
              <a href="/clock" style={{ ...S.btnGhost, textDecoration: "none", display: "inline-block" }}>
                ▶ Pointage normal
              </a>

              {dayType !== "holiday" ? (
                <button onClick={markHoliday} disabled={loading} style={S.btnPrimary}>
                  🎌 Marquer comme Férié
                </button>
              ) : (
                <button onClick={setWork} disabled={loading} style={S.btnOutlineRed}>
                  ↩ Repasser en Travail
                </button>
              )}

              <button onClick={loadAll} disabled={loading} style={S.btnGhost}>
                🔄 Recharger
              </button>
            </div>
          </div>

          {msg && <div style={S.msg}>{msg}</div>}
        </div>

        <div style={{ ...S.card, marginTop: 14 }}>
          <div style={S.row}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>Historique du jour</h3>
            <div style={S.rightText}>Total work : {totalWorkH.toFixed(2)} h</div>
          </div>

          <div style={S.sep} />

          {logs.length === 0 ? (
            <p style={{ color: THEME.sub, margin: 0 }}>Aucun segment aujourd&apos;hui.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {logs.map((l, idx) => {
                const start = fmtHM(l.started_at);
                const end = l.ended_at ? fmtHM(l.ended_at) : "en cours";
                const site = l.site_id ? siteMap.get(l.site_id) : "";
                const title = l.segment_type === "pause" ? "PAUSE" : site ? `CHANTIER: ${site}` : "CHANTIER: -";
                const durMin = minutesBetween(l.started_at, l.ended_at ?? nowIso);

                return (
                  <div key={idx} style={S.logCard}>
                    <div style={S.row}>
                      <div style={{ fontWeight: 900 }}>{title}</div>
                      <div style={S.rightText}>
                        {start} - {end} ({(durMin / 60).toFixed(2)} h)
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={S.sep} />

          <a href="/employee/month" style={S.link}>➡ Aller sur Mon mois</a>
        </div>
      </div>
    </main>
  );
}
