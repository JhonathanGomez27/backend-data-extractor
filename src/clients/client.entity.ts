import { ModelTypeEntity } from "src/model-types/model-type.entity";
import { ModelEntity } from "src/models/model.entity";
import { Column, Entity, OneToMany, PrimaryGeneratedColumn, Unique } from "typeorm";

@Entity('clients')
@Unique(['name'])
export class ClientEntity {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 255 })
    name: string;

    @Column({ type: 'varchar', length: 500, nullable: true })
    description: string;

    @Column({ type: 'varchar', nullable: true })
    imageUrl: string;

    @Column({ type: 'boolean', default: true })
    isActive: boolean;

    // credenciales para Basic Auth en la API de clientes
    @Column({ unique: true }) basicUsername: string;
    @Column() basicPasswordHash: string;

    @OneToMany(() => ModelEntity, m => m.client) models: ModelEntity[];
    @OneToMany(() => ModelTypeEntity, mt => mt.client) modelTypes: ModelTypeEntity[];

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    createdAt: Date;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updatedAt: Date;
}