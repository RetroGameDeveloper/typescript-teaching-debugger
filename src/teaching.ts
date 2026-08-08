export interface TeachingNote {
  explanation: string;
  title: string;
}

export type TeachingNotes = Record<number, TeachingNote>;
