import { AttributeSet } from '../attributes/attributes';

export interface CombatSkill {
  id: string;
  power: number;
  chanNguyenCost: number;
  cooldownRounds: number;
  slot: number;
}

export interface CombatantSnapshot {
  id: 'player' | 'enemy';
  attributes: AttributeSet;
  battlePower: number;
  maxChanNguyen: number;
  skills: CombatSkill[];
}

export interface CombatTurn {
  round: number;
  actor: 'player' | 'enemy';
  target: 'player' | 'enemy';
  action: string;
  damage: number;
  remainingHp: number;
}

export interface BattleResult {
  winner: 'player' | 'enemy' | 'draw';
  turns: CombatTurn[];
  rounds: number;
  playerRemainingHp: number;
  enemyRemainingHp: number;
}
