export interface Word {
  id: string;
  original: string;
  translation: string;
  learned: boolean;
}

export interface Dictionary {
  id: string;
  name: string;
  words: Word[];
  createdAt: number;
}
