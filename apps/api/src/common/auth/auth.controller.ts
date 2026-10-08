import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TenantContext } from '../tenancy/tenant-context';
import { RateLimits } from '../rate-limit/rate-limit.decorator';
import { AbuseProtected } from '../security/abuse-protection.decorator';
import { Public, RequirePermissions } from './auth.decorators';
import { AuthService } from './auth.service';

@ApiTags('Authentication')
@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Public()
  @AbuseProtected()
  @RateLimits({ name: 'register-ip', limit: 20, windowSeconds: 900, key: 'ip' })
  @Post('register')
  @ApiOperation({ summary: 'Register a customer account' })
  @ApiBody({
    schema: {
      required: ['email', 'password', 'firstName', 'lastName'],
      properties: {
        email: { type: 'string', format: 'email' },
        password: { type: 'string', minLength: 12 },
        firstName: { type: 'string' },
        lastName: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Account created' })
  register(@Body() body: { email: string; password: string; firstName: string; lastName: string }) {
    return this.auth.register(body);
  }
  @Public() @Post('verify-email') @ApiOperation({ summary: 'Verify an email address' }) verifyEmail(
    @Body() body: { token: string },
  ) {
    return this.auth.verifyEmail(body.token);
  }
  @Public()
  @AbuseProtected()
  @RateLimits({ name: 'verification-resend', limit: 3, windowSeconds: 3600, key: 'email' })
  @Post('verify-email/resend')
  @ApiOperation({ summary: 'Resend an email verification link' })
  resendVerification(@Body() body: { email: string }) {
    return this.auth.resendVerification(body.email).then(() => ({ accepted: true }));
  }
  @Public()
  @AbuseProtected()
  @RateLimits(
    { name: 'login-account', limit: 5, windowSeconds: 900, key: 'email' },
    { name: 'login-ip', limit: 20, windowSeconds: 900, key: 'ip' },
  )
  @Post('login')
  @ApiOperation({ summary: 'Create access and refresh tokens' })
  login(@Body() body: { email: string; password: string }) {
    return this.auth.login(body.email, body.password);
  }
  @Public() @Post('refresh') @ApiOperation({ summary: 'Rotate a refresh token' }) refresh(
    @Body() body: { refreshToken: string },
  ) {
    return this.auth.rotate(body.refreshToken);
  }
  @Public() @Post('logout') @ApiOperation({ summary: 'Revoke a refresh-token family' }) logout(
    @Body() body: { refreshToken: string },
  ) {
    return this.auth.revoke(body.refreshToken);
  }
  @Public()
  @AbuseProtected()
  @RateLimits(
    { name: 'otp-hour', limit: 3, windowSeconds: 3600, key: 'phone' },
    { name: 'otp-day', limit: 10, windowSeconds: 86400, key: 'phone' },
  )
  @Post('otp/request')
  @ApiOperation({ summary: 'Request a mobile OTP' })
  requestOtp(@Body() body: { phone: string }) {
    return this.auth.requestOtp(body.phone);
  }
  @Public()
  @AbuseProtected()
  @RateLimits({ name: 'otp-verify', limit: 5, windowSeconds: 600, key: 'challenge' })
  @Post('otp/verify')
  @ApiOperation({ summary: 'Verify a mobile OTP' })
  verifyOtp(@Body() body: { challengeId: string; code: string }) {
    return this.auth.verifyOtp(body.challengeId, body.code);
  }
  @Public()
  @AbuseProtected()
  @RateLimits({ name: 'password-reset', limit: 3, windowSeconds: 3600, key: 'email' })
  @Post('password/forgot')
  @ApiOperation({ summary: 'Request password reset' })
  forgot(@Body() body: { email: string }) {
    return this.auth.createPasswordReset(body.email).then(() => ({ accepted: true }));
  }
  @Public()
  @Post('password/reset')
  @ApiOperation({ summary: 'Reset password with a single-use token' })
  reset(@Body() body: { token: string; password: string }) {
    return this.auth.resetPassword(body.token, body.password);
  }
  @Get('me')
  @RequirePermissions('catalog.read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Return current authentication context' })
  me() {
    return TenantContext.get();
  }
}
