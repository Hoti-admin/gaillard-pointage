import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function genTempPassword() {
  const year = new Date().getFullYear();
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `Gaillard-${year}@${suffix}`;
}

async function requireAdmin(accessToken: string) {
  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(accessToken);
  if (userErr || !userData.user) return { ok: false as const, reason: "UNAUTHORIZED" };

  const { data: prof } = await supabaseAdmin
    .from("profiles")
    .select("role,is_active")
    .eq("user_id", userData.user.id)
    .single();

  if (!prof?.is_active || prof.role !== "admin") return { ok: false as const, reason: "FORBIDDEN" };
  return { ok: true as const };
}

export async function POST(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

    const admin = await requireAdmin(token);
    if (!admin.ok) return NextResponse.json({ error: admin.reason }, { status: 403 });

    const body = await req.json();
    const user_id = String(body?.user_id ?? "").trim();
    if (!user_id) return NextResponse.json({ error: "user_id manquant" }, { status: 400 });

    const temp = genTempPassword();

    // 1) reset password auth
    const { error: uErr } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
      password: temp,
    });
    if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });

    // 2) force change next login
    const { error: pErr } = await supabaseAdmin
      .from("profiles")
      .update({ must_change_password: true })
      .eq("user_id", user_id);

    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, user_id, temp_password: temp });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err), stack: err?.stack ?? null }, { status: 500 });
  }
}
