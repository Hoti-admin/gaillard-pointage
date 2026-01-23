import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

async function requireAdmin(accessToken: string) {
  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(accessToken);
  if (userErr || !userData.user) return { ok: false as const, status: 401, reason: "UNAUTHORIZED" };

  const { data: prof, error: pErr } = await supabaseAdmin
    .from("profiles")
    .select("role,is_active")
    .eq("user_id", userData.user.id)
    .single();

  if (pErr || !prof?.is_active || String(prof.role) !== "admin") {
    return { ok: false as const, status: 403, reason: "FORBIDDEN" };
  }
  return { ok: true as const };
}

export async function POST(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

    const au = await requireAdmin(token);
    if (!au.ok) return NextResponse.json({ error: au.reason }, { status: au.status });

    const body = await req.json().catch(() => null);
    const user_id = String(body?.user_id ?? "").trim();
    const is_active = Boolean(body?.is_active);

    if (!user_id) return NextResponse.json({ error: "user_id manquant" }, { status: 400 });

    // 🔎 profil cible
    const { data: targetProf, error: tErr } = await supabaseAdmin
      .from("profiles")
      .select("role,is_active")
      .eq("user_id", user_id)
      .maybeSingle();

    if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });
    if (!targetProf) return NextResponse.json({ error: "Employé introuvable" }, { status: 404 });

    const targetRole = String((targetProf as any)?.role ?? "");
    const targetActive = Boolean((targetProf as any)?.is_active ?? false);

    // ✅ Sécurité: impossible de désactiver le dernier admin actif
    if (targetRole === "admin" && targetActive === true && is_active === false) {
      const { count, error: cErr } = await supabaseAdmin
        .from("profiles")
        .select("user_id", { count: "exact", head: true })
        .eq("role", "admin")
        .eq("is_active", true);

      if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });

      const adminsActifs = Number(count ?? 0);
      if (adminsActifs <= 1) {
        return NextResponse.json({ error: "Impossible de désactiver le dernier admin actif." }, { status: 400 });
      }
    }

    // ✅ update
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ is_active })
      .eq("user_id", user_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err), stack: err?.stack ?? null }, { status: 500 });
  }
}
