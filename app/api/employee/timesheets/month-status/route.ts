import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function decodeSubFromJWT(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "===".slice((payload.length + 3) % 4);
    const json = Buffer.from(padded, "base64").toString("utf8");
    const obj = JSON.parse(json);
    return String(obj?.sub ?? "") || null;
  } catch {
    return null;
  }
}

async function requireEmployee(accessToken: string) {
  let userId: string | null = null;

  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(accessToken);
  if (!userErr && userData?.user?.id) userId = userData.user.id;
  if (!userId) userId = decodeSubFromJWT(accessToken);
  if (!userId) return { ok: false as const, reason: "UNAUTHORIZED" };

  const { data: prof, error: profErr } = await supabaseAdmin
    .from("profiles")
    .select("user_id,is_active")
    .eq("user_id", userId)
    .maybeSingle();

  if (profErr) return { ok: false as const, reason: profErr.message };
  if (!prof?.is_active) return { ok: false as const, reason: "FORBIDDEN" };

  return { ok: true as const, userId };
}

export async function GET(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

    const employee = await requireEmployee(token);
    if (!employee.ok) {
      const status = employee.reason === "UNAUTHORIZED" ? 401 : employee.reason === "FORBIDDEN" ? 403 : 500;
      return NextResponse.json({ error: employee.reason }, { status });
    }

    const { searchParams } = new URL(req.url);
    const year = String(searchParams.get("year") ?? "").trim();
    if (!/^\d{4}$/.test(year)) {
      return NextResponse.json({ error: "year requis (YYYY)" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("timesheet_months")
      .select("month,status,approved_at")
      .eq("user_id", employee.userId)
      .gte("month", `${year}-01`)
      .lte("month", `${year}-12`)
      .order("month", { ascending: true });

    if (error) {
      console.error("employee month-status error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      rows: (data ?? []).map((row: any) => ({
        month: String(row.month).slice(0, 7),
        status: String(row.status) === "approved" ? "approved" : "pending",
        approved_at: row.approved_at ?? null,
      })),
    });
  } catch (err: any) {
    console.error("employee month-status unexpected error:", err);
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}
