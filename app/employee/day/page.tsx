"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type DayType = "work" | "holiday" | "sick" | "leave" | "accident" | "vacation" | "other";
type Site = { id: string; name: string | null; is_active: boolean | null };

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
};

const S: any = {
  page: { minHeight: "100vh", background: THEME.bg, color: THEME.text, padding: 18, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" },
  container: { maxWidth: 820, margin: "18px auto", background: THEME.surface, border: `1px solid ${THEME.border}`, borderRadius: 18, padding: 18, boxShadow: "0 10px 30px rgba(0,0,0,0.25)" },
  top: { display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" },
  brand: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" },
  logo: { width: 220, height: "auto", display: "block", filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.35))", borderRadius: 14, border: `1px solid ${THEME.border}` },
  h1: { margin: 0, fontSize: 26, fontWeight: 900, letterSpacing: -0.3 },
  sub: { marginTop: 6, color: THEME.sub, fontWeight: 800 },

  card: { background: THEME.card, border: `1px solid ${THEME.border}`, borderRadius: 16, padding: 14, marginTop: 14 },
  row: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  row3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 },

  label: { display: "block", fontWeight: 900, marginBottom: 6, color: THEME.sub },
  input: { width: "100%", padding: 12, borderRadius: 14, border: `1px solid ${THEME.border}`, background: THEME.card2, color: THEME.text, outline: "none" },
  select: { width: "100%", padding: 12, borderRadius: 14, border: `1px solid ${THEME.border}`, background: THEME.card2, color: THEME.text, outline: "none" },

  btnPrimary: { width: "100%", padding: 14, fontWeight: 900, borderRadius: 14, border: `1px solid ${THEME.red}`, background: THEME.red, color: "#fff", cursor: "pointer" },
  btnGhost: { width: "100%", padding: 12, fontWeight: 900, borderRadius: 14, border: `1px solid ${THEME.border}`, background: THEME.card2, color: THEME.text, cursor: "pointer" },

  pill: (on: boolean) => ({
    width: "100%",
    padding: 12,
    fontWeight: 900,
    borderRadius: 14,
    border: `1px solid ${on ? THEME.green : THEME.border}`,
    background: on ? "rgba(34,197,94,0.12)" : THEME.card2,
    color: THEME.text,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  }),

  msg: { marginTop: 12, padding: "10px 12px", borderRadius: 14, border: `1px solid ${THEME.border}`, background: THEME.card2, fontWeight: 800 },
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function clampNum(v: any) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export default function EmployeeDayPage() {
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const [date, setDate] = useState(todayISO());
  const [sites, setSites] = useState<Site[]>([]);

  const [dayType, setDayType] = useState<DayType>("work");
  const [siteId, setSiteId] = useState<string>("");

  const [startTime, setStartTime] = useState("07:00");
  const [breakStart, setBreakStart] = useState("12:00");
  const [breakEnd, setBreakEnd] = useState("13:00");
  const [endTime, setEndTime] = useState("17:00");

  const [travelCHF, setTravelCHF] = useState(0);
  const [mealsYes, setMealsYes] = useState(false);
  const [miscCHF, setMiscCHF] = useState(0);

  const isWork = dayType === "work";

  const siteOptions = useMemo(() => {
    return (sites ?? [])
      .map((s) => ({
        ...s,
        name: (s.name ?? "").trim(),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [sites]);

  async function loadDay() {
    setMsg("");
    setLoading(true);

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setLoading(false);
      window.location.href = "/";
      return;
    }

    const res = await fetch(`/api/employee/day-data?date=${encodeURIComponent(date)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!res.ok) {
      let detail = "";
      try {
        const j = await res.json();
        detail = j?.error ? String(j.error) : "";
      } catch {}
      const extra = detail || res.statusText || "Erreur serveur";
      setMsg(`⚠️ Erreur chargement (${res.status}) : ${extra}`);
      setLoading(false);
      return;
    }

    const j = await res.json();
    setSites((j?.sites ?? []) as Site[]);

    const st = j?.status;
    const ex = j?.expenses;

    const dt: DayType = (st?.day_type ?? "work") as DayType;
    setDayType(dt);

    setSiteId(st?.site_id ? String(st.site_id) : "");
    setStartTime(st?.start_time ?? "07:00");
    setBreakStart(st?.break_start ?? "12:00");
    setBreakEnd(st?.break_end ?? "13:00");
    setEndTime(st?.end_time ?? "17:00");

    setTravelCHF(Number(ex?.travel_chf ?? 0));
    setMealsYes(Number(ex?.meals_qty ?? 0) > 0);
    setMiscCHF(Number(ex?.misc_chf ?? 0));

    setLoading(false);
  }

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      setChecking(false);
      if (!data.session) window.location.href = "/";
      else loadDay();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (checking) return;
    loadDay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  async function save() {
    setMsg("");
    setLoading(true);

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setLoading(false);
      setMsg("⚠️ Missing token");
      return;
    }

    const payload: any = {
      work_date: date,
      day_type: dayType,
      note: null,
      travel_chf: clampNum(travelCHF),
      meals_qty: mealsYes ? 1 : 0,
      misc_chf: clampNum(miscCHF),
    };

    if (isWork) {
      payload.site_id = siteId || null;
      payload.start_time = startTime;
      payload.break_start = breakStart;
      payload.break_end = breakEnd;
      payload.end_time = endTime;
    } else {
      payload.site_id = null;
      payload.start_time = null;
      payload.break_start = null;
      payload.break_end = null;
      payload.end_time = null;
      payload.travel_chf = 0;
      payload.meals_qty = 0;
      payload.misc_chf = 0;
    }

    const res = await fetch("/api/employee/day-save", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    setLoading(false);

    if (!res.ok) {
      let detail = "";
      try {
        const j = await res.json();
        detail = j?.error ? String(j.error) : "";
      } catch {}
      const extra = detail || res.statusText || "Erreur serveur";
      setMsg(`⚠️ Erreur sauvegarde (${res.status}) : ${extra}`);
      return;
    }

    setMsg("✅ Journée enregistrée.");
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (checking) return <main style={S.page}>Chargement…</main>;

  return (
    <main style={S.page}>
      <div style={S.container}>
        <div style={S.top}>
          <div style={S.brand}>
            <img src="/gaillard-logo.png" alt="Gaillard" style={S.logo} />
            <div>
              <h1 style={S.h1}>Pointage journée</h1>
              <div style={S.sub}>Journée complète + frais simples</div>
            </div>
          </div>
          <a href="/employee" style={{ color: THEME.sub, fontWeight: 900, textDecoration: "none" }}>
            ⬅ Espace employé
          </a>
        </div>

        <div style={S.card}>
          <div style={S.row}>
            <div>
              <label style={S.label}>Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={S.input} />
            </div>

            <div>
              <label style={S.label}>Type de journée</label>
              <select value={dayType} onChange={(e) => setDayType(e.target.value as DayType)} style={S.select}>
                <option value="work">Travail</option>
                <option value="holiday">Férié</option>
                <option value="sick">Maladie</option>
                <option value="leave">Congé</option>
                <option value="accident">Accident</option>
                <option value="vacation">Vacances</option>
                <option value="other">Autre</option>
              </select>
            </div>
          </div>
        </div>

        <div style={S.card}>
          <div style={S.row}>
            <div>
              <label style={S.label}>Chantier</label>
              <select value={siteId} onChange={(e) => setSiteId(e.target.value)} style={S.select} disabled={!isWork}>
                <option value="">— Choisir —</option>

                {/* ✅ si aucun chantier */}
                {siteOptions.length === 0 && <option value="">(Aucun chantier actif)</option>}

                {siteOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name || `Chantier (${String(s.id).slice(0, 6)})`}
                  </option>
                ))}
              </select>
            </div>

            <div />
          </div>

          <div style={{ height: 1, background: THEME.border, margin: "14px 0" }} />

          <div style={S.row3}>
            <div>
              <label style={S.label}>Début</label>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={S.input} disabled={!isWork} />
            </div>
            <div>
              <label style={S.label}>Pause (début)</label>
              <input type="time" value={breakStart} onChange={(e) => setBreakStart(e.target.value)} style={S.input} disabled={!isWork} />
            </div>
            <div>
              <label style={S.label}>Pause (fin)</label>
              <input type="time" value={breakEnd} onChange={(e) => setBreakEnd(e.target.value)} style={S.input} disabled={!isWork} />
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <label style={S.label}>Fin</label>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} style={S.input} disabled={!isWork} />
          </div>
        </div>

        <div style={S.card}>
          <h3 style={{ marginTop: 0 }}>Frais du jour</h3>

          <div style={S.row3}>
            <div>
              <label style={S.label}>Déplacement (CHF)</label>
              <input type="number" step="0.01" value={travelCHF} onChange={(e) => setTravelCHF(clampNum(e.target.value))} style={S.input} disabled={!isWork} />
            </div>

            <div>
              <label style={S.label}>Repas extérieurs midi</label>
              <button type="button" style={S.pill(mealsYes)} disabled={!isWork} onClick={() => setMealsYes((v) => !v)}>
                🍽 {mealsYes ? "OUI" : "NON"}
              </button>
            </div>

            <div>
              <label style={S.label}>Divers (CHF)</label>
              <input type="number" step="0.01" value={miscCHF} onChange={(e) => setMiscCHF(clampNum(e.target.value))} style={S.input} disabled={!isWork} />
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <button onClick={save} style={S.btnPrimary} disabled={loading}>
              ✅ Enregistrer la journée
            </button>
          </div>

          {msg.trim() && <div style={S.msg}>{msg}</div>}
        </div>

        <div style={{ marginTop: 12 }}>
          <button onClick={signOut} style={S.btnGhost} disabled={loading}>
            Se déconnecter
          </button>
        </div>
      </div>
    </main>
  );
}
