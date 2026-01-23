import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type LogRow = {
  user_id: string;
  work_date: string;
  segment_type: "work" | "pause";
  started_at: string;
  ended_at: string | null;
};

async function requireAdmin(accessToken: string) {
  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(accessToken);
  if (userErr || !userData.user) return { ok: false as const, status: 401, reason: "UNAUTHORIZED" };

  const { data: prof, error: pErr } = await supabaseAdmin
    .from("profiles")
    .select("role,is_active")
    .eq("user_id", userData.user.id)
    .single();

  if (pErr || !prof?.is_active || String(prof.role) !== "admin") return { ok: false as const, status: 403, reason: "FORBIDDEN" };
  return { ok: true as const };
}

function minutesBetween(aIso: string, bIso: string) {
  const a = new Date(aIso).getTime();
  const b = new Date(bIso).getTime();
  return Math.max(0, Math.round((b - a) / 60000));
}

export async function GET(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

    const au = await requireAdmin(token);
    if (!au.ok) return NextResponse.json({ error: au.reason }, { status: au.status });

    const { searchParams } = new URL(req.url);
    const yearStr = String(searchParams.get("year") ?? "");
    if (!/^\d{4}$/.test(yearStr)) return NextResponse.json({ error: "year invalide" }, { status: 400 });
    const year = parseInt(yearStr, 10);

    const firstDate = `${year}-01-01`;
    const lastDate = `${year}-12-31`;

    // employees
    const { data: profs, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("user_id,full_name,is_active")
      .eq("is_active", true)
      .order("full_name", { ascending: true });

    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

    const employees = (profs ?? []).map((p: any) => ({
      user_id: String(p.user_id),
      full_name: String(p.full_name ?? ""),
    }));
    const userIds = employees.map((e) => e.user_id);

    // logs year
    const { data: logs, error: lErr } = await supabaseAdmin
      .from("daily_site_logs")
      .select("user_id,work_date,segment_type,started_at,ended_at")
      .in("user_id", userIds)
      .gte("work_date", firstDate)
      .lte("work_date", lastDate)
      .order("work_date", { ascending: true });

    if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 });

    const nowIso = new Date().toISOString();
    const hoursByUserMonth = new Map<string, Map<string, number>>(); // uid -> (YYYY-MM -> hours)
    const totalByUser = new Map<string, number>(); // uid -> hours

    for (const r of (logs ?? []) as any as LogRow[]) {
      if (r.segment_type !== "work") continue;
      const end = r.ended_at ?? nowIso;
      const mins = minutesBetween(r.started_at, end);
      if (mins <= 0) continue;

      const uid = String(r.user_id);
      const ym = String(r.work_date).slice(0, 7);

      if (!hoursByUserMonth.has(uid)) hoursByUserMonth.set(uid, new Map());
      const m = hoursByUserMonth.get(uid)!;
      m.set(ym, (m.get(ym) ?? 0) + mins / 60);

      totalByUser.set(uid, (totalByUser.get(uid) ?? 0) + mins / 60);
    }

    // approvals year
    const from = `${year}-01`;
    const to = `${year}-12`;

    const { data: appr, error: aErr } = await supabaseAdmin
      .from("timesheet_months")
      .select("user_id,month,status")
      .in("user_id", userIds)
      .gte("month", from)
      .lte("month", to);

    if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 });

    const statusByUserMonth = new Map<string, Map<string, "pending" | "approved">>();
    for (const r of (appr ?? []) as any[]) {
      const uid = String(r.user_id);
      const ym = String(r.month);
      const st = String(r.status) as any;
      if (!statusByUserMonth.has(uid)) statusByUserMonth.set(uid, new Map());
      statusByUserMonth.get(uid)!.set(ym, st);
    }

    const rows = employees.map((e) => {
      const uid = e.user_id;
      const total = totalByUser.get(uid) ?? 0;
      const hm = hoursByUserMonth.get(uid) ?? new Map();
      const sm = statusByUserMonth.get(uid) ?? new Map();

      let approvedHours = 0;
      let pendingHours = 0;
      let approvedMonths = 0;
      let pendingMonths = 0;

      for (let m = 1; m <= 12; m++) {
        const ym = `${year}-${String(m).padStart(2, "0")}`;
        const h = hm.get(ym) ?? 0;
        const st = sm.get(ym) ?? "pending";
        if (st === "approved") {
          approvedHours += h;
          approvedMonths += 1;
        } else {
          pendingHours += h;
          pendingMonths += 1;
        }
      }

      return {
        user_id: uid,
        full_name: e.full_name,
        total_hours: Number(total.toFixed(2)),
        approved_hours: Number(approvedHours.toFixed(2)),
        pending_hours: Number(pendingHours.toFixed(2)),
        approved_months: approvedMonths,
        pending_months: pendingMonths,
      };
    });

    return NextResponse.json({ rows });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}
