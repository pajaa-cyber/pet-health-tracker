import { EventType } from '../types/calendarEvent';

export const EVENT_TYPE_LIST: EventType[] = [
  'medical', 'grooming', 'fitness', 'food', 'potty', 'behaviour', 'symptom', 'other',
];

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  medical: 'Medical',
  grooming: 'Grooming',
  fitness: 'Fitness',
  food: 'Food',
  potty: 'Potty',
  behaviour: 'Behaviour',
  symptom: 'Symptom',
  other: 'Other',
};

export const EVENT_TYPE_EMOJI: Record<EventType, string> = {
  medical: '💊',
  grooming: '✂️',
  fitness: '🏃',
  food: '🍖',
  potty: '🚽',
  behaviour: '🐾',
  symptom: '🤒',
  other: '📌',
};
