import { createContext, useContext } from 'react'
import type { TutorService } from './tutor-service'

export const TutorContext = createContext<TutorService | null>(null)
export function useTutorService() { return useContext(TutorContext) }
