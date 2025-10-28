import { ClientEntity } from "src/clients/client.entity";
import { Column, Entity, Index, ManyToOne, PrimaryGeneratedColumn, Unique } from "typeorm";

@Entity('model_types')
@Unique(['name','clientId'])
export class ModelTypeEntity {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Index()
    @Column({ type: 'varchar' })
    name: string;

    @Column({ type: 'varchar', nullable: true })
    description: string;

    // si es null => es global (por defecto). si tiene clientId => es específico del cliente
    @Index()
    @Column({ type: 'uuid', nullable: true })
    clientId: string | null;

    @ManyToOne(() => ClientEntity, c => c.modelTypes, { onDelete: 'CASCADE' })
    client?: ClientEntity | null;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    createdAt: Date;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updatedAt: Date;
}