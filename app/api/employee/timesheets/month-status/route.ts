import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type StatusOut = "pending" | "approved";

function monthKey(v: any): string {
  return String(v ?? "").slice(0, 7); // YYYY-MM
}

function normalizeStatus(v: any): StatusOut {
  const s = String(v ?? "").toLowerCase().trim();
  if (s === "approved" || s === "valid" || s === "validated" || s === "ok") return "approved";
  if (v === true || v === 1) return "approved";
  return "pending";
}

// ✅ NO "as const" (évite l’erreur TS deep)
const CANDIDATES: Array<{ table: string; userCol: string }> = [
  { table: "timesheets_month_status", userCol: "user_id" },
  { table: "timesheets_month_status", userCol: "employee_id" },
  { table: "timesheet_month_status", userCol: "user_id" },
  { table: "timesheet_month_status", userCol: "employee_id" },
  { table: "timesheets_status", userCol: "user_id" },
  { table: "timesheet_status", userCol: "user_id" },
];

function pickMonthField(row: any) {
  return row?.month ?? row?.month_key ?? row?.period ?? row?.pay_month ?? row?.request_month ?? row?.work_month ?? null;
}
function pickStatusField(row: any) {
  return row?.status ?? row?.state ?? row?.month_status ?? row?.is_approved ?? row?.approved ?? null;
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
    const year = String(searchParams.get("year") || new Date().getFullYear());

    for (const cand of CANDIDATES) {
      // ✅ cast "any" pour éviter TS deep
      const q: any = (supabaseAdmin as any).from(cand.table).select("*").eq(cand.userCol, user_id).limit(200);

      const { data, error } = await q;
      if (error) continue;

      const rowsIn = (data ?? []) as any[];
      const rowsOut: Array<{ month: string; status: StatusOut }> = [];

      for (const r of rowsIn) {
        const mk = monthKey(pickMonthField(r));
        if (!mk || mk.length < 7) continue;
        if (!mk.startsWith(year + "-")) continue;

        const st = normalizeStatus(pickStatusField(r));
        rowsOut.push({ month: mk, status: st });
      }

      // ✅ même si vide, on renvoie la source (debug)
      return NextResponse.json({
        rows: rowsOut,
        source: { table: cand.table, userCol: cand.userCol },
      });
    }

    return NextResponse.json({
      rows: [],
      error: "Aucun statut trouvé (table inconnue).",
    });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err), stack: err?.stack ?? null }, { status: 500 });
  }
}
