import { IsObject, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class InitResponseDto {
  @ApiProperty({ 
    description: 'Context object containing request context data',
    example: {}
  })
  @IsObject()
  @IsNotEmpty()
  context: any;

  @ApiProperty({
    description: 'Message object containing order and provider data',
    example: {}
  })
  @IsObject()
  @IsNotEmpty()
  message: any;

  [key: string]: any;
}
