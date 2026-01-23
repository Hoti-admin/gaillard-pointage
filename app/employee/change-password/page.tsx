"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const THEME = {
  bg: "#0b1220",
  surface: "#0f172a",
  card2: "#0e1930",
  border: "#24324f",
  text: "#e5e7eb",
  sub: "#a8b3cf",
  red: "#b40000",
};

const S: any = {
  page: {
    minHeight: "100vh",
    background: THEME.bg,
    color: THEME.text,
    padding: 18,
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    width: "100%",
    maxWidth: 520,
    background: THEME.surface,
    border: `1px solid ${THEME.border}`,
    borderRadius: 18,
    padding: 18,
    boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
  },
  brand: { display: "flex", justifyContent: "center", marginBottom: 8 },
  logo: { width: 240, height: "auto", display: "block", filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.35))" },
  title: { margin: 0, fontSize: 26, fontWeight: 900, letterSpacing: -0.3, textAlign: "center" },
  sub: { marginTop: 8, color: THEME.sub, fontWeight: 800, lineHeight: 1.4, textAlign: "center" },
  label: { display: "block", marginTop: 14, marginBottom: 6, fontWeight: 900, color: THEME.sub },
  input: { width: "100%", padding: 12, borderRadius: 14, border: `1px solid ${THEME.border}`, background: THEME.card2, color: THEME.text, outline: "none" },
  btn: { width: "100%", padding: 12, marginTop: 16, fontWeight: 900, borderRadius: 14, border: `1px solid ${THEME.red}`, background: THEME.red, color: "#fff", cursor: "pointer" },
  btnGhost: { width: "100%", padding: 12, marginTop: 10, fontWeight: 900, borderRadius: 14, border: `1px solid ${THEME.border}`, background: THEME.card2, color: THEME.text, cursor: "pointer" },
  msg: { marginTop: 12, padding: "10px 12px", borderRadius: 12, border: `1px solid ${THEME.border}`, background: THEME.card2, fontWeight: 800 },
};

export default function EmployeeChangePasswordPage() {
  const [checking, setChecking] = useState(true);
  const [session, setSession] = useState<any>(null);

  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
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

  async function save() {
    setMsg("");

    if (p1.length < 8) return setMsg("❌ Mot de passe minimum 8 caractères.");
    if (p1 !== p2) return setMsg("❌ Les mots de passe ne correspondent pas.");

    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password: p1 });
    if (error) {
      setLoading(false);
      return setMsg("❌ " + error.message);
    }

    const res = await fetch("/api/employee/confirm-password-changed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true }),
    });

    setLoading(false);

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      return setMsg("⚠️ Mot de passe changé, mais erreur confirmation: " + (j?.error || res.statusText));
    }

    setMsg("✅ Mot de passe changé. Redirection...");
    setTimeout(() => (window.location.href = "/employee"), 800);
  }

  if (checking) return <main style={S.page}>Chargement...</main>;
  if (!session) return null;

  return (
    <main style={S.page}>
      <div style={S.card}>
        <div style={S.brand}>
          <img src="/gaillard-logo.png" alt="Gaillard Jean-Paul SA" style={S.logo} />
        </div>

        <h1 style={S.title}>Changer le mot de passe</h1>
        <p style={S.sub}>Obligatoire avant d’accéder à l’espace employé.</p>

        <label style={S.label}>Nouveau mot de passe</label>
        <input type="password" value={p1} onChange={(e) => setP1(e.target.value)} style={S.input} placeholder="••••••••" autoComplete="new-password" />

        <label style={S.label}>Confirmer</label>
        <input type="password" value={p2} onChange={(e) => setP2(e.target.value)} style={S.input} placeholder="••••••••" autoComplete="new-password" />

        <button onClick={save} style={S.btn} disabled={loading}>
          {loading ? "Enregistrement..." : "✅ Enregistrer"}
        </button>

        <button onClick={() => (window.location.href = "/employee")} style={S.btnGhost}>
          ⬅ Retour espace employé
        </button>

        {msg && <div style={S.msg}>{msg}</div>}
      </div>
    </main>
  );
}
