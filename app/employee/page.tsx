"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { supabase } from "@/lib/supabaseClient";

type Profile = { role: string; is_active: boolean; full_name: string | null };
type TimesheetStatus = "pending" | "approved";
type MonthRow = { month: string; status: TimesheetStatus };

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

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function monthLabelFR(ym: string) {
  const [y, m] = ym.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("fr-CH", { month: "long", year: "numeric" });
}

function normalizeStatus(value: unknown): TimesheetStatus {
  return value === "approved" ? "approved" : "pending";
}

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

export default function EmployeeMenuPage() {
  const isMobile = useIsMobile();
  const now = new Date();
  const currentYm = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;

  const [checking, setChecking] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [msg, setMsg] = useState("");
  const [rows, setRows] = useState<MonthRow[]>([]);

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
      const { data } = await supabase
        .from("profiles")
        .select("role,is_active,full_name")
        .eq("user_id", session.user.id)
        .single();
      setProfile((data as Profile) ?? null);
    })();
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.access_token) return;
    (async () => {
      try {
        setLoadingStats(true);
        setMsg("");

        const res = await fetch(
          `/api/employee/timesheets/month-status?year=${now.getFullYear()}`,
          {
            headers: { Authorization: `Bearer ${session.access_token}` },
            cache: "no-store",
          }
        );

        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          setMsg("Erreur chargement dashboard : " + (j?.error || res.statusText));
          return;
        }

        const j = await res.json();
        const rawRows = Array.isArray(j?.rows) ? j.rows : [];
        const nextRows: MonthRow[] = rawRows
          .map((r: any): MonthRow => ({
            month: String(r?.month ?? "").slice(0, 7),
            status: normalizeStatus(r?.status),
          }))
          .filter((r: MonthRow) => /^\d{4}-\d{2}$/.test(r.month));

        setRows(nextRows);
      } catch (error) {
        console.error(error);
        setMsg("Erreur inattendue lors du chargement du dashboard.");
      } finally {
        setLoadingStats(false);
      }
    })();
  }, [session?.access_token, now]);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  const role = profile?.role ?? "employee";
  const name = profile?.full_name ?? "";
  const email = session?.user?.email ?? "";

  const approvedRows = useMemo(
    () => rows.filter((r) => r.status === "approved").sort((a, b) => b.month.localeCompare(a.month)),
    [rows]
  );

  const currentMonthStatus = useMemo<TimesheetStatus>(
    () => rows.find((r) => r.month === currentYm)?.status ?? "pending",
    [rows, currentYm]
  );

  const currentYearApprovedCount = useMemo(
    () => approvedRows.filter((r) => r.month.startsWith(`${now.getFullYear()}-`)).length,
    [approvedRows, now]
  );

  const lastApprovedMonth = approvedRows[0]?.month ?? null;

  const cards = [
    {
      title: "📍 Aujourd’hui",
      sub: "Pointage rapide + férié",
      href: "/employee/today",
      accent: THEME.blue,
    },
    {
      title: "🧾 Pointage journée",
      sub: "Choisir date + chantier avec heures pré-remplies",
      href: "/employee/day",
      accent: THEME.red,
    },
    {
      title: "🗓️ Mon mois",
      sub: "Saisie, modifications et absences",
      href: "/employee/month",
      accent: THEME.amber,
    },
    {
      title: "📄 Mes bordereaux",
      sub: "Historique validé PDF / Excel",
      href: "/employee/bordereaux",
      accent: THEME.green,
    },
    {
      title: "⏱️ Heures supp",
      sub: "Saisie et demandes d’heures supplémentaires",
      href: "/employee/overtime",
      accent: THEME.blue,
    },
  ];

  if (checking) return <main style={pageStyle}>Chargement…</main>;
  if (!session) {
    window.location.href = "/";
    return null;
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
            <img
              src="/gaillard-logo.png"
              alt="Gaillard Jean-Paul SA"
              style={{ ...logoStyle, width: isMobile ? 120 : 220 }}
            />
            <div>
              <h1 style={{ ...titleStyle, fontSize: isMobile ? 28 : 34 }}>Espace employé</h1>
              <p style={subStyle}>
                Connecté : <b>{email}</b>
                {name ? ` — ${name}` : ""} — (<b>{role}</b>)
              </p>
              <div style={tinySubStyle}>
                Version premium : accès rapide, bordereaux validés et navigation plus propre sur mobile.
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {role === "admin" && (
              <a href="/admin" style={ghostLinkStyle}>
                🛠️ Admin
              </a>
            )}
            <button onClick={signOut} style={btnGhostStyle}>
              Se déconnecter
            </button>
          </div>
        </div>

        <div
          style={{
            ...heroGridStyle,
            gridTemplateColumns: isMobile ? "1fr" : "1.2fr 0.8fr",
          }}
        >
          <div style={heroCardStyle}>
            <div style={eyebrowStyle}>Dashboard</div>
            <div style={{ fontSize: isMobile ? 22 : 30, fontWeight: 900, lineHeight: 1.08 }}>
              Bonjour {name || ""}
            </div>
            <div style={{ color: THEME.sub, marginTop: 8, fontWeight: 700 }}>
              Retrouve ici ton pointage, tes bordereaux validés et les accès rapides les plus utiles.
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
              <span style={pillStyle(currentMonthStatus === "approved" ? THEME.green : THEME.amber)}>
                {currentMonthStatus === "approved" ? "● Mois actuel validé" : "● Mois actuel en attente"}
              </span>
              <span style={pillStyle(THEME.blue)}>{currentYearApprovedCount} bordereau(x) validé(s) en {now.getFullYear()}</span>
            </div>
          </div>

          <div style={heroCardStyle}>
            <div style={eyebrowStyle}>Résumé rapide</div>
            <div style={statsGridStyle}>
              <div style={statCardStyle}>
                <div style={statLabelStyle}>Statut du mois</div>
                <div style={{ ...statValueStyle, color: currentMonthStatus === "approved" ? THEME.green : THEME.amber }}>
                  {currentMonthStatus === "approved" ? "Validé" : "En attente"}
                </div>
              </div>

              <div style={statCardStyle}>
                <div style={statLabelStyle}>Dernier bordereau</div>
                <div style={statValueStyle}>{lastApprovedMonth ? monthLabelFR(lastApprovedMonth) : "Aucun"}</div>
              </div>

              <div style={statCardStyle}>
                <div style={statLabelStyle}>Mois actuel</div>
                <div style={statValueStyle}>{monthLabelFR(currentYm)}</div>
              </div>

              <div style={statCardStyle}>
                <div style={statLabelStyle}>Chargement</div>
                <div style={statValueStyle}>{loadingStats ? "En cours" : "Prêt"}</div>
              </div>
            </div>
          </div>
        </div>

        {msg && <div style={messageStyle}>{msg}</div>}

        <div style={{ marginTop: 18 }}>
          <div style={sectionHeadStyle}>
            <div>
              <div style={eyebrowStyle}>Accès rapides</div>
              <h2 style={{ margin: "4px 0 0", fontSize: isMobile ? 22 : 26 }}>Menu principal</h2>
            </div>
            <div style={{ color: THEME.sub, fontWeight: 800 }}>Optimisé téléphone : grosses cartes, lecture simple, clic rapide.</div>
          </div>

          <div style={{ ...tilesGridStyle, gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(240px, 1fr))" }}>
            {cards.map((card) => (
              <a key={card.href} href={card.href} style={tileStyle(card.accent)}>
                <div style={tileTitleStyle}>{card.title}</div>
                <div style={tileSubStyle}>{card.sub}</div>
                <div style={{ marginTop: 12, color: card.accent, fontWeight: 900 }}>Ouvrir →</div>
              </a>
            ))}
          </div>
        </div>

        <div style={{ ...bottomGridStyle, gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr" }}>
          <a href="/employee/bordereaux" style={featureCardStyle}>
            <div style={eyebrowStyle}>Bordereaux</div>
            <div style={{ fontWeight: 900, fontSize: 20 }}>Derniers documents validés</div>
            <div style={featureSubStyle}>
              {lastApprovedMonth
                ? `Dernier mois validé : ${monthLabelFR(lastApprovedMonth)}`
                : "Aucun bordereau validé pour le moment."}
            </div>
          </a>

          <a href="/employee/month" style={featureCardStyle}>
            <div style={eyebrowStyle}>Suivi mensuel</div>
            <div style={{ fontWeight: 900, fontSize: 20 }}>Accès direct au mois en cours</div>
            <div style={featureSubStyle}>Ouvre ton mois pour saisir, corriger ou contrôler rapidement tes journées.</div>
          </a>
        </div>

        <div style={{ marginTop: 16 }}>
          <a href="/" style={backLinkStyle}>⬅ Retour accueil</a>
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
  opacity: 0.95,
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

const statsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
  marginTop: 12,
};

const statCardStyle: CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: `1px solid ${THEME.border}`,
  borderRadius: 16,
  padding: 12,
};

const statLabelStyle: CSSProperties = {
  color: THEME.sub,
  fontWeight: 800,
  fontSize: 12,
};

const statValueStyle: CSSProperties = {
  marginTop: 6,
  fontWeight: 900,
  fontSize: 18,
  lineHeight: 1.15,
};

const sectionHeadStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap",
};

const tilesGridStyle: CSSProperties = {
  display: "grid",
  gap: 12,
  marginTop: 14,
};

const bottomGridStyle: CSSProperties = {
  display: "grid",
  gap: 12,
  marginTop: 18,
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

const featureCardStyle: CSSProperties = {
  display: "block",
  background: THEME.card,
  border: `1px solid ${THEME.border}`,
  borderRadius: 18,
  padding: 16,
  textDecoration: "none",
  color: THEME.text,
};

const featureSubStyle: CSSProperties = {
  marginTop: 8,
  color: THEME.sub,
  fontWeight: 700,
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

const backLinkStyle: CSSProperties = {
  color: THEME.sub,
  fontWeight: 900,
  textDecoration: "none",
};

const pillStyle = (color: string): CSSProperties => ({
  borderRadius: 999,
  border: `1px solid ${color}55`,
  background: `${color}16`,
  color,
  fontWeight: 900,
  padding: "8px 12px",
});
