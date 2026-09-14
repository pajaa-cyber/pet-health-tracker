import { PetSpecies } from '../types/pet';

// Deliberately curated, not exhaustive — a representative common-breeds list
// per species, not a kennel-club-complete database. See the plan's
// Assumptions section for why. Species with no meaningful "breed" concept
// (reptile, small_rodent as a catch-all category) get an empty list, which
// BreedPicker handles by skipping straight to the free-text row.
export const BREEDS_BY_SPECIES: Partial<Record<PetSpecies, string[]>> = {
  dog: [
    'Beagle', 'Bichon Frise', 'Border Collie', 'Boxer', 'Bulldog', 'Chihuahua',
    'Cocker Spaniel', 'Dachshund', 'Doberman', 'French Bulldog', 'German Shepherd',
    'Golden Retriever', 'Great Dane', 'Labrador Retriever', 'Maltese', 'Pomeranian',
    'Poodle', 'Pug', 'Rottweiler', 'Shih Tzu', 'Siberian Husky', 'Yorkshire Terrier',
  ],
  cat: [
    'Abyssinian', 'American Shorthair', 'Bengal', 'British Shorthair', 'Burmese',
    'Devon Rex', 'Domestic Shorthair', 'Maine Coon', 'Persian', 'Ragdoll',
    'Russian Blue', 'Scottish Fold', 'Siamese', 'Sphynx', 'Turkish Angora',
  ],
  rabbit: ['Dutch', 'Flemish Giant', 'Holland Lop', 'Lionhead', 'Mini Rex', 'Netherland Dwarf'],
  bird: ['Budgerigar', 'Canary', 'Cockatiel', 'Cockatoo', 'Conure', 'Finch', 'Lovebird', 'Parrot'],
  ferret: ['Standard Ferret'],
};
