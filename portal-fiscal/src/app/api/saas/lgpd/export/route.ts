import { NextResponse } from "next/server";
import { authSession } from "@/lib/auth/session";
import { exportUserDataLgpd } from "@/lib/saas/lgpd";

export async function GET() {
  try {
    const session = await authSession.requireSession();
    const report = await exportUserDataLgpd(session.userId);

    return new NextResponse(JSON.stringify(report, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="lgpd_data_export_${session.userId}.json"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Erro ao gerar exportação LGPD." }, { status: 500 });
  }
}
