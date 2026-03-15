import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type TimesheetStatus = "pending" | "approved";

async function requireAdmin(accessToken: string) {
  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(accessToken);
  if (userErr || !userData.user) return { ok: false as const, reason: "UNAUTHORIZED" };

  const { data: prof, error: profErr } = await supabaseAdmin
    .from("profiles")
    .select("role,is_active")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (profErr) return { ok: false as const, reason: profErr.message };
  if (!prof?.is_active || prof.role !== "admin") return { ok: false as const, reason: "FORBIDDEN" };

  return { ok: true as const, adminId: userData.user.id };
}

function normalizeMonth(value: string) {
  const v = String(value ?? "").slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(v)) return null;
  return v;
}

function normalizeStatus(value: unknown): TimesheetStatus {
  return String(value) === "approved" ? "approved" : "pending";
}

async function getTargetUserIds(user_id: string) {
  if (user_id !== "all") return [user_id];

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("user_id")
    .eq("is_active", true)
    .order("user_id", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row: any) => String(row.user_id)).filter(Boolean);
}

export async function POST(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

    const admin = await requireAdmin(token);
    if (!admin.ok) {
      const status = admin.reason === "UNAUTHORIZED" ? 401 : admin.reason === "FORBIDDEN" ? 403 : 500;
      return NextResponse.json({ error: admin.reason }, { status });
    }

    const body = await req.json().catch(() => ({}));
    const user_id = String(body?.user_id ?? "");
    const month = normalizeMonth(String(body?.month ?? ""));
    const status = normalizeStatus(body?.status);

    if (!user_id || !month) {
      return NextResponse.json({ error: "user_id + month requis" }, { status: 400 });
    }

    const userIds = await getTargetUserIds(user_id);
    if (!userIds.length) {
      return NextResponse.json({ error: "Aucun employé trouvé" }, { status: 400 });
    }

    const approvedAt = status === "approved" ? new Date().toISOString() : null;
    const rows = userIds.map((uid) => ({
      user_id: uid,
      month,
      status,
      approved_at: approvedAt,
    }));

    const { data, error } = await supabaseAdmin
      .from("timesheet_months")
      .upsert(rows, { onConflict: "user_id,month" })
      .select("user_id,month,status,approved_at");

    if (error) {
      console.error("set-status error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      count: data?.length ?? rows.length,
      rows: data ?? rows,
    });
  } catch (err: any) {
    console.error("set-status unexpected error:", err);
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}
