import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import fs from "fs/promises";
import path from "path";

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

async function tryRead(relPath: string): Promise<Uint8Array | null> {
  try {
    const p = path.join(process.cwd(), relPath);
    const b = await fs.readFile(p);
    return new Uint8Array(b);
  } catch {
    return null;
  }
}

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
    const monthLabel = monthLabelFR(ym);

    // ✅ check validated month for this employee
    const { data: stOk, error: stErr } = await supabaseAdmin
      .from("timesheet_months")
      .select("status")
      .eq("user_id", user_id)
      .eq("month", ym)
      .maybeSingle();

    if (stErr) return NextResponse.json({ error: stErr.message }, { status: 500 });
    if (!stOk || String(stOk.status) !== "approved") {
      return NextResponse.json({ error: "MONTH_NOT_APPROVED" }, { status: 403 });
    }

    // profile
    const { data: prof, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("user_id", user_id)
      .maybeSingle();

    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
    const fullName = safeText(prof?.full_name ?? "");

    // sites
    const { data: sites, error: sitesErr } = await supabaseAdmin.from("sites").select("id,name");
    if (sitesErr) return NextResponse.json({ error: sitesErr.message }, { status: 500 });
    const siteName = new Map((sites ?? []).map((s: any) => [String(s.id), safeText(String(s.name ?? ""))]));

    // daily_status
    const { data: stRows, error: dsErr } = await supabaseAdmin
      .from("daily_status")
      .select("work_date,day_type,note,site_id,start_time,break_start,break_end,end_time")
      .eq("user_id", user_id)
      .gte("work_date", firstDate)
      .lte("work_date", lastDate)
      .order("work_date", { ascending: true });

    if (dsErr) return NextResponse.json({ error: dsErr.message }, { status: 500 });

    const statusMap = new Map<string, any>();
    for (const r of (stRows ?? []) as any[]) statusMap.set(String(r.work_date), r);

    // logs multi
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

    let travel = 0,
      meals = 0,
      misc = 0;
    for (const r of (expRows ?? []) as any[]) {
      travel += Number(r.travel_chf ?? 0);
      meals += Number(r.meals_qty ?? 0);
      misc += Number(r.misc_chf ?? 0);
    }

    // logo jpg preferred
    const logoJpg = await tryRead("public/gaillard-logo.jpg");
    const logoPng = await tryRead("public/gaillard-logo.png");
    const logo = logoJpg ?? logoPng ?? null;

    // PDF
    const weeks = getWeeksForMonth(y, m0);
    const colCount = weeks.length;

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const logoImg = logo
      ? (logoJpg ? await pdfDoc.embedJpg(logoJpg) : await pdfDoc.embedPng(logoPng!))
      : null;

    const PAGE_W = 842;
    const PAGE_H = 595;
    const MARGIN = 24;

    const dayFont = colCount >= 6 ? 9 : 10;
    const smallFont = colCount >= 6 ? 8 : 9;

    const page = pdfDoc.addPage([PAGE_W, PAGE_H]);

    const headerTop = PAGE_H - MARGIN;
    if (logoImg) page.drawImage(logoImg, { x: MARGIN, y: headerTop - 86, width: 260, height: 78 });

    page.drawText(safeText(`Nom de l'employe : ${fullName}`), {
      x: PAGE_W - MARGIN - 320,
      y: headerTop - 38,
      size: 12,
      font: fontBold,
    });

    page.drawText(safeText(`Mois de : ${monthLabel}`), {
      x: PAGE_W - MARGIN - 320,
      y: headerTop - 58,
      size: 12,
      font: fontBold,
    });

    const gridTop = PAGE_H - 150;
    const gridLeft = MARGIN;
    const gridW = PAGE_W - 2 * MARGIN;
    const colW = gridW / colCount;

    const dayH = 64;
    const totalH = 22;

    let monthTotal = 0;

    for (let w = 0; w < weeks.length; w++) {
      const x0 = gridLeft + w * colW;
      let weekTotal = 0;

      for (let d = 0; d < 5; d++) {
        const y0 = gridTop - d * dayH;

        page.drawRectangle({
          x: x0,
          y: y0 - dayH,
          width: colW,
          height: dayH,
          borderWidth: 1,
          borderColor: rgb(0, 0, 0),
        });

        const date = addDays(weeks[w], d);
        const inMonth = date.getMonth() === m0;

        const line1 = inMonth ? safeText(`${frDayName(d)}  ${fmtFRDate(date)}`) : safeText(frDayName(d));
        let line2 = "";
        let line3 = "";

        if (inMonth) {
          const key = `${y}-${String(m0 + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
          const st = statusMap.get(key);
          const dt: DayType = (st?.day_type ?? "work") as DayType;

          if (dt !== "work") {
            line2 = dayTypeLabel(dt, st?.note);
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
              const chantier = st.site_id ? (siteName.get(String(st.site_id)) ?? "-") : "-";
              const h = calcHoursFromStatus(st);
              total += h;
              if (h > 0) entries.push({ name: chantier, hours: h });
            }

            line2 = safeText(compactChantiers(entries, 2));
            line3 = safeText(`Heures : ${total > 0 ? total.toFixed(2) : "0.00"} h`);

            weekTotal += total;
            monthTotal += total;
          }
        }

        page.drawText(line1, { x: x0 + 6, y: y0 - 16, size: dayFont, font: fontBold });

        if (line2) {
          page.drawText(line2, {
            x: x0 + 6,
            y: y0 - 32,
            size: smallFont,
            font: line2.startsWith("Chantiers") ? font : fontBold,
          });
        }
        if (line3) {
          page.drawText(line3, { x: x0 + 6, y: y0 - 48, size: smallFont, font: fontBold });
        }
      }

      const yT = gridTop - 5 * dayH;
      page.drawRectangle({
        x: x0,
        y: yT - totalH,
        width: colW,
        height: totalH,
        borderWidth: 1,
        borderColor: rgb(0, 0, 0),
      });

      page.drawText(safeText(`Total semaine : ${weekTotal.toFixed(2)} h`), {
        x: x0 + 6,
        y: yT - 16,
        size: smallFont,
        font: fontBold,
      });
    }

    const bottomY = 45;

    page.drawText(safeText(`Frais de deplacement :  ${travel.toFixed(2)} CHF`), {
      x: MARGIN,
      y: bottomY + 32,
      size: 10,
      font: fontBold,
    });

    page.drawText(safeText(`Repas exterieurs      :  ${meals}`), {
      x: MARGIN,
      y: bottomY + 16,
      size: 10,
      font: fontBold,
    });

    page.drawText(safeText(`Frais divers          :  ${misc.toFixed(2)} CHF`), {
      x: MARGIN,
      y: bottomY,
      size: 10,
      font: fontBold,
    });

    page.drawText(safeText(`Total des heures du mois = ${monthTotal.toFixed(2)} heures`), {
      x: PAGE_W - MARGIN - 360,
      y: bottomY + 14,
      size: 14,
      font: fontBold,
    });

    const pdfBytes = await pdfDoc.save();

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Bordereau_${ym}.pdf"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err), stack: err?.stack ?? null }, { status: 500 });
  }
}
