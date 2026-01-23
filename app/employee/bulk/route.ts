import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type DayType = "work" | "sick" | "leave" | "accident" | "vacation" | "other";

function isYYYYMMDD(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function parseHM(t: string | null | undefined) {
  if (!t) return null;
  const v = String(t).slice(0, 5);
  const [h, m] = v.split(":").map((x) => parseInt(x, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

export async function POST(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData.user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const userId = userData.user.id;

    const body = await req.json();

    const dates: string[] = Array.isArray(body?.dates) ? body.dates : [];
    const day_type: DayType = body?.day_type || "work";
    const note: string | null = (body?.note ?? "").toString().trim() || null;

    const site_id: string | null = body?.site_id || null;

    const start_time: string | null = body?.start_time || null;
    const break_start: string | null = body?.break_start || null;
    const break_end: string | null = body?.break_end || null;
    const end_time: string | null = body?.end_time || null;

    const travel_chf = Number(body?.travel_chf ?? 0) || 0;
    const misc_chf = Number(body?.misc_chf ?? 0) || 0;
    const meals_qty = Math.max(0, parseInt(body?.meals_qty ?? 0, 10) || 0);

    const cleanDates = dates.filter(isYYYYMMDD);
    if (cleanDates.length === 0) {
      return NextResponse.json({ error: "No valid dates" }, { status: 400 });
    }

    // Normalise times (si journée travail)
    const isWork = day_type === "work";

    // Option sécurité: si les heures sont incohérentes, on garde quand même (c'est l'employé)
    const stM = parseHM(start_time);
    const etM = parseHM(end_time);
    const bsM = parseHM(break_start);
    const beM = parseHM(break_end);

    const statusRows = cleanDates.map((d) => ({
      user_id: userId,
      work_date: d,
      day_type,
      note,
      site_id: isWork ? site_id : null,
      start_time: isWork ? start_time : null,
      break_start: isWork ? break_start : null,
      break_end: isWork ? break_end : null,
      end_time: isWork ? end_time : null,
    }));

    const expRows = cleanDates.map((d) => ({
      user_id: userId,
      work_date: d,
      travel_chf,
      misc_chf,
      meals_qty,
    }));

    const { error: e1 } = await supabaseAdmin
      .from("daily_status")
      .upsert(statusRows, { onConflict: "user_id,work_date" });

    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });

    const { error: e2 } = await supabaseAdmin
      .from("daily_expenses")
      .upsert(expRows, { onConflict: "user_id,work_date" });

    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });

    return NextResponse.json({ ok: true, count: cleanDates.length });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err), stack: err?.stack ?? null }, { status: 500 });
  }
}
