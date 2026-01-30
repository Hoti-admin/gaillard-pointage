import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

// On essaye 2 noms de table possibles (selon ce que tu as déjà)
const TABLES = ["timesheets_month_status", "timesheet_month_status"];

async function queryTable(table: string, user_id: string, year: string) {
  const { data, error } = await supabaseAdmin
    .from(table)
    .select("month,status")
    .eq("user_id", user_id)
    .like("month", `${year}-%`)
    .order("month", { ascending: true });

  if (error) return { ok: false as const, error: error.message, data: null as any };
  return { ok: true as const, error: null as any, data: data ?? [] };
}

export async function GET(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData.user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const user_id = userData.user.id;

    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year") || new Date().getFullYear().toString();

    for (const t of TABLES) {
      const r = await queryTable(t, user_id, year);
      if (r.ok) return NextResponse.json({ rows: r.data, table: t });
    }

    return NextResponse.json({ rows: [], error: "Table status introuvable (vérifie le nom de table)" }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: String(err?.message ?? err), stack: err?.stack ?? null },
      { status: 500 }
    );
  }
}
