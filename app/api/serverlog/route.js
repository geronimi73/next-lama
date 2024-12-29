import { NextRequest, NextResponse } from "next/server";

export async function POST(request) {
  const { log } = await request.json();

  console.log(log)

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
