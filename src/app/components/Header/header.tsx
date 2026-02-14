"use client";

import Image from "next/image";

export const Header = ({
  onRegisterClick,
  onHomeClick,
}: {
  onRegisterClick: () => void;
  onHomeClick?: () => void;
}) => {
  return (
    <header className="w-full border-b border-slate-200 bg-white">
      <div className="max-w-8xl mx-auto px-10 py-4 flex items-center justify-between">
        {/* Logo / Título */}
        <button
          type="button"
          onClick={onHomeClick}
          className="flex items-center gap-2 cursor-pointer text-left"
          aria-label="Ir para início"
        >
          <Image
            src="/logo4.png"
            alt="Ilustração de fé e vitória"
            width={50}
            height={50}
            className="mx-auto rounded-lg shadow-lg"
          />
          <span className="text-xl font-bold text-slate-800">
            Tabernaculo da Fé - SP
          </span>
        </button>

        {/* Ações */}
        <nav className="flex items-center gap-4">
          {/* Você chamou isso de Ranking, mantive como botão visual */}
          <button
            type="button"
            className="text-slate-600 font-semibold hover:text-indigo-600 transition-colors cursor-pointer"
            onClick={() => alert("Ranking em breve 🙂")}
          >
            Ranking
          </button>

          {/* ✅ Botão que antes estava no page.tsx */}
          <button
            type="button"
            onClick={onRegisterClick}
            className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-black hover:bg-indigo-500 transition-colors cursor-pointer"
          >
            Cadastrar Perguntas
          </button>
        </nav>
      </div>
    </header>
  );
};
