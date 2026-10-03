import { NextResponse } from "next/server"

export async function POST() {
  return NextResponse.json(
    { error: "Los pagos no están disponibles en esta versión." },
    { status: 503 }
  )
}
