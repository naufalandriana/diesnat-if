import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const raw = typeof body?.nim === "string" ? body.nim : "";
  const nim = raw.trim().toUpperCase().replace(/\s+/g, "");

  // Validasi format ketat — bukan cuma length
  if (!/^[A-Z0-9]{6,20}$/.test(nim)) {
    return NextResponse.json({ error: "NIM tidak valid." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("participants")
    .select("nim, name, passed, divisions(name)")
    .eq("nim", nim)
    .maybeSingle();

  if (error) {
    console.error("[check-nim]", error.message);
    return NextResponse.json(
      { error: "Terjadi kesalahan server." },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json({ found: false, passed: false });
  }

  // Supabase bisa balikin `divisions` sebagai object ATAU array
  // tergantung versi & cara baca relasinya. Handle dua-duanya.
  const divisionRel = (data as { divisions?: unknown }).divisions;
  const divisionName = Array.isArray(divisionRel)
    ? (divisionRel[0] as { name?: string } | undefined)?.name ?? null
    : (divisionRel as { name?: string } | null | undefined)?.name ?? null;

  const didPass = !!data.passed;

  return NextResponse.json({
    found: true,
    passed: didPass,
    // hanya kirim nama & divisi kalau lolos (opsional, untuk privasi)
    name: didPass ? data.name : undefined,
    division: didPass ? divisionName : null,
  });
}