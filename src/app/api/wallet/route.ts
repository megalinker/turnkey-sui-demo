import { getSuiWalletInfo } from "@/app/lib/server-turnkey";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const data = await getSuiWalletInfo();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}