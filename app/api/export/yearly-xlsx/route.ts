import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type LogRow = {
  user_id: string;
  work_date: string;
  segment_type: "work" | "pause";
  started_at: string;
  ended_at: string | null;
};

async function requireUser(accessToken: string) {
  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(accessToken);
  if (userErr || !userData.user) return { ok: false as const, status: 401, reason: "UNAUTHORIZED" };

  const { data: prof, error: pErr } = await supabaseAdmin
    .from("profiles")
    .select("role,is_active")
    .eq("user_id", userData.user.id)
    .single();

  if (pErr || !prof?.is_active) return { ok: false as const, status: 403, reason: "FORBIDDEN" };

  const role = String(prof.role || "employee");
  return { ok: true as const, role, userId: userData.user.id };
}

function minutesBetween(aIso: string, bIso: string) {
  const a = new Date(aIso).getTime();
  const b = new Date(bIso).getTime();
  return Math.max(0, Math.round((b - a) / 60000));
}
function monthLabelFR(year: number, m1: number) {
  const d = new Date(year, m1 - 1, 1);
  return d.toLocaleDateString("fr-CH", { month: "long" });
}

export async function GET(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

    const au = await requireUser(token);
    if (!au.ok) return NextResponse.json({ error: au.reason }, { status: au.status });

    const isAdmin = au.role === "admin";

    const { searchParams } = new URL(req.url);
    const yearStr = searchParams.get("year") || String(new Date().getFullYear());
    let employee = searchParams.get("employee") || "all";

    const year = parseInt(yearStr, 10);
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ error: "Year invalide" }, { status: 400 });
    }

    if (!isAdmin) employee = au.userId;
    else if (employee === "self") employee = au.userId;

    // employees list
    let employees: Array<{ user_id: string; full_name: string }> = [];
    if (employee === "all") {
      if (!isAdmin) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

      const { data: profs, error: pErr } = await supabaseAdmin
        .from("profiles")
        .select("user_id,full_name,is_active")
        .eq("is_active", true)
        .order("full_name", { ascending: true });

      if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
      employees = (profs ?? []).map((p: any) => ({ user_id: String(p.user_id), full_name: String(p.full_name ?? "") }));
    } else {
      const { data: prof, error: pErr } = await supabaseAdmin
        .from("profiles")
        .select("user_id,full_name,is_active")
        .eq("user_id", employee)
        .single();

      if (pErr || !prof) return NextResponse.json({ error: "Employe introuvable" }, { status: 400 });
      employees = [{ user_id: String(prof.user_id), full_name: String(prof.full_name ?? "") }];
    }

    const userIds = employees.map((e) => e.user_id);
    const firstDate = `${year}-01-01`;
    const lastDate = `${year}-12-31`;
    const nowIso = new Date().toISOString();

    // logs year
    const { data: logs, error: lErr } = await supabaseAdmin
      .from("daily_site_logs")
      .select("user_id,work_date,segment_type,started_at,ended_at")
      .in("user_id", userIds)
      .gte("work_date", firstDate)
      .lte("work_date", lastDate);

    if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 });

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

    // hours by employee month
    const hoursByUserMonth = new Map<string, Map<string, number>>();
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
    }

    // workbook
    const wb = new ExcelJS.Workbook();
    wb.creator = "Gaillard Pointage";
    wb.created = new Date();

    // Résumé
    const wsR = wb.addWorksheet("Résumé");
    wsR.getColumn(1).width = 30;
    wsR.getColumn(2).width = 16;
    wsR.getColumn(3).width = 16;
    wsR.getColumn(4).width = 16;
    wsR.getColumn(5).width = 14;
    wsR.getColumn(6).width = 14;

    wsR.addRow([`GAILLARD Jean-Paul SA — Résumé annuel ${year}`]).font = { bold: true, size: 16, color: { argb: "FFB40000" } };
    wsR.addRow([]);
    const head = wsR.addRow(["Employé", "Total (h)", "Validé (h)", "En attente (h)", "Mois validés", "Mois attente"]);
    head.font = { bold: true };

    let grandTotal = 0, grandApproved = 0, grandPending = 0;

    for (const e of employees) {
      const uid = e.user_id;
      const hm = hoursByUserMonth.get(uid) ?? new Map();
      const sm = statusByUserMonth.get(uid) ?? new Map();

      let total = 0, approved = 0, pending = 0, cA = 0, cP = 0;
      for (let m = 1; m <= 12; m++) {
        const ym = `${year}-${String(m).padStart(2, "0")}`;
        const h = hm.get(ym) ?? 0;
        total += h;
        const st = sm.get(ym) ?? "pending";
        if (st === "approved") { approved += h; cA++; } else { pending += h; cP++; }
      }

      grandTotal += total; grandApproved += approved; grandPending += pending;

      wsR.addRow([
        e.full_name,
        Number(total.toFixed(2)),
        Number(approved.toFixed(2)),
        Number(pending.toFixed(2)),
        cA,
        cP,
      ]);
    }

    wsR.addRow([]);
    const tot = wsR.addRow([
      "TOTAL",
      Number(grandTotal.toFixed(2)),
      Number(grandApproved.toFixed(2)),
      Number(grandPending.toFixed(2)),
      "",
      "",
    ]);
    tot.font = { bold: true };

    // 1 feuille par employé
    for (const e of employees) {
      const ws = wb.addWorksheet((e.full_name || "Employe").slice(0, 28));
      ws.getColumn(1).width = 18;
      ws.getColumn(2).width = 12;
      ws.getColumn(3).width = 14;

      ws.addRow([`Bordereaux — ${year} — ${e.full_name}`]).font = { bold: true, size: 14, color: { argb: "FFB40000" } };
      ws.addRow([]);
      const h = ws.addRow(["Mois", "Heures (h)", "Statut"]);
      h.font = { bold: true };

      const hm = hoursByUserMonth.get(e.user_id) ?? new Map();
      const sm = statusByUserMonth.get(e.user_id) ?? new Map();

      let total = 0;
      for (let m = 1; m <= 12; m++) {
        const ym = `${year}-${String(m).padStart(2, "0")}`;
        const hours = hm.get(ym) ?? 0;
        const st = sm.get(ym) ?? "pending";
        total += hours;

        ws.addRow([`${monthLabelFR(year, m)} ${year}`, Number(hours.toFixed(2)), st === "approved" ? "VALIDÉ" : "EN ATTENTE"]);
      }

      ws.addRow([]);
      const t = ws.addRow(["TOTAL", Number(total.toFixed(2)), ""]);
      t.font = { bold: true };
      ws.getColumn(2).numFmt = "0.00";
    }

    const bufAny = await wb.xlsx.writeBuffer();
    const out = Buffer.isBuffer(bufAny) ? bufAny : Buffer.from(bufAny as ArrayBuffer);

    const fileName = employee === "all" ? `Annuel_${year}_TOUS.xlsx` : `Annuel_${year}.xlsx`;

    return new NextResponse(out, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err), stack: err?.stack ?? null }, { status: 500 });
  }
}
