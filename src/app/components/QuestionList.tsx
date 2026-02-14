"use client";

import React, { useState, useEffect } from 'react';
import { Question } from '../types';

type FeedbackState = 'none' | 'correct' | 'incorrect' | 'revealed';

interface Props {
  question: Question;
  onClose: () => void;
}

const PresentationMode: React.FC<Props> = ({ question, onClose }) => {
  const [userInput, setUserInput] = useState('');
  const [feedback, setFeedback] = useState<FeedbackState>('none');
  const [showAnswer, setShowAnswer] = useState(false);

  // Reset states when question changes (though this component usually unmounts)
  useEffect(() => {
    setUserInput('');
    setFeedback('none');
    setShowAnswer(false);
  }, [question]);

  const handleCheck = () => {
    if (!userInput.trim()) return;
    
    if (userInput.toLowerCase().trim() === question.answer.toLowerCase().trim()) {
      setFeedback('correct');
    } else {
      setFeedback('incorrect');
      // Briefly show X then go back to none, but the prompt says "show X", so we'll keep it visible until they try again
    }
  };

  const handleReveal = () => {
    setShowAnswer(true);
    setFeedback('revealed');
  };

  return (
    <div className="fixed inset-0 z-50 presentation-mode flex flex-col text-white overflow-hidden">
      {/* Top Bar */}
      <div className="p-6 flex justify-between items-center bg-black/20 backdrop-blur-md border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-500 p-2 rounded-lg">
            <i className="fas fa-presentation-screen"></i>
          </div>
          <span className="font-bold tracking-wider text-xl">APRESENTAÇÃO</span>
        </div>
        <button 
          onClick={onClose}
          className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-all"
        >
          <i className="fas fa-times text-2xl px-2"></i>
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-5xl mx-auto w-full relative">
        
        {/* Main Feedback Layer */}
        {feedback === 'incorrect' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none animate-bounce">
            <i className="fas fa-times text-[15rem] text-rose-500 opacity-80 shadow-2xl"></i>
          </div>
        )}
        
        {feedback === 'correct' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-pulse z-50">
            <div className="text-center flex flex-col items-center gap-8">
              <div>
                <i className="fas fa-check-circle text-[15rem] text-emerald-400 opacity-90 mb-4"></i>
                <h2 className="text-6xl font-black text-emerald-300">CORRETO!</h2>
              </div>
              <button
                onClick={onClose}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-black py-4 px-12 rounded-2xl text-2xl shadow-2xl transition-all active:scale-95 flex items-center gap-3"
              >
                <i className="fas fa-arrow-right"></i>
                Próxima Pergunta
              </button>
            </div>
          </div>
        )}

        {/* Content Box */}
        <div className={`w-full transition-all duration-500 ${feedback === 'correct' ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
          <div className="mb-12 text-center">
             <h2 className="text-5xl md:text-7xl font-bold leading-tight mb-8">
              {question.text}
             </h2>
          </div>

          <div className="flex flex-col items-center gap-8 w-full">
            {/* Input and Actions */}
            <div className="w-full max-w-2xl flex flex-col gap-4">
              <div className="relative">
                <input 
                  type="text"
                  value={userInput}
                  onChange={(e) => {
                    setUserInput(e.target.value);
                    if (feedback === 'incorrect') setFeedback('none');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
                  placeholder="Digite sua resposta aqui..."
                  disabled={feedback === 'correct'}
                  className="w-full bg-white/10 border-2 border-white/20 text-white text-3xl px-8 py-5 rounded-2xl outline-none focus:border-indigo-500 focus:bg-white/15 transition-all text-center placeholder:text-white/30"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={handleCheck}
                  disabled={feedback === 'correct'}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed py-4 px-8 rounded-xl font-bold text-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-3"
                >
                  <i className="fas fa-paper-plane"></i>
                  Verificar Resposta
                </button>
                <button
                  onClick={handleReveal}
                  className="bg-white/5 hover:bg-white/10 border border-white/20 py-4 px-8 rounded-xl font-bold text-xl transition-all active:scale-95 flex items-center justify-center gap-3"
                >
                  <i className="fas fa-eye"></i>
                  Exibir Correta
                </button>
              </div>
            </div>

            {/* Revealed Answer */}
            {showAnswer && (
              <div className="bg-amber-500 text-slate-900 px-8 py-4 rounded-xl font-black text-4xl animate-bounce shadow-2xl">
                {question.answer}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Footer Branding */}
      <div className="p-6 text-center text-white/20 font-medium tracking-widest text-sm uppercase">
        Dynamic Presentation Engine v1.0
      </div>
    </div>
  );
};

export default PresentationMode;
