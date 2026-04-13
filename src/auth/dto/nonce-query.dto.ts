import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEthereumAddress, IsNotEmpty } from 'class-validator';

export class NonceQueryDTO {
  @ApiProperty({
    type: String,
    description: 'Address',
    example: '0x412b26641ed4e28dccccfe8a2d975ee1fa237364c41cb2fe26f684bebe8d66a1',
  })
  @IsNotEmpty()
  @IsEthereumAddress()
  @Transform(({ value }) => value?.toLowerCase())
  walletAddress: string;
}
