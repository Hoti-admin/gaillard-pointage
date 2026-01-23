import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type DayType = "work" | "holiday" | "sick" | "leave" | "accident" | "vacation" | "other";
const ALLOWED: DayType[] = ["work", "holiday", "sick", "leave", "accident", "vacation", "other"];

function isYMD(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}
function addDays(ymd: string, n: number) {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function cmp(a: string, b: string) {
  return a.localeCompare(b);
}

export async function POST(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData.user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const from = String(body?.from ?? "");
    const to = String(body?.to ?? "");
    const day_type = String(body?.day_type ?? "") as DayType;
    const note = body?.note ? String(body.note) : null;

    if (!isYMD(from) || !isYMD(to)) return NextResponse.json({ error: "Bad dates" }, { status: 400 });
    if (!ALLOWED.includes(day_type)) return NextResponse.json({ error: "Bad day_type" }, { status: 400 });

    let start = from;
    let end = to;
    if (cmp(start, end) > 0) {
      start = to;
      end = from;
    }

    const rows: any[] = [];
    let cur = start;
    while (cmp(cur, end) <= 0) {
      const isWorkLike = day_type === "work" || day_type === "holiday";

      rows.push({
        user_id: userData.user.id,
        work_date: cur,
        day_type,
        note: day_type === "other" ? (note?.trim() || null) : null,
        site_id: null,
        start_time: isWorkLike ? "07:00" : null,
        break_start: isWorkLike ? "12:00" : null,
        break_end: isWorkLike ? "13:00" : null,
        end_time: isWorkLike ? "17:00" : null,
      });

      cur = addDays(cur, 1);
    }

    // Upsert = idempotent (si double clic => pas de doublons)
    const { error } = await supabaseAdmin
      .from("daily_status")
      .upsert(rows, { onConflict: "user_id,work_date" });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, updated: rows.length }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err), stack: err?.stack ?? null }, { status: 500 });
  }
}
