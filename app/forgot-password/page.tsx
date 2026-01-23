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

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) window.location.href = "/employee";
    });
  }, []);

  async function send() {
    setMsg("");
    setLoading(true);

    const redirectTo = `${window.location.origin}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo });

    setLoading(false);

    if (error) return setMsg("❌ " + error.message);

    setMsg("✅ Email envoyé. Ouvre ton mail et clique sur le lien pour créer un nouveau mot de passe.");
  }

  return (
    <main style={S.page}>
      <div style={S.card}>
        <div style={S.brand}>
          <img src="/gaillard-logo.png" alt="Gaillard Jean-Paul SA" style={S.logo} />
        </div>

        <h1 style={S.title}>Mot de passe oublié</h1>
        <p style={S.sub}>Entre ton email. Tu recevras un lien pour définir un nouveau mot de passe.</p>

        <label style={S.label}>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="prenom.nom@..." style={S.input} autoComplete="email" />

        <button onClick={send} style={S.btn} disabled={loading || !email.trim()}>
          {loading ? "Envoi..." : "Envoyer le lien"}
        </button>

        <button onClick={() => (window.location.href = "/")} style={S.btnGhost}>
          ⬅ Retour login
        </button>

        {msg && <div style={S.msg}>{msg}</div>}
      </div>
    </main>
  );
}
