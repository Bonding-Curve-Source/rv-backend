import { Module } from '@nestjs/common';
import { RaiseConfigController } from './raise-config.controller';
import { RaiseConfigService } from './raise-config.service';

@Module({
  controllers: [RaiseConfigController],
  providers: [RaiseConfigService]
})
export class RaiseConfigModule {}
