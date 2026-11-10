import outputData from '../data/content/notebook-outputs.json'

export type NotebookQuestion = {
  question: string
  options: string[]
  correctIndex: number
  hint: string
  explanations: string[]
}
export type NotebookOutput = {
  feature: string
  type: 'audio' | 'video' | 'pdf' | 'image' | 'quiz' | 'flashcards' | 'table'
  src: string
  prompt: string
  description?: string
  sourceSha256: string
  pages?: string[]
  poster?: string
  captions?: string
  cards?: { question: string; answer: string }[]
  questions?: NotebookQuestion[]
  headers?: string[]
  rows?: string[][]
}

export const notebookOutputs = outputData as Record<string, NotebookOutput>
