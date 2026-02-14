import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

type ApiType = "OPEN" | "MCQ";

function toDbType(t: string | null) {
  if (t === "MCQ") return "multipla_escolha";
  if (t === "OPEN") return "discursiva";
  return null; // ALL
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const limitRaw = Number(searchParams.get("limit") ?? 10);
    const difficulty = searchParams.get("difficulty");
    const type = (searchParams.get("type") as ApiType | null) ?? null;

    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 50 ? limitRaw : 10;

    const values: any[] = [];
    const where: string[] = ["used_at IS NULL"];

    if (difficulty) {
      values.push(difficulty);
      where.push(`difficulty = $${values.length}`);
    }

    const dbType = toDbType(type);
    if (dbType) {
      values.push(dbType);
      where.push(`type = $${values.length}`);
    }

    // detect hint columns
    const colRes = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'questions' AND column_name IN ('hint1','hint2')`
    );
    const cols = new Set(colRes.rows.map((r: any) => r.column_name));

    const selectCols = [
      'id',
      'text',
      'difficulty',
      `CASE WHEN type = 'multipla_escolha' THEN 'MCQ' ELSE 'OPEN' END AS type`,
      'answer',
    ];
    if (cols.has('hint1')) selectCols.push('hint1');
    if (cols.has('hint2')) selectCols.push('hint2');
    selectCols.push('options', `correct_index AS "correctIndex"`, `created_at AS "createdAt"`, `used_at AS "usedAt"`);

    const query = `
      SELECT
        ${selectCols.join(',\n        ')}
      FROM questions
      WHERE ${where.join(" AND ")}
      ORDER BY RANDOM()
      LIMIT $${values.length + 1}
    `;

    values.push(limit);

    const { rows } = await pool.query(query, values);

    return NextResponse.json({
      limit,
      count: rows.length,
      data: rows,
      message:
        rows.length === 0
          ? "Não há mais perguntas disponíveis (todas já foram usadas)."
          : undefined,
    });
  } catch (err) {
    console.error("GET /api/questions/random error:", err);
    return NextResponse.json(
      { error: "Erro ao buscar perguntas aleatórias" },
      { status: 500 }
    );
  }
}
