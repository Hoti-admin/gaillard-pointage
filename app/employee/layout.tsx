"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

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

  if (!ok) return <p style={{ padding: 16, fontFamily: "system-ui" }}>Chargement…</p>;
  return <>{children}</>;
}
