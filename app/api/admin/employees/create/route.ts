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

function genPassword() {
  const year = new Date().getFullYear();
  const rnd = Math.floor(1000 + Math.random() * 9000);
  return `Gaillard-${year}@${rnd}`;
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
    const full_name = String(body?.full_name ?? "").trim();
    const role = String(body?.role ?? "employee");
    const password = String(body?.password ?? "").trim() || genPassword();

    if (!email) return NextResponse.json({ error: "Email manquant" }, { status: 400 });
    if (!full_name) return NextResponse.json({ error: "Nom complet manquant" }, { status: 400 });
    if (!["admin", "employee"].includes(role)) return NextResponse.json({ error: "Role invalide" }, { status: 400 });
    if (password.length < 8) return NextResponse.json({ error: "Mot de passe min 8 caractères" }, { status: 400 });

    // Create auth user
    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (cErr || !created?.user) {
      return NextResponse.json({ error: cErr?.message || "createUser failed" }, { status: 500 });
    }

    const uid = created.user.id;

    // Insert profile
    const { error: pErr } = await supabaseAdmin.from("profiles").insert({
      user_id: uid,
      email,
      full_name,
      role,
      is_active: true,
      must_change_password: true,
    });

    if (pErr) {
      // rollback user if profile insert fails
      await supabaseAdmin.auth.admin.deleteUser(uid).catch(() => {});
      return NextResponse.json({ error: pErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, user_id: uid, temp_password: password });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err), stack: err?.stack ?? null }, { status: 500 });
  }
}
