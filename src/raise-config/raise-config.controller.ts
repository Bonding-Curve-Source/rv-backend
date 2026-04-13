import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { RaiseConfigService } from './raise-config.service';

@ApiTags('Raise config')
@Controller('raise-config')
export class RaiseConfigController {
  constructor(private readonly raiseConfigService: RaiseConfigService) {}

  @Get()
  @ApiOperation({
    summary: 'Cấu hình raise (RaiseToken + RaiseValue)',
    description:
      'Trả về danh sách token raise và các mức giá trị raise theo symbol, khớp schema Prisma.',
  })
  getRaiseConfig() {
    return this.raiseConfigService.getRaiseConfig();
  }

  @Get('tokens')
  @ApiOperation({ summary: 'Danh sách RaiseToken' })
  getRaiseTokens() {
    return this.raiseConfigService.findAllRaiseTokens();
  }

  @Get('values')
  @ApiOperation({ summary: 'Danh sách RaiseValue' })
  getRaiseValues() {
    return this.raiseConfigService.findAllRaiseValues();
  }
}
