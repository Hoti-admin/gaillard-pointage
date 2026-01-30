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

// fallback decode sub (au cas où)
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

export async function GET(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

    let user_id: string | null = null;
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (!userErr && userData?.user?.id) user_id = userData.user.id;
    if (!user_id) user_id = decodeSubFromJWT(token);

    if (!user_id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const year = String(searchParams.get("year") || new Date().getFullYear());

    const { data, error } = await supabaseAdmin
      .from("timesheet_month_status")
      .select("month,status")
      .eq("user_id", user_id)
      .like("month", `${year}-%`)
      .order("month", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = (data ?? []).map((r: any) => ({
      month: normYM(r.month),
      status: String(r.status) === "approved" ? "approved" : "pending",
    }));

    return NextResponse.json({ rows });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err), stack: err?.stack ?? null }, { status: 500 });
  }
}
