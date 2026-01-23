"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Profile = { role: string; is_active: boolean; full_name: string | null };
type Emp = { user_id: string; full_name: string };
type Site = { id: string; name: string; is_active: boolean };

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

type Payment = {
  id: string;
  user_id: string;
  pay_month: string; // YYYY-MM
  paid_hours: number;
  note: string | null;
  created_at: string;
};

type RequestRow = {
  id: string;
  user_id: string;
  request_month: string; // YYYY-MM
  requested_hours: number;
  note: string | null;
  created_at?: string;
  updated_at?: string;
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
  purple: "#a78bfa",
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
    maxWidth: 1180,
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
  row: { display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" } as React.CSSProperties,
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
  btnOk: {
    padding: "12px 14px",
    fontWeight: 900,
    borderRadius: 14,
    border: `1px solid ${THEME.green}`,
    background: "transparent",
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
  btnDanger: {
    padding: "12px 14px",
    fontWeight: 900,
    borderRadius: 14,
    border: `1px solid ${THEME.red}`,
    background: "transparent",
    color: THEME.text,
    cursor: "pointer",
  } as React.CSSProperties,
  sep: { height: 1, background: THEME.border, margin: "14px 0" } as React.CSSProperties,
  msg: {
    marginTop: 12,
    padding: "10px 12px",
    borderRadius: 12,
    border: `1px solid ${THEME.border}`,
    background: THEME.card2,
    fontWeight: 800,
  } as React.CSSProperties,
  chip: (color: string) =>
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
      boxShadow: "0 0 0 4px rgba(255,255,255,0.03)",
    } as React.CSSProperties),
  link: { color: THEME.sub, fontWeight: 900, textDecoration: "none" } as React.CSSProperties,
};

function ymNow() {
  return new Date().toISOString().slice(0, 7);
}
function monthRange(month: string) {
  const [y, m] = month.split("-").map((x) => parseInt(x, 10));
  const first = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const last = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { first, last };
}
function t5(v: string | null) {
  if (!v) return "";
  return String(v).slice(0, 5);
}
function parseHours(s: string) {
  const v = Number(String(s ?? "").trim().replace(",", "."));
  return Number.isFinite(v) ? v : NaN;
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function AdminOvertimePage() {
  const [checking, setChecking] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [month, setMonth] = useState(ymNow());
  const [employee, setEmployee] = useState<string>("all");
  const [status, setStatus] = useState<"all" | "pending" | "approved">("pending");

  const [employees, setEmployees] = useState<Emp[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const empMap = useMemo(() => new Map(employees.map((e) => [e.user_id, e.full_name])), [employees]);
  const siteMap = useMemo(() => new Map(sites.map((s) => [s.id, s.name])), [sites]);

  const [allRows, setAllRows] = useState<Entry[]>([]);
  const [rows, setRows] = useState<Entry[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);

  const [payHours, setPayHours] = useState("0.00");
  const [payNote, setPayNote] = useState("");

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
      const { data: prof } = await supabase
        .from("profiles")
        .select("role,is_active,full_name")
        .eq("user_id", session.user.id)
        .single();
      setProfile((prof as any) ?? null);

      const { data: emps } = await supabase
        .from("profiles")
        .select("user_id,full_name,is_active")
        .eq("is_active", true)
        .order("full_name", { ascending: true });
      setEmployees(((emps ?? []) as any[]).map((e) => ({ user_id: String(e.user_id), full_name: String(e.full_name ?? "") })));

      const { data: sData } = await supabase
        .from("sites")
        .select("id,name,is_active")
        .order("name", { ascending: true });
      setSites((sData ?? []) as any);
    })();
  }, [session?.user?.id]);

  const isAdmin = !!(profile?.is_active && profile?.role === "admin");

  async function loadAll() {
    setLoading(true);
    setMsg("");

    const { first, last } = monthRange(month);

    // 1) toutes les lignes du mois
    let qAll = supabase
      .from("overtime_entries")
      .select("id,user_id,work_date,site_id,start_time,end_time,hours,reason,is_paid,paid_at,is_approved,approved_at")
      .gte("work_date", first)
      .lte("work_date", last)
      .order("work_date", { ascending: true });

    if (employee !== "all") qAll = qAll.eq("user_id", employee);

    const { data: dAll, error: eAll } = await qAll;
    if (eAll) {
      setLoading(false);
      setMsg("Erreur chargement: " + eAll.message);
      setAllRows([]);
      setRows([]);
      return;
    }

    const listAll = (dAll ?? []) as any as Entry[];
    setAllRows(listAll);

    // 2) filtre affichage (validation)
    const listView =
      status === "all"
        ? listAll
        : status === "approved"
        ? listAll.filter((r) => r.is_approved)
        : listAll.filter((r) => !r.is_approved);

    setRows(listView);

    // 3) paiements du mois
    let qPay = supabase
      .from("overtime_payments")
      .select("id,user_id,pay_month,paid_hours,note,created_at")
      .eq("pay_month", month)
      .order("created_at", { ascending: false });

    if (employee !== "all") qPay = qPay.eq("user_id", employee);

    const { data: pData, error: pErr } = await qPay;
    if (pErr) {
      setLoading(false);
      setMsg("Erreur paiements: " + pErr.message);
      setPayments([]);
      return;
    }
    setPayments((pData ?? []) as any);

    // 4) demandes de paiement du mois
    let qReq = supabase
      .from("overtime_requests")
      .select("id,user_id,request_month,requested_hours,note,created_at,updated_at")
      .eq("request_month", month)
      .order("updated_at", { ascending: false });

    if (employee !== "all") qReq = qReq.eq("user_id", employee);

    const { data: rData, error: rErr } = await qReq;
    if (rErr) {
      setLoading(false);
      setMsg("Erreur demandes: " + rErr.message);
      setRequests([]);
      return;
    }
    setRequests((rData ?? []) as any);

    setLoading(false);
  }

  useEffect(() => {
    if (!session?.user?.id) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, month, employee, status]);

  const paidByUser = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of payments) m.set(p.user_id, (m.get(p.user_id) ?? 0) + Number(p.paid_hours ?? 0));
    return m;
  }, [payments]);

  const requestByUser = useMemo(() => {
    const m = new Map<string, { hours: number; note: string | null }>();
    for (const r of requests) m.set(r.user_id, { hours: Number(r.requested_hours ?? 0), note: r.note ?? null });
    return m;
  }, [requests]);

  const totalsByUser = useMemo(() => {
    const m = new Map<string, { total: number; approved: number; pending: number }>();
    for (const r of allRows) {
      if (!m.has(r.user_id)) m.set(r.user_id, { total: 0, approved: 0, pending: 0 });
      const agg = m.get(r.user_id)!;
      const h = Number(r.hours ?? 0);
      agg.total += h;
      if (r.is_approved) agg.approved += h;
      else agg.pending += h;
    }
    return m;
  }, [allRows]);

  const userIds = useMemo(() => {
    const s = new Set<string>();
    for (const r of allRows) s.add(r.user_id);
    for (const p of payments) s.add(p.user_id);
    for (const r of requests) s.add(r.user_id);
    return Array.from(s).sort((a, b) => (empMap.get(a) ?? a).localeCompare(empMap.get(b) ?? b));
  }, [allRows, payments, requests, empMap]);

  const overview = useMemo(() => {
    return userIds.map((uid) => {
      const name = empMap.get(uid) ?? uid;
      const t = totalsByUser.get(uid) ?? { total: 0, approved: 0, pending: 0 };
      const paid = paidByUser.get(uid) ?? 0;

      const req = requestByUser.get(uid);
      const requestedRaw = req ? req.hours : t.total; // défaut = payer tout
      const requested = clamp(requestedRaw, 0, t.total);
      const reqAuto = !req;
      const keep = Math.max(0, t.total - requested);

      const balance = t.approved - paid; // solde basé sur validé

      return {
        uid,
        name,
        total: t.total,
        approved: t.approved,
        pending: t.pending,
        requested,
        keep,
        reqAuto,
        paid,
        balance,
        reqNote: req?.note ?? null,
      };
    });
  }, [userIds, empMap, totalsByUser, paidByUser, requestByUser]);

  const globalTotals = useMemo(() => {
    let total = 0,
      approved = 0,
      pending = 0,
      requested = 0,
      paid = 0,
      balance = 0;

    for (const r of overview) {
      total += r.total;
      approved += r.approved;
      pending += r.pending;
      requested += r.requested;
      paid += r.paid;
      balance += r.balance;
    }
    return { total, approved, pending, requested, paid, balance };
  }, [overview]);

  const selectedOverview = employee !== "all" ? overview.find((o) => o.uid === employee) : null;

  useEffect(() => {
    if (employee === "all") return;
    if (!selectedOverview) return;
    // pré-remplir avec "demandé"
    setPayHours(selectedOverview.requested.toFixed(2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee]);

  async function toggleApprove(e: Entry) {
    const ok = window.confirm(e.is_approved ? "Remettre en attente ?" : "Valider cette ligne ?");
    if (!ok) return;

    setLoading(true);
    setMsg("");

    const { error } = await supabase
      .from("overtime_entries")
      .update({
        is_approved: !e.is_approved,
        approved_at: !e.is_approved ? new Date().toISOString() : null,
      })
      .eq("id", e.id);

    setLoading(false);

    if (error) {
      setMsg("Erreur validation: " + error.message);
      return;
    }

    setMsg("✅ Statut validation mis à jour.");
    await loadAll();
  }

  async function addPayment(hoursToPay: number, note?: string | null) {
    if (employee === "all") {
      setMsg("⚠️ Choisis un employé pour enregistrer un paiement.");
      return;
    }
    const h = Number(hoursToPay);
    if (!Number.isFinite(h) || h <= 0) {
      setMsg("⚠️ Heures payées invalides (> 0).");
      return;
    }

    setLoading(true);
    setMsg("");

    const { error } = await supabase.from("overtime_payments").insert({
      user_id: employee,
      pay_month: month,
      paid_hours: Number(h.toFixed(2)),
      note: note?.trim() || null,
    });

    setLoading(false);

    if (error) {
      setMsg("Erreur paiement: " + error.message);
      return;
    }

    setMsg("✅ Paiement enregistré.");
    setPayNote("");
    await loadAll();
  }

  // ✅ 1 clic : Créer paiement = heures demandées
  async function payRequestedOneClick() {
    if (employee === "all" || !selectedOverview) {
      setMsg("⚠️ Choisis un employé.");
      return;
    }

    const h = Number(selectedOverview.requested ?? 0);
    if (!Number.isFinite(h) || h <= 0) {
      setMsg("⚠️ Aucun nombre d'heures demandé pour ce mois.");
      return;
    }

    const ok = window.confirm(
      `Créer un paiement de ${h.toFixed(2)} h pour ${selectedOverview.name} (mois ${month}) ?`
    );
    if (!ok) return;

    const autoNoteParts: string[] = [];
    autoNoteParts.push("Auto: paiement selon demande employé");
    if (selectedOverview.reqNote) autoNoteParts.push(`Demande: ${selectedOverview.reqNote}`);
    const autoNote = autoNoteParts.join(" | ");

    await addPayment(h, autoNote);
  }

  async function deletePayment(p: Payment) {
    const ok = window.confirm("Supprimer ce paiement ? (corriger une erreur)");
    if (!ok) return;

    setLoading(true);
    setMsg("");

    const { error } = await supabase.from("overtime_payments").delete().eq("id", p.id);

    setLoading(false);

    if (error) {
      setMsg("Erreur suppression paiement: " + error.message);
      return;
    }

    setMsg("✅ Paiement supprimé.");
    await loadAll();
  }

  async function exportXlsx() {
    if (!session?.access_token) return;
    setLoading(true);
    setMsg("");

    const url =
      `/api/export/overtime-xlsx?month=${encodeURIComponent(month)}` +
      `&employee=${encodeURIComponent(employee)}` +
      `&status=${encodeURIComponent(status)}`;

    const res = await fetch(url, { headers: { Authorization: `Bearer ${session.access_token}` } });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setMsg("Erreur export: " + (j?.error || res.statusText));
      setLoading(false);
      return;
    }

    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `HeuresSupp_${month}_${employee}_${status}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);

    setLoading(false);
  }

  if (checking) return <main style={S.page}>Chargement...</main>;
  if (!session) {
    window.location.href = "/";
    return null;
  }

  if (!isAdmin) {
    return (
      <main style={S.page}>
        <div style={S.container}>
          <h1 style={S.h1}>Admin - Heures supp</h1>
          <p style={S.sub}>Accès admin uniquement.</p>
          <a href="/admin" style={S.link}>⬅ Retour admin</a>
        </div>
      </main>
    );
  }

  return (
    <main style={S.page}>
      <div style={S.container}>
        <div style={S.row}>
          <div>
            <h1 style={S.h1}>Admin - Heures supp</h1>
            <p style={S.sub}>Validation + demandes + paiements + solde + export</p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a href="/admin" style={S.link}>⬅ Admin</a>
            <button onClick={exportXlsx} style={S.btnPrimary} disabled={loading}>
              📗 Export Excel
            </button>
            <button onClick={loadAll} style={S.btnGhost} disabled={loading}>
              🔄 Recharger
            </button>
          </div>
        </div>

        {/* Filtres */}
        <div style={{ ...S.card, marginTop: 14 }}>
          <h3 style={{ marginTop: 0, fontSize: 16, fontWeight: 900 }}>Filtres</h3>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={S.label}>Mois</label>
              <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={S.input} />
            </div>

            <div>
              <label style={S.label}>Employé</label>
              <select value={employee} onChange={(e) => setEmployee(e.target.value)} style={S.input}>
                <option value="all">Tous</option>
                {employees.map((e) => (
                  <option key={e.user_id} value={e.user_id}>
                    {e.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={S.label}>Validation (affichage)</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as any)} style={S.input}>
                <option value="all">Tous</option>
                <option value="pending">En attente</option>
                <option value="approved">Validé</option>
              </select>
            </div>
          </div>

          <div style={S.sep} />

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <span style={S.chip(THEME.green)}><span style={S.dot(THEME.green)} />Total saisi: {globalTotals.total.toFixed(2)} h</span>
            <span style={S.chip(THEME.blue)}><span style={S.dot(THEME.blue)} />Validé: {globalTotals.approved.toFixed(2)} h</span>
            <span style={S.chip(THEME.amber)}><span style={S.dot(THEME.amber)} />En attente: {globalTotals.pending.toFixed(2)} h</span>
            <span style={S.chip(THEME.purple)}><span style={S.dot(THEME.purple)} />Demandé: {globalTotals.requested.toFixed(2)} h</span>
            <span style={S.chip(THEME.red)}><span style={S.dot(THEME.red)} />Déjà payé: {globalTotals.paid.toFixed(2)} h</span>
            <span style={S.chip(THEME.green)}><span style={S.dot(THEME.green)} />Solde: {globalTotals.balance.toFixed(2)} h</span>
          </div>
        </div>

        {/* Vue d'ensemble */}
        <div style={{ ...S.card, marginTop: 14 }}>
          <h3 style={{ marginTop: 0, fontSize: 16, fontWeight: 900 }}>Vue d'ensemble (par employé)</h3>

          {overview.length === 0 ? (
            <p style={{ margin: 0, color: THEME.sub }}>Aucune donnée.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {overview.map((r) => (
                <div key={r.uid} style={{ background: THEME.card2, border: `1px solid ${THEME.border}`, borderRadius: 14, padding: 12 }}>
                  <div style={S.row}>
                    <div style={{ fontWeight: 900 }}>{r.name}</div>
                    <div style={{ color: THEME.sub, fontWeight: 900 }}>
                      Total {r.total.toFixed(2)}h — Validé {r.approved.toFixed(2)}h — En attente {r.pending.toFixed(2)}h —{" "}
                      Demandé {r.requested.toFixed(2)}h{r.reqAuto ? " (auto)" : ""} — Conserver {r.keep.toFixed(2)}h —{" "}
                      Payé {r.paid.toFixed(2)}h — Solde {r.balance.toFixed(2)}h
                    </div>
                  </div>
                  {r.reqNote && <div style={{ marginTop: 6, color: THEME.sub }}>Note: {r.reqNote}</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Paiement */}
        <div style={{ ...S.card, marginTop: 14 }}>
          <h3 style={{ marginTop: 0, fontSize: 16, fontWeight: 900 }}>Paiement (heures déjà payées)</h3>

          {employee === "all" ? (
            <div style={S.msg}>⚠️ Choisis un employé pour enregistrer un paiement.</div>
          ) : (
            selectedOverview && (
              <div style={{ marginBottom: 12, color: THEME.sub, fontWeight: 900 }}>
                Pour <b>{selectedOverview.name}</b> — Demandé: <b>{selectedOverview.requested.toFixed(2)}h</b>{" "}
                {selectedOverview.reqAuto ? "(auto)" : ""} — Conserver: <b>{selectedOverview.keep.toFixed(2)}h</b>
              </div>
            )
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 12 }}>
            <div>
              <label style={S.label}>Heures payées</label>
              <input value={payHours} onChange={(e) => setPayHours(e.target.value)} style={S.input} disabled={employee === "all"} />
            </div>

            <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
              <button
                onClick={() => addPayment(parseHours(payHours), payNote)}
                style={S.btnPrimary}
                disabled={loading || employee === "all"}
              >
                ✅ Ajouter paiement
              </button>

              {/* ✅ NOUVEAU : 1 clic -> paiement = demandé */}
              <button
                onClick={payRequestedOneClick}
                style={S.btnOk}
                disabled={loading || employee === "all" || !selectedOverview || selectedOverview.requested <= 0}
                title="Crée un paiement avec exactement les heures demandées par l'employé"
              >
                ⚡ Paiement = demandé
              </button>
            </div>

            <div>
              <label style={S.label}>Note (optionnel)</label>
              <input value={payNote} onChange={(e) => setPayNote(e.target.value)} style={S.input} placeholder="Ex: payé avec salaire du mois" />
            </div>
          </div>

          <div style={S.sep} />

          <h4 style={{ margin: 0, fontWeight: 900 }}>Historique des paiements (mois)</h4>

          {payments.length === 0 ? (
            <p style={{ marginTop: 10, color: THEME.sub }}>Aucun paiement enregistré.</p>
          ) : (
            <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
              {payments.map((p) => (
                <div key={p.id} style={{ background: THEME.card2, border: `1px solid ${THEME.border}`, borderRadius: 14, padding: 12 }}>
                  <div style={S.row}>
                    <div>
                      <div style={{ fontWeight: 900 }}>
                        {empMap.get(p.user_id) ?? p.user_id} — {Number(p.paid_hours).toFixed(2)} h — {p.pay_month}
                      </div>
                      {p.note && <div style={{ color: THEME.sub, marginTop: 4 }}>{p.note}</div>}
                      <div style={{ color: THEME.sub, marginTop: 4, fontWeight: 900 }}>{String(p.created_at).slice(0, 10)}</div>
                    </div>
                    <div>
                      <button onClick={() => deletePayment(p)} style={S.btnDanger} disabled={loading}>
                        🗑️ Supprimer
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Détails / validation */}
        <div style={{ ...S.card, marginTop: 14 }}>
          <h3 style={{ marginTop: 0, fontSize: 16, fontWeight: 900 }}>Détails (validation)</h3>

          {rows.length === 0 ? (
            <p style={{ margin: 0, color: THEME.sub }}>Aucune ligne.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {rows.map((e) => {
                const empName = empMap.get(e.user_id) ?? e.user_id;
                const chantier = e.site_id ? siteMap.get(e.site_id) ?? "-" : "-";
                const st = t5(e.start_time);
                const et = t5(e.end_time);

                return (
                  <div key={e.id} style={{ background: THEME.card2, border: `1px solid ${THEME.border}`, borderRadius: 14, padding: 12 }}>
                    <div style={S.row}>
                      <div>
                        <div style={{ fontWeight: 900 }}>
                          {e.work_date} — {empName} — {chantier} — {st} - {et} — {Number(e.hours).toFixed(2)} h
                        </div>
                        {e.reason && <div style={{ color: THEME.sub, marginTop: 4 }}>{e.reason}</div>}
                        <div style={{ marginTop: 8 }}>
                          <span style={S.chip(e.is_approved ? THEME.blue : THEME.amber)}>
                            <span style={S.dot(e.is_approved ? THEME.blue : THEME.amber)} />
                            {e.is_approved ? "VALIDÉ" : "EN ATTENTE"}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
                        <button onClick={() => toggleApprove(e)} style={e.is_approved ? S.btnWarn : S.btnOk} disabled={loading}>
                          {e.is_approved ? "↩ Remettre attente" : "✅ Valider"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {msg && <div style={S.msg}>{msg}</div>}
        </div>
      </div>
    </main>
  );
}
