import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const numericId = Number(id);

    if (!numericId || isNaN(numericId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const { rowCount } = await pool.query(
      "DELETE FROM questions WHERE id = $1",
      [numericId]
    );

    if (rowCount === 0) {
      return NextResponse.json(
        { error: "Pergunta não encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "Pergunta removida com sucesso",
    });
  } catch (err) {
    console.error("DELETE error:", err);
    return NextResponse.json(
      { error: "Erro ao deletar pergunta" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const numericId = Number(id);

    if (!numericId || isNaN(numericId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const body = await req.json();

    const { text, difficulty, type, answer, hint1, options, correctIndex } = body;

    // detect hint columns
    const colRes = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'questions' AND column_name = 'hint1'`
    );
    const hasHint1 = colRes.rows.some((r: any) => r.column_name === 'hint1');

    const setCols: string[] = ['text = $1', 'difficulty = $2', 'type = $3', 'answer = $4'];
    const params: any[] = [text, difficulty, type, answer];

    if (hasHint1) {
      setCols.push(`hint1 = $${params.length + 1}`);
      params.push(hint1 ?? null);
    }

    setCols.push(`options = $${params.length + 1}::jsonb`);
    params.push(options ? JSON.stringify(options) : null);

    setCols.push(`correct_index = $${params.length + 1}`);
    params.push(correctIndex ?? null);

    const idParamIndex = params.length + 1;
    const query = `
      UPDATE questions
      SET ${setCols.join(',\n          ')},\n          created_at = created_at
      WHERE id = $${idParamIndex}
      RETURNING id, text, difficulty, type, answer${hasHint1 ? ', hint1' : ''}, options, correct_index AS "correctIndex", created_at AS "createdAt"
    `;

    params.push(numericId);

    const { rowCount, rows } = await pool.query(query, params);

    if (rowCount === 0) {
      return NextResponse.json(
        { error: "Pergunta não encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error("PUT error:", err);
    return NextResponse.json(
      { error: "Erro ao atualizar pergunta" },
      { status: 500 }
    );
  }
}
