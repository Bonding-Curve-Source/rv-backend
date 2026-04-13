import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEthereumAddress, IsNotEmpty, IsString } from 'class-validator';

export class LoginDTO {
  @ApiProperty({
    type: String,
    description: 'address',
    example: '0x412b26641ed4e28dccccfe8a2d975ee1fa237364c41cb2fe26f684bebe8d66a1',
  })
  @IsNotEmpty()
  @IsEthereumAddress()
  @Transform(({ value }) => value?.toLowerCase())
  walletAddress: string;

  @ApiProperty({ type: String })
  @IsNotEmpty()
  @IsString()
  signature: string;
}
