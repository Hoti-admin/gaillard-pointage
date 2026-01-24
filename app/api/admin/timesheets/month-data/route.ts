import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

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

function monthToRange(month: string) {
  const [yStr, mStr] = month.split("-");
  const y = parseInt(yStr, 10);
  const m0 = parseInt(mStr, 10) - 1;
  const lastDay = new Date(y, m0 + 1, 0).getDate();
  const firstDate = `${y}-${String(m0 + 1).padStart(2, "0")}-01`;
  const lastDate = `${y}-${String(m0 + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { firstDate, lastDate };
}

export async function GET(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

    const admin = await requireAdmin(token);
    if (!admin.ok) return NextResponse.json({ error: admin.reason }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month");
    const user_id = searchParams.get("user_id");

    if (!month || !user_id) return NextResponse.json({ error: "month + user_id requis" }, { status: 400 });

    const { firstDate, lastDate } = monthToRange(month);

    const { data: sites, error: sErr } = await supabaseAdmin.from("sites").select("id,name,is_active").order("name", { ascending: true });
    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

    const { data: stRows, error: stErr } = await supabaseAdmin
      .from("daily_status")
      .select("work_date,day_type,note,site_id,start_time,break_start,break_end,end_time")
      .eq("user_id", user_id)
      .gte("work_date", firstDate)
      .lte("work_date", lastDate)
      .order("work_date", { ascending: true });
    if (stErr) return NextResponse.json({ error: stErr.message }, { status: 500 });

    const { data: exRows, error: exErr } = await supabaseAdmin
      .from("daily_expenses")
      .select("work_date,travel_chf,meals_qty,misc_chf")
      .eq("user_id", user_id)
      .gte("work_date", firstDate)
      .lte("work_date", lastDate)
      .order("work_date", { ascending: true });
    if (exErr) return NextResponse.json({ error: exErr.message }, { status: 500 });

    const { data: logRows, error: lErr } = await supabaseAdmin
      .from("daily_site_logs")
      .select("work_date")
      .eq("user_id", user_id)
      .gte("work_date", firstDate)
      .lte("work_date", lastDate);
    if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 });

    const log_dates = Array.from(new Set((logRows ?? []).map((r: any) => String(r.work_date))));

    const { data: ms, error: msErr } = await supabaseAdmin
      .from("timesheet_months")
      .select("status")
      .eq("user_id", user_id)
      .eq("month", month)
      .maybeSingle();
    if (msErr) return NextResponse.json({ error: msErr.message }, { status: 500 });

    const month_status = (ms?.status === "approved" ? "approved" : "pending");

    return NextResponse.json({
      sites: sites ?? [],
      status_rows: stRows ?? [],
      expense_rows: exRows ?? [],
      log_dates,
      month_status,
    });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err), stack: err?.stack ?? null }, { status: 500 });
  }
}
