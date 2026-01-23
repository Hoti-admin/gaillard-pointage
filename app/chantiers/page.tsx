"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Site = {
  id: string;
  name: string;
  is_active: boolean;
};

export default function ChantiersPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadSites() {
    const { data } = await supabase
      .from("sites")
      .select("id, name, is_active")
      .order("created_at", { ascending: false });

    setSites(data || []);
  }

  async function addSite() {
    if (!name.trim()) return;
    setLoading(true);

    await supabase.from("sites").insert({ name });

    setName("");
    setLoading(false);
    loadSites();
  }

  async function toggleSite(id: string, is_active: boolean) {
    await supabase.from("sites").update({ is_active: !is_active }).eq("id", id);
    loadSites();
  }

  useEffect(() => {
    loadSites();
  }, []);

  return (
    <main style={{ maxWidth: 600, margin: "40px auto", padding: 16 }}>
      <h1>Chantiers</h1>
      <p>Gestion des chantiers (admin)</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          placeholder="Nom du chantier"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ flex: 1, padding: 10 }}
        />
        <button onClick={addSite} disabled={loading} style={{ padding: "10px 14px" }}>
          Ajouter
        </button>
      </div>

      <ul style={{ listStyle: "none", padding: 0 }}>
        {sites.map((s) => (
          <li
            key={s.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 12px",
              marginBottom: 8,
              border: "1px solid #ddd",
              opacity: s.is_active ? 1 : 0.4,
            }}
          >
            <span>{s.name}</span>
            <button onClick={() => toggleSite(s.id, s.is_active)}>
              {s.is_active ? "Désactiver" : "Activer"}
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
