import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ModelTypeEntity } from 'src/model-types/model-type.entity';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const users = app.get(UsersService);
  const ds = app.get<DataSource>(getDataSourceToken());

  // admin
  const adminEmail = process.env.ADMIN_USERNAME ?? 'admin@fh.local';
  const adminPass = process.env.ADMIN_PASSWORD ?? 'changeme123';
  const exists = await users.findByEmail(adminEmail);
  if (!exists) {
    await users.create({
      name: 'Super Admin',
      email: adminEmail,
      password: await bcrypt.hash(adminPass, 12),
    });
    console.log(`Admin creado: ${adminEmail} / ${adminPass}`);
  }

  // tipos globales
  const repo = ds.getRepository(ModelTypeEntity);
  const defaults = [
    'voc_model',
    'intention_model',
    'typification_model',
    'validation_model',
    'ud',
    'sm',
    'Saludo',
    'Info',
    'Comercializacion',
    'Legalizacion',
    'Despedida',
    'user_intention_model',
    'lang',
    'topics',
    'validation_model_mobil',
    'LegalizacionMovil',
    'otro'
  ];
  for (const name of defaults) {
    const found = await repo.findOne({ where: { name, clientId: null } });
    if (!found) await repo.save(repo.create({ name, clientId: null }));
  }

  await app.close();
}
run().catch((e) => {
  console.error(e);
  process.exit(1);
});
