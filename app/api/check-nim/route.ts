import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase";

type CheckResult = {
  found: boolean;
  passed: boolean;
  role: "participant" | "coordinator" | "leader" | "unknown";
  name?: string;
  division?: string | null;
  position?: string | null;
  whatsappLink?: string | null;
};

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const raw = typeof body?.nim === "string" ? body.nim : "";
  const nim = raw.trim().toUpperCase().replace(/\s+/g, "");

  if (!/^[A-Z0-9]{6,20}$/.test(nim)) {
    return NextResponse.json({ error: "NIM tidak valid." }, { status: 400 });
  }

  // ── Fire semua query PARALLEL sekaligus ──────────────────────────────────
  const [leaderRes, coordRes, participantRes] = await Promise.all([
    supabase
      .from("leaders")
      .select("nim, name, position")
      .eq("nim", nim)
      .maybeSingle(),

    supabase
      .from("coordinators")
      .select("nim, name, whatsapp_link, divisions(name)")
      .eq("nim", nim)
      .maybeSingle(),

    supabase
      .from("participants")
      .select(`
        nim, name, passed,
        divisions(
          name,
          coordinators(whatsapp_link)
        )
      `)
      .eq("nim", nim)
      .maybeSingle(),
  ]);

  // ── Error handling ────────────────────────────────────────────────────────
  if (leaderRes.error) {
    console.error("[check-nim:leader]", leaderRes.error.message);
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
  }
  if (coordRes.error) {
    console.error("[check-nim:coordinator]", coordRes.error.message);
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
  }
  if (participantRes.error) {
    console.error("[check-nim:participant]", participantRes.error.message);
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
  }

  // ── 1. Leader ─────────────────────────────────────────────────────────────
  if (leaderRes.data) {
    const leader = leaderRes.data;
    return NextResponse.json({
      found: true,
      passed: true,
      role: "leader",
      name: leader.name,
      position: leader.position,
      division: null,
      whatsappLink: null,
    } satisfies CheckResult);
  }

  // ── 2. Coordinator ────────────────────────────────────────────────────────
  if (coordRes.data) {
    const coordinator = coordRes.data;
    const divisionRel = (coordinator as { divisions?: unknown }).divisions;
    const divisionName = Array.isArray(divisionRel)
      ? (divisionRel[0] as { name?: string } | undefined)?.name ?? null
      : (divisionRel as { name?: string } | null | undefined)?.name ?? null;

    return NextResponse.json({
      found: true,
      passed: true,
      role: "coordinator",
      name: coordinator.name,
      division: divisionName,
      whatsappLink: null,
      position: null,
    } satisfies CheckResult);
  }

  // ── 3. Participant ────────────────────────────────────────────────────────
  if (!participantRes.data) {
    return NextResponse.json({
      found: false,
      passed: false,
      role: "unknown",
    } satisfies CheckResult);
  }

  const data = participantRes.data;
  const didPass = !!data.passed;

  // Resolve division + WA koordinator dari join, tanpa query tambahan
  const divisionRel = (data as { divisions?: unknown }).divisions;
  const divisionObj = Array.isArray(divisionRel)
    ? (divisionRel[0] as { name?: string; coordinators?: unknown } | undefined)
    : (divisionRel as { name?: string; coordinators?: unknown } | null | undefined);

  const divisionName = divisionObj?.name ?? null;

  let whatsappLink: string | null = null;
  if (didPass && divisionObj?.coordinators) {
    const coordRel = divisionObj.coordinators;
    whatsappLink = Array.isArray(coordRel)
      ? (coordRel[0] as { whatsapp_link?: string } | undefined)?.whatsapp_link ?? null
      : (coordRel as { whatsapp_link?: string } | null | undefined)?.whatsapp_link ?? null;
  }

  return NextResponse.json({
    found: true,
    passed: didPass,
    role: "participant",
    name: didPass ? data.name : undefined,
    division: didPass ? divisionName : null,
    whatsappLink: didPass ? whatsappLink : null,
    position: null,
  } satisfies CheckResult);
}