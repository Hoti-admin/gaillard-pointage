"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Entry = {
  id: string;
  user_id: string;
  work_date: string;
  site_id: string | null;
  start_time: string | null;
  end_time: string | null;
  hours: number;
  reason: string | null;
  is_paid: boolean;
  paid_at: string | null;
  is_approved: boolean;
  approved_at: string | null;
};

type Site = { id: string; name: string; is_active: boolean };
type Profile = { role: string; is_active: boolean; full_name: string | null };

type OvertimeRequest = {
  id: string;
  user_id: string;
  request_month: string; // YYYY-MM
  requested_hours: number;
  note: string | null;
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

const S = {
  page: { minHeight: "100vh", background: THEME.bg, color: THEME.text, padding: 18, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" } as React.CSSProperties,
  container: { maxWidth: 1020, margin: "18px auto", background: THEME.surface, border: `1px solid ${THEME.border}`, borderRadius: 18, padding: 18, boxShadow: "0 10px 30px rgba(0,0,0,0.25)" } as React.CSSProperties,
  h1: { margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: -0.3 } as React.CSSProperties,
  sub: { marginTop: 8, color: THEME.sub } as React.CSSProperties,
  card: { background: THEME.card, border: `1px solid ${THEME.border}`, borderRadius: 16, padding: 14, boxShadow: "0 6px 16px rgba(0,0,0,0.18)" } as React.CSSProperties,
  card2: { background: THEME.card2, border: `1px solid ${THEME.border}`, borderRadius: 14, padding: 12 } as React.CSSProperties,
  row: { display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" } as React.CSSProperties,
  label: { display: "block", fontWeight: 900, marginBottom: 6, color: THEME.sub } as React.CSSProperties,
  input: { width: "100%", padding: 10, borderRadius: 14, border: `1px solid ${THEME.border}`, background: THEME.card2, color: THEME.text, outline: "none" } as React.CSSProperties,
  btnPrimary: { padding: "12px 14px", fontWeight: 900, borderRadius: 14, border: `1px solid ${THEME.red}`, background: THEME.red, color: "#fff", cursor: "pointer" } as React.CSSProperties,
  btnGhost: { padding: "12px 14px", fontWeight: 900, borderRadius: 14, border: `1px solid ${THEME.border}`, background: THEME.card2, color: THEME.text, cursor: "pointer" } as React.CSSProperties,
  btnDanger: { padding: "12px 14px", fontWeight: 900, borderRadius: 14, border: `1px solid ${THEME.red}`, background: "transparent", color: THEME.text, cursor: "pointer" } as React.CSSProperties,
  sep: { height: 1, background: THEME.border, margin: "14px 0" } as React.CSSProperties,
  msg: { marginTop: 12, padding: "10px 12px", borderRadius: 12, border: `1px solid ${THEME.border}`, background: THEME.card2, fontWeight: 800 } as React.CSSProperties,
  chip: (color: string) => ({ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 999, border: `1px solid ${THEME.border}`, background: THEME.card2, fontWeight: 900 } as React.CSSProperties),
  dot: (color: string) => ({ width: 10, height: 10, borderRadius: 999, background: color, boxShadow: "0 0 0 4px rgba(255,255,255,0.03)" } as React.CSSProperties),
  link: { color: THEME.sub, fontWeight: 900, textDecoration: "none" } as React.CSSProperties,
};

function ymNow() {
  return new Date().toISOString().slice(0, 7);
}
function ymdNow() {
  return new Date().toISOString().slice(0, 10);
}
function monthRange(month: string) {
  const [y, m] = month.split("-").map((x) => parseInt(x, 10));
  const first = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const last = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { first, last };
}
function toMin(hhmm: string) {
  const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}
function calcHours(start: string, end: string) {
  const a = toMin(start);
  const b = toMin(end);
  const diff = Math.max(0, b - a);
  return Math.round((diff / 60) * 100) / 100;
}
function t5(v: string | null) {
  if (!v) return "";
  return String(v).slice(0, 5);
}
function parseHours(s: string) {
  const v = Number(String(s ?? "").trim().replace(",", "."));
  return Number.isFinite(v) ? v : NaN;
}

export default function EmployeeOvertimePage() {
  const [checking, setChecking] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [sites, setSites] = useState<Site[]>([]);
  const siteMap = useMemo(() => new Map(sites.map((s) => [s.id, s.name])), [sites]);

  const [month, setMonth] = useState(ymNow());

  // ajout ligne
  const [date, setDate] = useState(ymdNow());
  const [siteId, setSiteId] = useState<string>("");
  const [startTime, setStartTime] = useState("17:00");
  const [endTime, setEndTime] = useState("18:00");
  const [reason, setReason] = useState("");

  // liste
  const [entries, setEntries] = useState<Entry[]>([]);
  const [showPaid, setShowPaid] = useState(true);
  const [showUnpaid, setShowUnpaid] = useState(true);

  // edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [eDate, setEDate] = useState("");
  const [eSiteId, setESiteId] = useState("");
  const [eStart, setEStart] = useState("");
  const [eEnd, setEEnd] = useState("");
  const [eReason, setEReason] = useState("");

  // demande paiement mensuelle
  const [reqRow, setReqRow] = useState<OvertimeRequest | null>(null);
  const [reqMode, setReqMode] = useState<"all" | "none" | "partial">("all");
  const [reqHours, setReqHours] = useState("0.00");
  const [reqNote, setReqNote] = useState("");

  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const hoursAuto = useMemo(() => calcHours(startTime, endTime), [startTime, endTime]);

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
      const { data } = await supabase.from("profiles").select("role,is_active,full_name").eq("user_id", session.user.id).single();
      setProfile((data as any) ?? null);

      const { data: sData } = await supabase
        .from("sites")
        .select("id,name,is_active")
        .eq("is_active", true)
        .order("name", { ascending: true });
      setSites((sData ?? []) as any);
    })();
  }, [session?.user?.id]);

  async function loadMonth() {
    if (!session?.user?.id) return;
    setLoading(true);
    setMsg("");

    const { first, last } = monthRange(month);

    const { data, error } = await supabase
      .from("overtime_entries")
      .select("id,user_id,work_date,site_id,start_time,end_time,hours,reason,is_paid,paid_at,is_approved,approved_at")
      .eq("user_id", session.user.id)
      .gte("work_date", first)
      .lte("work_date", last)
      .order("work_date", { ascending: true });

    if (error) {
      setLoading(false);
      setMsg("Erreur chargement: " + error.message);
      setEntries([]);
      return;
    }

    const list = (data ?? []) as any as Entry[];
    setEntries(list);

    // demande paiement du mois
    const { data: rData, error: rErr } = await supabase
      .from("overtime_requests")
      .select("id,user_id,request_month,requested_hours,note")
      .eq("user_id", session.user.id)
      .eq("request_month", month)
      .maybeSingle();

    if (rErr) {
      setReqRow(null);
      setReqMode("all");
      setReqNote("");
      setReqHours("0.00");
      setLoading(false);
      return;
    }

    const req = (rData as any as OvertimeRequest) ?? null;
    setReqRow(req);

    const totalMonth = list.reduce((a, e) => a + Number(e.hours ?? 0), 0);
    const rh = Number(req?.requested_hours ?? 0);

    if (!req) {
      // default: payer tout (demande = total du mois)
      setReqMode("all");
      setReqHours(totalMonth.toFixed(2));
      setReqNote("");
    } else {
      if (rh <= 0.0001) setReqMode("none");
      else if (Math.abs(rh - totalMonth) < 0.01) setReqMode("all");
      else setReqMode("partial");
      setReqHours(rh.toFixed(2));
      setReqNote(req.note ?? "");
    }

    setLoading(false);
  }

  useEffect(() => {
    if (!session?.user?.id) return;
    loadMonth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, month]);

  const filtered = useMemo(() => entries.filter((e) => (e.is_paid ? showPaid : showUnpaid)), [entries, showPaid, showUnpaid]);

  const totals = useMemo(() => {
    let tot = 0, approved = 0, pending = 0;
    for (const e of entries) {
      const h = Number(e.hours ?? 0);
      tot += h;
      if (e.is_approved) approved += h;
      else pending += h;
    }
    return { tot, approved, pending };
  }, [entries]);

  useEffect(() => {
    // si mode "all", garder la demande synchronisée avec le total du mois
    if (reqMode !== "all") return;
    setReqHours(totals.tot.toFixed(2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totals.tot, reqMode]);

  async function addEntry() {
    if (!session?.user?.id) return;
    if (!date) return setMsg("⚠️ Date obligatoire.");
    if (!siteId) return setMsg("⚠️ Choisis un chantier.");
    const h = calcHours(startTime, endTime);
    if (h <= 0) return setMsg("⚠️ Vérifie l'heure début/fin (heures doivent être > 0).");

    setLoading(true);
    setMsg("");

    const { error } = await supabase.from("overtime_entries").insert({
      user_id: session.user.id,
      work_date: date,
      site_id: siteId,
      start_time: startTime,
      end_time: endTime,
      hours: Number(h.toFixed(2)),
      reason: reason.trim() || null,
      is_paid: false,
      paid_at: null,
      is_approved: false,
      approved_at: null,
    });

    setLoading(false);

    if (error) {
      setMsg("Erreur ajout: " + error.message);
      return;
    }

    setMsg("✅ Ajouté (en attente de validation admin).");
    setReason("");
    await loadMonth();
  }

  function startEdit(e: Entry) {
    setEditingId(e.id);
    setEDate(e.work_date);
    setESiteId(e.site_id ?? "");
    setEStart(t5(e.start_time) || "17:00");
    setEEnd(t5(e.end_time) || "18:00");
    setEReason(e.reason ?? "");
    setMsg("");
  }
  function cancelEdit() {
    setEditingId(null);
    setEDate("");
    setESiteId("");
    setEStart("");
    setEEnd("");
    setEReason("");
  }
  async function saveEdit(id: string) {
    if (!eDate) return setMsg("⚠️ Date obligatoire.");
    if (!eSiteId) return setMsg("⚠️ Chantier obligatoire.");
    const h = calcHours(eStart, eEnd);
    if (h <= 0) return setMsg("⚠️ Vérifie heure début/fin.");

    setLoading(true);
    setMsg("");

    const { error } = await supabase
      .from("overtime_entries")
      .update({
        work_date: eDate,
        site_id: eSiteId,
        start_time: eStart,
        end_time: eEnd,
        hours: Number(h.toFixed(2)),
        reason: eReason.trim() || null,
      })
      .eq("id", id);

    setLoading(false);

    if (error) {
      setMsg("Erreur modification: " + error.message);
      return;
    }

    setMsg("✅ Modifié.");
    cancelEdit();
    await loadMonth();
  }

  async function deleteEntry(e: Entry) {
    const ok = window.confirm("Supprimer cette ligne d'heures supp ?");
    if (!ok) return;

    setLoading(true);
    setMsg("");

    const { error } = await supabase.from("overtime_entries").delete().eq("id", e.id);

    setLoading(false);

    if (error) {
      setMsg("Erreur suppression: " + error.message);
      return;
    }

    setMsg("✅ Supprimé.");
    await loadMonth();
  }

  async function saveRequest() {
    if (!session?.user?.id) return;

    const total = totals.tot;
    let wanted = 0;

    if (reqMode === "none") wanted = 0;
    else if (reqMode === "all") wanted = total;
    else {
      const v = parseHours(reqHours);
      if (!Number.isFinite(v) || v < 0) {
        setMsg("⚠️ Heures à payer: valeur invalide.");
        return;
      }
      wanted = v;
    }

    // clamp: 0..total
    wanted = Math.max(0, Math.min(total, wanted));

    setLoading(true);
    setMsg("");

    const { error } = await supabase
      .from("overtime_requests")
      .upsert(
        {
          user_id: session.user.id,
          request_month: month,
          requested_hours: Number(wanted.toFixed(2)),
          note: reqNote.trim() || null,
        },
        { onConflict: "user_id,request_month" }
      );

    setLoading(false);

    if (error) {
      setMsg("Erreur demande: " + error.message);
      return;
    }

    setMsg("✅ Demande enregistrée. L'admin la verra pour préparer le paiement.");
    await loadMonth();
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

  const isAdmin = !!(profile?.is_active && profile?.role === "admin");

  return (
    <main style={S.page}>
      <div style={S.container}>
        <div style={S.row}>
          <div>
            <h1 style={S.h1}>Heures supplémentaires</h1>
            <p style={S.sub}>Chantier + de/a + demande de paiement mensuelle (tout / conserver / partiel)</p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <a href="/employee" style={S.link}>⬅ Menu</a>
            {isAdmin && <a href="/admin/overtime" style={S.link}>➡ Admin heures supp</a>}
            <button onClick={signOut} style={S.btnGhost}>Se déconnecter</button>
          </div>
        </div>

        {/* Ajout ligne */}
        <div style={{ ...S.card, marginTop: 14 }}>
          <h3 style={{ marginTop: 0, fontSize: 16, fontWeight: 900 }}>Ajouter une ligne</h3>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={S.label}>Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={S.input} />
            </div>

            <div>
              <label style={S.label}>Chantier</label>
              <select value={siteId} onChange={(e) => setSiteId(e.target.value)} style={S.input}>
                <option value="">-- Choisir --</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={S.label}>De</label>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={S.input} />
            </div>

            <div>
              <label style={S.label}>A</label>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} style={S.input} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginTop: 12 }}>
            <div>
              <label style={S.label}>Motif (optionnel)</label>
              <input value={reason} onChange={(e) => setReason(e.target.value)} style={S.input} />
            </div>
            <div>
              <label style={S.label}>Heures (auto)</label>
              <input value={hoursAuto.toFixed(2)} readOnly style={S.input} />
            </div>
          </div>

          <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={addEntry} style={S.btnPrimary} disabled={loading}>✅ Ajouter</button>
            <button onClick={loadMonth} style={S.btnGhost} disabled={loading}>🔄 Recharger</button>
          </div>

          {msg && <div style={S.msg}>{msg}</div>}
        </div>

        {/* Mois + demande paiement */}
        <div style={{ ...S.card, marginTop: 14 }}>
          <div style={S.row}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>Mois</h3>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ ...S.input, width: 180 }} />
              <button onClick={() => setShowUnpaid((v) => !v)} style={S.btnGhost}>{showUnpaid ? "Masquer non paye" : "Afficher non paye"}</button>
              <button onClick={() => setShowPaid((v) => !v)} style={S.btnGhost}>{showPaid ? "Masquer paye" : "Afficher paye"}</button>
            </div>
          </div>

          <div style={S.sep} />

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <span style={S.chip(THEME.green)}><span style={S.dot(THEME.green)} />Total: {totals.tot.toFixed(2)} h</span>
            <span style={S.chip(THEME.blue)}><span style={S.dot(THEME.blue)} />Valide: {totals.approved.toFixed(2)} h</span>
            <span style={S.chip(THEME.amber)}><span style={S.dot(THEME.amber)} />En attente: {totals.pending.toFixed(2)} h</span>
          </div>

          <div style={S.sep} />

          {/* ✅ demande paiement */}
          <div style={S.card2}>
            <div style={S.row}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 15 }}>Demande de paiement pour ce mois</div>
                <div style={{ color: THEME.sub, marginTop: 4 }}>
                  Choisis ce que tu veux payer maintenant. Le reste sera conservé.
                </div>
              </div>
              <button onClick={saveRequest} style={S.btnPrimary} disabled={loading}>
                ✅ Enregistrer demande
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 12 }}>
              <label style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer" }}>
                <input type="radio" checked={reqMode === "all"} onChange={() => setReqMode("all")} />
                <span style={{ fontWeight: 900 }}>Payer tout ce mois</span>
              </label>

              <label style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer" }}>
                <input type="radio" checked={reqMode === "none"} onChange={() => setReqMode("none")} />
                <span style={{ fontWeight: 900 }}>Tout conserver</span>
              </label>

              <label style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer" }}>
                <input type="radio" checked={reqMode === "partial"} onChange={() => setReqMode("partial")} />
                <span style={{ fontWeight: 900 }}>Partiel (X heures)</span>
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12, marginTop: 12 }}>
              <div>
                <label style={S.label}>Heures a payer ce mois</label>
                <input
                  value={
                    reqMode === "none" ? "0.00" : reqMode === "all" ? totals.tot.toFixed(2) : reqHours
                  }
                  onChange={(e) => setReqHours(e.target.value)}
                  style={S.input}
                  disabled={reqMode !== "partial"}
                />
              </div>
              <div>
                <label style={S.label}>Note (optionnel)</label>
                <input value={reqNote} onChange={(e) => setReqNote(e.target.value)} style={S.input} placeholder="Ex: payer 10h, garder le reste" />
              </div>
            </div>

            <div style={{ marginTop: 10, color: THEME.sub, fontWeight: 900 }}>
              Conserve: {(Math.max(0, totals.tot - (reqMode === "none" ? 0 : reqMode === "all" ? totals.tot : Math.min(totals.tot, parseHours(reqHours) || 0)))).toFixed(2)} h
            </div>

            {reqRow && (
              <div style={{ marginTop: 10, color: THEME.sub }}>
                Derniere demande enregistrée: <b>{Number(reqRow.requested_hours ?? 0).toFixed(2)} h</b>
              </div>
            )}
          </div>

          <div style={S.sep} />

          {/* liste */}
          {filtered.length === 0 ? (
            <p style={{ margin: 0, color: THEME.sub }}>Aucune ligne.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {filtered.map((e) => {
                const editing = editingId === e.id;
                const chantier = e.site_id ? siteMap.get(e.site_id) ?? "-" : "-";
                const st = t5(e.start_time);
                const et = t5(e.end_time);

                const canEdit = !e.is_paid && !e.is_approved;

                return (
                  <div key={e.id} style={{ background: THEME.card2, border: `1px solid ${THEME.border}`, borderRadius: 14, padding: 12 }}>
                    {!editing ? (
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <div>
                          <div style={{ fontWeight: 900 }}>
                            {e.work_date} — {chantier} — {st} - {et} — {Number(e.hours).toFixed(2)} h
                          </div>
                          {e.reason && <div style={{ color: THEME.sub, marginTop: 4 }}>{e.reason}</div>}

                          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <span style={S.chip(e.is_approved ? THEME.blue : THEME.amber)}>
                              <span style={S.dot(e.is_approved ? THEME.blue : THEME.amber)} />
                              {e.is_approved ? "VALIDE" : "EN ATTENTE"}
                            </span>
                            <span style={S.chip(e.is_paid ? THEME.red : THEME.amber)}>
                              <span style={S.dot(e.is_paid ? THEME.red : THEME.amber)} />
                              {e.is_paid ? "PAYE" : "NON PAYE"}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
                          {canEdit ? (
                            <>
                              <button onClick={() => startEdit(e)} style={S.btnGhost} disabled={loading}>✏️ Modifier</button>
                              <button onClick={() => deleteEntry(e)} style={S.btnDanger} disabled={loading}>🗑️ Supprimer</button>
                            </>
                          ) : (
                            <span style={{ color: THEME.sub, fontWeight: 900 }}>
                              {e.is_approved ? "Validé par admin" : ""}{e.is_paid ? " - Payé" : ""}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr 1fr", gap: 12 }}>
                          <div>
                            <label style={S.label}>Date</label>
                            <input type="date" value={eDate} onChange={(ev) => setEDate(ev.target.value)} style={S.input} />
                          </div>
                          <div>
                            <label style={S.label}>Chantier</label>
                            <select value={eSiteId} onChange={(ev) => setESiteId(ev.target.value)} style={S.input}>
                              <option value="">-- Choisir --</option>
                              {sites.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label style={S.label}>De</label>
                            <input type="time" value={eStart} onChange={(ev) => setEStart(ev.target.value)} style={S.input} />
                          </div>
                          <div>
                            <label style={S.label}>A</label>
                            <input type="time" value={eEnd} onChange={(ev) => setEEnd(ev.target.value)} style={S.input} />
                          </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginTop: 12 }}>
                          <div>
                            <label style={S.label}>Motif</label>
                            <input value={eReason} onChange={(ev) => setEReason(ev.target.value)} style={S.input} />
                          </div>
                          <div>
                            <label style={S.label}>Heures (auto)</label>
                            <input value={calcHours(eStart, eEnd).toFixed(2)} readOnly style={S.input} />
                          </div>
                        </div>

                        <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                          <button onClick={() => saveEdit(e.id)} style={S.btnPrimary} disabled={loading}>✅ Enregistrer</button>
                          <button onClick={cancelEdit} style={S.btnGhost} disabled={loading}>Annuler</button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {msg && <div style={S.msg}>{msg}</div>}
      </div>
    </main>
  );
}
