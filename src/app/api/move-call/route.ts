import { executeGenericMoveCall } from "@/app/lib/server-turnkey";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { target, typeArguments, args } = await req.json();

    if (!target) {
      return NextResponse.json({ error: "Target is required" }, { status: 400 });
    }

    const result = await executeGenericMoveCall(
      target, 
      typeArguments || [], 
      args || []
    );

    return NextResponse.json({ 
      digest: result.digest, 
      status: result.effects?.status.status 
    });
  } catch (error: any) {
    console.error("Move call error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}