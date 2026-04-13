import { IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTwitterIdDto {
  @ApiProperty({
    type: String,
    description: 'Twitter ID',
    example: '1234567890',
  })
  @IsString()
  twitterId: string;

  @ApiProperty()
  @IsString()
  accessToken: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  image?: string;
}

export class AddRefCodeDto {
  @ApiProperty({
    type: String,
    description: 'Ref code',
    example: '1234567890',
  })
  @IsString()
  refCode: string;
}
