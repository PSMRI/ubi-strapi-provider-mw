import { IsArray, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class InitResponseDto {
  @ApiProperty({ 
    description: 'Array of responses containing message data',
    example: [{ context: {}, message: {} }]
  })
  @IsArray()
  @IsNotEmpty()
  responses: any[];

  [key: string]: any;
}
