import { Entity, Column, PrimaryColumn, CreateDateColumn } from 'typeorm';

@Entity('profiles')
export class Profile {
  @PrimaryColumn()
  id: string;

  @Column({ unique: true })
  name: string;

  @Column()
  gender: string;

  @Column('float')
  gender_probability: number;

  @Column('int')
  age: number;

  @Column()
  age_group: string;

  @Column({ length: 10, nullable: true })
  country_id: string;

  @Column()
  country_name: string;

  @Column('float')
  country_probability: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}