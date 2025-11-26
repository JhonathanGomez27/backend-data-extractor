import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ClientEntity } from 'src/clients/client.entity';

@Entity('extraction_logs')
export class ExtractionLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  clientId: string;

  @ManyToOne(() => ClientEntity, { nullable: false })
  @JoinColumn({ name: 'clientId' })
  client: ClientEntity;

  @Column({ type: 'jsonb', nullable: true })
  modelsUsed: { id: string; name: string; description: string }[];

  @Column({ type: 'int', nullable: true })
  transcriptionSize: number; // Tamaño en caracteres o palabras

  @Column({ type: 'int', nullable: true })
  durationMs: number; // Duración en milisegundos

  @Column({ type: 'varchar', length: 50, default: 'success' })
  status: 'success' | 'error' | 'partial';

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>; // Para información adicional

  @Column({ type: 'jsonb', nullable: true })
  response: Record<string, any>; // Respuesta completa de la extracción

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
