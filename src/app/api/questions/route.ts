import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

type ApiType = "OPEN" | "MCQ";
type DbType = "discursiva" | "multipla_escolha";

type CreateQuestionBody = {
  text: string;
  difficulty?: string;
  type: ApiType | DbType; // aceita os dois, por segurança
  answer?: string;
  options?: string[];
  correctIndex?: number;
  hint1?: string;
};

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function toDbType(t: unknown): DbType {
  if (t === "MCQ" || t === "multipla_escolha") return "multipla_escolha";
  return "discursiva"; // default
}

function toApiType(t: unknown): ApiType {
  if (t === "multipla_escolha" || t === "MCQ") return "MCQ";
  return "OPEN";
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const pageRaw = Number(searchParams.get("page") ?? 1);
    const limitRaw = Number(searchParams.get("limit") ?? 5);
    const difficulty = searchParams.get("difficulty");

    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 200 ? limitRaw : 5;

    const offset = (page - 1) * limit;

    const where: string[] = [];
    const values: any[] = [];

    if (difficulty) {
      values.push(difficulty);
      where.push(`difficulty = $${values.length}`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    // total
    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM questions
      ${whereSql}
    `;
    const countResult = await pool.query(countQuery, values);
    const total = countResult.rows[0]?.total ?? 0;

    // dados
    // detect if hint columns exist (compat com DB antigo)
    const colRes = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'questions' AND column_name = 'hint1'`
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

    selectCols.push('options', `correct_index AS "correctIndex"`, `created_at AS "createdAt"`, `used_at AS "usedAt"`);

    const dataQuery = `
      SELECT
        ${selectCols.join(',\n        ')}
      FROM questions
      ${whereSql}
      ORDER BY created_at DESC
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}
    `;

    const dataValues = [...values, limit, offset];
    const { rows } = await pool.query(dataQuery, dataValues);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return NextResponse.json({
      page,
      limit,
      total,
      totalPages,
      count: rows.length,
      data: rows,
    });
  } catch (err) {
    console.error("GET /api/questions error:", err);
    return NextResponse.json({ error: "Erro ao buscar perguntas" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CreateQuestionBody;

    if (!isNonEmptyString(body.text)) {
      return NextResponse.json({ error: "Texto da pergunta é obrigatório." }, { status: 400 });
    }

    const dbType = toDbType(body.type);
    const difficulty = isNonEmptyString(body.difficulty) ? body.difficulty : "facil";

    // Regras por tipo
    let answer = "";
    let options: string[] | null = null;
    let correctIndex: number | null = null;

    // Ensure hint columns exist so we can insert them (safe if already present)
    try {
      await pool.query(`ALTER TABLE questions ADD COLUMN IF NOT EXISTS hint1 TEXT;`);
    } catch (e) {
      // non-fatal, continue
      console.warn("Could not ensure hint columns exist:", e);
    }

    if (dbType === "multipla_escolha") {
      const rawOptions = Array.isArray(body.options) ? body.options : [];
      const trimmed = rawOptions.map((o) => (typeof o === "string" ? o.trim() : ""));

      if (trimmed.length !== 4 || trimmed.some((o) => !o)) {
        return NextResponse.json(
          { error: "MCQ precisa de 4 alternativas preenchidas (A, B, C e D)." },
          { status: 400 }
        );
      }

      const ci =
        typeof body.correctIndex === "number" && body.correctIndex >= 0 && body.correctIndex <= 3
          ? body.correctIndex
          : 0;

      options = trimmed;
      correctIndex = ci;
      answer = isNonEmptyString(body.answer) ? body.answer.trim() : trimmed[ci];
    } else {
      if (!isNonEmptyString(body.answer)) {
        return NextResponse.json({ error: "Resposta é obrigatória para pergunta aberta." }, { status: 400 });
      }
      answer = body.answer.trim();
    }

    // ⚠️ Sobre o campo options:
    // Se sua coluna `options` for JSONB: use JSON.stringify(options) e ::jsonb (como abaixo).
    // Se sua coluna `options` for TEXT[]: troque para passar `options` direto e remova o ::jsonb.
    // detect hint columns for insert
    const colRes2 = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'questions' AND column_name = 'hint1'`
    );
    const insertCols: string[] = ['text', 'difficulty', 'type', 'answer'];
    const insertValues: any[] = [body.text.trim(), difficulty, dbType, answer];

    if (colRes2.rows.some((r: any) => r.column_name === 'hint1')) {
      insertCols.push('hint1');
      insertValues.push(isNonEmptyString(body.hint1) ? body.hint1.trim() : null);
    }

    insertCols.push('options', 'correct_index');
    insertValues.push(options ? JSON.stringify(options) : null, correctIndex);

    const placeholders = insertCols.map((_, i) => `$${i + 1}`).join(', ');
    const insertQuery = `
      INSERT INTO questions (${insertCols.join(', ')})
      VALUES (${placeholders})
      RETURNING id, text, difficulty, type, answer${colRes2.rows.some((r: any) => r.column_name === 'hint1') ? ', hint1' : ''}, options, correct_index AS "correctIndex", created_at AS "createdAt", used_at AS "usedAt"
    `;

    const { rows } = await pool.query(insertQuery, insertValues);

    // devolve type no formato do frontend
    const row = rows[0];
    row.type = toApiType(row.type);

    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    console.error("POST /api/questions error:", err);
    return NextResponse.json({ error: "Erro ao criar pergunta" }, { status: 500 });
  }
}
