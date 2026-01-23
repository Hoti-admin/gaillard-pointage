import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import crypto from "crypto";

export const runtime = "nodejs";

type DayType = "work" | "sick" | "leave" | "accident" | "vacation" | "other";

function isYYYYMMDD(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function hashBody(body: any) {
  return crypto.createHash("sha256").update(JSON.stringify(body)).digest("hex");
}

async function dedupOrContinue(userId: string, endpoint: string, key: string) {
  const bucket = Math.floor(Date.now() / 10000); // 10s
  const { error } = await supabaseAdmin
    .from("request_dedup")
    .insert({ user_id: userId, endpoint, idem_key: key, bucket });

  if (!error) return { dedup: false as const };
  if ((error as any).code === "23505") return { dedup: true as const };
  return { dedup: false as const, error };
}

export async function POST(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData.user) {
      return NextResponse.json({ error: "UNAUTHORIZED", detail: userErr?.message ?? "" }, { status: 401 });
    }
    const userId = userData.user.id;

    const body = await req.json();

    const headerKey = (req.headers.get("x-idempotency-key") || "").trim();
    const idemKey = headerKey || hashBody(body);

    const dd = await dedupOrContinue(userId, "employee_save_month", idemKey);
    if (dd.dedup) return NextResponse.json({ ok: true, dedup: true });

    const rows = Array.isArray(body?.rows) ? body.rows : [];
    if (rows.length === 0) return NextResponse.json({ error: "No rows provided" }, { status: 400 });

    const statusRows: any[] = [];
    const expRows: any[] = [];

    for (const r of rows) {
      const work_date = String(r?.work_date ?? "");
      if (!isYYYYMMDD(work_date)) continue;

      const day_type: DayType = (r?.day_type ?? "work") as DayType;
      const note = (r?.note ?? "").toString().trim() || null;
      const isWork = day_type === "work";

      statusRows.push({
        user_id: userId,
        work_date,
        day_type,
        note,
        site_id: isWork ? (r?.site_id || null) : null,
        start_time: isWork ? (r?.start_time || null) : null,
        break_start: isWork ? (r?.break_start || null) : null,
        break_end: isWork ? (r?.break_end || null) : null,
        end_time: isWork ? (r?.end_time || null) : null,
      });

      expRows.push({
        user_id: userId,
        work_date,
        travel_chf: Number(r?.travel_chf ?? 0) || 0,
        misc_chf: Number(r?.misc_chf ?? 0) || 0,
        meals_qty: Math.max(0, parseInt(r?.meals_qty ?? 0, 10) || 0),
      });
    }

    if (statusRows.length === 0) return NextResponse.json({ error: "No valid rows" }, { status: 400 });

    const { error: e1 } = await supabaseAdmin
      .from("daily_status")
      .upsert(statusRows, { onConflict: "user_id,work_date" });

    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });

    const { error: e2 } = await supabaseAdmin
      .from("daily_expenses")
      .upsert(expRows, { onConflict: "user_id,work_date" });

    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });

    return NextResponse.json({ ok: true, count: statusRows.length });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err), stack: err?.stack ?? null }, { status: 500 });
  }
}
