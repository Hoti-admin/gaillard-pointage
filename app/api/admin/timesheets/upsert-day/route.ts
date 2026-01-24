import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type DayType = "work" | "holiday" | "sick" | "leave" | "accident" | "vacation" | "other";

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

function iso(work_date: string, hhmm: string) {
  // durée OK même si Vercel est en UTC
  return new Date(`${work_date}T${hhmm}:00`).toISOString();
}

export async function POST(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

    const admin = await requireAdmin(token);
    if (!admin.ok) return NextResponse.json({ error: admin.reason }, { status: 403 });

    const body = await req.json().catch(() => ({}));

    const user_id = String(body.user_id ?? "");
    const work_date = String(body.work_date ?? "");
    const day_type = String(body.day_type ?? "work") as DayType;

    if (!user_id || !work_date) return NextResponse.json({ error: "user_id + work_date requis" }, { status: 400 });

    const note = body.note ?? null;
    const site_id = body.site_id ? String(body.site_id) : null;

    const start_time = body.start_time ?? null;
    const break_start = body.break_start ?? null;
    const break_end = body.break_end ?? null;
    const end_time = body.end_time ?? null;

    const travel_chf = Number(body.travel_chf ?? 0);
    const meals_qty = Number(body.meals_qty ?? 0);
    const misc_chf = Number(body.misc_chf ?? 0);

    const replace_logs = Boolean(body.replace_logs ?? false);

    // 1) daily_status upsert
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

    // 2) daily_expenses upsert
    const exPayload: any = {
      user_id,
      work_date,
      travel_chf,
      meals_qty,
      misc_chf,
    };

    const { error: exErr } = await supabaseAdmin.from("daily_expenses").upsert(exPayload, {
      onConflict: "user_id,work_date",
    });
    if (exErr) return NextResponse.json({ error: exErr.message }, { status: 500 });

    // 3) Optionnel : remplacer les logs du jour pour que les exports reflètent la correction
    if (replace_logs) {
      await supabaseAdmin.from("daily_site_logs").delete().eq("user_id", user_id).eq("work_date", work_date);

      if (day_type === "work" && site_id && start_time && end_time) {
        const logs: any[] = [];

        // si pause complète
        if (break_start && break_end) {
          // work 1
          if (start_time < break_start) {
            logs.push({
              user_id,
              work_date,
              site_id,
              segment_type: "work",
              started_at: iso(work_date, String(start_time).slice(0, 5)),
              ended_at: iso(work_date, String(break_start).slice(0, 5)),
            });
          }
          // pause
          if (break_start < break_end) {
            logs.push({
              user_id,
              work_date,
              site_id: null,
              segment_type: "pause",
              started_at: iso(work_date, String(break_start).slice(0, 5)),
              ended_at: iso(work_date, String(break_end).slice(0, 5)),
            });
          }
          // work 2
          if (break_end < end_time) {
            logs.push({
              user_id,
              work_date,
              site_id,
              segment_type: "work",
              started_at: iso(work_date, String(break_end).slice(0, 5)),
              ended_at: iso(work_date, String(end_time).slice(0, 5)),
            });
          }
        } else {
          // sans pause : un seul segment work
          logs.push({
            user_id,
            work_date,
            site_id,
            segment_type: "work",
            started_at: iso(work_date, String(start_time).slice(0, 5)),
            ended_at: iso(work_date, String(end_time).slice(0, 5)),
          });
        }

        if (logs.length) {
          const { error: lErr } = await supabaseAdmin.from("daily_site_logs").insert(logs);
          if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 });
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err), stack: err?.stack ?? null }, { status: 500 });
  }
}
