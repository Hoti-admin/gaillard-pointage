import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type DayType = "work" | "holiday" | "sick" | "leave" | "accident" | "vacation" | "other";

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

function monthToRange(month: string) {
  const [yStr, mStr] = month.split("-");
  const y = parseInt(yStr, 10);
  const m0 = parseInt(mStr, 10) - 1;
  const lastDay = new Date(y, m0 + 1, 0).getDate();
  const firstDate = `${y}-${String(m0 + 1).padStart(2, "0")}-01`;
  const lastDate = `${y}-${String(m0 + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { y, m0, firstDate, lastDate };
}
function monthLabelFR(month: string) {
  const [y, mo] = month.split("-");
  const d = new Date(parseInt(y, 10), parseInt(mo, 10) - 1, 1);
  return d.toLocaleDateString("fr-CH", { month: "long", year: "numeric" });
}
function mondayOfWeek(d: Date) {
  const dd = new Date(d);
  const jsDay = dd.getDay();
  const diff = (jsDay + 6) % 7;
  dd.setDate(dd.getDate() - diff);
  dd.setHours(0, 0, 0, 0);
  return dd;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function getWeeksForMonth(y: number, m0: number) {
  const first = new Date(y, m0, 1);
  const last = new Date(y, m0 + 1, 0);
  const start = mondayOfWeek(first);
  const end = mondayOfWeek(last);

  const weeks: Date[] = [];
  let cur = new Date(start);
  while (cur <= end) {
    weeks.push(new Date(cur));
    cur = addDays(cur, 7);
  }
  return weeks;
}
function frDayName(i: number) {
  return ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"][i] ?? "";
}
function fmtFRDate(d: Date) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}.${mm}.${yy}`;
}
function dayTypeLabel(t: DayType, note?: string | null) {
  const n = (note ?? "").trim();
  switch (t) {
    case "holiday": return "FERIE";
    case "sick": return "MALADIE";
    case "leave": return "CONGE";
    case "accident": return "ACCIDENT";
    case "vacation": return "VACANCES";
    case "other": return n ? `AUTRE: ${n}` : "AUTRE";
    default: return "";
  }
}
function minutesBetween(aIso: string, bIso: string) {
  const a = new Date(aIso).getTime();
  const b = new Date(bIso).getTime();
  return Math.max(0, Math.round((b - a) / 60000));
}

type LogRow = {
  work_date: string;
  site_id: string | null;
  segment_type: "work" | "pause";
  started_at: string;
  ended_at: string | null;
};

export async function GET(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

    const au = await requireUser(token);
    if (!au.ok) return NextResponse.json({ error: au.reason }, { status: au.status });

    const isAdmin = au.role === "admin";

    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month") || new Date().toISOString().slice(0, 7);
    let employee = searchParams.get("employee") || "all";
    let status = searchParams.get("status") || "approved";

    if (!isAdmin) {
      employee = au.userId;
      status = "approved";
    } else {
      if (employee === "self") employee = au.userId;
    }

    const { y, m0, firstDate, lastDate } = monthToRange(month);
    const labelMonth = monthLabelFR(month);

    // sites
    const { data: sites, error: sitesErr } = await supabaseAdmin.from("sites").select("id,name");
    if (sitesErr) return NextResponse.json({ error: sitesErr.message }, { status: 500 });
    const siteName = new Map((sites ?? []).map((s: any) => [String(s.id), String(s.name ?? "")]));

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

    // workbook
    const wb = new ExcelJS.Workbook();
    wb.creator = "Gaillard Pointage";
    wb.created = new Date();

    for (const emp of employees) {
      const ws = wb.addWorksheet((emp.full_name || "Employe").slice(0, 28));
      ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 1 };

      const weeks = getWeeksForMonth(y, m0);
      const colCount = weeks.length;
      const startCol = 2;
      const lastCol = startCol + colCount - 1;

      ws.getColumn(1).width = 2;
      for (let c = startCol; c <= lastCol; c++) ws.getColumn(c).width = colCount >= 6 ? 28 : 32;

      // Header simple pro
      ws.getRow(1).height = 30;
      ws.mergeCells(1, startCol, 1, lastCol);
      ws.getCell(1, startCol).value = "GAILLARD Jean-Paul SA";
      ws.getCell(1, startCol).font = { bold: true, size: 20, color: { argb: "FFB40000" } };

      ws.getRow(2).height = 18;
      ws.mergeCells(2, startCol, 2, lastCol);
      ws.getCell(2, startCol).value = `Bordereau - ${labelMonth} - ${emp.full_name}`;
      ws.getCell(2, startCol).font = { bold: true, size: 12 };

      ws.getRow(3).height = 10;
      ws.mergeCells(3, startCol, 3, lastCol);
      ws.getCell(3, startCol).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFB40000" } };

      // Data
      const { data: stRows, error: stErr } = await supabaseAdmin
        .from("daily_status")
        .select("work_date,day_type,note,site_id,start_time,break_start,break_end,end_time")
        .eq("user_id", emp.user_id)
        .gte("work_date", firstDate)
        .lte("work_date", lastDate);

      if (stErr) return NextResponse.json({ error: stErr.message }, { status: 500 });
      const statusMap = new Map<string, any>();
      for (const r of (stRows ?? []) as any[]) statusMap.set(String(r.work_date), r);

      const { data: logs, error: logErr } = await supabaseAdmin
        .from("daily_site_logs")
        .select("work_date,site_id,segment_type,started_at,ended_at")
        .eq("user_id", emp.user_id)
        .gte("work_date", firstDate)
        .lte("work_date", lastDate)
        .order("started_at", { ascending: true });

      if (logErr) return NextResponse.json({ error: logErr.message }, { status: 500 });

      const workByDaySite = new Map<string, Map<string, number>>();
      const nowIso = new Date().toISOString();

      for (const l of (logs ?? []) as LogRow[]) {
        if (l.segment_type !== "work") continue;
        if (!l.site_id) continue;
        const end = l.ended_at ?? nowIso;
        const mins = minutesBetween(l.started_at, end);
        if (mins <= 0) continue;

        if (!workByDaySite.has(l.work_date)) workByDaySite.set(l.work_date, new Map());
        const m = workByDaySite.get(l.work_date)!;
        m.set(String(l.site_id), (m.get(String(l.site_id)) ?? 0) + mins);
      }

      // grid
      const gridStartRow = 5;
      for (let rr = 0; rr < 5; rr++) ws.getRow(gridStartRow + rr).height = 55;
      ws.getRow(gridStartRow + 5).height = 22;

      let monthTotal = 0;

      for (let w = 0; w < weeks.length; w++) {
        const col = startCol + w;
        let weekTotal = 0;

        for (let d = 0; d < 5; d++) {
          const row = gridStartRow + d;
          const cell = ws.getCell(row, col);

          cell.alignment = { wrapText: true, vertical: "top" };
          cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };

          const date = addDays(weeks[w], d);
          const inMonth = date.getMonth() === m0;
          const line1 = inMonth ? `${frDayName(d)}  ${fmtFRDate(date)}` : `${frDayName(d)}`;

          if (!inMonth) {
            cell.value = { richText: [{ text: line1, font: { bold: true, size: 10 } }] };
            continue;
          }

          const key = `${y}-${String(m0 + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
          const st = statusMap.get(key);
          const dt: DayType = (st?.day_type ?? "work") as DayType;

          if (dt !== "work") {
            const l2 = dayTypeLabel(dt, st?.note);
            cell.value = {
              richText: [
                { text: line1 + "\n", font: { bold: true, size: 10 } },
                { text: l2, font: { bold: true, size: 10 } },
              ],
            };
          } else {
            const bySite = workByDaySite.get(key);
            let total = 0;

            if (bySite && bySite.size > 0) {
              for (const [, mins] of bySite.entries()) total += mins / 60;
            } else if (st) {
              // fallback: si tu utilises encore daily_status pour certains jours
              const stt = st.start_time ? String(st.start_time).slice(0, 5) : "";
              const ett = st.end_time ? String(st.end_time).slice(0, 5) : "";
              if (stt && ett) {
                // minimal
              }
            }

            const l2 = `Heures : ${total.toFixed(2)} h`;
            cell.value = {
              richText: [
                { text: line1 + "\n", font: { bold: true, size: 10 } },
                { text: l2, font: { bold: true, size: 10 } },
              ],
            };

            weekTotal += total;
            monthTotal += total;
          }
        }

        const totalCell = ws.getCell(gridStartRow + 5, col);
        totalCell.value = `Total semaine : ${weekTotal.toFixed(2)} h`;
        totalCell.font = { bold: true, size: 10 };
        totalCell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
      }

      const bottomRow = gridStartRow + 7;
      ws.mergeCells(bottomRow, startCol, bottomRow, lastCol);
      ws.getCell(bottomRow, startCol).value = `Total des heures du mois = ${monthTotal.toFixed(2)} heures`;
      ws.getCell(bottomRow, startCol).font = { bold: true, size: 14 };
      ws.getCell(bottomRow, startCol).alignment = { horizontal: "right" };
    }

    const bufAny = await wb.xlsx.writeBuffer();
    const out = Buffer.isBuffer(bufAny) ? bufAny : Buffer.from(bufAny as ArrayBuffer);

    const fileName = `Bordereau_${month}.xlsx`;

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
