"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type DayType = "work" | "holiday" | "sick" | "leave" | "accident" | "vacation" | "other";
type Site = { id: string; name: string; is_active: boolean };
type DayRow = {
  work_date: string;
  day_type: DayType;
  note: string | null;
  site_id: string | null;
  start_time: string | null;
  break_start: string | null;
  break_end: string | null;
  end_time: string | null;
};
type ExpenseRow = {
  work_date: string;
  travel_chf: number;
  meals_qty: number;
  misc_chf: number;
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
  inputBg: "#0e1930",
};

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}
function ym(d: Date) {
  return d.toISOString().slice(0, 7);
}
function monthRange(month: string) {
  const [y, m] = month.split("-").map((x) => parseInt(x, 10));
  const first = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const last = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { first, last };
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
    maxWidth: 1060,
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
  row: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" } as React.CSSProperties,
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 } as React.CSSProperties,
  label: { display: "block", fontWeight: 900, marginBottom: 6, color: THEME.sub } as React.CSSProperties,
  input: {
    width: "100%",
    padding: 10,
    borderRadius: 14,
    border: `1px solid ${THEME.border}`,
    background: THEME.inputBg,
    color: THEME.text,
    outline: "none",
  } as React.CSSProperties,
  inputDisabled: {
    width: "100%",
    padding: 10,
    borderRadius: 14,
    border: `1px solid ${THEME.border}`,
    background: "#0b1426",
    color: THEME.muted,
    opacity: 0.75,
  } as React.CSSProperties,
  btnPrimary: {
    width: "100%",
    padding: 12,
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
  link: { color: "#ffffff", fontWeight: 900, textDecoration: "none" } as React.CSSProperties,
  smallLink: { color: THEME.sub, fontWeight: 900, textDecoration: "none" } as React.CSSProperties,
  sep: { height: 1, background: THEME.border, margin: "14px 0" } as React.CSSProperties,
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

export default function EmployeeMonthPage() {
  const [checking, setChecking] = useState(true);
  const [session, setSession] = useState<any>(null);

  const [month, setMonth] = useState<string>(ym(new Date()));
  const { firstDate, lastDate } = useMemo(() => {
    const r = monthRange(month);
    return { firstDate: r.first, lastDate: r.last };
  }, [month]);

  const [selectedDate, setSelectedDate] = useState<string>(ymd(new Date()));
  const [sites, setSites] = useState<Site[]>([]);
  const [days, setDays] = useState<Map<string, DayRow>>(new Map());
  const [expenses, setExpenses] = useState<Map<string, ExpenseRow>>(new Map());

  const [dayType, setDayType] = useState<DayType>("work");
  const [note, setNote] = useState("");
  const [siteId, setSiteId] = useState<string>("");

  const [startTime, setStartTime] = useState("07:00");
  const [breakStart, setBreakStart] = useState("12:00");
  const [breakEnd, setBreakEnd] = useState("13:00");
  const [endTime, setEndTime] = useState("17:00");

  const [travel, setTravel] = useState("0");
  const [mealsQty, setMealsQty] = useState("0");
  const [misc, setMisc] = useState("0");

  const [bulkFrom, setBulkFrom] = useState<string>(ymd(new Date()));
  const [bulkTo, setBulkTo] = useState<string>(ymd(new Date()));
  const [bulkType, setBulkType] = useState<DayType>("vacation");
  const [bulkNote, setBulkNote] = useState("");

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

  useEffect(() => {
    if (!session?.user?.id) return;

    (async () => {
      setMsg("");
      setLoading(true);

      const { data: sData } = await supabase
        .from("sites")
        .select("id,name,is_active")
        .eq("is_active", true)
        .order("name", { ascending: true });
      setSites((sData ?? []) as any);

      const { data: dData, error: dErr } = await supabase
        .from("daily_status")
        .select("work_date,day_type,note,site_id,start_time,break_start,break_end,end_time")
        .eq("user_id", session.user.id)
        .gte("work_date", firstDate)
        .lte("work_date", lastDate);

      if (dErr) {
        setMsg("Erreur chargement mois: " + dErr.message);
        setLoading(false);
        return;
      }

      const map = new Map<string, DayRow>();
      for (const r of (dData ?? []) as any[]) map.set(String(r.work_date), r as DayRow);
      setDays(map);

      const { data: eData } = await supabase
        .from("daily_expenses")
        .select("work_date,travel_chf,meals_qty,misc_chf")
        .eq("user_id", session.user.id)
        .gte("work_date", firstDate)
        .lte("work_date", lastDate);

      const em = new Map<string, ExpenseRow>();
      for (const r of (eData ?? []) as any[]) {
        em.set(String(r.work_date), {
          work_date: String(r.work_date),
          travel_chf: Number(r.travel_chf ?? 0),
          meals_qty: Number(r.meals_qty ?? 0),
          misc_chf: Number(r.misc_chf ?? 0),
        });
      }
      setExpenses(em);

      setLoading(false);
    })();
  }, [session?.user?.id, firstDate, lastDate]);

  useEffect(() => {
    const d = days.get(selectedDate);
    const e = expenses.get(selectedDate);

    if (d) {
      setDayType((d.day_type ?? "work") as DayType);
      setNote(d.note ?? "");
      setSiteId(d.site_id ?? "");
      setStartTime((d.start_time ?? "07:00").slice(0, 5));
      setBreakStart((d.break_start ?? "12:00").slice(0, 5));
      setBreakEnd((d.break_end ?? "13:00").slice(0, 5));
      setEndTime((d.end_time ?? "17:00").slice(0, 5));
    } else {
      setDayType("work");
      setNote("");
      setSiteId("");
      setStartTime("07:00");
      setBreakStart("12:00");
      setBreakEnd("13:00");
      setEndTime("17:00");
    }

    setTravel(String(e?.travel_chf ?? 0));
    setMealsQty(String(e?.meals_qty ?? 0));
    setMisc(String(e?.misc_chf ?? 0));
  }, [selectedDate, days, expenses]);

  async function saveDay() {
    if (!session?.user?.id) return;
    setLoading(true);
    setMsg("");

    const isWorkLike = dayType === "work" || dayType === "holiday";
    const payload: any = {
      user_id: session.user.id,
      work_date: selectedDate,
      day_type: dayType,
      note: dayType === "other" ? (note.trim() || null) : null,
      site_id: isWorkLike ? (siteId || null) : null,
      start_time: isWorkLike ? startTime : null,
      break_start: isWorkLike ? breakStart : null,
      break_end: isWorkLike ? breakEnd : null,
      end_time: isWorkLike ? endTime : null,
    };

    const { error } = await supabase.from("daily_status").upsert(payload, { onConflict: "user_id,work_date" });
    if (error) {
      setMsg("Erreur sauvegarde jour: " + error.message);
      setLoading(false);
      return;
    }

    const t = Number(travel || 0);
    const mq = parseInt(mealsQty || "0", 10) || 0;
    const mi = Number(misc || 0);

    const { error: eErr } = await supabase
      .from("daily_expenses")
      .upsert(
        { user_id: session.user.id, work_date: selectedDate, travel_chf: t, meals_qty: mq, misc_chf: mi },
        { onConflict: "user_id,work_date" }
      );

    setMsg(eErr ? "Jour OK, mais erreur frais: " + eErr.message : "✅ Journée enregistrée.");
    setLoading(false);

    const { data: d1 } = await supabase
      .from("daily_status")
      .select("work_date,day_type,note,site_id,start_time,break_start,break_end,end_time")
      .eq("user_id", session.user.id)
      .eq("work_date", selectedDate)
      .single();

    const { data: e1 } = await supabase
      .from("daily_expenses")
      .select("work_date,travel_chf,meals_qty,misc_chf")
      .eq("user_id", session.user.id)
      .eq("work_date", selectedDate)
      .single();

    setDays((prev) => {
      const m = new Map(prev);
      if (d1) m.set(String((d1 as any).work_date), d1 as any);
      return m;
    });

    setExpenses((prev) => {
      const m = new Map(prev);
      if (e1) {
        m.set(String((e1 as any).work_date), {
          work_date: String((e1 as any).work_date),
          travel_chf: Number((e1 as any).travel_chf ?? 0),
          meals_qty: Number((e1 as any).meals_qty ?? 0),
          misc_chf: Number((e1 as any).misc_chf ?? 0),
        });
      }
      return m;
    });
  }

  async function applyBulk() {
    if (!session?.access_token) return;
    setLoading(true);
    setMsg("");

    const body: any = {
      from: bulkFrom,
      to: bulkTo,
      day_type: bulkType,
      note: bulkType === "other" ? (bulkNote.trim() || null) : null,
    };

    const res = await fetch("/api/employee/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(body),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg("Erreur période: " + (json?.error || res.statusText));
      setLoading(false);
      return;
    }

    setMsg(`✅ Période appliquée (${json.updated ?? "OK"} jours).`);

    const { data: dData } = await supabase
      .from("daily_status")
      .select("work_date,day_type,note,site_id,start_time,break_start,break_end,end_time")
      .eq("user_id", session.user.id)
      .gte("work_date", firstDate)
      .lte("work_date", lastDate);

    const map = new Map<string, DayRow>();
    for (const r of (dData ?? []) as any[]) map.set(String(r.work_date), r as DayRow);
    setDays(map);

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

  const isWorkLike = dayType === "work" || dayType === "holiday";

  return (
    <main style={S.page}>
      <div style={S.container}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 style={S.h1}>Mon mois</h1>
            <p style={S.sub}>
              Connecté : <b>{session.user.email}</b>
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <a href="/employee" style={S.smallLink}>⬅ Menu</a>
            <button onClick={signOut} style={S.btnGhost}>Se déconnecter</button>
          </div>
        </div>

        <div style={{ ...S.card, marginTop: 14 }}>
          <div style={S.row}>
            <div style={{ minWidth: 180 }}>
              <label style={S.label}>Mois</label>
              <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={S.input} />
            </div>
            <div style={{ minWidth: 180 }}>
              <label style={S.label}>Date</label>
              <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={S.input} />
            </div>
            <div style={{ marginLeft: "auto" }}>
              <a href="/employee/today" style={S.link}>▶ Aujourd&apos;hui</a>
            </div>
          </div>
        </div>

        <div style={{ ...S.card, marginTop: 14 }}>
          <h3 style={{ marginTop: 0, fontSize: 16, fontWeight: 900 }}>Journée</h3>

          <div style={S.grid2}>
            <div>
              <label style={S.label}>Type</label>
              <select value={dayType} onChange={(e) => setDayType(e.target.value as DayType)} style={S.input}>
                <option value="work">Travail</option>
                <option value="holiday">Férié</option>
                <option value="sick">Maladie</option>
                <option value="leave">Congé</option>
                <option value="accident">Accident</option>
                <option value="vacation">Vacances</option>
                <option value="other">Autre</option>
              </select>

              {dayType === "other" && (
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Note (optionnel)"
                  style={{ ...S.input, marginTop: 10 }}
                />
              )}

              <p style={{ marginTop: 10, marginBottom: 0, color: THEME.sub }}>
                “Férié” remplit la case export. Si tu travailles quand même, garde les heures ou fais ton pointage normal.
              </p>
            </div>

            <div>
              <label style={S.label}>Chantier (optionnel)</label>
              <select
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
                disabled={!isWorkLike}
                style={isWorkLike ? S.input : S.inputDisabled}
              >
                <option value="">--</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                <div>
                  <label style={S.label}>Début</label>
                  <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} disabled={!isWorkLike} style={isWorkLike ? S.input : S.inputDisabled} />
                </div>
                <div>
                  <label style={S.label}>Fin</label>
                  <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} disabled={!isWorkLike} style={isWorkLike ? S.input : S.inputDisabled} />
                </div>
                <div>
                  <label style={S.label}>Pause début</label>
                  <input type="time" value={breakStart} onChange={(e) => setBreakStart(e.target.value)} disabled={!isWorkLike} style={isWorkLike ? S.input : S.inputDisabled} />
                </div>
                <div>
                  <label style={S.label}>Pause fin</label>
                  <input type="time" value={breakEnd} onChange={(e) => setBreakEnd(e.target.value)} disabled={!isWorkLike} style={isWorkLike ? S.input : S.inputDisabled} />
                </div>
              </div>
            </div>
          </div>

          <div style={S.sep} />

          <h4 style={{ margin: 0, fontWeight: 900 }}>Frais du jour</h4>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 10 }}>
            <div>
              <label style={S.label}>Déplacement (CHF)</label>
              <input value={travel} onChange={(e) => setTravel(e.target.value)} inputMode="decimal" style={S.input} />
            </div>
            <div>
              <label style={S.label}>Repas extérieurs (nb)</label>
              <input value={mealsQty} onChange={(e) => setMealsQty(e.target.value)} inputMode="numeric" style={S.input} />
            </div>
            <div>
              <label style={S.label}>Divers (CHF)</label>
              <input value={misc} onChange={(e) => setMisc(e.target.value)} inputMode="decimal" style={S.input} />
            </div>
          </div>

          <button onClick={saveDay} disabled={loading} style={{ ...S.btnPrimary, marginTop: 14 }}>
            {loading ? "Enregistrement..." : "✅ Enregistrer la journée"}
          </button>

          {msg && <div style={S.msg}>{msg}</div>}
        </div>

        <div style={{ ...S.card, marginTop: 14 }}>
          <h3 style={{ marginTop: 0, fontSize: 16, fontWeight: 900 }}>Période (du ... au ...)</h3>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div>
              <label style={S.label}>Du</label>
              <input type="date" value={bulkFrom} onChange={(e) => setBulkFrom(e.target.value)} style={S.input} />
            </div>
            <div>
              <label style={S.label}>Au</label>
              <input type="date" value={bulkTo} onChange={(e) => setBulkTo(e.target.value)} style={S.input} />
            </div>
            <div style={{ minWidth: 220 }}>
              <label style={S.label}>Type</label>
              <select value={bulkType} onChange={(e) => setBulkType(e.target.value as DayType)} style={S.input}>
                <option value="holiday">Férié</option>
                <option value="vacation">Vacances</option>
                <option value="sick">Maladie</option>
                <option value="leave">Congé</option>
                <option value="accident">Accident</option>
                <option value="other">Autre</option>
                <option value="work">Travail</option>
              </select>
            </div>
            {bulkType === "other" && (
              <div style={{ flex: 1, minWidth: 240 }}>
                <label style={S.label}>Note</label>
                <input value={bulkNote} onChange={(e) => setBulkNote(e.target.value)} style={S.input} />
              </div>
            )}
          </div>

          <button onClick={applyBulk} disabled={loading} style={{ ...S.btnPrimary, marginTop: 12 }}>
            {loading ? "Application..." : "✅ Appliquer sur la période"}
          </button>
        </div>
      </div>
    </main>
  );
}
