"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Site = { id: string; name: string };

const THEME = {
  bg: "#0b1220",
  surface: "#0f172a",
  card: "#111c33",
  card2: "#0e1930",
  border: "#24324f",
  text: "#e5e7eb",
  sub: "#a8b3cf",
  red: "#b40000",
};

const S: any = {
  page: { minHeight: "100vh", background: THEME.bg, color: THEME.text, padding: 18, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" },
  container: { maxWidth: 860, margin: "18px auto", background: THEME.surface, border: `1px solid ${THEME.border}`, borderRadius: 18, padding: 18, boxShadow: "0 10px 30px rgba(0,0,0,0.25)" },
  top: { display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" },
  brand: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" },
  logo: { width: 200, height: "auto", display: "block", filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.35))" },
  h1: { margin: 0, fontSize: 26, fontWeight: 900, letterSpacing: -0.3 },
  sub: { marginTop: 6, color: THEME.sub, fontWeight: 800 },
  card: { background: THEME.card, border: `1px solid ${THEME.border}`, borderRadius: 16, padding: 14, marginTop: 14 },
  label: { display: "block", fontWeight: 900, marginBottom: 6, color: THEME.sub },
  input: { width: "100%", padding: 12, borderRadius: 14, border: `1px solid ${THEME.border}`, background: THEME.card2, color: THEME.text, outline: "none" },
  row2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  row4: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 },
  btnPrimary: { padding: "12px 14px", fontWeight: 900, borderRadius: 14, border: `1px solid ${THEME.red}`, background: THEME.red, color: "#fff", cursor: "pointer" },
  btnGhost: { padding: "12px 14px", fontWeight: 900, borderRadius: 14, border: `1px solid ${THEME.border}`, background: THEME.card2, color: THEME.text, cursor: "pointer" },
  msg: { marginTop: 12, padding: "10px 12px", borderRadius: 12, border: `1px solid ${THEME.border}`, background: THEME.card2, fontWeight: 800 },
  hint: { color: THEME.sub, fontWeight: 800, marginTop: 10, lineHeight: 1.4 },
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function isoLocal(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function isoToday() {
  return isoLocal(new Date());
}
function isoYesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return isoLocal(d);
}

export default function EmployeeDayPage() {
  const [checking, setChecking] = useState(true);
  const [session, setSession] = useState<any>(null);

  const [sites, setSites] = useState<Site[]>([]);
  const [siteId, setSiteId] = useState("");
  const [workDate, setWorkDate] = useState(isoToday());

  // heures pré-remplies
  const [startTime, setStartTime] = useState("07:00");
  const [breakStart, setBreakStart] = useState("12:00");
  const [breakEnd, setBreakEnd] = useState("13:00");
  const [endTime, setEndTime] = useState("17:00");

  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecking(false);
      if (!data.session) window.location.href = "/";
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function loadSites() {
    setMsg("");
    const { data, error } = await supabase
      .from("sites")
      .select("id,name")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      setMsg("Erreur chargement chantiers: " + error.message);
      return;
    }

    const list = (data ?? []).map((s: any) => ({ id: String(s.id), name: String(s.name ?? "") }));
    setSites(list);
    if (!siteId && list.length > 0) setSiteId(list[0].id);
  }

  useEffect(() => {
    if (!session) return;
    loadSites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const totalHours = useMemo(() => {
    const toMin = (t: string) => {
      const [h, m] = t.split(":").map((x) => parseInt(x, 10));
      return h * 60 + m;
    };
    const st = toMin(startTime);
    const bs = toMin(breakStart);
    const be = toMin(breakEnd);
    const et = toMin(endTime);
    const total = Math.max(0, et - st);
    const pause = Math.max(0, be - bs);
    return Math.max(0, total - pause) / 60;
  }, [startTime, breakStart, breakEnd, endTime]);

  async function copySiteFromYesterday() {
    if (!session?.user?.id) return;

    setLoading(true);
    setMsg("");

    const yday = isoYesterday();

    const { data, error } = await supabase
      .from("daily_status")
      .select("day_type,site_id")
      .eq("user_id", session.user.id)
      .eq("work_date", yday)
      .maybeSingle();

    setLoading(false);

    if (error) {
      setMsg("❌ Erreur lecture d’hier: " + error.message);
      return;
    }

    if (!data || String((data as any).day_type ?? "work") !== "work" || !(data as any).site_id) {
      setMsg("⚠️ Pas de chantier trouvé hier (ou journée non-travail).");
      return;
    }

    const sid = String((data as any).site_id);
    setSiteId(sid);
    setMsg("✅ Chantier d’hier copié.");
  }

  async function saveDay() {
    if (!session?.user?.id) return;
    if (!workDate) return setMsg("⚠️ Choisis une date.");
    if (!siteId) return setMsg("⚠️ Choisis un chantier.");

    setLoading(true);
    setMsg("");

    const payload: any = {
      user_id: session.user.id,
      work_date: workDate,
      day_type: "work",
      site_id: siteId,
      start_time: startTime,
      break_start: breakStart,
      break_end: breakEnd,
      end_time: endTime,
      note: null,
    };

    const { error } = await supabase.from("daily_status").upsert(payload, {
      onConflict: "user_id,work_date",
    });

    setLoading(false);

    if (error) {
      setMsg("❌ Erreur enregistrement: " + error.message);
      return;
    }

    setMsg(`✅ Journée enregistrée (${totalHours.toFixed(2)} h).`);
  }

  if (checking) return <main style={S.page}>Chargement...</main>;
  if (!session) return null;

  return (
    <main style={S.page}>
      <div style={S.container}>
        <div style={S.top}>
          <div style={S.brand}>
            <img src="/gaillard-logo.png" alt="Gaillard Jean-Paul SA" style={S.logo} />
            <div>
              <h1 style={S.h1}>Pointage journée (1 clic)</h1>
              <div style={S.sub}>Choisir la date + chantier, puis enregistrer (heures pré-remplies).</div>
            </div>
          </div>

          <button onClick={() => (window.location.href = "/employee")} style={S.btnGhost}>
            ⬅ Retour menu
          </button>
        </div>

        <div style={S.card}>
          <div style={S.row2}>
            <div>
              <label style={S.label}>Date</label>
              <input type="date" value={workDate} onChange={(e) => setWorkDate(e.target.value)} style={S.input} />
            </div>

            <div>
              <label style={S.label}>Chantier</label>
              <select value={siteId} onChange={(e) => setSiteId(e.target.value)} style={S.input}>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ height: 1, background: THEME.border, margin: "14px 0" }} />

          <div style={S.row4}>
            <div>
              <label style={S.label}>Début</label>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={S.input} />
            </div>
            <div>
              <label style={S.label}>Pause (début)</label>
              <input type="time" value={breakStart} onChange={(e) => setBreakStart(e.target.value)} style={S.input} />
            </div>
            <div>
              <label style={S.label}>Pause (fin)</label>
              <input type="time" value={breakEnd} onChange={(e) => setBreakEnd(e.target.value)} style={S.input} />
            </div>
            <div>
              <label style={S.label}>Fin</label>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} style={S.input} />
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14, alignItems: "center" }}>
            <button onClick={saveDay} style={S.btnPrimary} disabled={loading}>
              {loading ? "Enregistrement..." : "✅ Enregistrer la journée"}
            </button>

            {/* ✅ NOUVEAU : copier chantier d’hier */}
            <button onClick={copySiteFromYesterday} style={S.btnGhost} disabled={loading}>
              📌 Copier chantier d’hier
            </button>

            <button
              onClick={() => {
                setStartTime("07:00");
                setBreakStart("12:00");
                setBreakEnd("13:00");
                setEndTime("17:00");
                setMsg("✅ Horaires remis par défaut.");
              }}
              style={S.btnGhost}
              disabled={loading}
            >
              ↩ Remettre horaires défaut
            </button>
          </div>

          <div style={S.hint}>
            Total estimé : <b style={{ color: THEME.text }}>{totalHours.toFixed(2)} h</b> (07:00–12:00 / 13:00–17:00)
          </div>

          {msg && <div style={S.msg}>{msg}</div>}
        </div>
      </div>
    </main>
  );
}
