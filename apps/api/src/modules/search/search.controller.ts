import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public, RequirePermissions } from '../../common/auth/auth.decorators';
import { AgeGateTokenService } from '../../common/security/age-gate-token.service';
import { SearchService } from './search.service';

@ApiTags('Search')
@Controller('api/v1/search')
export class SearchController {
  constructor(
    private readonly searchService: SearchService,
    private readonly ageGate: AgeGateTokenService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Ranked product search with filters, facets, and cursor pagination' })
  search(
    @Query() query: Record<string, unknown>,
    @Req() request: Request,
    @Headers('x-session-id') sessionId?: string,
  ) {
    return this.searchService.search(query, this.allowed(request, sessionId));
  }

  @Public()
  @Get('autocomplete')
  @ApiOperation({ summary: 'Typo-tolerant product autocomplete' })
  autocomplete(
    @Query('q') q: string | undefined,
    @Query('limit') limit: string | undefined,
    @Req() request: Request,
    @Headers('x-session-id') sessionId?: string,
  ) {
    return this.searchService.autocomplete(q, limit, this.allowed(request, sessionId));
  }

  @Get('synonyms') @RequirePermissions('catalog.write') @ApiBearerAuth() listSynonyms() {
    return this.searchService.listSynonyms();
  }
  @Post('synonyms') @RequirePermissions('catalog.write') @ApiBearerAuth() createSynonym(
    @Body() body: unknown,
  ) {
    return this.searchService.createSynonym(body);
  }
  @Patch('synonyms/:id') @RequirePermissions('catalog.write') @ApiBearerAuth() updateSynonym(
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.searchService.updateSynonym(id, body);
  }
  @Delete('synonyms/:id') @RequirePermissions('catalog.write') @ApiBearerAuth() deleteSynonym(
    @Param('id') id: string,
  ) {
    return this.searchService.deleteSynonym(id);
  }

  private allowed(request: Request, sessionId?: string): boolean {
    return this.ageGate.verify(
      (request.cookies?.age_gate as string | undefined) ?? request.header('x-age-gate-token'),
      sessionId,
    );
  }
}
