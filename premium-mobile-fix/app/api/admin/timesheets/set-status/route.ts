import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

async function requireAdmin(accessToken: string) {
  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(accessToken);
  if (userErr || !userData.user) return { ok: false as const, reason: "UNAUTHORIZED" };

  const { data: prof, error: profErr } = await supabaseAdmin
    .from("profiles")
    .select("role,is_active")
    .eq("user_id", userData.user.id)
    .single();

  if (profErr || !prof?.is_active || prof.role !== "admin") {
    return { ok: false as const, reason: "FORBIDDEN" };
  }

  return { ok: true as const, adminId: userData.user.id };
}

function normalizeMonth(month: string) {
  const m = String(month ?? "").match(/^(\d{4})-(\d{1,2})$/);
  if (!m) return "";
  return `${m[1]}-${String(parseInt(m[2], 10)).padStart(2, "0")}`;
}

export async function POST(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const adminCheck = await requireAdmin(token);
    if (!adminCheck.ok) {
      return NextResponse.json({ error: adminCheck.reason }, { status: adminCheck.reason === "UNAUTHORIZED" ? 401 : 403 });
    }

    const body = await req.json().catch(() => ({}));
    const user_id = String(body?.user_id ?? "");
    const month = normalizeMonth(String(body?.month ?? ""));
    const status = String(body?.status ?? "").toLowerCase() === "approved" ? "approved" : "pending";

    if (!user_id || !month) {
      return NextResponse.json({ error: "user_id et month sont requis" }, { status: 400 });
    }

    const payload = {
      user_id,
      month,
      status,
      approved_at: status === "approved" ? new Date().toISOString() : null,
      approved_by: status === "approved" ? adminCheck.adminId : null,
    };

    const { data, error } = await supabaseAdmin
      .from("timesheet_months")
      .upsert(payload, { onConflict: "user_id,month" })
      .select("user_id,month,status,approved_at,approved_by")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, row: data, month_status: data.status });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}
