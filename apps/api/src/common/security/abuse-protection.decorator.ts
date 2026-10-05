import { SetMetadata } from '@nestjs/common';
export const ABUSE_PROTECTED = 'abuse-protected';
export const AbuseProtected = () => SetMetadata(ABUSE_PROTECTED, true);
