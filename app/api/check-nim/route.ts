import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase";

type CheckResult = {
  found: boolean;
  passed: boolean;
  role: "participant" | "coordinator" | "leader" | "unknown";
  name?: string;
  division?: string | null;
  position?: string | null;       // untuk leader
  whatsappLink?: string | null;   // untuk coordinator / peserta lolos
};

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const raw = typeof body?.nim === "string" ? body.nim : "";
  const nim = raw.trim().toUpperCase().replace(/\s+/g, "");

  if (!/^[A-Z0-9]{6,20}$/.test(nim)) {
    return NextResponse.json({ error: "NIM tidak valid." }, { status: 400 });
  }

  // ── 1. Cek LEADER dulu (paling spesifik)
  const { data: leader, error: leaderErr } = await supabase
    .from("leaders")
    .select("nim, name, position")
    .eq("nim", nim)
    .maybeSingle();

  if (leaderErr) {
    console.error("[check-nim:leader]", leaderErr.message);
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
  }

  if (leader) {
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

  // ── 2. Cek COORDINATOR
  const { data: coordinator, error: coordErr } = await supabase
    .from("coordinators")
    .select("nim, name, whatsapp_link, divisions(name)")
    .eq("nim", nim)
    .maybeSingle();

  if (coordErr) {
    console.error("[check-nim:coordinator]", coordErr.message);
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
  }

  if (coordinator) {
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
      whatsappLink: null, // koor gak perlu tombol WA
      position: null,
    } satisfies CheckResult);
  }

  // ── 3. Cek PARTICIPANT (peserta seleksi)
  const { data, error } = await supabase
    .from("participants")
    .select("nim, name, passed, divisions(name)")
    .eq("nim", nim)
    .maybeSingle();

  if (error) {
    console.error("[check-nim:participant]", error.message);
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({
      found: false,
      passed: false,
      role: "unknown",
    } satisfies CheckResult);
  }

  const divisionRel = (data as { divisions?: unknown }).divisions;
  const divisionName = Array.isArray(divisionRel)
    ? (divisionRel[0] as { name?: string } | undefined)?.name ?? null
    : (divisionRel as { name?: string } | null | undefined)?.name ?? null;

  const didPass = !!data.passed;

  // Kalau peserta lolos & punya divisi → ambil WA koordinator divisi tsb
  let whatsappLink: string | null = null;
  if (didPass && divisionName) {
    const { data: coord } = await supabase
      .from("coordinators")
      .select("whatsapp_link")
      .eq("division_id", (
        await supabase.from("divisions").select("id").eq("name", divisionName).maybeSingle()
      ).data?.id ?? -1)
      .maybeSingle();

    whatsappLink = coord?.whatsapp_link ?? null;
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