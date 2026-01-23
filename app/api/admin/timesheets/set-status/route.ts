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
  return { ok: true as const, adminId: userData.user.id };
}

function isMonth(s: string) {
  return /^\d{4}-\d{2}$/.test(s);
}

export async function POST(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

    const au = await requireAdmin(token);
    if (!au.ok) return NextResponse.json({ error: au.reason }, { status: au.status });

    const body = await req.json().catch(() => null);
    const user_id = String(body?.user_id ?? "");
    const month = String(body?.month ?? "");
    const status = String(body?.status ?? "");

    if (!user_id) return NextResponse.json({ error: "user_id manquant" }, { status: 400 });
    if (!isMonth(month)) return NextResponse.json({ error: "month invalide (YYYY-MM)" }, { status: 400 });
    if (status !== "approved" && status !== "pending") return NextResponse.json({ error: "status invalide" }, { status: 400 });

    const payload: any = {
      user_id,
      month,
      status,
      note: null,
    };

    if (status === "approved") {
      payload.approved_by = au.adminId;
      payload.approved_at = new Date().toISOString();
    } else {
      payload.approved_by = null;
      payload.approved_at = null;
    }

    const { error } = await supabaseAdmin
      .from("timesheet_months")
      .upsert(payload, { onConflict: "user_id,month" });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}
