import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const numericId = Number(id);

    if (!numericId || isNaN(numericId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const { rows, rowCount } = await pool.query(
      `
      UPDATE questions
      SET used_at = NOW()
      WHERE id = $1 AND used_at IS NULL
      RETURNING id, used_at AS "usedAt"
      `,
      [numericId]
    );

    if (rowCount === 0) {
      return NextResponse.json(
        { error: "Pergunta não encontrada ou já foi usada" },
        { status: 409 }
      );
    }

    return NextResponse.json({ message: "Pergunta marcada como usada", ...rows[0] });
  } catch (err) {
    console.error("POST /api/questions/[id]/use error:", err);
    return NextResponse.json(
      { error: "Erro ao marcar como usada" },
      { status: 500 }
    );
  }
}
