import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function normYM(v: any): string {
  const s = String(v ?? "");
  const m = s.match(/(\d{4})-(\d{1,2})/);
  if (!m) return "";
  const yy = m[1];
  const mm = String(parseInt(m[2], 10)).padStart(2, "0");
  return `${yy}-${mm}`;
}

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

export async function GET(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

    const admin = await requireAdmin(token);
    if (!admin.ok) return NextResponse.json({ error: admin.reason }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const year = String(searchParams.get("year") || new Date().getFullYear());
    const user_id = String(searchParams.get("user_id") || "all");

    if (user_id !== "all") {
      // ✅ par employé : renvoyer les mois de l'année
      const { data, error } = await supabaseAdmin
        .from("timesheet_month_status")
        .select("month,status")
        .eq("user_id", user_id)
        .like("month", `${year}-%`)
        .order("month", { ascending: true });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      const rows = (data ?? []).map((r: any) => ({ month: normYM(r.month), status: r.status === "approved" ? "approved" : "pending" }));
      return NextResponse.json({ rows });
    }

    // ✅ "all" : un mois est "approved" seulement si tous les employés actifs sont approved
    const { data: profs, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("user_id,is_active")
      .eq("is_active", true);

    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

    const users = (profs ?? []).map((p: any) => String(p.user_id));
    if (users.length === 0) return NextResponse.json({ rows: [] });

    const { data: st, error: sErr } = await supabaseAdmin
      .from("timesheet_month_status")
      .select("user_id,month,status")
      .in("user_id", users)
      .like("month", `${year}-%`);

    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

    // group by month
    const byMonth = new Map<string, { approvedCount: number; total: number }>();
    for (const uid of users) {
      // total per month will be compared later
    }
    for (const r of (st ?? []) as any[]) {
      const m = normYM(r.month);
      if (!m) continue;
      if (!byMonth.has(m)) byMonth.set(m, { approvedCount: 0, total: users.length });
      if (String(r.status) === "approved") byMonth.get(m)!.approvedCount += 1;
    }

    const rows: Array<{ month: string; status: "pending" | "approved" }> = [];
    for (let mm = 1; mm <= 12; mm++) {
      const ym = `${year}-${String(mm).padStart(2, "0")}`;
      const g = byMonth.get(ym);
      const ok = g ? g.approvedCount >= g.total : false;
      rows.push({ month: ym, status: ok ? "approved" : "pending" });
    }

    return NextResponse.json({ rows });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err), stack: err?.stack ?? null }, { status: 500 });
  }
}
