"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Site = {
  id: string;
  name: string;
  address: string | null;
  is_active: boolean;
  created_at?: string;
};

type Profile = { role: string; is_active: boolean };

const THEME = {
  bg: "#0b1220",
  surface: "#0f172a",
  card: "#111c33",
  card2: "#0e1930",
  border: "#24324f",
  text: "#e5e7eb",
  sub: "#a8b3cf",
  muted: "#8b97b6",
  red: "#b40000",
  red2: "#d11a1a",
  green: "#22c55e",
  amber: "#f59e0b",
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
    maxWidth: 980,
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
  card2: {
    background: THEME.card2,
    border: `1px solid ${THEME.border}`,
    borderRadius: 16,
    padding: 14,
  } as React.CSSProperties,
  row: { display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" } as React.CSSProperties,
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
  btnDanger: {
    padding: "12px 14px",
    fontWeight: 900,
    borderRadius: 14,
    border: `1px solid ${THEME.red2}`,
    background: "transparent",
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
  sep: { height: 1, background: THEME.border, margin: "14px 0" } as React.CSSProperties,
  badge: (color: string) =>
    ({
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "6px 12px",
      borderRadius: 999,
      border: `1px solid ${THEME.border}`,
      background: THEME.card2,
      fontWeight: 900,
      color: THEME.text,
    } as React.CSSProperties),
  dot: (color: string) =>
    ({
      width: 10,
      height: 10,
      borderRadius: 999,
      background: color,
      boxShadow: "0 0 0 4px rgba(255,255,255,0.03)",
    } as React.CSSProperties),
  msg: {
    marginTop: 12,
    padding: "10px 12px",
    borderRadius: 12,
    border: `1px solid ${THEME.border}`,
    background: THEME.card2,
    color: THEME.text,
    fontWeight: 800,
  } as React.CSSProperties,
  link: { color: THEME.sub, fontWeight: 900, textDecoration: "none" } as React.CSSProperties,
};

export default function SitesPage() {
  const [checking, setChecking] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [sites, setSites] = useState<Site[]>([]);
  const [filter, setFilter] = useState("");
  const [showInactive, setShowInactive] = useState(true);

  // add form
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");

  // edit form
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");

  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // session
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecking(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // check admin + load
  useEffect(() => {
    if (!session?.user?.id) return;

    (async () => {
      setMsg("");
      const { data: prof, error } = await supabase
        .from("profiles")
        .select("role,is_active")
        .eq("user_id", session.user.id)
        .single();

      if (error || !prof?.is_active || prof.role !== "admin") {
        setIsAdmin(false);
        return;
      }
      setIsAdmin(true);
      await loadSites();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  async function loadSites() {
    setMsg("");
    setLoading(true);

    const { data, error } = await supabase
      .from("sites")
      .select("id,name,address,is_active,created_at")
      .order("created_at", { ascending: false });

    setLoading(false);

    if (error) {
      setMsg("Erreur chargement: " + error.message);
      return;
    }
    setSites((data ?? []) as any);
  }

  async function addSite() {
    if (!name.trim()) {
      setMsg("⚠️ Mets un nom de chantier.");
      return;
    }

    setLoading(true);
    setMsg("");

    const { error } = await supabase.from("sites").insert({
      name: name.trim(),
      address: address.trim() || null,
      is_active: true,
    });

    setLoading(false);

    if (error) {
      setMsg("Erreur ajout: " + error.message);
      return;
    }

    setName("");
    setAddress("");
    setMsg("✅ Chantier ajouté.");
    await loadSites();
  }

  function startEdit(s: Site) {
    setEditingId(s.id);
    setEditName(s.name ?? "");
    setEditAddress(s.address ?? "");
    setMsg("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditAddress("");
  }

  async function saveEdit(siteId: string) {
    if (!editName.trim()) {
      setMsg("⚠️ Le nom est obligatoire.");
      return;
    }

    setLoading(true);
    setMsg("");

    const { error } = await supabase
      .from("sites")
      .update({
        name: editName.trim(),
        address: editAddress.trim() || null,
      })
      .eq("id", siteId);

    setLoading(false);

    if (error) {
      setMsg("Erreur modification: " + error.message);
      return;
    }

    setMsg("✅ Chantier modifié.");
    setEditingId(null);
    await loadSites();
  }

  async function toggleActive(site: Site) {
    setLoading(true);
    setMsg("");

    const { error } = await supabase
      .from("sites")
      .update({ is_active: !site.is_active })
      .eq("id", site.id);

    setLoading(false);

    if (error) {
      setMsg("Erreur: " + error.message);
      return;
    }
    await loadSites();
  }

  // ✅ suppression sécurisée :
  // - si chantier déjà utilisé dans daily_site_logs ou daily_status => on désactive à la place
  // - sinon => delete définitif
  async function deleteSite(site: Site) {
    const ok = window.confirm(
      `Supprimer le chantier "${site.name}" ?\n\nSi ce chantier a déjà été utilisé dans des pointages, il sera désactivé (pour ne pas casser les exports).`
    );
    if (!ok) return;

    setLoading(true);
    setMsg("");

    // check references logs
    const { count: cLogs, error: eLogs } = await supabase
      .from("daily_site_logs")
      .select("work_date", { count: "exact", head: true })
      .eq("site_id", site.id);

    if (eLogs) {
      setLoading(false);
      setMsg("Erreur vérification logs: " + eLogs.message);
      return;
    }

    // check references status
    const { count: cStatus, error: eStatus } = await supabase
      .from("daily_status")
      .select("work_date", { count: "exact", head: true })
      .eq("site_id", site.id);

    if (eStatus) {
      setLoading(false);
      setMsg("Erreur vérification status: " + eStatus.message);
      return;
    }

    const used = (cLogs ?? 0) > 0 || (cStatus ?? 0) > 0;

    if (used) {
      // soft delete => désactiver
      const { error } = await supabase.from("sites").update({ is_active: false }).eq("id", site.id);
      setLoading(false);

      if (error) {
        setMsg("Erreur désactivation: " + error.message);
        return;
      }
      setMsg("✅ Chantier désactivé (utilisé dans des pointages).");
      await loadSites();
      return;
    }

    // delete définitif
    const { error } = await supabase.from("sites").delete().eq("id", site.id);
    setLoading(false);

    if (error) {
      setMsg("Erreur suppression: " + error.message);
      return;
    }

    setMsg("✅ Chantier supprimé.");
    await loadSites();
  }

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return sites.filter((s) => {
      if (!showInactive && !s.is_active) return false;
      if (!q) return true;
      const hay = `${s.name ?? ""} ${s.address ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [sites, filter, showInactive]);

  if (checking) return <main style={S.page}>Chargement...</main>;
  if (!session) {
    window.location.href = "/";
    return null;
  }

  if (!isAdmin) {
    return (
      <main style={S.page}>
        <div style={S.container}>
          <h1 style={S.h1}>Chantiers</h1>
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
            <h1 style={S.h1}>Chantiers</h1>
            <p style={S.sub}>Admin — Ajouter / modifier / désactiver / supprimer</p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <a href="/admin" style={S.link}>⬅ Retour admin</a>
            <button onClick={loadSites} style={S.btnGhost} disabled={loading}>
              🔄 Recharger
            </button>
          </div>
        </div>

        {/* AJOUT */}
        <div style={{ ...S.card, marginTop: 14 }}>
          <h3 style={{ marginTop: 0, fontSize: 16, fontWeight: 900 }}>Ajouter un chantier</h3>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={S.label}>Nom chantier *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Taconnets 10 – Givisiez"
                style={S.input}
              />
            </div>
            <div>
              <label style={S.label}>Adresse (optionnel)</label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ex: Route ... 1700 Fribourg"
                style={S.input}
              />
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <button onClick={addSite} disabled={loading} style={S.btnPrimary}>
              {loading ? "Ajout..." : "✅ Ajouter"}
            </button>
          </div>

          {msg && <div style={S.msg}>{msg}</div>}
        </div>

        {/* LISTE */}
        <div style={{ ...S.card, marginTop: 14 }}>
          <div style={S.row}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>Liste des chantiers</h3>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Rechercher..."
                style={{ ...S.input, width: 260 }}
              />
              <button
                onClick={() => setShowInactive((v) => !v)}
                style={S.btnGhost}
              >
                {showInactive ? "Masquer inactifs" : "Afficher inactifs"}
              </button>
            </div>
          </div>

          <div style={S.sep} />

          <div style={{ display: "grid", gap: 10 }}>
            {filtered.map((s) => {
              const editing = editingId === s.id;
              const badgeColor = s.is_active ? THEME.green : THEME.amber;

              return (
                <div key={s.id} style={S.card2}>
                  {!editing ? (
                    <>
                      <div style={S.row}>
                        <div>
                          <div style={{ fontWeight: 900, fontSize: 16 }}>{s.name}</div>
                          {s.address && <div style={{ color: THEME.sub, marginTop: 4 }}>{s.address}</div>}
                          <div style={{ marginTop: 10 }}>
                            <span style={S.badge(badgeColor)}>
                              <span style={S.dot(badgeColor)} />
                              {s.is_active ? "ACTIF" : "INACTIF"}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
                          <button onClick={() => startEdit(s)} style={S.btnGhost}>
                            ✏️ Modifier
                          </button>
                          <button onClick={() => toggleActive(s)} style={S.btnOk} disabled={loading}>
                            {s.is_active ? "Désactiver" : "Activer"}
                          </button>
                          <button onClick={() => deleteSite(s)} style={S.btnDanger} disabled={loading}>
                            🗑️ Supprimer
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={S.row}>
                        <div style={{ flex: 1, minWidth: 260 }}>
                          <label style={S.label}>Nom</label>
                          <input value={editName} onChange={(e) => setEditName(e.target.value)} style={S.input} />
                        </div>
                        <div style={{ flex: 1, minWidth: 260 }}>
                          <label style={S.label}>Adresse</label>
                          <input value={editAddress} onChange={(e) => setEditAddress(e.target.value)} style={S.input} />
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                        <button onClick={() => saveEdit(s.id)} style={S.btnPrimary} disabled={loading}>
                          ✅ Enregistrer
                        </button>
                        <button onClick={cancelEdit} style={S.btnGhost} disabled={loading}>
                          Annuler
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}

            {filtered.length === 0 && <p style={{ color: THEME.sub, margin: 0 }}>Aucun chantier.</p>}
          </div>
        </div>
      </div>
    </main>
  );
}
