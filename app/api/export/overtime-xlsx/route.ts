import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type Entry = {
  id: string;
  user_id: string;
  work_date: string;
  site_id: string | null;
  start_time: string | null;
  end_time: string | null;
  hours: number;
  reason: string | null;
  is_approved: boolean;
  approved_at: string | null;
};

type OvertimeRequest = { hours: number; note: string | null };

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

function monthToRange(month: string) {
  const [yStr, mStr] = month.split("-");
  const y = parseInt(yStr, 10);
  const m0 = parseInt(mStr, 10) - 1;
  const lastDay = new Date(y, m0 + 1, 0).getDate();
  const firstDate = `${y}-${String(m0 + 1).padStart(2, "0")}-01`;
  const lastDate = `${y}-${String(m0 + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { firstDate, lastDate };
}
function monthLabelFR(month: string) {
  const [y, mo] = month.split("-");
  const d = new Date(parseInt(y, 10), parseInt(mo, 10) - 1, 1);
  return d.toLocaleDateString("fr-CH", { month: "long", year: "numeric" });
}
function t5(v: string | null) {
  if (!v) return "";
  return String(v).slice(0, 5);
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

const COLOR = {
  primaryRed: "FFB40000",
  darkText: "FF111827",
  subText: "FF374151",
  headerFill: "FFF2F4F7",
  bandFill: "FFFDECEC",
  altFill: "FFF9FAFB",
  border: "FFE5E7EB",
};

function setBorderThin(cell: ExcelJS.Cell) {
  cell.border = {
    top: { style: "thin", color: { argb: COLOR.border } },
    left: { style: "thin", color: { argb: COLOR.border } },
    bottom: { style: "thin", color: { argb: COLOR.border } },
    right: { style: "thin", color: { argb: COLOR.border } },
  };
}
function styleHeaderRow(ws: ExcelJS.Worksheet, rowIndex: number, fromCol: number, toCol: number) {
  const row = ws.getRow(rowIndex);
  row.height = 20;
  for (let c = fromCol; c <= toCol; c++) {
    const cell = ws.getCell(rowIndex, c);
    cell.font = { bold: true, color: { argb: COLOR.darkText } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.headerFill } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    setBorderThin(cell);
  }
}
function styleDataRow(ws: ExcelJS.Worksheet, rowIndex: number, fromCol: number, toCol: number, alt = false) {
  const row = ws.getRow(rowIndex);
  row.height = 18;
  for (let c = fromCol; c <= toCol; c++) {
    const cell = ws.getCell(rowIndex, c);
    cell.alignment = { vertical: "middle", wrapText: true };
    if (alt) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.altFill } };
    setBorderThin(cell);
  }
}

export async function GET(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

    const admin = await requireAdmin(token);
    if (!admin.ok) return NextResponse.json({ error: admin.reason }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month") || new Date().toISOString().slice(0, 7);
    const employee = searchParams.get("employee") || "all";
    const status = (searchParams.get("status") || "all") as "all" | "pending" | "approved";

    const { firstDate, lastDate } = monthToRange(month);
    const labelMonth = monthLabelFR(month);

    // maps: sites / employees
    const { data: sites, error: sErr } = await supabaseAdmin.from("sites").select("id,name");
    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
    const siteMap = new Map((sites ?? []).map((s: any) => [String(s.id), String(s.name ?? "")]));

    const { data: profs, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("user_id,full_name,is_active")
      .eq("is_active", true);
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
    const empMap = new Map((profs ?? []).map((p: any) => [String(p.user_id), String(p.full_name ?? "")]));

    // overtime entries for month
    let q = supabaseAdmin
      .from("overtime_entries")
      .select("id,user_id,work_date,site_id,start_time,end_time,hours,reason,is_approved,approved_at")
      .gte("work_date", firstDate)
      .lte("work_date", lastDate)
      .order("work_date", { ascending: true });

    if (employee !== "all") q = q.eq("user_id", employee);
    if (status === "pending") q = q.eq("is_approved", false);
    if (status === "approved") q = q.eq("is_approved", true);

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const rows = (data ?? []) as any as Entry[];

    // payments for month (heures déjà payées)
    let pq = supabaseAdmin.from("overtime_payments").select("user_id,paid_hours").eq("pay_month", month);
    if (employee !== "all") pq = pq.eq("user_id", employee);
    const { data: pays, error: payErr } = await pq;
    if (payErr) return NextResponse.json({ error: payErr.message }, { status: 500 });

    const paidByUser = new Map<string, number>();
    for (const p of (pays ?? []) as any[]) {
      const uid = String(p.user_id);
      paidByUser.set(uid, (paidByUser.get(uid) ?? 0) + Number(p.paid_hours ?? 0));
    }

    // requests for month (demandé à payer)
    let rq = supabaseAdmin.from("overtime_requests").select("user_id,requested_hours,note").eq("request_month", month);
    if (employee !== "all") rq = rq.eq("user_id", employee);
    const { data: reqs, error: reqErr } = await rq;
    if (reqErr) return NextResponse.json({ error: reqErr.message }, { status: 500 });

    const reqByUser = new Map<string, OvertimeRequest>();
    for (const r of (reqs ?? []) as any[]) {
      reqByUser.set(String(r.user_id), { hours: Number(r.requested_hours ?? 0), note: (r.note ?? null) as any });
    }

    // totals by employee
    const totalByUser = new Map<string, number>();
    const approvedByUser = new Map<string, number>();
    const pendingByUser = new Map<string, number>();

    for (const r of rows) {
      const uid = String(r.user_id);
      const h = Number(r.hours ?? 0);
      totalByUser.set(uid, (totalByUser.get(uid) ?? 0) + h);
      if (r.is_approved) approvedByUser.set(uid, (approvedByUser.get(uid) ?? 0) + h);
      else pendingByUser.set(uid, (pendingByUser.get(uid) ?? 0) + h);
    }

    const userIds = Array.from(
      new Set([
        ...Array.from(totalByUser.keys()),
        ...Array.from(paidByUser.keys()),
        ...Array.from(reqByUser.keys()),
      ])
    ).sort((a, b) => (empMap.get(a) ?? a).localeCompare(empMap.get(b) ?? b));

    // workbook
    const wb = new ExcelJS.Workbook();
    wb.creator = "Gaillard Pointage";
    wb.created = new Date();

    // =========================
    // Sheet 1: RÉSUMÉ
    // =========================
    const wsR = wb.addWorksheet("Résumé");
    wsR.pageSetup = {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
      printTitlesRow: "1:6",
    };

    wsR.getColumn(1).width = 2;
    wsR.getColumn(2).width = 30; // Employé
    wsR.getColumn(3).width = 14; // Total
    wsR.getColumn(4).width = 14; // Validé
    wsR.getColumn(5).width = 14; // En attente
    wsR.getColumn(6).width = 14; // Demandé
    wsR.getColumn(7).width = 14; // Déjà payé
    wsR.getColumn(8).width = 14; // Solde
    wsR.getColumn(9).width = 26; // Remarque
    wsR.getColumn(10).width = 2;

    wsR.mergeCells("B1:I1");
    wsR.getRow(1).height = 30;
    wsR.getCell("B1").value = "GAILLARD Jean-Paul SA";
    wsR.getCell("B1").font = { bold: true, size: 20, color: { argb: COLOR.primaryRed } };
    wsR.getCell("B1").alignment = { horizontal: "left", vertical: "middle" };
    wsR.getCell("B1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.bandFill } };

    wsR.mergeCells("B2:I2");
    wsR.getRow(2).height = 18;
    wsR.getCell("B2").value = "Heures supplémentaires — Résumé (validation + demandé + paiement)";
    wsR.getCell("B2").font = { bold: true, size: 12, color: { argb: COLOR.subText } };
    wsR.getCell("B2").alignment = { horizontal: "left", vertical: "middle" };

    wsR.mergeCells("B3:I3");
    wsR.getRow(3).height = 18;
    wsR.getCell("B3").value =
      `Mois : ${labelMonth}   |   Employé : ${employee === "all" ? "Tous" : (empMap.get(employee) ?? employee)}   |   Validation : ${status}`;
    wsR.getCell("B3").font = { bold: false, size: 11, color: { argb: COLOR.subText } };
    wsR.getCell("B3").alignment = { horizontal: "left", vertical: "middle" };

    wsR.mergeCells("B4:I4");
    wsR.getRow(4).height = 10;
    wsR.getCell("B4").fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.primaryRed } };

    const headRow = 6;
    wsR.getRow(5).height = 8;

    wsR.getCell(headRow, 2).value = "Employé";
    wsR.getCell(headRow, 3).value = "Total saisi (h)";
    wsR.getCell(headRow, 4).value = "Validé (h)";
    wsR.getCell(headRow, 5).value = "En attente (h)";
    wsR.getCell(headRow, 6).value = "Demandé (h)";
    wsR.getCell(headRow, 7).value = "Déjà payé (h)";
    wsR.getCell(headRow, 8).value = "Solde (h)";
    wsR.getCell(headRow, 9).value = "Remarque";
    styleHeaderRow(wsR, headRow, 2, 9);
    wsR.views = [{ state: "frozen", ySplit: headRow }];

    let rr = headRow;
    let gTot = 0, gApp = 0, gPend = 0, gReq = 0, gPaid = 0, gBal = 0;

    for (const uid of userIds) {
      const name = empMap.get(uid) ?? uid;

      const total = Number((totalByUser.get(uid) ?? 0).toFixed(2));
      const approved = Number((approvedByUser.get(uid) ?? 0).toFixed(2));
      const pending = Number((pendingByUser.get(uid) ?? 0).toFixed(2));
      const paidH = Number((paidByUser.get(uid) ?? 0).toFixed(2));

      const reqRow: OvertimeRequest | undefined = reqByUser.get(uid);
      const requestedRaw = reqRow ? Number(reqRow.hours ?? 0) : total; // défaut = payer tout
      const requested = Number(clamp(requestedRaw, 0, total).toFixed(2));

      const balance = Number((approved - paidH).toFixed(2));

      // ✅ FIX TS + logique plus claire
      const reqNote = reqRow?.note ? `Demande: ${reqRow.note}` : "";
      const creditNote = balance < 0 ? (reqNote ? " | " : "") + "Crédit (trop payé)" : "";
      const autoNote = !reqRow ? ((reqNote || balance < 0) ? " | " : "") + "Auto (pas de demande)" : "";
      const remark = reqNote + creditNote + autoNote;

      gTot += total; gApp += approved; gPend += pending; gReq += requested; gPaid += paidH; gBal += balance;

      rr++;
      wsR.getCell(rr, 2).value = name;
      wsR.getCell(rr, 3).value = total;
      wsR.getCell(rr, 4).value = approved;
      wsR.getCell(rr, 5).value = pending;
      wsR.getCell(rr, 6).value = requested;
      wsR.getCell(rr, 7).value = paidH;
      wsR.getCell(rr, 8).value = balance;
      wsR.getCell(rr, 9).value = remark;

      for (let c = 3; c <= 8; c++) wsR.getCell(rr, c).numFmt = "0.00";

      wsR.getCell(rr, 2).alignment = { horizontal: "left", vertical: "middle" };
      for (let c = 3; c <= 8; c++) wsR.getCell(rr, c).alignment = { horizontal: "right", vertical: "middle" };
      wsR.getCell(rr, 9).alignment = { horizontal: "left", vertical: "middle", wrapText: true };

      styleDataRow(wsR, rr, 2, 9, (rr - headRow) % 2 === 0);
    }

    rr += 2;
    wsR.getRow(rr).height = 20;
    wsR.getCell(rr, 2).value = "TOTAL";
    wsR.getCell(rr, 3).value = Number(gTot.toFixed(2));
    wsR.getCell(rr, 4).value = Number(gApp.toFixed(2));
    wsR.getCell(rr, 5).value = Number(gPend.toFixed(2));
    wsR.getCell(rr, 6).value = Number(gReq.toFixed(2));
    wsR.getCell(rr, 7).value = Number(gPaid.toFixed(2));
    wsR.getCell(rr, 8).value = Number(gBal.toFixed(2));
    wsR.getCell(rr, 9).value = "";

    for (let c = 2; c <= 9; c++) {
      const cell = wsR.getCell(rr, c);
      cell.font = { bold: true, color: { argb: COLOR.darkText } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.headerFill } };
      cell.alignment = c === 2 ? { horizontal: "left", vertical: "middle" } : { horizontal: "right", vertical: "middle" };
      setBorderThin(cell);
    }
    for (let c = 3; c <= 8; c++) wsR.getCell(rr, c).numFmt = "0.00";

    // =========================
    // Sheet 2: DÉTAILS
    // =========================
    const wsD = wb.addWorksheet("Détails");
    wsD.pageSetup = {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
      printTitlesRow: "1:6",
    };

    wsD.getColumn(1).width = 2;
    wsD.getColumn(2).width = 12;
    wsD.getColumn(3).width = 22;
    wsD.getColumn(4).width = 28;
    wsD.getColumn(5).width = 8;
    wsD.getColumn(6).width = 8;
    wsD.getColumn(7).width = 10;
    wsD.getColumn(8).width = 12;
    wsD.getColumn(9).width = 44;
    wsD.getColumn(10).width = 2;

    wsD.mergeCells("B1:I1");
    wsD.getRow(1).height = 30;
    wsD.getCell("B1").value = "GAILLARD Jean-Paul SA";
    wsD.getCell("B1").font = { bold: true, size: 20, color: { argb: COLOR.primaryRed } };
    wsD.getCell("B1").alignment = { horizontal: "left", vertical: "middle" };
    wsD.getCell("B1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.bandFill } };

    wsD.mergeCells("B2:I2");
    wsD.getRow(2).height = 18;
    wsD.getCell("B2").value = `Détails — Mois : ${labelMonth}`;
    wsD.getCell("B2").font = { bold: true, size: 12, color: { argb: COLOR.subText } };
    wsD.getCell("B2").alignment = { horizontal: "left", vertical: "middle" };

    wsD.mergeCells("B3:I3");
    wsD.getRow(3).height = 18;
    wsD.getCell("B3").value = `Employé : ${employee === "all" ? "Tous" : (empMap.get(employee) ?? employee)}   |   Validation : ${status}`;
    wsD.getCell("B3").font = { bold: false, size: 11, color: { argb: COLOR.subText } };
    wsD.getCell("B3").alignment = { horizontal: "left", vertical: "middle" };

    wsD.mergeCells("B4:I4");
    wsD.getRow(4).height = 10;
    wsD.getCell("B4").fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.primaryRed } };

    const dHead = 6;
    wsD.getRow(5).height = 8;

    wsD.getCell(dHead, 2).value = "Date";
    wsD.getCell(dHead, 3).value = "Employé";
    wsD.getCell(dHead, 4).value = "Chantier";
    wsD.getCell(dHead, 5).value = "De";
    wsD.getCell(dHead, 6).value = "À";
    wsD.getCell(dHead, 7).value = "Heures";
    wsD.getCell(dHead, 8).value = "Validation";
    wsD.getCell(dHead, 9).value = "Motif";
    styleHeaderRow(wsD, dHead, 2, 9);
    wsD.views = [{ state: "frozen", ySplit: dHead }];

    let dr = dHead;
    rows.forEach((it, idx) => {
      dr++;
      const empName = empMap.get(String(it.user_id)) ?? String(it.user_id);
      const chantier = it.site_id ? (siteMap.get(String(it.site_id)) ?? "-") : "-";
      const valid = it.is_approved ? "VALIDÉ" : "EN ATTENTE";

      wsD.getCell(dr, 2).value = it.work_date;
      wsD.getCell(dr, 3).value = empName;
      wsD.getCell(dr, 4).value = chantier;
      wsD.getCell(dr, 5).value = t5(it.start_time);
      wsD.getCell(dr, 6).value = t5(it.end_time);
      wsD.getCell(dr, 7).value = Number(Number(it.hours ?? 0).toFixed(2));
      wsD.getCell(dr, 7).numFmt = "0.00";
      wsD.getCell(dr, 8).value = valid;
      wsD.getCell(dr, 9).value = it.reason ?? "";

      wsD.getCell(dr, 2).alignment = { horizontal: "center", vertical: "middle" };
      wsD.getCell(dr, 3).alignment = { horizontal: "left", vertical: "middle" };
      wsD.getCell(dr, 4).alignment = { horizontal: "left", vertical: "middle", wrapText: true };
      wsD.getCell(dr, 5).alignment = { horizontal: "center", vertical: "middle" };
      wsD.getCell(dr, 6).alignment = { horizontal: "center", vertical: "middle" };
      wsD.getCell(dr, 7).alignment = { horizontal: "right", vertical: "middle" };
      wsD.getCell(dr, 8).alignment = { horizontal: "center", vertical: "middle" };
      wsD.getCell(dr, 9).alignment = { horizontal: "left", vertical: "middle", wrapText: true };

      styleDataRow(wsD, dr, 2, 9, idx % 2 === 0);
    });

    const bufAny = await wb.xlsx.writeBuffer();
    const out = Buffer.isBuffer(bufAny) ? bufAny : Buffer.from(bufAny as ArrayBuffer);

    return new NextResponse(out, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="HeuresSupp_${month}.xlsx"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err), stack: err?.stack ?? null }, { status: 500 });
  }
}
