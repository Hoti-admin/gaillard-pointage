"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Profile = { role: string; is_active: boolean; full_name: string | null };

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
  container: { maxWidth: 980, margin: "18px auto", background: THEME.surface, border: `1px solid ${THEME.border}`, borderRadius: 18, padding: 18, boxShadow: "0 10px 30px rgba(0,0,0,0.25)" },
  top: { display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" },
  brand: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" },
  logo: { width: 220, height: "auto", display: "block", filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.35))" },
  h1: { margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: -0.3 },
  sub: { marginTop: 6, color: THEME.sub, fontWeight: 800 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginTop: 14 },
  tile: { display: "block", background: THEME.card, border: `1px solid ${THEME.border}`, borderRadius: 16, padding: 14, textDecoration: "none", color: THEME.text, boxShadow: "0 6px 16px rgba(0,0,0,0.18)" },
  tileTitle: { fontWeight: 900, fontSize: 16 },
  tileSub: { marginTop: 6, color: THEME.sub, fontWeight: 700 },
  btnGhost: { padding: "12px 14px", fontWeight: 900, borderRadius: 14, border: `1px solid ${THEME.border}`, background: THEME.card2, color: THEME.text, cursor: "pointer" },
  link: { color: THEME.sub, fontWeight: 900, textDecoration: "none" },
};

export default function EmployeeMenuPage() {
  const [checking, setChecking] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

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
    })();
  }, [session?.user?.id]);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (checking) return <main style={S.page}>Chargement...</main>;
  if (!session) {
    window.location.href = "/";
    return null;
  }

  const role = profile?.role ?? "employee";
  const name = profile?.full_name ?? "";
  const email = session?.user?.email ?? "";

  return (
    <main style={S.page}>
      <div style={S.container}>
        <div style={S.top}>
          <div style={S.brand}>
            <img src="/gaillard-logo.png" alt="Gaillard Jean-Paul SA" style={S.logo} />
            <div>
              <h1 style={S.h1}>Espace employé</h1>
              <p style={S.sub}>
                Connecté : <b>{email}</b> {name ? `— ${name}` : ""} — (<b>{role}</b>)
              </p>
            </div>
          </div>

          <button onClick={signOut} style={S.btnGhost}>Se déconnecter</button>
        </div>

        <div style={S.grid}>
          <a href="/employee/today" style={S.tile}>
            <div style={S.tileTitle}>📍 Aujourd’hui</div>
            <div style={S.tileSub}>Pointage rapide + férié</div>
          </a>

          {/* ✅ NOUVEAU : Pointage journée (1 clic) */}
          <a href="/employee/day" style={S.tile}>
            <div style={S.tileTitle}>🧾 Pointage journée</div>
            <div style={S.tileSub}>Choisir date + chantier (heures pré-remplies)</div>
          </a>

          <a href="/employee/month" style={S.tile}>
            <div style={S.tileTitle}>🗓️ Mon mois</div>
            <div style={S.tileSub}>Saisie / modifications / absences</div>
          </a>

          <a href="/employee/bordereaux" style={S.tile}>
            <div style={S.tileTitle}>📄 Mes bordereaux</div>
            <div style={S.tileSub}>PDF validés uniquement</div>
          </a>

          <a href="/employee/overtime" style={S.tile}>
            <div style={S.tileTitle}>⏱️ Heures supp</div>
            <div style={S.tileSub}>Saisie + demandes</div>
          </a>

          {role === "admin" && (
            <a href="/admin" style={S.tile}>
              <div style={S.tileTitle}>🛠️ Admin</div>
              <div style={S.tileSub}>Accès admin</div>
            </a>
          )}
        </div>

        <div style={{ marginTop: 16 }}>
          <a href="/" style={S.link}>⬅ Retour accueil</a>
        </div>
      </div>
    </main>
  );
}
