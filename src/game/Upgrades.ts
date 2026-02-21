import type { Engine } from './Engine';
import type { Weapon } from './Weapons';
import {
  MagicWand,
  Garlic,
  Orbitals,
  Headhunter,
  TailFuse,
  BloodTrail,
  MagnetPulse,
  RicochetArc,
  OrbitalResonance,
  EmergencyShield,
  TimeDilation,
  GreedPact,
  CorpseBloom,
} from './Weapons';

export type UpgradeCtor = new () => Weapon;

export type UpgradeChoice =
  | { type: 'upgrade'; weapon: Weapon; class: UpgradeCtor }
  | { type: 'new'; weapon: Weapon; class: UpgradeCtor }
  | { type: 'recover'; healRatio: number; title: string; description: string };

export const UPGRADE_POOL: UpgradeCtor[] = [
  MagicWand,
  Garlic,
  Orbitals,
  Headhunter,
  TailFuse,
  BloodTrail,
  MagnetPulse,
  RicochetArc,
  OrbitalResonance,
  EmergencyShield,
  TimeDilation,
  GreedPact,
  CorpseBloom,
];

const RECOVER_CHOICE: UpgradeChoice = {
  type: 'recover',
  healRatio: 0.25,
  title: 'Recover',
  description: 'Restore 25% of max HP.',
};

function pickRandom<T>(arr: T[]): T | undefined {
  if (arr.length === 0) return undefined;
  const idx = Math.floor(Math.random() * arr.length);
  return arr.splice(idx, 1)[0];
}

export function createStartingWeapon(): Weapon {
  const Ctor = UPGRADE_POOL.find((candidate) => new candidate().id === 'magic-wand') ?? MagicWand;
  return new Ctor();
}

export function buildLevelUpChoices(engine: Engine, count: number = 3): UpgradeChoice[] {
  const candidates: UpgradeChoice[] = [];

  for (const UpgradeClass of UPGRADE_POOL) {
    const skill = new UpgradeClass();
    const existing = engine.weapons.find((weapon) => weapon.id === skill.id);

    if (existing) {
      if (existing.level < existing.maxLevel) {
        candidates.push({
          type: 'upgrade',
          weapon: existing,
          class: UpgradeClass,
        });
      }
      continue;
    }

    if (!skill.requires || skill.requires(engine)) {
      candidates.push({
        type: 'new',
        weapon: skill,
        class: UpgradeClass,
      });
    }
  }

  const choices: UpgradeChoice[] = [];
  const pool = [...candidates];

  while (choices.length < count && pool.length > 0) {
    const picked = pickRandom(pool);
    if (picked) {
      choices.push(picked);
    }
  }

  while (choices.length < count) {
    choices.push({ ...RECOVER_CHOICE });
  }

  return choices;
}
