import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type DayType = "work" | "holiday" | "sick" | "leave" | "accident" | "vacation" | "other";

function num(v: any) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export async function POST(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData.user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const user_id = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const work_date = String(body.work_date ?? "");
    const day_type = String(body.day_type ?? "work") as DayType;

    if (!work_date) return NextResponse.json({ error: "work_date requis" }, { status: 400 });

    const note = body.note ?? null;
    const site_id = body.site_id ? String(body.site_id) : null;

    const start_time = body.start_time ?? null;
    const break_start = body.break_start ?? null;
    const break_end = body.break_end ?? null;
    const end_time = body.end_time ?? null;

    // ✅ frais simples
    let meals_qty = Number(body.meals_qty ?? 0) ? 1 : 0; // OUI/NON => 1/0
    let travel_chf = num(body.travel_chf);
    let misc_chf = num(body.misc_chf);

    // si pas travail => on force frais à 0
    if (day_type !== "work") {
      meals_qty = 0;
      travel_chf = 0;
      misc_chf = 0;
    }

    // 1) daily_status
    const stPayload: any = {
      user_id,
      work_date,
      day_type,
      note,
      site_id: day_type === "work" ? site_id : null,
      start_time: day_type === "work" ? start_time : null,
      break_start: day_type === "work" ? break_start : null,
      break_end: day_type === "work" ? break_end : null,
      end_time: day_type === "work" ? end_time : null,
    };

    const { error: stErr } = await supabaseAdmin.from("daily_status").upsert(stPayload, {
      onConflict: "user_id,work_date",
    });
    if (stErr) return NextResponse.json({ error: stErr.message }, { status: 500 });

    // 2) daily_expenses
    const exPayload: any = {
      user_id,
      work_date,
      meals_qty,
      travel_chf,
      misc_chf,
    };

    const { error: exErr } = await supabaseAdmin.from("daily_expenses").upsert(exPayload, {
      onConflict: "user_id,work_date",
    });
    if (exErr) return NextResponse.json({ error: exErr.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err), stack: err?.stack ?? null }, { status: 500 });
  }
}
