
export interface Ingredient {
  item: string;
  quantity: string;
}

export interface CookingStep {
  title: string;
  instruction: string;
  tip?: string;
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  ingredients: Ingredient[];
  steps: CookingStep[];
  prepTime: string;
  servings: string;
  difficulty: 'Fácil' | 'Médio' | 'Difícil';
  category: string;
  imageUrl?: string;
  origin?: string;
}

export type Continent = 'África' | 'Europa' | 'Ásia' | 'América' | 'Oceania' | 'Global';
export type Language = 'pt' | 'en' | 'es' | 'fr';
export type UserPlan = 'Grátis' | 'Premium' | 'Pesquisador';
export type ViewState = 'landing' | 'loading' | 'recipe' | 'cooking' | 'auth' | 'plans' | 'research';

export interface User {
  id: string;
  name: string;
  email: string;
  plan: UserPlan;
  language: Language;
  expiresAt?: string;
}
