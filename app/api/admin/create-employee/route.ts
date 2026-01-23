import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function isEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function genTempPassword() {
  const year = new Date().getFullYear(); // 2026
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase(); // 4 chars
  return `Gaillard-${year}@${suffix}`; // ex: Gaillard-2026@A1B2
}

async function requireAdmin(accessToken: string) {
  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(accessToken);
  if (userErr || !userData.user) return { ok: false as const, reason: "UNAUTHORIZED" };

  const userId = userData.user.id;

  const { data: prof, error: profErr } = await supabaseAdmin
    .from("profiles")
    .select("role,is_active")
    .eq("user_id", userId)
    .single();

  if (profErr || !prof) return { ok: false as const, reason: "NO_PROFILE" };
  if (!prof.is_active) return { ok: false as const, reason: "INACTIVE" };
  if (prof.role !== "admin") return { ok: false as const, reason: "FORBIDDEN" };

  return { ok: true as const, userId };
}

export async function POST(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

    const admin = await requireAdmin(token);
    if (!admin.ok) return NextResponse.json({ error: admin.reason }, { status: 403 });

    const body = await req.json();

    const email = String(body?.email ?? "").trim().toLowerCase();
    const full_name = String(body?.full_name ?? "").trim();
    const role = (String(body?.role ?? "employee") as "employee" | "admin");

    // password optionnel : si vide -> généré
    const givenPassword = String(body?.password ?? "").trim();
    const password = givenPassword.length >= 8 ? givenPassword : genTempPassword();

    if (!isEmail(email)) return NextResponse.json({ error: "Email invalide" }, { status: 400 });
    if (!full_name) return NextResponse.json({ error: "Nom obligatoire" }, { status: 400 });
    if (password.length < 8) return NextResponse.json({ error: "Mot de passe min. 8 caractères" }, { status: 400 });

    // 1) créer user auth
    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // ✅ pas besoin de confirmer email
    });

    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
    const newUserId = created.user?.id;
    if (!newUserId) return NextResponse.json({ error: "User id manquant" }, { status: 500 });

    // 2) créer profile (avec must_change_password=true)
    const { error: pErr } = await supabaseAdmin.from("profiles").upsert(
      {
        user_id: newUserId,
        email,
        full_name,
        role,
        is_active: true,
        must_change_password: true,
      },
      { onConflict: "user_id" }
    );

    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

    // ✅ on renvoie le mdp temporaire à l’admin (pour le communiquer)
    return NextResponse.json({ ok: true, user_id: newUserId, email, full_name, role, temp_password: password });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err), stack: err?.stack ?? null }, { status: 500 });
  }
}
