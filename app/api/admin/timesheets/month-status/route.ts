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
    .maybeSingle();

  if (profErr) return { ok: false as const, reason: profErr.message };
  if (!prof?.is_active || prof.role !== "admin") return { ok: false as const, reason: "FORBIDDEN" };

  return { ok: true as const };
}

export async function GET(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

    const admin = await requireAdmin(token);
    if (!admin.ok) {
      const status = admin.reason === "UNAUTHORIZED" ? 401 : admin.reason === "FORBIDDEN" ? 403 : 500;
      return NextResponse.json({ error: admin.reason }, { status });
    }

    const { searchParams } = new URL(req.url);
    const year = String(searchParams.get("year") ?? "").trim();
    const user_id = String(searchParams.get("user_id") ?? "all").trim() || "all";

    if (!/^\d{4}$/.test(year)) {
      return NextResponse.json({ error: "year requis (YYYY)" }, { status: 400 });
    }

    let query = supabaseAdmin
      .from("timesheet_months")
      .select("user_id,month,status,approved_at")
      .gte("month", `${year}-01`)
      .lte("month", `${year}-12`)
      .order("month", { ascending: true })
      .order("user_id", { ascending: true });

    if (user_id !== "all") {
      query = query.eq("user_id", user_id);
    }

    const { data, error } = await query;
    if (error) {
      console.error("admin month-status error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      rows: (data ?? []).map((row: any) => ({
        user_id: String(row.user_id),
        month: String(row.month).slice(0, 7),
        status: String(row.status) === "approved" ? "approved" : "pending",
        approved_at: row.approved_at ?? null,
      })),
    });
  } catch (err: any) {
    console.error("admin month-status unexpected error:", err);
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}
