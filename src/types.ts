export interface Category {
  id: string;
  name: string;
}

export interface Variable {
  symbol: string;
  name: string;
  unit: string;
  defaultValue: number;
}

export interface Formula {
  id: string;
  categoryId: string;
  title: string;
  latex: string;
  /** mathjs 표현식 (계산기용). 비어 있으면 계산기 비활성 */
  expr: string;
  resultSymbol: string;
  resultUnit: string;
  description: string;
  variables: Variable[];
  tags: string[];
  favorite: boolean;
  /** 라이트너 박스 1~5 */
  box: number;
  dueAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface Repo {
  categories(): Promise<Category[]>;
  formulas(): Promise<Formula[]>;
  addCategory(name: string, id?: string): Promise<Category>;
  save(f: Formula): Promise<void>;
  remove(id: string): Promise<void>;
  toggleFavorite(id: string): Promise<void>;
  review(id: string, correct: boolean): Promise<void>;
}
