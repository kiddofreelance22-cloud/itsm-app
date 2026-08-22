import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { ServiceRequest } from "./request.entity";
import { CatalogVariable } from "../../catalogs/entities/catalog-variable.entity";

@Entity("request_variable_values")
export class RequestVariableValue {
  @PrimaryGeneratedColumn({ name: "value_id" })
  valueId!: number;

  @ManyToOne(() => ServiceRequest, (request) => request.variableValues, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "request_id" })
  request!: ServiceRequest;

  @ManyToOne(() => CatalogVariable, { onDelete: "CASCADE" })
  @JoinColumn({ name: "variable_id" })
  variable!: CatalogVariable;

  @Column({ type: "text", nullable: true })
  value!: string;
}
