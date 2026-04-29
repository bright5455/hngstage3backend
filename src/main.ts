import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());
  app.use(helmet());

app.setGlobalPrefix('api/v1');

  app.enableCors({
  origin: '*',
});

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();