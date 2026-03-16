import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type RowOut = {
  month: string;
  status: "pending" | "approved";
};

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
      return NextResponse.json({ error: employee.reason }, { status: employee.reason === "UNAUTHORIZED" ? 401 : 403 });
    }

    const { searchParams } = new URL(req.url);
    const year = String(searchParams.get("year") ?? "").trim();

    let query = supabaseAdmin
      .from("timesheet_months")
      .select("month,status")
      .eq("user_id", employee.userId)
      .order("month", { ascending: true });

    if (/^\d{4}$/.test(year)) {
      query = query.gte("month", `${year}-01`).lte("month", `${year}-12`);
    }

    const { data, error } = await query;
    if (error) {
      console.error("employee month-status error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows: RowOut[] = (data ?? []).map((r: any) => ({
      month: String(r.month ?? "").slice(0, 7),
      status: String(r.status) === "approved" ? "approved" : "pending",
    }));

    const years = Array.from(new Set(rows.map((r) => r.month.slice(0, 4)))).sort();

    return NextResponse.json({ ok: true, rows, years });
  } catch (error: any) {
    console.error("employee month-status unexpected:", error);
    return NextResponse.json({ error: String(error?.message ?? error) }, { status: 500 });
  }
}
