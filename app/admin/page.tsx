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
  page: {
    minHeight: "100vh",
    background: THEME.bg,
    color: THEME.text,
    padding: 18,
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
  },
  container: {
    maxWidth: 1100,
    margin: "18px auto",
    background: THEME.surface,
    border: `1px solid ${THEME.border}`,
    borderRadius: 18,
    padding: 18,
    boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
  },
  top: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
  },
  brand: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" },
  logo: { width: 220, height: "auto", display: "block", filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.35))" },
  h1: { margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: -0.3 },
  sub: { marginTop: 6, color: THEME.sub, fontWeight: 800 },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 12,
    marginTop: 14,
  },
  tile: {
    display: "block",
    background: THEME.card,
    border: `1px solid ${THEME.border}`,
    borderRadius: 16,
    padding: 14,
    textDecoration: "none",
    color: THEME.text,
    boxShadow: "0 6px 16px rgba(0,0,0,0.18)",
  },
  tileTitle: { fontWeight: 900, fontSize: 16 },
  tileSub: { marginTop: 6, color: THEME.sub, fontWeight: 700 },

  btnGhost: {
    padding: "12px 14px",
    fontWeight: 900,
    borderRadius: 14,
    border: `1px solid ${THEME.border}`,
    background: THEME.card2,
    color: THEME.text,
    cursor: "pointer",
  },

  msg: {
    marginTop: 12,
    padding: "10px 12px",
    borderRadius: 12,
    border: `1px solid ${THEME.border}`,
    background: THEME.card2,
    fontWeight: 800,
  },

  link: { color: THEME.sub, fontWeight: 900, textDecoration: "none" },
};

export default function AdminPage() {
  const [checking, setChecking] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [msg, setMsg] = useState("");

  const isAdmin = !!(profile?.is_active && profile?.role === "admin");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecking(false);
      if (!data.session) window.location.href = "/";
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("role,is_active,full_name")
        .eq("user_id", session.user.id)
        .single();

      if (error) {
        setMsg("Erreur profil: " + error.message);
        return;
      }
      setProfile((data as any) ?? null);
    })();
  }, [session?.user?.id]);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (checking) return <main style={S.page}>Chargement...</main>;
  if (!session) return null;

  if (!isAdmin) {
    return (
      <main style={S.page}>
        <div style={S.container}>
          <div style={S.top}>
            <div style={S.brand}>
              <img src="/gaillard-logo.png" alt="Gaillard Jean-Paul SA" style={S.logo} />
              <div>
                <h1 style={S.h1}>Admin</h1>
                <div style={S.sub}>Accès admin uniquement.</div>
              </div>
            </div>
            <button onClick={signOut} style={S.btnGhost}>Se déconnecter</button>
          </div>

          {msg && <div style={S.msg}>{msg}</div>}

          <div style={{ marginTop: 14 }}>
            <a href="/employee" style={S.link}>⬅ Retour espace employé</a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={S.page}>
      <div style={S.container}>
        <div style={S.top}>
          <div style={S.brand}>
            <img src="/gaillard-logo.png" alt="Gaillard Jean-Paul SA" style={S.logo} />
            <div>
              <h1 style={S.h1}>Admin</h1>
              <div style={S.sub}>Tableau de bord</div>
            </div>
          </div>
          <button onClick={signOut} style={S.btnGhost}>Se déconnecter</button>
        </div>

        {msg && <div style={S.msg}>{msg}</div>}

        <div style={S.grid}>
          <a href="/admin/bordereaux" style={S.tile}>
            <div style={S.tileTitle}>📦 Exports & Validation</div>
            <div style={S.tileSub}>PDF/Excel + valider les mois</div>
          </a>

          <a href="/admin/employees" style={S.tile}>
            <div style={S.tileTitle}>👥 Employés</div>
            <div style={S.tileSub}>Créer / reset MDP / activer / supprimer</div>
          </a>

          <a href="/sites" style={S.tile}>
            <div style={S.tileTitle}>🏗️ Chantiers</div>
            <div style={S.tileSub}>Ajouter / modifier / activer / supprimer</div>
          </a>

          <a href="/admin/overtime" style={S.tile}>
            <div style={S.tileTitle}>⏱️ Heures supp</div>
            <div style={S.tileSub}>Validation + paiements + export</div>
          </a>
        </div>
      </div>
    </main>
  );
}
