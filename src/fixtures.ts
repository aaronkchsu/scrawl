import type { TeamId } from './types.ts';
// Explicitly synthetic nominations, never presented as real Twitch activity.
export const fixtureRounds: { team: TeamId; name: string; text: string; approach: string }[][] = [
  [
    { team: 'a', name: 'mossboss', text: 'a duck with a sponge beak', approach: 'soak' },
    { team: 'b', name: 'toastghost', text: 'a robot carrying a giant jam jar', approach: 'catch' },
    { team: 'a', name: 'tinywizard', text: 'a frog wearing an enormous sponge backpack', approach: 'soak' },
    { team: 'b', name: 'pixelpigeon', text: 'a cat using a bucket as a helmet', approach: 'catch' },
    { team: 'a', name: 'noodleclub', text: 'a duck on roller skates dragging a sponge', approach: 'soak' },
    { team: 'b', name: 'orbitalbread', text: 'a robot pushing a bucket on wheels', approach: 'catch' },
  ],
  [
    { team: 'a', name: 'mossboss', text: 'a duck with a copper grounding tail touching earth', approach: 'ground' },
    { team: 'b', name: 'toastghost', text: 'a robot holding an enormous mirror', approach: 'reflect' },
    { team: 'a', name: 'tinywizard', text: 'a frog dragging a grounding wire', approach: 'ground' },
    { team: 'b', name: 'pixelpigeon', text: 'a cat with a mirrored disco helmet', approach: 'reflect' },
    { team: 'a', name: 'noodleclub', text: 'a duck on wheels with a trailing copper cable', approach: 'ground' },
    { team: 'b', name: 'orbitalbread', text: 'a robot with a reflective frying pan shield', approach: 'reflect' },
  ],
];
