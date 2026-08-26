import { NextResponse } from "next/server";
import { getStoredAuth } from "../../../lib/auth";

export async function POST(request: Request) {
  const auth = getStoredAuth();
  if (!auth?.token) return NextResponse.json({ ok: false }, { status: 401 });
  const body = await request.json();
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_GLOW_API_URL ?? "http://127.0.0.1:8600"}/profile/locale`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${auth.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ locale: body.locale }),
    },
  );
  return NextResponse.json({ ok: res.ok }, { status: res.ok ? 200 : res.status });
}
