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

  if (pErr || !prof?.is_active || String(prof.role) !== "admin") return { ok: false as const, status: 403, reason: "FORBIDDEN" };
  return { ok: true as const };
}

export async function GET(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

    const au = await requireAdmin(token);
    if (!au.ok) return NextResponse.json({ error: au.reason }, { status: au.status });

    const { searchParams } = new URL(req.url);
    const year = String(searchParams.get("year") ?? "");
    const user_id = String(searchParams.get("user_id") ?? "");
    if (!/^\d{4}$/.test(year)) return NextResponse.json({ error: "year invalide" }, { status: 400 });
    if (!user_id) return NextResponse.json({ error: "user_id manquant" }, { status: 400 });

    const from = `${year}-01`;
    const to = `${year}-12`;

    const { data, error } = await supabaseAdmin
      .from("timesheet_months")
      .select("month,status")
      .eq("user_id", user_id)
      .gte("month", from)
      .lte("month", to);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ rows: data ?? [] });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}
