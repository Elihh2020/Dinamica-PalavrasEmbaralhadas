"use client";

import React, { useEffect, useRef, useState } from "react";
import { X, Check, Eye, ArrowLeft } from "lucide-react";
import { Question, GameSettings } from "../types";

type FeedbackType = "correct" | "wrong" | null;
type QuestionType = "OPEN" | "MCQ";
type SettingsQuestionType = "ALL" | "OPEN" | "MCQ";

interface Props {
  questions: Question[]; // mantém prop (você usa em outros pontos), mas agora não é usada pra sorteio
  settings: GameSettings;
  onExit: () => void;
}

export const GameRunner: React.FC<Props> = ({ settings, onExit }) => {
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);

  // OPEN
  const [guess, setGuess] = useState("");

  const [feedback, setFeedback] = useState<FeedbackType>(null);
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false);

  const [timeLeft, setTimeLeft] = useState<number>(settings.timerDuration);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  const [isLoading, setIsLoading] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ✅ tipo selecionado no App (ALL | OPEN | MCQ)
  const selectedType: SettingsQuestionType =
    ((settings as any).questionType as SettingsQuestionType) ?? "ALL";

  // ✅ tipo da questão atual (OPEN | MCQ)
  const questionType: QuestionType = (currentQuestion?.type ?? "OPEN") as QuestionType;

  // -----------------------------
  // 🔥 Integração com backend
  // -----------------------------
  const fetchRandomQuestion = async (): Promise<Question | null> => {
    const params = new URLSearchParams();
    params.set("limit", "1");
    params.set("difficulty", String(settings.difficulty));

    // Se o backend ainda não filtra por type, ele só vai ignorar esse param (não quebra).
    if (selectedType !== "ALL") params.set("type", selectedType);

    const res = await fetch(`/api/questions/random?${params.toString()}`, {
      cache: "no-store",
    });

    if (!res.ok) return null;

    const payload = await res.json().catch(() => null);
    const q = payload?.data?.[0] ?? null;
    return q as Question | null;
  };

  const markUsed = async (id: string | number) => {
    const res = await fetch(`/api/questions/${id}/use`, { method: "POST" });
    // 200 = marcou como usada
    // 409 = já usada (ok, não precisa travar o jogo)
    if (res.status === 409) return;
    if (!res.ok) {
      const payload = await res.json().catch(() => null);
      console.warn("Falha ao marcar pergunta como usada:", payload);
    }
  };

  const loadNextQuestion = async () => {
    setIsLoading(true);

    // reset UI
    setGuess("");
    setFeedback(null);
    setShowCorrectAnswer(false);

    setTimeLeft(settings.timerDuration);
    setIsTimerRunning(false);

    try {
      const q = await fetchRandomQuestion();
      setCurrentQuestion(q);
    } finally {
      setIsLoading(false);
    }
  };

  // init: ao entrar no jogo / trocar settings, busca do banco (sem repetir)
  useEffect(() => {
    loadNextQuestion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.difficulty, settings.timerDuration, selectedType]);

  // foco no input quando trocar pergunta (somente OPEN)
  useEffect(() => {
    if ((currentQuestion?.type ?? "OPEN") === "OPEN") {
      inputRef.current?.focus();
    }
  }, [currentQuestion?.id]);

  // timer loop
  useEffect(() => {
    if (!isTimerRunning) return;

    if (timeLeft > 0) {
      timerRef.current = setTimeout(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else {
      setIsTimerRunning(false);
      // opcional: quando tempo acabar, revelar resposta automaticamente
      // setShowCorrectAnswer(true);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [timeLeft, isTimerRunning]);

  const startTimer = () => {
    if (timeLeft === 0) setTimeLeft(settings.timerDuration);
    setIsTimerRunning(true);
  };

  const pauseTimer = () => setIsTimerRunning(false);

  const resetTimer = () => {
    setIsTimerRunning(false);
    setTimeLeft(settings.timerDuration);
  };

  const increaseTimer = () => {
    setTimeLeft((prev) => prev + 1);
  };

  const decreaseTimer = () => {
    setTimeLeft((prev) => Math.max(0, prev - 1));
  };

  // ✅ Próxima pergunta:
  // Regra: só “queima” a pergunta quando ela foi respondida (acertou) OU quando revelou resposta.
  const goNext = async () => {
    if (!currentQuestion) return;

    const shouldConsume = feedback === "correct" || showCorrectAnswer;

    if (shouldConsume) {
      await markUsed(currentQuestion.id as any);
    }

    await loadNextQuestion();
  };

  // OPEN: submit
  const checkAnswer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentQuestion) return;
    if (questionType !== "OPEN") return;
    if (!guess.trim() || feedback === "correct") return;

    const normalizedGuess = guess.trim().toLowerCase();
    const normalizedCorrect = currentQuestion.answer.trim().toLowerCase();

    if (normalizedGuess === normalizedCorrect) {
      setFeedback("correct");
      setIsTimerRunning(false);
      setShowCorrectAnswer(true);
    } else {
      setFeedback("wrong");
      setTimeout(() => setFeedback(null), 1500);
    }
    setGuess("");
  };

  // MCQ: click option
  const handlePickOption = (idx: number) => {
    if (!currentQuestion) return;
    if (questionType !== "MCQ") return;
    if (feedback === "correct") return;

    const correctIdx =
      typeof currentQuestion.correctIndex === "number"
        ? currentQuestion.correctIndex
        : -1;

    const picked = (currentQuestion.options?.[idx] ?? "").trim().toLowerCase();
    const correctAnswer = currentQuestion.answer.trim().toLowerCase();

    const isCorrect =
      correctIdx >= 0 ? idx === correctIdx : picked === correctAnswer;

    if (isCorrect) {
      setFeedback("correct");
      setIsTimerRunning(false);
      setShowCorrectAnswer(true);
    } else {
      setFeedback("wrong");
      setTimeout(() => setFeedback(null), 1500);
    }
  };

  const getCorrectAnswerText = () => {
    if (!currentQuestion) return "";

    if (questionType === "MCQ") {
      const ci = currentQuestion.correctIndex;
      if (typeof ci === "number" && currentQuestion.options?.[ci]) {
        const label = String.fromCharCode(65 + ci);
        return `${label}) ${currentQuestion.options[ci]}`;
      }
      return currentQuestion.answer;
    }

    return currentQuestion.answer;
  };

  // ✅ Tela final (acabou perguntas disponíveis / ou carregando)
  if (isLoading && !currentQuestion) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center p-8 text-white">
        <h2 className="text-3xl md:text-5xl font-black tracking-tight text-center">
          Carregando pergunta...
        </h2>
      </div>
    );
  }

  if (!currentQuestion) {
    const label =
      selectedType === "OPEN"
        ? "Abertas"
        : selectedType === "MCQ"
          ? "Múltiplas"
          : "Todas";

    return (
      <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center p-8 text-white">
        <h2 className="text-4xl md:text-6xl font-black tracking-tight text-center">
          Fim das perguntas desta categoria!
        </h2>

        <p className="mt-4 text-white/70 text-center">
          Categoria: <b>{label}</b> • Dificuldade: <b>{settings.difficulty}</b>
        </p>

        <button
          onClick={onExit}
          className="mt-10 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-bold text-xl transition-all cursor-pointer"
          type="button"
        >
          Voltar ao Início
        </button>
      </div>
    );
  }

  const mcqOptions = (currentQuestion.options ?? []).slice(0, 4);
  const hasMcqOptions = questionType === "MCQ" ? mcqOptions.length > 0 : true;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-between p-8 text-white select-none overflow-hidden">
      {/* Header Controls */}
      <div className="w-full flex justify-between items-center max-w-7xl">
        <button
          onClick={onExit}
          className="p-3 hover:bg-slate-800 rounded-full transition-all group"
          aria-label="Voltar"
          type="button"
        >
          <ArrowLeft
            size={32}
            className="group-hover:-translate-x-1 transition-transform cursor-pointer"
          />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 w-full max-w-7xl flex items-center justify-center">
        {/* Feedback Overlays */}
        {feedback === "correct" && (
          <div className="absolute inset-0 bg-green-500/20 backdrop-blur-sm z-10 animate-in fade-in zoom-in duration-300">
            <button
              onClick={onExit}
              className="absolute top-8 right-8 p-3 hover:bg-slate-800 rounded-full transition-all group cursor-pointer pointer-events-auto z-20"
              aria-label="Sair"
              title="Sair"
              type="button"
            >
              <X
                size={32}
                className="opacity-80 group-hover:opacity-100 transition-opacity"
              />
            </button>

            <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
              <div className="bg-green-600 p-8 rounded-full shadow-2xl shadow-green-500/40 mb-6">
                <Check size={120} strokeWidth={4} />
              </div>
              <h2 className="text-7xl font-black uppercase tracking-tighter mb-12">
                Correto!
              </h2>

              <button
                onClick={goNext}
                className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-bold text-xl transition-all cursor-pointer"
                type="button"
              >
                Próxima Pergunta
              </button>
            </div>
          </div>
        )}

        {feedback === "wrong" && (
          <div className="absolute inset-0 bg-rose-500/20 backdrop-blur-sm z-10 flex items-center justify-center animate-in fade-in zoom-in duration-150">
            <div className="bg-rose-600 p-8 rounded-full shadow-2xl shadow-rose-500/40">
              <X size={120} strokeWidth={4} />
            </div>
          </div>
        )}

        {/* ✅ Layout alinhado: esquerda (textos + resposta) | direita (cronômetro) */}
        <div className="w-full grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-10 lg:gap-14 items-start">
          {/* Coluna esquerda: tudo alinhado entre si */}
          <div className="w-full max-w-6xl justify-self-center lg:justify-self-start text-left">
            <span className="inline-block bg-indigo-600/20 text-white px-8 py-2 rounded-full text-xl font-bold uppercase tracking-[0.4em]">
              🧠 Quem sou eu?
            </span>

            <div className="mt-4 space-y-6">
              <h1 className="text-5xl md:text-7xl font-bold leading-tight balance text-white flex items-start gap-4">
                <span className="text-indigo-300 leading-[1] mt-3 select-none">•</span>
                  {currentQuestion.text}
              </h1>

              {(currentQuestion?.hint1 || currentQuestion?.hint2) && (
                <div className="space-y-4">
                  {currentQuestion.hint1 && (
                    <p className="text-5xl md:text-7xl font-bold leading-tight balance text-white flex items-start gap-4">
                      <span className="text-indigo-300 leading-[1] mt-3 select-none">•</span>
                       {currentQuestion.hint1}
                    </p>
                  )}
                  {currentQuestion.hint2 && (
                    <p className="text-5xl md:text-7xl font-bold leading-tight balance text-white flex items-start gap-4">
                      <span className="text-indigo-300 leading-[1] mt-3 select-none">•</span>
                       {currentQuestion.hint2}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Answer Area (alinhada com os textos) */}
            <div className="mt-10 w-full max-w-2xl">
              {/* OPEN */}
              {questionType === "OPEN" && (
                <form onSubmit={checkAnswer} className="relative group">
                  <input
                    ref={inputRef}
                    type="text"
                    value={guess}
                    onChange={(e) => setGuess(e.target.value)}
                    disabled={feedback === "correct"}
                    placeholder="Digite a resposta e aperte Enter..."
                    className="w-full bg-slate-900/50 border-b-4 border-slate-700 text-3xl md:text-4xl py-6 px-4 text-left outline-none focus:border-indigo-500 transition-all placeholder:text-slate-800 placeholder:text-2xl disabled:opacity-50"
                  />
                </form>
              )}

              {/* MCQ */}
              {questionType === "MCQ" && (
                <>
                  {!hasMcqOptions ? (
                    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 text-slate-300">
                      <p className="font-bold">
                        Essa pergunta está como múltipla escolha, mas não possui alternativas.
                      </p>
                      <p className="text-sm text-slate-400 mt-2">
                        Vá em “Cadastrar Perguntas” e preencha as opções A, B, C e D.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {mcqOptions.map((opt, idx) => {
                        const label = String.fromCharCode(65 + idx);
                        return (
                          <button
                            key={idx}
                            onClick={() => handlePickOption(idx)}
                            disabled={feedback === "correct"}
                            type="button"
                            className="text-left bg-slate-900/50 hover:bg-slate-900/70 border border-slate-800 rounded-2xl p-5 transition-all active:scale-[0.99] disabled:opacity-60 cursor-pointer"
                          >
                            <div className="flex items-start gap-3">
                              <span className="shrink-0 w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-300 font-black flex items-center justify-center">
                                {label}
                              </span>
                              <p className="text-xl md:text-2xl font-semibold text-white/90">
                                {opt}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {/* Correct Answer Reveal */}
              {showCorrectAnswer && (
                <div className="mt-8 animate-in slide-in-from-bottom-4 fade-in duration-500 bg-slate-800 p-6 rounded-3xl border border-slate-700">
                  <p className="text-slate-400 text-sm uppercase font-bold tracking-widest mb-2">
                    Resposta Correta
                  </p>
                  <p className="text-4xl font-bold text-indigo-400">
                    {getCorrectAnswerText()}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Coluna direita: Cronometro */}
          <div className="w-full lg:w-auto flex justify-center lg:justify-end justify-self-center lg:justify-self-end">
            <div className="relative">
              <div className="absolute -inset-4 rounded-[40px] bg-indigo-500/10 blur-2xl" />
              <div className="relative bg-slate-900/60 border border-slate-800 rounded-[70px] px-10 py-8 backdrop-blur-xl shadow-2xl">
                <div className="flex flex-col items-center gap-5">
                  <div className="flex items-center gap-3">
                    <span className="px-4 py-2 rounded-full bg-indigo-600/20 text-indigo-300 text-sm font-black uppercase tracking-widest">
                      Cronômetro
                    </span>
                    <span className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/70 text-sm font-bold">
                      {settings.timerDuration}s
                    </span>
                  </div>

                  <div className="flex gap-6 items-center justify-center">
                    <button
                      onClick={decreaseTimer}
                      className="px-4 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-3xl transition-all active:scale-95 shadow-xl shadow-indigo-500/20 cursor-pointer"
                      title="Diminuir tempo"
                      type="button"
                    >
                      −
                    </button>

                    <div
                      className={`text-[120px] md:text-[160px] font-mono font-black tabular-nums leading-none transition-all ${
                        timeLeft <= 3 && timeLeft > 0
                          ? "text-rose-500 animate-pulse"
                          : "text-white"
                      }`}
                    >
                      {String(timeLeft).padStart(2, "0")}
                    </div>

                    <button
                      onClick={increaseTimer}
                      className="px-4 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-3xl transition-all active:scale-95 shadow-xl shadow-indigo-500/20 cursor-pointer"
                      title="Aumentar tempo"
                      type="button"
                    >
                      +
                    </button>
                  </div>

                  <div className="w-[320px] max-w-[80vw] h-3 bg-white/5 rounded-full overflow-hidden border border-white/10">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.max(
                          0,
                          Math.min(100, (timeLeft / settings.timerDuration) * 100)
                        )}%`,
                        background:
                          timeLeft <= 3 && timeLeft > 0
                            ? "rgba(244, 63, 94, 0.9)"
                            : "rgba(99, 102, 241, 0.9)",
                      }}
                    />
                  </div>

                  <div className="flex gap-3 w-full justify-center">
                    {!isTimerRunning ? (
                      <button
                        onClick={startTimer}
                        className="px-8 py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-black transition-all active:scale-95 shadow-xl shadow-emerald-500/20 cursor-pointer"
                        type="button"
                      >
                        INICIAR
                      </button>
                    ) : (
                      <button
                        onClick={pauseTimer}
                        className="px-8 py-4 rounded-2xl bg-rose-500 hover:bg-rose-400 text-white font-black transition-all active:scale-95 shadow-xl shadow-rose-500/20 cursor-pointer"
                        type="button"
                      >
                        PAUSAR
                      </button>
                    )}

                    <button
                      onClick={resetTimer}
                      className="px-6 py-4 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold transition-all active:scale-95 border border-white/10 cursor-pointer"
                      title="Reiniciar"
                      type="button"
                    >
                      ↺
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* /Cronometro */}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="w-full flex justify-center py-4">
        {!showCorrectAnswer && feedback !== "correct" && (
          <button
            onClick={() => setShowCorrectAnswer(true)}
            className="flex items-center gap-3 px-8 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-bold transition-all hover:scale-105 active:scale-95 border border-slate-700 cursor-pointer"
            type="button"
          >
            <Eye size={24} /> Revelar Resposta
          </button>
        )}

        {(showCorrectAnswer || feedback === "correct") && (
          <button
            onClick={goNext}
            className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-bold text-xl transition-all cursor-pointer"
            type="button"
          >
            Próxima Pergunta
          </button>
        )}
      </div>

      {/* Subtle Grid Background */}
      <div
        className="absolute inset-0 -z-10 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(#4f46e5 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
    </div>
  );
};

export default GameRunner;
