"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
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
  green: "#22c55e",
  amber: "#f59e0b",
  blue: "#60a5fa",
};

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 768);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return isMobile;
}

export default function AdminPage() {
  const isMobile = useIsMobile();
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
      if (error) setMsg("Erreur profil : " + error.message);
      else setProfile((data as Profile) ?? null);
    })();
  }, [session?.user?.id]);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  const cards = useMemo(
    () => [
      {
        href: "/admin/review",
        title: "🧾 Contrôle bordereau",
        sub: "Voir, corriger, valider puis exporter avec une vue plus mobile.",
        accent: THEME.red,
      },
      {
        href: "/admin/bordereaux",
        title: "📦 Exports & validation",
        sub: "PDF / Excel et suivi des mois validés ou en attente.",
        accent: THEME.green,
      },
      {
        href: "/admin/employees",
        title: "👥 Employés",
        sub: "Créer, réinitialiser les accès, activer ou désactiver les comptes.",
        accent: THEME.blue,
      },
      {
        href: "/sites",
        title: "🏗️ Chantiers",
        sub: "Ajouter, modifier et maintenir la liste active des chantiers.",
        accent: THEME.amber,
      },
      {
        href: "/admin/overtime",
        title: "⏱️ Heures supp",
        sub: "Valider, suivre et exporter les heures supplémentaires.",
        accent: THEME.blue,
      },
    ],
    []
  );

  if (checking) return <main style={pageStyle}>Chargement…</main>;
  if (!session) return null;

  if (!isAdmin) {
    return (
      <main style={pageStyle}>
        <div style={containerStyle}>
          <div style={topStyle}>
            <div style={brandStyle}>
              <img src="/gaillard-logo.png" alt="Gaillard Jean-Paul SA" style={{ ...logoStyle, width: isMobile ? 120 : 220 }} />
              <div>
                <h1 style={{ ...titleStyle, fontSize: isMobile ? 28 : 34 }}>Admin</h1>
                <div style={subStyle}>Accès admin uniquement.</div>
              </div>
            </div>
            <button onClick={signOut} style={btnGhostStyle}>Se déconnecter</button>
          </div>

          {msg && <div style={messageStyle}>{msg}</div>}
          <div style={{ marginTop: 14 }}>
            <a href="/employee" style={linkStyle}>⬅ Retour espace employé</a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <div style={{ ...containerStyle, padding: isMobile ? 14 : 22 }}>
        <div
          style={{
            ...topStyle,
            flexDirection: isMobile ? "column" : "row",
            alignItems: isMobile ? "stretch" : "center",
          }}
        >
          <div style={brandStyle}>
            <img src="/gaillard-logo.png" alt="Gaillard Jean-Paul SA" style={{ ...logoStyle, width: isMobile ? 120 : 220 }} />
            <div>
              <h1 style={{ ...titleStyle, fontSize: isMobile ? 28 : 34 }}>Admin</h1>
              <div style={subStyle}>Tableau de bord premium</div>
              <div style={tinySubStyle}>Navigation plus claire, cartes plus propres et meilleur affichage mobile.</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a href="/employee" style={ghostLinkStyle}>👤 Espace employé</a>
            <button onClick={signOut} style={btnGhostStyle}>Se déconnecter</button>
          </div>
        </div>

        {msg && <div style={messageStyle}>{msg}</div>}

        <div style={{ ...heroGridStyle, gridTemplateColumns: isMobile ? "1fr" : "1.2fr 0.8fr" }}>
          <div style={heroCardStyle}>
            <div style={eyebrowStyle}>Pilotage</div>
            <div style={{ fontSize: isMobile ? 22 : 30, fontWeight: 900, lineHeight: 1.08 }}>
              Bienvenue {profile?.full_name || "admin"}
            </div>
            <div style={{ color: THEME.sub, marginTop: 8, fontWeight: 700 }}>
              Accède rapidement aux contrôles mensuels, aux exports, aux employés et aux chantiers depuis un seul écran.
            </div>
          </div>

          <div style={heroCardStyle}>
            <div style={eyebrowStyle}>Accès rapides</div>
            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              <a href="/admin/review" style={miniActionStyle}>✅ Contrôler et valider un mois</a>
              <a href="/admin/bordereaux" style={miniActionStyle}>📄 Ouvrir les exports</a>
              <a href="/admin/employees" style={miniActionStyle}>👥 Gérer les employés</a>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <div style={sectionHeadStyle}>
            <div>
              <div style={eyebrowStyle}>Modules</div>
              <h2 style={{ margin: "4px 0 0", fontSize: isMobile ? 22 : 26 }}>Outils d’administration</h2>
            </div>
            <div style={{ color: THEME.sub, fontWeight: 800 }}>Version allégée et plus propre sur téléphone.</div>
          </div>

          <div style={{ ...gridStyle, gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(250px, 1fr))" }}>
            {cards.map((card) => (
              <a key={card.href} href={card.href} style={tileStyle(card.accent)}>
                <div style={tileTitleStyle}>{card.title}</div>
                <div style={tileSubStyle}>{card.sub}</div>
                <div style={{ marginTop: 12, color: card.accent, fontWeight: 900 }}>Ouvrir →</div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(180deg, #081121 0%, #0b1220 100%)",
  color: THEME.text,
  padding: 14,
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
};

const containerStyle: CSSProperties = {
  maxWidth: 1180,
  margin: "0 auto",
  background: THEME.surface,
  border: `1px solid ${THEME.border}`,
  borderRadius: 24,
  boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
};

const topStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  paddingBottom: 10,
};

const brandStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  flexWrap: "wrap",
};

const logoStyle: CSSProperties = {
  height: "auto",
  display: "block",
  borderRadius: 18,
  border: `1px solid ${THEME.border}`,
  boxShadow: "0 14px 36px rgba(0,0,0,0.28)",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontWeight: 900,
  letterSpacing: -0.6,
};

const subStyle: CSSProperties = {
  marginTop: 6,
  color: THEME.sub,
  fontWeight: 800,
};

const tinySubStyle: CSSProperties = {
  marginTop: 6,
  color: THEME.sub,
  fontWeight: 700,
};

const heroGridStyle: CSSProperties = {
  display: "grid",
  gap: 16,
  marginTop: 12,
};

const heroCardStyle: CSSProperties = {
  background: "linear-gradient(180deg, rgba(17,28,51,0.98) 0%, rgba(14,25,48,0.98) 100%)",
  border: `1px solid ${THEME.border}`,
  borderRadius: 20,
  padding: 16,
};

const eyebrowStyle: CSSProperties = {
  color: THEME.sub,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: 1.1,
  fontSize: 12,
};

const sectionHeadStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap",
};

const gridStyle: CSSProperties = {
  display: "grid",
  gap: 12,
  marginTop: 14,
};

const tileStyle = (accent: string): CSSProperties => ({
  display: "block",
  background: THEME.card,
  border: `1px solid ${THEME.border}`,
  borderLeft: `4px solid ${accent}`,
  borderRadius: 18,
  padding: 16,
  textDecoration: "none",
  color: THEME.text,
  boxShadow: "0 10px 24px rgba(0,0,0,0.18)",
});

const tileTitleStyle: CSSProperties = {
  fontWeight: 900,
  fontSize: 18,
};

const tileSubStyle: CSSProperties = {
  marginTop: 8,
  color: THEME.sub,
  fontWeight: 700,
};

const miniActionStyle: CSSProperties = {
  display: "block",
  textDecoration: "none",
  color: THEME.text,
  background: "rgba(255,255,255,0.03)",
  border: `1px solid ${THEME.border}`,
  borderRadius: 14,
  padding: "12px 14px",
  fontWeight: 900,
};

const btnGhostStyle: CSSProperties = {
  padding: "12px 14px",
  fontWeight: 900,
  borderRadius: 14,
  border: `1px solid ${THEME.border}`,
  background: THEME.card2,
  color: THEME.text,
  cursor: "pointer",
};

const ghostLinkStyle: CSSProperties = {
  ...btnGhostStyle,
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
};

const messageStyle: CSSProperties = {
  marginTop: 14,
  padding: "12px 14px",
  borderRadius: 14,
  border: `1px solid ${THEME.border}`,
  background: THEME.card2,
  fontWeight: 800,
  whiteSpace: "pre-wrap",
};

const linkStyle: CSSProperties = {
  color: THEME.sub,
  fontWeight: 900,
  textDecoration: "none",
};
