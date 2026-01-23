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

const S = {
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
    maxWidth: 460,
    background: THEME.surface,
    border: `1px solid ${THEME.border}`,
    borderRadius: 18,
    padding: 18,
    boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
  },
  brand: {
    display: "flex",
    justifyContent: "center",
    marginBottom: 8,
  },
  logo: {
    width: 240,
    height: "auto",
    display: "block",
    filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.35))",
  },
  title: { margin: 0, fontSize: 26, fontWeight: 900, letterSpacing: -0.3, textAlign: "center" as const },
  sub: { marginTop: 8, color: THEME.sub, fontWeight: 800, textAlign: "center" as const },
  label: { display: "block", marginTop: 14, marginBottom: 6, fontWeight: 900, color: THEME.sub },
  input: {
    width: "100%",
    padding: 12,
    borderRadius: 14,
    border: `1px solid ${THEME.border}`,
    background: THEME.card2,
    color: THEME.text,
    outline: "none",
  },
  btn: {
    width: "100%",
    padding: 12,
    marginTop: 16,
    fontWeight: 900,
    borderRadius: 14,
    border: `1px solid ${THEME.red}`,
    background: THEME.red,
    color: "#fff",
    cursor: "pointer",
  },
  btnGhost: {
    width: "100%",
    padding: 12,
    marginTop: 10,
    fontWeight: 900,
    borderRadius: 14,
    border: `1px solid ${THEME.border}`,
    background: THEME.card2,
    color: THEME.text,
    cursor: "pointer",
  },
  link: { color: THEME.sub, fontWeight: 900, textDecoration: "none" },
  msg: {
    marginTop: 12,
    padding: "10px 12px",
    borderRadius: 12,
    border: `1px solid ${THEME.border}`,
    background: THEME.card2,
    fontWeight: 800,
  },
  footerRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, gap: 10, flexWrap: "wrap" as const },
  small: { color: THEME.sub, fontWeight: 800, fontSize: 12 },
};

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signIn() {
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(error.message);
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  if (!session) {
    return (
      <main style={S.page}>
        <div style={S.card}>
          <div style={S.brand}>
            <img src="/gaillard-logo.png" alt="Gaillard Jean-Paul SA" style={S.logo} />
          </div>

          <h1 style={S.title}>Pointage</h1>
          <p style={S.sub}>Connexion</p>

          <label style={S.label}>Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="prenom.nom@gaillard.ch"
            style={S.input}
            autoComplete="email"
          />

          <label style={S.label}>Mot de passe</label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="••••••••"
            style={S.input}
            autoComplete="current-password"
          />

          <button onClick={signIn} style={S.btn} disabled={loading}>
            {loading ? "Connexion..." : "Se connecter"}
          </button>

          <div style={S.footerRow}>
            <a href="/forgot-password" style={S.link}>
              Mot de passe oublié ?
            </a>
            <span style={S.small}>GAILLARD Jean-Paul SA</span>
          </div>

          {error && <div style={S.msg}>{error}</div>}
        </div>
      </main>
    );
  }

  return (
    <main style={S.page}>
      <div style={S.card}>
        <div style={S.brand}>
          <img src="/gaillard-logo.png" alt="Gaillard Jean-Paul SA" style={S.logo} />
        </div>

        <h1 style={S.title}>Pointage</h1>
        <p style={S.sub}>Connecté : {session.user.email}</p>

        <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
          <a href="/employee" style={{ ...S.btn, display: "inline-block", textAlign: "center", textDecoration: "none" }}>
            ➡️ Espace employé
          </a>

          <a
            href="/admin"
            style={{
              ...S.btnGhost,
              display: "inline-block",
              textAlign: "center",
              textDecoration: "none",
            }}
          >
            🛠️ Admin
          </a>

          <button onClick={signOut} style={S.btnGhost}>
            Se déconnecter
          </button>
        </div>
      </div>
    </main>
  );
}
