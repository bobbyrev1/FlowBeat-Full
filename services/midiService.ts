
import { MidiPattern } from '../types';

export const generateMidiPattern = (pattern: MidiPattern, length: number): number[] => {
  const steps = Array(length).fill(0);

  switch (pattern) {
    case MidiPattern.HiHat:
      for (let i = 0; i < length; i += 2) {
        steps[i] = 1;
      }
      break;
    case MidiPattern.TrapHiHat:
      // Base pattern (e.g., every 8th note)
      for (let i = 0; i < length; i += 2) {
        steps[i] = 1;
      }
      
      // Add random rolls with subdivisions.
      // This will iterate through the steps and randomly replace some with 2, 3, or 4-note rolls.
      for (let i = 0; i < length; i++) {
        // 15% chance to create a roll on a step.
        // This can replace an existing hi-hat hit or fill an empty space.
        if (Math.random() < 0.15) {
          const rollType = Math.random();
          if (rollType < 0.5) { // 50% chance of a 2-roll (16th notes)
            steps[i] = 2;
          } else if (rollType < 0.85) { // 35% chance of a 3-roll (triplets)
            steps[i] = 3;
          } else { // 15% chance of a 4-roll (32nd notes)
            steps[i] = 4;
          }
          
          // To make the pattern breathe, skip the next step after creating a roll.
          i++; 
        }
      }
      break;
    case MidiPattern.Clap:
      for (let i = 4; i < length; i += 8) {
        steps[i] = 1;
      }
      break;
    case MidiPattern.FourOnTheFloor:
      for (let i = 0; i < length; i += 4) {
        steps[i] = 1;
      }
      break;
    case MidiPattern.HalfTimeClap1:
      for (let i = 8; i < length; i += 16) {
        steps[i] = 1;
      }
      break;
    case MidiPattern.HalfTimeClap2:
      [4, 12, 20, 31].forEach(step => {
        if (step < length) steps[step] = 1;
      });
      break;
    case MidiPattern.Erase:
      // The steps array is already initialized with 0s.
      return Array(length).fill(0);
    default:
      break;
  }
  return steps;
};