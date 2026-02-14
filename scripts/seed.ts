import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Pool } from "pg";

type Question = {
  text: string;
  difficulty: string;
  type: "multipla_escolha" | "discursiva";
  answer?: string | null;
  options?: string[] | null;
  correctIndex?: number | null;
};

const questions: Question[] = [
  {
    text: "Qual é a capital do Brasil?",
    difficulty: "facil",
    type: "multipla_escolha",
    answer: "Brasília",
    options: ["Rio de Janeiro", "Brasília", "São Paulo", "Salvador"],
    correctIndex: 1,
  },
  {
    text: "Quanto é 7 × 8?",
    difficulty: "medio",
    type: "multipla_escolha",
    answer: "56",
    options: ["54", "56", "58", "64"],
    correctIndex: 1,
  },
  {
    text: "Explique o que é HTML.",
    difficulty: "medio",
    type: "discursiva",
    answer: "HTML é uma linguagem de marcação usada para estruturar conteúdo na web.",
    options: null,
    correctIndex: null,
  },
];

async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL não encontrado. Verifique seu .env.local");
  }

  const pool = new Pool({ connectionString });

  try {
    // 1) Garantir tabela (caso rode em máquina limpa)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS questions (
        id SERIAL PRIMARY KEY,
        text TEXT NOT NULL,
        difficulty VARCHAR(20),
        type VARCHAR(30),
        answer TEXT,
        hint1 TEXT,
        hint2 TEXT,
        options JSONB,
        correct_index INT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // Ensure hint columns exist on existing DB
    await pool.query(`ALTER TABLE questions ADD COLUMN IF NOT EXISTS hint1 TEXT;`);
    await pool.query(`ALTER TABLE questions ADD COLUMN IF NOT EXISTS hint2 TEXT;`);

    // 2) Limpar e reiniciar IDs (opcional, mas recomendado em seed)
    await pool.query(`TRUNCATE TABLE questions RESTART IDENTITY;`);

    // 3) Inserir dados
    const insertSql = `
      INSERT INTO questions (text, difficulty, type, answer, hint1, hint2, options, correct_index)
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
    `;

    for (const q of questions) {
      const optionsJson = q.options ? JSON.stringify(q.options) : null;

      await pool.query(insertSql, [
        q.text,
        q.difficulty ?? null,
        q.type,
        q.answer ?? null,
        null,
        null,
        optionsJson,
        q.type === "multipla_escolha" ? q.correctIndex ?? null : null,
      ]);
    }

    const { rows } = await pool.query(`SELECT COUNT(*)::int AS total FROM questions;`);
    console.log(`✅ Seed concluído. Total de perguntas: ${rows[0].total}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("❌ Erro no seed:", err);
  process.exit(1);
});
