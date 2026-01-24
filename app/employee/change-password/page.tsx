"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const THEME = {
  bg: "#0b1220",
  surface: "#0f172a",
  card: "#111c33",
  card2: "#0e1930",
  border: "#24324f",
  text: "#e5e7eb",
  sub: "#a8b3cf",
  red: "#b40000",
  ok: "#22c55e",
};

const S: any = {
  page: { minHeight: "100vh", background: THEME.bg, color: THEME.text, padding: 18, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" },
  box: { maxWidth: 520, margin: "20px auto", background: THEME.surface, border: `1px solid ${THEME.border}`, borderRadius: 18, padding: 18, boxShadow: "0 10px 30px rgba(0,0,0,0.25)" },
  logoWrap: { display: "flex", justifyContent: "center", marginTop: 6, marginBottom: 14 },
  logo: { width: 220, height: "auto", display: "block", borderRadius: 14, border: `1px solid ${THEME.border}`, background: THEME.card2 },
  h1: { margin: "6px 0 6px 0", fontSize: 30, fontWeight: 900, letterSpacing: -0.3, textAlign: "center" },
  sub: { marginTop: 0, color: THEME.sub, fontWeight: 800, textAlign: "center" },

  label: { display: "block", fontWeight: 900, marginTop: 14, marginBottom: 6, color: THEME.sub },
  input: { width: "100%", padding: 12, borderRadius: 14, border: `1px solid ${THEME.border}`, background: THEME.card2, color: THEME.text, outline: "none", fontSize: 16 },
  btn: { width: "100%", padding: 14, marginTop: 14, fontWeight: 900, borderRadius: 14, border: `1px solid ${THEME.red}`, background: THEME.red, color: "#fff", cursor: "pointer", fontSize: 16 },
  btnGhost: { width: "100%", padding: 12, marginTop: 10, fontWeight: 900, borderRadius: 14, border: `1px solid ${THEME.border}`, background: THEME.card2, color: THEME.text, cursor: "pointer" },

  msg: { marginTop: 12, padding: "10px 12px", borderRadius: 14, border: `1px solid ${THEME.border}`, background: THEME.card2, fontWeight: 800 },
};

export default function ChangePasswordPage() {
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      setChecking(false);
      if (!data.session) window.location.href = "/";
    })();
  }, []);

  async function confirmChanged() {
    // ✅ IMPORTANT: récupérer un token frais au moment du clic (Safari/iPhone)
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Missing token");

    const res = await fetch("/api/employee/confirm-password-changed", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j?.error || res.statusText);
    }
  }

  async function save() {
    setMsg("");

    if (!pw1 || pw1.length < 8) {
      setMsg("⚠️ Mot de passe trop court (min 8).");
      return;
    }
    if (pw1 !== pw2) {
      setMsg("⚠️ Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    try {
      // 1) changer mot de passe
      const { error } = await supabase.auth.updateUser({ password: pw1 });
      if (error) throw new Error(error.message);

      // 2) refresh session (important sur iPhone)
      await supabase.auth.refreshSession();

      // 3) confirmer côté serveur (enlève le blocage must_change_password)
      await confirmChanged();

      setMsg("✅ Mot de passe changé. Redirection…");
      window.location.href = "/employee";
    } catch (e: any) {
      setMsg("⚠️ " + String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  if (checking) return <main style={S.page}>Chargement…</main>;

  return (
    <main style={S.page}>
      <div style={S.box}>
        <div style={S.logoWrap}>
          <img src="/gaillard-logo.png" alt="Gaillard" style={S.logo} />
        </div>

        <h1 style={S.h1}>Changer le mot de passe</h1>
        <p style={S.sub}>Obligatoire avant d’accéder à l’espace employé.</p>

        <label style={S.label}>Nouveau mot de passe</label>
        <input
          style={S.input}
          type="password"
          value={pw1}
          onChange={(e) => setPw1(e.target.value)}
          placeholder="Minimum 8 caractères"
        />

        <label style={S.label}>Confirmer</label>
        <input
          style={S.input}
          type="password"
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
          placeholder="Confirmer"
        />

        <button style={S.btn} onClick={save} disabled={loading}>
          ✅ Enregistrer
        </button>

        <button style={S.btnGhost} onClick={() => (window.location.href = "/employee")} disabled={loading}>
          ⬅ Retour espace employé
        </button>

        {msg && <div style={S.msg}>{msg}</div>}
      </div>
    </main>
  );
}
