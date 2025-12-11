import { transferSui } from "@/app/lib/server-turnkey";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { to, amount } = await req.json();
    if (!to || !amount) {
      return NextResponse.json({ error: "Missing to or amount" }, { status: 400 });
    }

    const result = await transferSui(to, amount);
    return NextResponse.json({ 
      digest: result.digest, 
      status: result.effects?.status.status 
    });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}