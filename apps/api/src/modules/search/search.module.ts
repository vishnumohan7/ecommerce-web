import { Module } from '@nestjs/common';
import { TOKENS } from '@app/ports';
import { AppConfigService } from '../../common/config/app-config.service';
import { AgeGateTokenService } from '../../common/security/age-gate-token.service';
import { MeilisearchProvider } from './meilisearch.provider';
import { PostgresSearchProvider } from './postgres-search.provider';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { SearchIndexSyncService } from './search-index-sync.service';

@Module({
  controllers: [SearchController],
  providers: [
    PostgresSearchProvider,
    MeilisearchProvider,
    AgeGateTokenService,
    SearchService,
    SearchIndexSyncService,
    {
      provide: TOKENS.Search,
      inject: [AppConfigService, PostgresSearchProvider, MeilisearchProvider],
      useFactory: (
        config: AppConfigService,
        postgres: PostgresSearchProvider,
        meili: MeilisearchProvider,
      ) => (config.values.SEARCH_PROVIDER === 'meilisearch' ? meili : postgres),
    },
  ],
  exports: [SearchService, SearchIndexSyncService, AgeGateTokenService, TOKENS.Search],
})
export class SearchModule {}
