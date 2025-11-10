import { ClientEntity } from 'src/clients/client.entity';
import { ModelTypeEntity } from 'src/model-types/model-type.entity';
import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('models')
export class ModelEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  // Campos genéricos ahora; luego puedes ampliarlos (JSON, metadatos, etc.)
  @Column({ type: 'jsonb', default: {} }) data: Record<string, any>;

  @Index()
  @Column({ type: 'uuid' })
  clientId: string;

  @ManyToOne(() => ClientEntity, (c) => c.models, { onDelete: 'CASCADE' })
  client: ClientEntity;

  @Index()
  @Column({ type: 'uuid' })
  modelTypeId: string;
  @ManyToOne(() => ModelTypeEntity, (mt) => mt.id, { onDelete: 'RESTRICT' })
  modelType: ModelTypeEntity;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;
}
