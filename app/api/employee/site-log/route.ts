import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type Action = "start" | "switch" | "pause" | "stop";

function isYYYYMMDD(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export async function POST(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData.user) {
      return NextResponse.json({ error: "UNAUTHORIZED", detail: userErr?.message ?? "" }, { status: 401 });
    }
    const userId = userData.user.id;

    const body = await req.json();
    const action: Action = (body?.action ?? "start") as Action;
    const work_date = String(body?.work_date ?? "").trim();
    const site_id = body?.site_id ? String(body.site_id) : null;

    if (!isYYYYMMDD(work_date)) return NextResponse.json({ error: "Invalid work_date" }, { status: 400 });
    if ((action === "start" || action === "switch") && !site_id) {
      return NextResponse.json({ error: "site_id required" }, { status: 400 });
    }
    if (action === "pause" && !site_id) {
      // pour "fin pause" on a besoin du chantier de reprise, mais pour "debut pause" non
      // on gère ça plus bas selon l'état ouvert
    }

    const nowIso = new Date().toISOString();

    // Segment ouvert ?
    const { data: openRows, error: openErr } = await supabaseAdmin
      .from("daily_site_logs")
      .select("id,site_id,started_at,segment_type")
      .eq("user_id", userId)
      .eq("work_date", work_date)
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1);

    if (openErr) return NextResponse.json({ error: openErr.message }, { status: 500 });
    const open = openRows?.[0] ?? null;

    // STOP = ferme ce qui est ouvert
    if (action === "stop") {
      if (!open) return NextResponse.json({ ok: true, stopped: false });

      const { error: uErr } = await supabaseAdmin
        .from("daily_site_logs")
        .update({ ended_at: nowIso })
        .eq("id", open.id);

      if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });
      return NextResponse.json({ ok: true, stopped: true });
    }

    // START = démarre un segment WORK si rien n'est ouvert
    if (action === "start") {
      if (open) return NextResponse.json({ ok: true, already_open: true, open });

      const { data: ins, error: iErr } = await supabaseAdmin
        .from("daily_site_logs")
        .insert({
          user_id: userId,
          work_date,
          site_id,
          segment_type: "work",
          started_at: nowIso,
        })
        .select("id,site_id,started_at,ended_at,segment_type")
        .single();

      if (iErr && (iErr as any).code === "23505") return NextResponse.json({ ok: true, already_open: true });
      if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 });

      return NextResponse.json({ ok: true, started: true, row: ins });
    }

    // SWITCH = ferme ce qui est ouvert (work ou pause) puis ouvre un segment WORK sur le chantier choisi
    if (action === "switch") {
      if (open) {
        const { error: uErr } = await supabaseAdmin
          .from("daily_site_logs")
          .update({ ended_at: nowIso })
          .eq("id", open.id);
        if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });
      }

      const { data: ins2, error: iErr2 } = await supabaseAdmin
        .from("daily_site_logs")
        .insert({
          user_id: userId,
          work_date,
          site_id,
          segment_type: "work",
          started_at: nowIso,
        })
        .select("id,site_id,started_at,ended_at,segment_type")
        .single();

      if (iErr2 && (iErr2 as any).code === "23505") return NextResponse.json({ ok: true, already_open: true });
      if (iErr2) return NextResponse.json({ error: iErr2.message }, { status: 500 });

      return NextResponse.json({ ok: true, switched: true, row: ins2 });
    }

    // PAUSE = toggle
    // - si WORK ouvert -> ferme WORK et ouvre PAUSE
    // - si PAUSE ouvert -> ferme PAUSE et ouvre WORK sur site_id (obligatoire)
    if (action === "pause") {
      if (!open) {
        // pas de segment ouvert => on démarre une pause (optionnel)
        const { data: pIns, error: pErr } = await supabaseAdmin
          .from("daily_site_logs")
          .insert({
            user_id: userId,
            work_date,
            site_id: null,
            segment_type: "pause",
            started_at: nowIso,
          })
          .select("id,started_at,ended_at,segment_type")
          .single();

        if (pErr && (pErr as any).code === "23505") return NextResponse.json({ ok: true, already_open: true });
        if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

        return NextResponse.json({ ok: true, pause_started: true, row: pIns });
      }

      if (open.segment_type === "work") {
        // fin work + début pause
        const { error: uErr } = await supabaseAdmin
          .from("daily_site_logs")
          .update({ ended_at: nowIso })
          .eq("id", open.id);
        if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });

        const { data: pIns, error: pErr } = await supabaseAdmin
          .from("daily_site_logs")
          .insert({
            user_id: userId,
            work_date,
            site_id: null,
            segment_type: "pause",
            started_at: nowIso,
          })
          .select("id,started_at,ended_at,segment_type")
          .single();

        if (pErr && (pErr as any).code === "23505") return NextResponse.json({ ok: true, already_open: true });
        if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

        return NextResponse.json({ ok: true, pause_started: true, row: pIns });
      }

      // open.pause => fin pause + reprise work (site_id obligatoire)
      if (!site_id) return NextResponse.json({ error: "site_id required to resume from pause" }, { status: 400 });

      const { error: uErr2 } = await supabaseAdmin
        .from("daily_site_logs")
        .update({ ended_at: nowIso })
        .eq("id", open.id);
      if (uErr2) return NextResponse.json({ error: uErr2.message }, { status: 500 });

      const { data: wIns, error: wErr } = await supabaseAdmin
        .from("daily_site_logs")
        .insert({
          user_id: userId,
          work_date,
          site_id,
          segment_type: "work",
          started_at: nowIso,
        })
        .select("id,site_id,started_at,ended_at,segment_type")
        .single();

      if (wErr && (wErr as any).code === "23505") return NextResponse.json({ ok: true, already_open: true });
      if (wErr) return NextResponse.json({ error: wErr.message }, { status: 500 });

      return NextResponse.json({ ok: true, pause_ended: true, row: wIns });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err), stack: err?.stack ?? null }, { status: 500 });
  }
}
