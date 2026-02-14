
export enum Difficulty {
  EASY = 'facil',
  MEDIUM = 'medio',
  HARD = 'dificil' 
}

export interface Question {
  id: string;
  text: string;
  answer: string;
  difficulty: Difficulty;
}

export type AppState = 'HOME' | 'REGISTER' | 'GAME';

export type FeedbackState = 'none' | 'correct' | 'incorrect' | 'revealed';

export interface GameSettings {
  difficulty: Difficulty;
  timerDuration: 5 | 10 | 15;
}

export type QuestionType = "OPEN" | "MCQ";

export interface Question {
  id: string;
  text: string;
  answer: string;              // ✅ continua existindo (para OPEN: texto; para MCQ: pode ser o texto da opção correta)
  difficulty: Difficulty;

  type?: QuestionType;         // ✅ opcional (compatível com perguntas antigas)
  options?: string[];          // ✅ só para MCQ (ex: 4 alternativas)
  correctIndex?: number;       // ✅ só para MCQ (0..3)
  hint1?: string;              // dica curta 1 (opcional)
}
