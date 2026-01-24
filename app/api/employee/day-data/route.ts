import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type DayType = "work" | "holiday" | "sick" | "leave" | "accident" | "vacation" | "other";

export async function GET(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData.user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const user_id = userData.user.id;

    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") || new Date().toISOString().slice(0, 10);

    // ✅ IMPORTANT : prendre is_active=true OU is_active NULL (pour éviter liste vide)
    const { data: sites, error: sErr } = await supabaseAdmin
      .from("sites")
      .select("id,name,is_active")
      .or("is_active.is.null,is_active.eq.true")
      .order("name", { ascending: true });

    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

    const { data: st, error: stErr } = await supabaseAdmin
      .from("daily_status")
      .select("work_date,day_type,note,site_id,start_time,break_start,break_end,end_time")
      .eq("user_id", user_id)
      .eq("work_date", date)
      .maybeSingle();

    if (stErr) return NextResponse.json({ error: stErr.message }, { status: 500 });

    const { data: ex, error: exErr } = await supabaseAdmin
      .from("daily_expenses")
      .select("work_date,meals_qty,travel_chf,misc_chf")
      .eq("user_id", user_id)
      .eq("work_date", date)
      .maybeSingle();

    if (exErr) return NextResponse.json({ error: exErr.message }, { status: 500 });

    const day_type: DayType = (st?.day_type ?? "work") as DayType;

    return NextResponse.json({
      date,
      sites: sites ?? [],
      status: st ?? null,
      expenses: ex ?? { work_date: date, meals_qty: 0, travel_chf: 0, misc_chf: 0 },
      day_type,
    });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err), stack: err?.stack ?? null }, { status: 500 });
  }
}
