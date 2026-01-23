"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Profile = { role: string; is_active: boolean; full_name: string | null };

type EmpRow = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: "admin" | "employee";
  is_active: boolean;
  must_change_password: boolean;
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

const S: any = {
  page: { minHeight: "100vh", background: THEME.bg, color: THEME.text, padding: 18, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" },
  container: { maxWidth: 1100, margin: "18px auto", background: THEME.surface, border: `1px solid ${THEME.border}`, borderRadius: 18, padding: 18, boxShadow: "0 10px 30px rgba(0,0,0,0.25)" },
  h1: { margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: -0.3 },
  sub: { marginTop: 8, color: THEME.sub },
  row: { display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" },
  card: { background: THEME.card, border: `1px solid ${THEME.border}`, borderRadius: 16, padding: 14, boxShadow: "0 6px 16px rgba(0,0,0,0.18)" },
  label: { display: "block", fontWeight: 900, marginBottom: 6, color: THEME.sub },
  input: { width: "100%", padding: 10, borderRadius: 14, border: `1px solid ${THEME.border}`, background: THEME.card2, color: THEME.text, outline: "none" },
  btnPrimary: { padding: "12px 14px", fontWeight: 900, borderRadius: 14, border: `1px solid ${THEME.red}`, background: THEME.red, color: "#fff", cursor: "pointer" },
  btnGhost: { padding: "12px 14px", fontWeight: 900, borderRadius: 14, border: `1px solid ${THEME.border}`, background: THEME.card2, color: THEME.text, cursor: "pointer" },
  btnOk: { padding: "12px 14px", fontWeight: 900, borderRadius: 14, border: `1px solid ${THEME.green}`, background: "transparent", color: THEME.text, cursor: "pointer" },
  btnWarn: { padding: "12px 14px", fontWeight: 900, borderRadius: 14, border: `1px solid ${THEME.amber}`, background: "transparent", color: THEME.text, cursor: "pointer" },
  btnDanger: { padding: "12px 14px", fontWeight: 900, borderRadius: 14, border: `1px solid ${THEME.red}`, background: "transparent", color: THEME.text, cursor: "pointer" },
  sep: { height: 1, background: THEME.border, margin: "14px 0" },
  msg: { marginTop: 12, padding: "10px 12px", borderRadius: 12, border: `1px solid ${THEME.border}`, background: THEME.card2, fontWeight: 800 },
  link: { color: THEME.sub, fontWeight: 900, textDecoration: "none" },
  badge: (color: string) => ({ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 999, border: `1px solid ${THEME.border}`, background: THEME.card2, fontWeight: 900 }),
  dot: (color: string) => ({ width: 10, height: 10, borderRadius: 999, background: color, boxShadow: "0 0 0 4px rgba(255,255,255,0.03)" }),
};

function genPasswordPreview() {
  const year = new Date().getFullYear();
  const rnd = Math.floor(1000 + Math.random() * 9000);
  return `Gaillard-${year}@${rnd}`;
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

export default function AdminEmployeesPage() {
  const [checking, setChecking] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [rows, setRows] = useState<EmpRow[]>([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // Create form
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"admin" | "employee">("employee");
  const [password, setPassword] = useState(genPasswordPreview());

  const isAdmin = !!(profile?.is_active && profile?.role === "admin");
  const activeCount = useMemo(() => rows.filter((r) => r.is_active).length, [rows]);

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
      const { data: prof } = await supabase.from("profiles").select("role,is_active,full_name").eq("user_id", session.user.id).single();
      setProfile((prof as any) ?? null);
      await loadEmployees();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  async function loadEmployees() {
    setLoading(true);
    setMsg("");

    const { data, error } = await supabase
      .from("profiles")
      .select("user_id,email,full_name,role,is_active,must_change_password")
      .order("full_name", { ascending: true });

    setLoading(false);

    if (error) {
      setMsg("Erreur chargement employés: " + error.message);
      return;
    }
    setRows((data ?? []) as any);
  }

  async function createEmployee() {
    if (!session?.access_token) return;
    setLoading(true);
    setMsg("");

    const res = await fetch("/api/admin/employees/create", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email, full_name: fullName, role, password }),
    });

    setLoading(false);

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setMsg("Erreur création: " + (j?.error || res.statusText));
      return;
    }

    const j = await res.json();
    const temp = String(j?.temp_password ?? "");

    setMsg(temp ? `✅ Employé créé. Mot de passe provisoire (copié): ${temp}` : "✅ Employé créé.");
    if (temp) copyToClipboard(temp);

    setEmail("");
    setFullName("");
    setRole("employee");
    setPassword(genPasswordPreview());

    await loadEmployees();
  }

  // ✅ ICI on passe par l’API serveur (protection dernier admin)
  async function toggleActive(row: EmpRow) {
    if (!session?.access_token) return;

    const nextActive = !row.is_active;
    const name = row.full_name || row.email || row.user_id;

    const ok = window.confirm(nextActive ? `Activer ${name} ?` : `Désactiver ${name} ?`);
    if (!ok) return;

    setLoading(true);
    setMsg("");

    const res = await fetch("/api/admin/employees/toggle-active", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: row.user_id, is_active: nextActive }),
    });

    setLoading(false);

    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg("Erreur: " + (j?.error || res.statusText));
      return;
    }

    setMsg("✅ Statut mis à jour.");
    await loadEmployees();
  }

  async function forcePassword(row: EmpRow) {
    if (!session?.access_token) return;
    const ok = window.confirm(`Forcer ${row.full_name || row.email} à changer le mot de passe à la prochaine connexion ?`);
    if (!ok) return;

    setLoading(true);
    setMsg("");

    const res = await fetch("/api/admin/employees/force-password", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: row.user_id }),
    });

    setLoading(false);

    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg("Erreur: " + (j?.error || res.statusText));
      return;
    }

    setMsg("✅ Obligation de changer le mot de passe activée.");
    await loadEmployees();
  }

  async function resetPassword(row: EmpRow) {
    if (!session?.access_token) return;
    const ok = window.confirm(`RESET mot de passe pour ${row.full_name || row.email} ?`);
    if (!ok) return;

    setLoading(true);
    setMsg("");

    const res = await fetch("/api/admin/employees/reset-password", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: row.user_id }),
    });

    setLoading(false);

    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg("Erreur reset: " + (j?.error || res.statusText));
      return;
    }

    const temp = String(j?.temp_password ?? "");
    if (temp) {
      copyToClipboard(temp);
      setMsg(`✅ Nouveau mot de passe (copié): ${temp} (obligé de changer à la 1ère connexion)`);
    } else {
      setMsg("✅ Mot de passe reset.");
    }
    await loadEmployees();
  }

  async function sendReset(row: EmpRow) {
    if (!session?.access_token) return;
    const email = String(row.email ?? "").trim();
    if (!email) {
      setMsg("⚠️ Cet employé n’a pas d’email enregistré dans profiles.email");
      return;
    }

    setLoading(true);
    setMsg("");

    const res = await fetch("/api/admin/employees/send-reset", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email, redirectTo: `${window.location.origin}/reset-password` }),
    });

    setLoading(false);

    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg("Erreur envoi reset: " + (j?.error || res.statusText));
      return;
    }

    if (j?.sent) {
      setMsg("✅ Email de reset envoyé (si SMTP Supabase configuré).");
      return;
    }

    const link = String(j?.action_link ?? "");
    if (link) {
      copyToClipboard(link);
      setMsg("✅ Lien de reset généré (copié). Tu peux l’envoyer à l’employé.");
    } else {
      setMsg("✅ OK, mais aucun lien retourné.");
    }
  }

  async function deleteEmployee(row: EmpRow) {
    if (!session?.access_token) return;

    const name = row.full_name || row.email || row.user_id;
    const confirmTxt = prompt(`SUPPRESSION DÉFINITIVE.\nTape SUPPRIMER pour confirmer la suppression de: ${name}`);
    if (confirmTxt !== "SUPPRIMER") return;

    setLoading(true);
    setMsg("");

    const res = await fetch("/api/admin/employees/delete", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: row.user_id }),
    });

    setLoading(false);

    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg("Erreur suppression: " + (j?.error || res.statusText));
      return;
    }

    setMsg("✅ Employé supprimé définitivement.");
    await loadEmployees();
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
          <h1 style={S.h1}>Admin — Employés</h1>
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
            <h1 style={S.h1}>Admin — Employés</h1>
            <p style={S.sub}>Créer / activer / reset mot de passe / supprimer (Total actifs: {activeCount})</p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a href="/admin" style={S.link}>⬅ Admin</a>
            <button onClick={loadEmployees} style={S.btnGhost} disabled={loading}>🔄 Recharger</button>
          </div>
        </div>

        <div style={{ ...S.card, marginTop: 14 }}>
          <h3 style={{ marginTop: 0 }}>Ajouter un employé</h3>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={S.label}>Email</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} style={S.input} placeholder="prenom.nom@..." />
            </div>

            <div>
              <label style={S.label}>Nom complet</label>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} style={S.input} placeholder="Nom Prénom" />
            </div>

            <div>
              <label style={S.label}>Rôle</label>
              <select value={role} onChange={(e) => setRole(e.target.value as any)} style={S.input}>
                <option value="employee">Employé</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div>
              <label style={S.label}>Mot de passe provisoire</label>
              <input value={password} onChange={(e) => setPassword(e.target.value)} style={S.input} />
              <div style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button onClick={() => setPassword(genPasswordPreview())} style={S.btnGhost} disabled={loading}>🔁 Générer</button>
                <button onClick={() => copyToClipboard(password)} style={S.btnGhost} disabled={loading}>📋 Copier</button>
              </div>
            </div>
          </div>

          <div style={S.sep} />

          <button onClick={createEmployee} style={S.btnPrimary} disabled={loading}>
            ✅ Créer l’employé (obligé de changer le mot de passe à la 1ère connexion)
          </button>

          {msg && <div style={S.msg}>{msg}</div>}
        </div>

        <div style={{ ...S.card, marginTop: 14 }}>
          <h3 style={{ marginTop: 0 }}>Liste des employés</h3>

          {rows.length === 0 ? (
            <p style={{ color: THEME.sub, margin: 0 }}>Aucun employé.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {rows.map((r) => (
                <div key={r.user_id} style={{ border: `1px solid ${THEME.border}`, background: THEME.card2, borderRadius: 14, padding: 12 }}>
                  <div style={S.row}>
                    <div>
                      <div style={{ fontWeight: 900, fontSize: 16 }}>
                        {r.full_name || "(sans nom)"}{" "}
                        <span style={S.badge(r.role === "admin" ? THEME.blue : THEME.amber)}>
                          <span style={S.dot(r.role === "admin" ? THEME.blue : THEME.amber)} />
                          {r.role}
                        </span>
                      </div>
                      <div style={{ color: THEME.sub, marginTop: 6, fontWeight: 900 }}>
                        Email: <b style={{ color: THEME.text }}>{r.email || "-"}</b> — Statut:{" "}
                        <b style={{ color: r.is_active ? THEME.green : THEME.amber }}>{r.is_active ? "Actif" : "Inactif"}</b>
                        {" — "}
                        MDP:{" "}
                        <b style={{ color: r.must_change_password ? THEME.amber : THEME.green }}>
                          {r.must_change_password ? "Doit changer" : "OK"}
                        </b>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button onClick={() => toggleActive(r)} style={S.btnGhost} disabled={loading}>
                        {r.is_active ? "⛔ Désactiver" : "✅ Activer"}
                      </button>

                      <button onClick={() => forcePassword(r)} style={S.btnWarn} disabled={loading}>
                        🔒 Forcer changement MDP
                      </button>

                      <button onClick={() => resetPassword(r)} style={S.btnOk} disabled={loading}>
                        ♻️ Reset MDP (temp)
                      </button>

                      <button onClick={() => sendReset(r)} style={S.btnGhost} disabled={loading}>
                        ✉️ Mot de passe oublié
                      </button>

                      <button onClick={() => deleteEmployee(r)} style={S.btnDanger} disabled={loading}>
                        🗑️ Supprimer
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {msg && <div style={S.msg}>{msg}</div>}
        </div>
      </div>
    </main>
  );
}
