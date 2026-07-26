import { DomainError } from '../errors';
import { RandomSource } from '../ports/RandomSource';
import { BattleResult, CombatSkill, CombatTurn, CombatantSnapshot } from './combat';

interface CombatState {
  snapshot: CombatantSnapshot;
  hp: number;
  chanNguyen: number;
  cooldowns: Map<string, number>;
}

export function activeSkillPower(powerPerLevel: number | null, level: number): number {
  if (powerPerLevel === null) return 0;
  if (!Number.isFinite(powerPerLevel) || powerPerLevel <= 0 || !Number.isInteger(level) || level < 1) {
    throw new DomainError('INVALID_COMBAT_CONFIG', 'active skill power configuration is invalid');
  }
  return powerPerLevel * level;
}

export function simulateBattle(input: {
  player: CombatantSnapshot;
  enemy: CombatantSnapshot;
  random: RandomSource;
  maxTurns: number;
}): BattleResult {
  if (!Number.isInteger(input.maxTurns) || input.maxTurns < 1) {
    throw new DomainError('INVALID_COMBAT_CONFIG', 'maxTurns must be a positive integer');
  }
  const states: Record<'player' | 'enemy', CombatState> = {
    player: createState(input.player),
    enemy: createState(input.enemy),
  };
  const turns: CombatTurn[] = [];
  let rounds = 0;

  for (let round = 1; round <= input.maxTurns; round += 1) {
    rounds = round;
    const order: ('player' | 'enemy')[] = states.player.snapshot.attributes.tocDo >= states.enemy.snapshot.attributes.tocDo
      ? ['player', 'enemy']
      : ['enemy', 'player'];

    for (const actorId of order) {
      const actor = states[actorId];
      const targetId = actorId === 'player' ? 'enemy' : 'player';
      const target = states[targetId];
      if (actor.hp <= 0 || target.hp <= 0) continue;
      turns.push(resolveTurn(actor, target, round, input.random));
      if (target.hp <= 0) {
        return resultFor(targetId === 'player' ? 'enemy' : 'player', turns, rounds, states);
      }
    }

    for (const state of Object.values(states)) {
      for (const [skillId, remaining] of state.cooldowns) {
        if (remaining <= 1) state.cooldowns.delete(skillId);
        else state.cooldowns.set(skillId, remaining - 1);
      }
    }
  }

  return resultFor('draw', turns, rounds, states);
}

function createState(snapshot: CombatantSnapshot): CombatState {
  if (!Number.isFinite(snapshot.attributes.khiHuyet) || snapshot.attributes.khiHuyet <= 0 || snapshot.maxChanNguyen < 0) {
    throw new DomainError('INVALID_COMBAT_CONFIG', `invalid combatant: ${snapshot.id}`);
  }
  return {
    snapshot,
    hp: snapshot.attributes.khiHuyet,
    chanNguyen: snapshot.maxChanNguyen,
    cooldowns: new Map(),
  };
}

function resolveTurn(actor: CombatState, target: CombatState, round: number, random: RandomSource): CombatTurn {
  const skill = selectSkill(actor);
  let action = 'basic-attack';
  let rawDamage = Math.max(actor.snapshot.attributes.congVatLy, actor.snapshot.attributes.congPhep);
  if (skill) {
    action = skill.id;
    actor.chanNguyen -= skill.chanNguyenCost;
    if (skill.cooldownRounds > 0) actor.cooldowns.set(skill.id, skill.cooldownRounds + 1);
    rawDamage = skill.power;
  }

  // A small deterministic variance keeps equal-power combatants from always
  // producing identical damage while preserving the snapshot's balance.
  const variance = 0.9 + Math.min(1, Math.max(0, random.next())) * 0.2;
  const damage = Math.max(1, Math.round(rawDamage * variance - target.snapshot.attributes.phongThu));
  target.hp = Math.max(0, target.hp - damage);
  return { round, actor: actor.snapshot.id, target: target.snapshot.id, action, damage, remainingHp: target.hp };
}

function selectSkill(state: CombatState): CombatSkill | null {
  return [...state.snapshot.skills]
    .sort((a, b) => a.slot - b.slot || a.id.localeCompare(b.id))
    .find((skill) =>
      skill.power > 0 && skill.chanNguyenCost >= 0 && skill.chanNguyenCost <= state.chanNguyen &&
      (state.cooldowns.get(skill.id) ?? 0) === 0,
    ) ?? null;
}

function resultFor(winner: BattleResult['winner'], turns: CombatTurn[], rounds: number, states: Record<'player' | 'enemy', CombatState>): BattleResult {
  return {
    winner,
    turns,
    rounds,
    playerRemainingHp: states.player.hp,
    enemyRemainingHp: states.enemy.hp,
  };
}
