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

export async function POST(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

    const admin = await requireAdmin(token);
    if (!admin.ok) return NextResponse.json({ error: admin.reason }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const month = normYM(body?.month);
    const user_id = String(body?.user_id ?? "all");
    const status = String(body?.status ?? "pending") === "approved" ? "approved" : "pending";

    if (!month) return NextResponse.json({ error: "Invalid month" }, { status: 400 });

    // si "all" => tous les employés actifs
    let targets: string[] = [];
    if (user_id === "all") {
      const { data: profs, error } = await supabaseAdmin
        .from("profiles")
        .select("user_id,is_active")
        .eq("is_active", true);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      targets = (profs ?? []).map((p: any) => String(p.user_id));
    } else {
      targets = [user_id];
    }

    const rows = targets.map((uid) => ({ user_id: uid, month, status, updated_at: new Date().toISOString() }));

    // upsert dans la table unique
    const { error: upErr } = await supabaseAdmin
      .from("timesheet_month_status")
      .upsert(rows, { onConflict: "user_id,month" });

    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, updated: targets.length, month, status });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err), stack: err?.stack ?? null }, { status: 500 });
  }
}
