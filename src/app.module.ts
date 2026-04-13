import { Module, ValidationPipe, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { PrismaPg } from '@prisma/adapter-pg';
// import { LoggerModule } from 'nestjs-pino';
import { PrismaModule } from 'nestjs-prisma';

import { AuthModule } from './auth/auth.module.js';
import { UserModule } from './user/index.js';
import { TokenModule } from './token/token.module';
import { RaiseConfigModule } from './raise-config/raise-config.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule.forRootAsync({
      isGlobal: true,
      useFactory: (config: ConfigService) => ({
        prismaOptions: {
          ...config.get('prismaOptions'),
          adapter: new PrismaPg({
            connectionString: config.getOrThrow<string>('DATABASE_URL'),
          }),
        },
      }),
      inject: [ConfigService],
    }),
    
    CqrsModule.forRoot(),
    
    UserModule,
    AuthModule,
    TokenModule,
    RaiseConfigModule,
  ],
})
export class AppModule {}
