import type { IEvent } from '@nestjs/cqrs';

export class UserConnectTwitterEvent implements IEvent {
  constructor(
    public readonly userId: number,
    public readonly twitterId: string,
  ) {}
}
