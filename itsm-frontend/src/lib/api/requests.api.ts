import { apiFetch } from "./client";
import { ServiceRequest } from "@/types/request";

export interface SubmitRequestDto {
  catalogId: number;
  variableValues: { variableId: number; value: string }[];
}

export const RequestsApi = {
  submit: (body: SubmitRequestDto) =>
    apiFetch<ServiceRequest>("/requests", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  listMine: () => apiFetch<ServiceRequest[]>("/requests/mine"),
  listAll: () => apiFetch<ServiceRequest[]>("/requests"),
  getOne: (id: number) => apiFetch<ServiceRequest>(`/requests/${id}`),
};
