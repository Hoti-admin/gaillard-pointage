"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Site = { id: string; name: string; is_active: boolean };
type StatusRow = { work_date: string; day_type: "work" | "holiday" | "sick" | "leave" | "accident" | "vacation" | "other" };
type LogRow = {
  id: string;
  work_date: string;
  site_id: string | null;
  segment_type: "work" | "pause";
  started_at: string;
  ended_at: string | null;
};

const THEME = {
  bg: "#0b1220",
  surface: "#0f172a",
  card: "#111c33",
  card2: "#0e1930",
  border: "#24324f",
  text: "#e5e7eb",
  sub: "#a8b3cf",
  muted: "#8b97b6",
  red: "#b40000",
  red2: "#d11a1a",
  green: "#22c55e",
  amber: "#f59e0b",
};

const S = {
  page: {
    minHeight: "100vh",
    background: THEME.bg,
    color: THEME.text,
    padding: 18,
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
  } as React.CSSProperties,
  container: {
    maxWidth: 980,
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
  label: { display: "block", fontWeight: 900, marginBottom: 6, color: THEME.sub } as React.CSSProperties,
  input: {
    width: "100%",
    padding: 10,
    borderRadius: 14,
    border: `1px solid ${THEME.border}`,
    background: THEME.card2,
    color: THEME.text,
    outline: "none",
  } as React.CSSProperties,
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
  btnWarn: {
    padding: "12px 14px",
    fontWeight: 900,
    borderRadius: 14,
    border: `1px solid ${THEME.amber}`,
    background: "transparent",
    color: THEME.text,
    cursor: "pointer",
  } as React.CSSProperties,
  btnOk: {
    padding: "12px 14px",
    fontWeight: 900,
    borderRadius: 14,
    border: `1px solid ${THEME.green}`,
    background: "transparent",
    color: THEME.text,
    cursor: "pointer",
  } as React.CSSProperties,
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
  link: { color: THEME.sub, fontWeight: 900, textDecoration: "none" } as React.CSSProperties,
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

export default function ClockPage() {
  const [checking, setChecking] = useState(true);
  const [session, setSession] = useState<any>(null);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [status, setStatus] = useState<StatusRow | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const siteMap = useMemo(() => new Map(sites.map((s) => [s.id, s.name])), [sites]);

  const [selectedSite, setSelectedSite] = useState<string>("");
  const [logs, setLogs] = useState<LogRow[]>([]);
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

    const { data: st } = await supabase
      .from("daily_status")
      .select("work_date,day_type")
      .eq("user_id", session.user.id)
      .eq("work_date", today)
      .maybeSingle();
    setStatus((st as any) ?? null);

    const { data: lData, error: lErr } = await supabase
      .from("daily_site_logs")
      .select("id,work_date,site_id,segment_type,started_at,ended_at")
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

  const nowIso = new Date().toISOString();
  const open = logs.find((l) => !l.ended_at) || null;
  const state =
    !open ? "idle" : open.segment_type === "pause" ? "paused" : "working";

  let totalWorkMin = 0;
  for (const l of logs) {
    if (l.segment_type !== "work") continue;
    const end = l.ended_at ?? nowIso;
    totalWorkMin += minutesBetween(l.started_at, end);
  }
  const totalWorkH = totalWorkMin / 60;

  async function startWork(siteId: string) {
    if (!session?.user?.id) return;
    if (!siteId) {
      setMsg("⚠️ Choisis un chantier.");
      return;
    }
    if (open) {
      setMsg("⚠️ Il y a déjà un segment en cours.");
      return;
    }

    setLoading(true);
    setMsg("");

    const { error } = await supabase.from("daily_site_logs").insert({
      user_id: session.user.id,
      work_date: today,
      site_id: siteId,
      segment_type: "work",
      started_at: new Date().toISOString(),
      ended_at: null,
    });

    if (error) setMsg("Erreur démarrage: " + error.message);
    await loadAll();
    setLoading(false);
  }

  async function endOpen() {
    if (!open) return;
    setLoading(true);
    setMsg("");

    const { error } = await supabase
      .from("daily_site_logs")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", open.id);

    if (error) setMsg("Erreur: " + error.message);
    await loadAll();
    setLoading(false);
  }

  async function pause() {
    if (!open || open.segment_type !== "work") {
      setMsg("⚠️ Tu dois être en travail pour mettre Pause.");
      return;
    }
    setLoading(true);
    setMsg("");

    const endIso = new Date().toISOString();
    const u1 = await supabase.from("daily_site_logs").update({ ended_at: endIso }).eq("id", open.id);
    if (u1.error) {
      setMsg("Erreur pause: " + u1.error.message);
      setLoading(false);
      return;
    }

    const ins = await supabase.from("daily_site_logs").insert({
      user_id: session.user.id,
      work_date: today,
      site_id: null,
      segment_type: "pause",
      started_at: endIso,
      ended_at: null,
    });

    if (ins.error) setMsg("Erreur pause: " + ins.error.message);
    await loadAll();
    setLoading(false);
  }

  async function resumeWork(siteId: string) {
    if (!session?.user?.id) return;
    if (!open || open.segment_type !== "pause") {
      setMsg("⚠️ Tu dois être en pause pour reprendre.");
      return;
    }
    if (!siteId) {
      setMsg("⚠️ Choisis un chantier pour reprendre.");
      return;
    }

    setLoading(true);
    setMsg("");

    const endIso = new Date().toISOString();
    const u1 = await supabase.from("daily_site_logs").update({ ended_at: endIso }).eq("id", open.id);
    if (u1.error) {
      setMsg("Erreur reprise: " + u1.error.message);
      setLoading(false);
      return;
    }

    const ins = await supabase.from("daily_site_logs").insert({
      user_id: session.user.id,
      work_date: today,
      site_id: siteId,
      segment_type: "work",
      started_at: endIso,
      ended_at: null,
    });

    if (ins.error) setMsg("Erreur reprise: " + ins.error.message);
    await loadAll();
    setLoading(false);
  }

  async function changeSite(siteId: string) {
    if (!open || open.segment_type !== "work") {
      setMsg("⚠️ Changement possible seulement en travail.");
      return;
    }
    if (!siteId) {
      setMsg("⚠️ Choisis un chantier.");
      return;
    }

    setLoading(true);
    setMsg("");

    const endIso = new Date().toISOString();
    const u1 = await supabase.from("daily_site_logs").update({ ended_at: endIso }).eq("id", open.id);
    if (u1.error) {
      setMsg("Erreur changement: " + u1.error.message);
      setLoading(false);
      return;
    }

    const ins = await supabase.from("daily_site_logs").insert({
      user_id: session.user.id,
      work_date: today,
      site_id: siteId,
      segment_type: "work",
      started_at: endIso,
      ended_at: null,
    });

    if (ins.error) setMsg("Erreur changement: " + ins.error.message);
    await loadAll();
    setLoading(false);
  }

  if (checking) return <main style={S.page}>Chargement...</main>;
  if (!session) {
    window.location.href = "/";
    return null;
  }

  const dayType = status?.day_type ?? "work";
  const dayBadge = dayType === "holiday" ? "FÉRIÉ" : "OK";

  return (
    <main style={S.page}>
      <div style={S.container}>
        <div style={S.row}>
          <div>
            <h1 style={S.h1}>Pointage</h1>
            <p style={S.sub}>
              Date : <b>{today}</b> — Statut : <b>{dayBadge}</b>
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <a href="/employee" style={S.link}>⬅ Menu</a>
            <button onClick={loadAll} style={S.btnGhost} disabled={loading}>
              🔄 Recharger
            </button>
          </div>
        </div>

        <div style={{ ...S.card, marginTop: 14 }}>
          <div style={S.row}>
            <div style={{ minWidth: 320, flex: 1 }}>
              <label style={S.label}>Chantier</label>
              <select value={selectedSite} onChange={(e) => setSelectedSite(e.target.value)} style={S.input}>
                <option value="">-- Choisir --</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <p style={{ marginTop: 8, marginBottom: 0, color: THEME.sub }}>
                État : <b>{state === "idle" ? "arrêté" : state === "working" ? "en travail" : "en pause"}</b> — Total work :{" "}
                <b>{totalWorkH.toFixed(2)} h</b>
              </p>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
              {state === "idle" && (
                <button onClick={() => startWork(selectedSite)} disabled={loading} style={S.btnPrimary}>
                  ▶ Démarrer
                </button>
              )}

              {state === "working" && (
                <>
                  <button onClick={pause} disabled={loading} style={S.btnWarn}>
                    ⏸ Pause
                  </button>
                  <button onClick={() => changeSite(selectedSite)} disabled={loading} style={S.btnGhost}>
                    🔁 Changer chantier
                  </button>
                  <button onClick={endOpen} disabled={loading} style={S.btnOk}>
                    ⏹ Terminer
                  </button>
                </>
              )}

              {state === "paused" && (
                <>
                  <button onClick={() => resumeWork(selectedSite)} disabled={loading} style={S.btnPrimary}>
                    ▶ Reprendre
                  </button>
                  <button onClick={endOpen} disabled={loading} style={S.btnOk}>
                    ⏹ Terminer
                  </button>
                </>
              )}
            </div>
          </div>

          {msg && <div style={S.msg}>{msg}</div>}
        </div>

        <div style={{ ...S.card, marginTop: 14 }}>
          <div style={S.row}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>Historique du jour</h3>
            <div style={S.rightText}>Segments : {logs.length}</div>
          </div>

          <div style={S.sep} />

          {logs.length === 0 ? (
            <p style={{ margin: 0, color: THEME.sub }}>Aucun segment.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {logs.map((l) => {
                const start = fmtHM(l.started_at);
                const end = l.ended_at ? fmtHM(l.ended_at) : "en cours";
                const name = l.segment_type === "pause" ? "PAUSE" : l.site_id ? siteMap.get(l.site_id) ?? "-" : "-";
                const mins = minutesBetween(l.started_at, l.ended_at ?? nowIso);
                return (
                  <div key={l.id} style={S.logCard}>
                    <div style={S.row}>
                      <div style={{ fontWeight: 900 }}>{l.segment_type === "pause" ? "PAUSE" : `CHANTIER: ${name}`}</div>
                      <div style={S.rightText}>
                        {start} - {end} ({(mins / 60).toFixed(2)} h)
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
