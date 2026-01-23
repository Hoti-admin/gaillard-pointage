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
    const email = String(body?.email ?? "").trim().toLowerCase();
    const redirectTo = String(body?.redirectTo ?? "").trim();

    if (!email) return NextResponse.json({ error: "email manquant" }, { status: 400 });

    // 1) tenter d'envoyer un email (si SMTP configuré dans Supabase)
    try {
      // @ts-ignore
      const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
        redirectTo: redirectTo || undefined,
      });
      if (!error) return NextResponse.json({ ok: true, sent: true });
    } catch {
      // ignore, on fera un lien
    }

    // 2) fallback: générer un lien à copier (l’admin peut l’envoyer)
    const { data, error: glErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: redirectTo ? { redirectTo } : undefined,
    });

    if (glErr) return NextResponse.json({ error: glErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, sent: false, action_link: data?.properties?.action_link ?? null });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err), stack: err?.stack ?? null }, { status: 500 });
  }
}
