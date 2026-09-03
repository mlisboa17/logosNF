import { NextResponse } from "next/server";
import { authSession } from "@/lib/auth/session";
import { createInvitation, acceptInvitation } from "@/lib/saas/invitations";

export async function POST(request: Request) {
  try {
    const session = await authSession.requireAdmin();
    const body = await request.json();

    if (body.action === "accept") {
      const { token } = body;
      if (!token) return NextResponse.json({ error: "Token de convite é obrigatório." }, { status: 400 });
      const result = await acceptInvitation(token, session.userId);
      return NextResponse.json(result);
    }

    const { email, role } = body;
    if (!email) {
      return NextResponse.json({ error: "E-mail do convidado é obrigatório." }, { status: 400 });
    }

    const organizationId = session.user.memberships[0]?.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "Usuário sem organização associada." }, { status: 400 });
    }

    const result = await createInvitation({
      organizationId,
      createdById: session.userId,
      email,
      role,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Erro ao processar convite." }, { status: 400 });
  }
}
