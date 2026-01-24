import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData.user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const user_id = userData.user.id;

    // ✅ on enlève l'obligation de changer le mot de passe
    const { error: pErr } = await supabaseAdmin
      .from("profiles")
      .update({
        must_change_password: false,
        password_changed_at: new Date().toISOString(),
      })
      .eq("user_id", user_id);

    if (pErr) {
      return NextResponse.json({ error: pErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: String(err?.message ?? err), stack: err?.stack ?? null },
      { status: 500 }
    );
  }
}
