import { NextResponse } from "next/server";
import { seedLeadsIfEmpty } from "@/lib/leads";
import { hasSupabaseEnv } from "@/lib/supabase";

export async function POST() {
  if (!hasSupabaseEnv()) {
    return NextResponse.json(
      {
        error:
          "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      },
      { status: 500 },
    );
  }

  try {
    const result = await seedLeadsIfEmpty();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not seed the database.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
