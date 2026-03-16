"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const THEME = {
  bg: "#0b1220",
  surface: "#0f172a",
  border: "#24324f",
  text: "#e5e7eb",
  sub: "#a8b3cf",
};

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    (async () => {
      setOk(false);

      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/");
        return;
      }

      const { data: prof, error } = await supabase
        .from("profiles")
        .select("is_active,must_change_password")
        .eq("user_id", data.session.user.id)
        .single();

      if (error || !prof?.is_active) {
        router.replace("/");
        return;
      }

      const onChangePage = pathname?.startsWith("/employee/change-password");
      if (prof.must_change_password && !onChangePage) {
        router.replace("/employee/change-password");
        return;
      }

      setOk(true);
    })();
  }, [pathname, router]);

  if (!ok) {
    return (
      <main style={pageStyle}>
        <div style={boxStyle}>
          <div style={titleStyle}>Chargement de l’espace employé…</div>
          <div style={subStyle}>Vérification de ta session et de tes accès.</div>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  padding: 20,
  background: "linear-gradient(180deg, #081121 0%, #0b1220 100%)",
  color: THEME.text,
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
};

const boxStyle: CSSProperties = {
  width: "100%",
  maxWidth: 460,
  background: THEME.surface,
  border: `1px solid ${THEME.border}`,
  borderRadius: 20,
  padding: 20,
  textAlign: "center",
  boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
};

const titleStyle: CSSProperties = {
  fontWeight: 900,
  fontSize: 22,
};

const subStyle: CSSProperties = {
  marginTop: 8,
  color: THEME.sub,
  fontWeight: 700,
};
