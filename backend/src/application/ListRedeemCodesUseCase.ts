import { RedeemCodeRepository } from '../domain/ports/RedeemCodeRepository';
import { RedeemCodeRecord } from '../domain/redeem/redeemCode';

export class ListRedeemCodesUseCase {
  constructor(private readonly codes: RedeemCodeRepository) {}
  async execute(): Promise<RedeemCodeRecord[]> {
    return this.codes.listAll();
  }
}
