import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type DayType = "work" | "holiday" | "sick" | "leave" | "accident" | "vacation" | "other";
type LogRow = {
  work_date: string;
  site_id: string | null;
  segment_type: "work" | "pause";
  started_at: string;
  ended_at: string | null;
};

function safeText(s: string) {
  if (!s) return "";
  let t = String(s)
    .replace(/\u2192/g, "->")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u2019/g, "'")
    .replace(/\u00A0/g, " ");
  let out = "";
  for (const ch of t) {
    const cp = ch.codePointAt(0) ?? 0;
    out += cp <= 255 ? ch : "?";
  }
  return out;
}
function clip(t: string, n: number) {
  const s = safeText(t);
  if (!s) return "";
  if (s.length <= n) return s;
  if (n <= 3) return s.slice(0, n);
  return s.slice(0, n - 3) + "...";
}

function normYM(month: string) {
  const m = String(month ?? "").match(/(\d{4})-(\d{1,2})/);
  if (!m) return "";
  return `${m[1]}-${String(parseInt(m[2], 10)).padStart(2, "0")}`;
}

function monthToRange(month: string) {
  const ym = normYM(month);
  const [yStr, mStr] = ym.split("-");
  const y = parseInt(yStr, 10);
  const m0 = parseInt(mStr, 10) - 1;
  const lastDay = new Date(y, m0 + 1, 0).getDate();
  const firstDate = `${y}-${String(m0 + 1).padStart(2, "0")}-01`;
  const lastDate = `${y}-${String(m0 + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { y, m0, firstDate, lastDate, ym };
}

function monthLabelFR(month: string) {
  const ym = normYM(month);
  const [y, mo] = ym.split("-");
  const d = new Date(parseInt(y, 10), parseInt(mo, 10) - 1, 1);
  return safeText(d.toLocaleDateString("fr-CH", { month: "long", year: "numeric" }));
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
  return safeText(["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"][i] ?? "");
}
function fmtFRDate(d: Date) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}.${mm}.${yy}`;
}

function dayTypeLabel(t: DayType, note?: string | null) {
  const n = safeText(note ?? "");
  switch (t) {
    case "holiday":
      return "FERIE";
    case "sick":
      return "MALADIE";
    case "leave":
      return "CONGE";
    case "accident":
      return "ACCIDENT";
    case "vacation":
      return "VACANCES";
    case "other":
      return n.trim() ? `AUTRE: ${n.trim()}` : "AUTRE";
    default:
      return "";
  }
}

function toMinutes(hhmm: string | null | undefined) {
  if (!hhmm) return null;
  const v = String(hhmm).slice(0, 5);
  const [h, m] = v.split(":").map((x) => parseInt(x, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}
function calcHoursFromStatus(r: any) {
  const st = toMinutes(r.start_time);
  const bs = toMinutes(r.break_start);
  const be = toMinutes(r.break_end);
  const et = toMinutes(r.end_time);
  if (st == null || et == null) return 0;
  const total = Math.max(0, et - st);
  const pause = bs != null && be != null ? Math.max(0, be - bs) : 0;
  return Math.max(0, total - pause) / 60;
}
function minutesBetween(aIso: string, bIso: string) {
  const a = new Date(aIso).getTime();
  const b = new Date(bIso).getTime();
  return Math.max(0, Math.round((b - a) / 60000));
}

function compactChantiers(entries: Array<{ name: string; hours: number }>, maxShow = 2) {
  if (!entries.length) return "Chantiers: -";
  const sorted = [...entries].sort((a, b) => b.hours - a.hours);
  const shown = sorted.slice(0, maxShow);
  const more = sorted.length - shown.length;
  const parts = shown.map((e) => `${clip(e.name, 18)} ${e.hours.toFixed(2)}h`);
  let s = `Chantiers: ${parts.join(" / ")}`;
  if (more > 0) s += ` (+${more})`;
  return s;
}

// fallback decode sub
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
    const monthParam = searchParams.get("month") || new Date().toISOString().slice(0, 7);

    const { y, m0, firstDate, lastDate, ym } = monthToRange(monthParam);
    const labelMonth = monthLabelFR(ym);

    // ✅ vérif validé
    const { data: okRow, error: okErr } = await supabaseAdmin
      .from("timesheet_months")
      .select("status")
      .eq("user_id", user_id)
      .eq("month", ym)
      .maybeSingle();

    if (okErr) return NextResponse.json({ error: okErr.message }, { status: 500 });
    if (!okRow || String(okRow.status) !== "approved") {
      return NextResponse.json({ error: "MONTH_NOT_APPROVED" }, { status: 403 });
    }

    // profile
    const { data: prof, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("user_id", user_id)
      .maybeSingle();
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

    const fullName = safeText(prof?.full_name ?? "Employe");

    // sites
    const { data: sites, error: sErr } = await supabaseAdmin.from("sites").select("id,name");
    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
    const siteName = new Map((sites ?? []).map((s: any) => [String(s.id), safeText(String(s.name ?? ""))]));

    // daily_status
    const { data: stRows, error: stErr } = await supabaseAdmin
      .from("daily_status")
      .select("work_date,day_type,note,site_id,start_time,break_start,break_end,end_time")
      .eq("user_id", user_id)
      .gte("work_date", firstDate)
      .lte("work_date", lastDate);
    if (stErr) return NextResponse.json({ error: stErr.message }, { status: 500 });

    const statusMap = new Map<string, any>();
    for (const r of (stRows ?? []) as any[]) statusMap.set(String(r.work_date), r);

    // logs
    const { data: logs, error: logErr } = await supabaseAdmin
      .from("daily_site_logs")
      .select("work_date,site_id,segment_type,started_at,ended_at")
      .eq("user_id", user_id)
      .gte("work_date", firstDate)
      .lte("work_date", lastDate)
      .order("started_at", { ascending: true });

    if (logErr) return NextResponse.json({ error: logErr.message }, { status: 500 });

    const workByDaySite = new Map<string, Map<string, number>>();
    const nowIso = new Date().toISOString();

    for (const l of (logs ?? []) as any as LogRow[]) {
      if (l.segment_type !== "work") continue;
      if (!l.site_id) continue;

      const end = l.ended_at ?? nowIso;
      const mins = minutesBetween(l.started_at, end);
      if (mins <= 0) continue;

      if (!workByDaySite.has(l.work_date)) workByDaySite.set(l.work_date, new Map());
      const m = workByDaySite.get(l.work_date)!;
      m.set(String(l.site_id), (m.get(String(l.site_id)) ?? 0) + mins);
    }

    // expenses totals
    const { data: expRows, error: expErr } = await supabaseAdmin
      .from("daily_expenses")
      .select("travel_chf,meals_qty,misc_chf")
      .eq("user_id", user_id)
      .gte("work_date", firstDate)
      .lte("work_date", lastDate);

    if (expErr) return NextResponse.json({ error: expErr.message }, { status: 500 });

    let travel = 0, meals = 0, misc = 0;
    for (const r of (expRows ?? []) as any[]) {
      travel += Number(r.travel_chf ?? 0);
      meals += Number(r.meals_qty ?? 0);
      misc += Number(r.misc_chf ?? 0);
    }

    const weeks = getWeeksForMonth(y, m0);
    const colCount = weeks.length;

    const wb = new ExcelJS.Workbook();
    wb.creator = "Gaillard Pointage";
    wb.created = new Date();

    const ws = wb.addWorksheet(clip(fullName, 28));
    ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 1 };
    ws.getColumn(1).width = 2;

    const startCol = 2;
    const lastCol = startCol + colCount - 1;
    for (let c = startCol; c <= lastCol; c++) ws.getColumn(c).width = colCount >= 6 ? 26 : 30;

    // Header
    ws.getRow(1).height = 30;
    ws.getRow(2).height = 18;
    ws.getRow(3).height = 16;
    ws.getRow(4).height = 12;
    ws.getRow(5).height = 8;

    ws.mergeCells(1, startCol, 1, lastCol);
    ws.getCell(1, startCol).value = "GAILLARD Jean-Paul SA";
    ws.getCell(1, startCol).font = { bold: true, size: 22, color: { argb: "FFB40000" } };
    ws.getCell(1, startCol).alignment = { horizontal: "left", vertical: "middle" };

    const rightStart = Math.max(startCol, lastCol - 1);
    const leftEnd = Math.max(startCol, rightStart - 1);

    if (leftEnd >= startCol) {
      ws.mergeCells(2, startCol, 2, leftEnd);
      ws.getCell(2, startCol).value = "PEINTURE - TAPISSERIE - RENOVATION";
      ws.getCell(2, startCol).font = { bold: true, size: 12, color: { argb: "FF111111" } };
      ws.getCell(2, startCol).alignment = { horizontal: "left", vertical: "middle" };

      ws.mergeCells(3, startCol, 3, leftEnd);
      ws.getCell(3, startCol).value = "Av. Louis-Weck-Reynold 40, 1700 Fribourg";
      ws.getCell(3, startCol).font = { size: 10, color: { argb: "FF444444" } };
      ws.getCell(3, startCol).alignment = { horizontal: "left", vertical: "middle" };
    }

    ws.mergeCells(2, rightStart, 2, lastCol);
    ws.mergeCells(3, rightStart, 3, lastCol);

    ws.getCell(2, rightStart).value = `Mois : ${labelMonth}`;
    ws.getCell(2, rightStart).font = { bold: true, size: 12 };
    ws.getCell(2, rightStart).alignment = { horizontal: "right", vertical: "middle" };

    ws.getCell(3, rightStart).value = `Employe : ${fullName}`;
    ws.getCell(3, rightStart).font = { bold: true, size: 12 };
    ws.getCell(3, rightStart).alignment = { horizontal: "right", vertical: "middle" };

    ws.mergeCells(4, startCol, 4, lastCol);
    ws.getCell(4, startCol).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFB40000" } };

    // Grid
    const gridStartRow = 6;
    for (let rr = 0; rr < 5; rr++) ws.getRow(gridStartRow + rr).height = 55;
    ws.getRow(gridStartRow + 5).height = 22;
    ws.views = [{ state: "frozen", ySplit: gridStartRow - 1 }];

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
              { text: l2, font: { bold: false, size: 10 } },
            ],
          };
        } else {
          const bySite = workByDaySite.get(key);
          let total = 0;
          let entries: Array<{ name: string; hours: number }> = [];

          if (bySite && bySite.size > 0) {
            for (const [sid, mins] of bySite.entries()) {
              const h = mins / 60;
              total += h;
              entries.push({ name: siteName.get(sid) ?? "-", hours: h });
            }
          } else if (st) {
            const sid = st.site_id ? String(st.site_id) : "";
            const chantier = sid ? (siteName.get(sid) ?? sid) : "-";
            const h = calcHoursFromStatus(st);
            total += h;
            if (h > 0) entries.push({ name: chantier, hours: h });
          }

          const l2 = compactChantiers(entries, 2);
          const l3 = `Heures : ${total.toFixed(2)} h`;

          cell.value = {
            richText: [
              { text: line1 + "\n", font: { bold: true, size: 10 } },
              { text: l2 + "\n", font: { bold: false, size: 9 } },
              { text: l3, font: { bold: true, size: 9 } },
            ],
          };

          weekTotal += total;
          monthTotal += total;
        }
      }

      const totalCell = ws.getCell(gridStartRow + 5, col);
      totalCell.value = `Total semaine : ${weekTotal.toFixed(2)} h`;
      totalCell.font = { bold: true, size: 9 };
      totalCell.alignment = { vertical: "middle" };
      totalCell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
    }

    // bottom totals
    const bottomRow = gridStartRow + 7;
    ws.getCell(bottomRow, startCol).value = `Frais de deplacement :  ${travel.toFixed(2)} CHF`;
    ws.getCell(bottomRow + 1, startCol).value = `Repas exterieurs      :  ${meals}`;
    ws.getCell(bottomRow + 2, startCol).value = `Frais divers          :  ${misc.toFixed(2)} CHF`;
    ws.getCell(bottomRow, startCol).font = { bold: true };
    ws.getCell(bottomRow + 1, startCol).font = { bold: true };
    ws.getCell(bottomRow + 2, startCol).font = { bold: true };

    const totalStartCol = Math.max(startCol, lastCol - 1);
    ws.mergeCells(bottomRow + 1, totalStartCol, bottomRow + 1, lastCol);
    ws.getCell(bottomRow + 1, totalStartCol).value = `Total des heures du mois = ${monthTotal.toFixed(2)} heures`;
    ws.getCell(bottomRow + 1, totalStartCol).font = { bold: true, size: 14 };
    ws.getCell(bottomRow + 1, totalStartCol).alignment = { horizontal: "right" };

    const bufAny = await wb.xlsx.writeBuffer();
    const out = Buffer.isBuffer(bufAny) ? bufAny : Buffer.from(bufAny as ArrayBuffer);

    return new NextResponse(out, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Bordereau_${ym}.xlsx"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err), stack: err?.stack ?? null }, { status: 500 });
  }
}
