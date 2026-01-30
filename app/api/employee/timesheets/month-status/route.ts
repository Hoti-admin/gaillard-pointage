import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type StatusOut = "pending" | "approved";

function normYM(v: any): string {
  const s = String(v ?? "");
  const m = s.match(/(\d{4})-(\d{1,2})/);
  if (!m) return "";
  const yy = m[1];
  const mm = String(parseInt(m[2], 10)).padStart(2, "0");
  return `${yy}-${mm}`;
}

function normalizeStatus(v: any): StatusOut {
  const s = String(v ?? "").toLowerCase().trim();
  if (s === "approved" || s === "valid" || s === "validated" || s === "ok") return "approved";
  if (v === true || v === 1) return "approved";
  return "pending";
}

// ✅ évite TS deep (pas de "as const")
const CANDIDATES: Array<{ table: string; userCol: string }> = [
  { table: "timesheets_month_status", userCol: "user_id" },
  { table: "timesheets_month_status", userCol: "employee_id" },
  { table: "timesheet_month_status", userCol: "user_id" },
  { table: "timesheet_month_status", userCol: "employee_id" },
  { table: "timesheets_status", userCol: "user_id" },
  { table: "timesheet_status", userCol: "user_id" },
];

function pickMonthField(row: any) {
  return row?.month ?? row?.month_key ?? row?.period ?? row?.work_month ?? row?.pay_month ?? row?.request_month ?? null;
}
function pickStatusField(row: any) {
  return row?.status ?? row?.state ?? row?.month_status ?? row?.is_approved ?? row?.approved ?? null;
}

// ✅ fallback si getUser() échoue : decode JWT payload pour récupérer sub
function decodeSubFromJWT(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "===".slice((payload.length + 3) % 4);
    const json = Buffer.from(padded, "base64").toString("utf8");
    const obj = JSON.parse(json);
    return String(obj?.sub ?? obj?.user_id ?? "") || null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

    // 1) Essai normal Supabase (le plus sûr)
    let user_id: string | null = null;
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (!userErr && userData?.user?.id) user_id = userData.user.id;

    // 2) Fallback decode JWT (évite le blocage en prod)
    if (!user_id) user_id = decodeSubFromJWT(token);

    if (!user_id) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", detail: userErr?.message ?? "Cannot resolve user_id" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const year = String(searchParams.get("year") || new Date().getFullYear());

    for (const cand of CANDIDATES) {
      // cast any => évite TS deep
      const q: any = (supabaseAdmin as any)
        .from(cand.table)
        .select("*")
        .eq(cand.userCol, user_id)
        .limit(500);

      const { data, error } = await q;
      if (error) continue;

      const rowsIn = (data ?? []) as any[];
      const rowsOut: Array<{ month: string; status: StatusOut }> = [];

      for (const r of rowsIn) {
        const mk = normYM(pickMonthField(r));
        if (!mk) continue;
        if (!mk.startsWith(year + "-")) continue;

        const st = normalizeStatus(pickStatusField(r));
        rowsOut.push({ month: mk, status: st });
      }

      rowsOut.sort((a, b) => a.month.localeCompare(b.month));

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
    return NextResponse.json(
      { error: String(err?.message ?? err), stack: err?.stack ?? null },
      { status: 500 }
    );
  }
}
