import type { IEvent } from '@nestjs/cqrs';

export class AddedReferralCodeEvent implements IEvent {
  constructor(
    public readonly userId: number,
    public readonly parentId: number,
    public readonly refCode: string,
    public readonly addedAt: Date,
  ) {}
}
