export type Question = {
  id: number;
  text: string;
  difficulty: string | null;
  type: "multipla_escolha" | "discursiva";
  answer: string | null;
  options: string[] | null;
  correctIndex: number | null;
  createdAt: string;
  usedAt?: string | null;
};

export async function getRandomQuestion(params?: { difficulty?: string }) {
  const qs = new URLSearchParams({ limit: "1" });
  if (params?.difficulty) qs.set("difficulty", params.difficulty);

  const res = await fetch(`/api/questions/random?${qs.toString()}`, {
    cache: "no-store",
  });

  const json = await res.json();
  const q = json?.data?.[0] as Question | undefined;
  return { question: q, raw: json };
}

export async function markQuestionUsed(id: number) {
  const res = await fetch(`/api/questions/${id}/use`, {
    method: "POST",
  });
  const json = await res.json();
  return { ok: res.ok, status: res.status, json };
}
