import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { VerificationService } from './verification.service';
import { VerifyApplicationVcsRequestDto } from './dtos/verify-application-vcs-request.dto';
import { VerifyApplicationVcsResponseDto } from './dtos/verify-application-vcs-response.dto';
import { AuthGuard } from 'src/auth/auth.guard';

@ApiTags('Verification')
@ApiBearerAuth('access-token')
@Controller('verification')
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Post('verify-vcs')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Verify Application VCS' })
  @ApiBody({
    type: VerifyApplicationVcsRequestDto,
    description: 'The application ID and optional file IDs to verify',
    examples: {
      default: {
        value: {
          applicationId: "1",
          applicationFileIds: ["13", "14"]
        },
      },
      onlyApplicationId: {
        value: {
          applicationId: "1"
        }
      }
    },
  })
  async verifyApplicationVcs(
    @Body() verifyApplicationVcsRequestDto: VerifyApplicationVcsRequestDto
  ): Promise<{
    isSuccess: boolean;
    code: number;
    response: VerifyApplicationVcsResponseDto;
  }> {
    // Pass the whole DTO object to the service
    return this.verificationService.verifyApplicationVcs(verifyApplicationVcsRequestDto);
  }
}
