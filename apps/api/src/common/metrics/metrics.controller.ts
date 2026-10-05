import { Controller, Get, Header } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { collectDefaultMetrics, register } from 'prom-client';
import { Public } from '../auth/auth.decorators';
collectDefaultMetrics({ prefix: 'denes_' });
@Controller()
export class MetricsController {
  @Public() @Get('metrics') @Header('content-type', register.contentType) @ApiExcludeEndpoint() metrics(): Promise<string> { return register.metrics(); }
}
