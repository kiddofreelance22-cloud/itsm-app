import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Logger } from "@nestjs/common";

export const INCIDENTS_ROOM = (id: string) => `incident:${id}`;
export const GROUP_QUEUE_ROOM = (groupId: number) => `queue:${groupId}`;
export const GLOBAL_ROOM = "incidents:global";

export enum IncidentEvent {
  // Server → Client
  INCIDENT_UPDATED   = "incident:updated",
  ACTIVITY_ADDED     = "incident:activity_added",
  INCIDENT_CLAIMED   = "incident:claimed",
  QUEUE_UPDATED      = "queue:updated",
  INCIDENT_CREATED   = "incident:created",

  // Client → Server
  JOIN_INCIDENT      = "join:incident",
  LEAVE_INCIDENT     = "leave:incident",
  JOIN_QUEUE         = "join:queue",
  LEAVE_QUEUE        = "leave:queue",
}

@WebSocketGateway({
  cors: { origin: "*" },
  namespace: "incidents",
})
export class IncidentsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(IncidentsGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    client.join(GLOBAL_ROOM);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage(IncidentEvent.JOIN_INCIDENT)
  handleJoinIncident(
    @MessageBody() incidentId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.join(INCIDENTS_ROOM(incidentId));
    this.logger.log(`Client ${client.id} joined incident room ${incidentId}`);
  }

  @SubscribeMessage(IncidentEvent.LEAVE_INCIDENT)
  handleLeaveIncident(
    @MessageBody() incidentId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(INCIDENTS_ROOM(incidentId));
  }

  @SubscribeMessage(IncidentEvent.JOIN_QUEUE)
  handleJoinQueue(
    @MessageBody() groupId: number,
    @ConnectedSocket() client: Socket,
  ) {
    client.join(GROUP_QUEUE_ROOM(groupId));
    this.logger.log(`Client ${client.id} watching queue for group ${groupId}`);
  }

  @SubscribeMessage(IncidentEvent.LEAVE_QUEUE)
  handleLeaveQueue(
    @MessageBody() groupId: number,
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(GROUP_QUEUE_ROOM(groupId));
  }

  // ── Emit helpers (called from IncidentsController) ─────────────────────────

  emitIncidentUpdated(incidentId: string, payload: any) {
    this.server.to(INCIDENTS_ROOM(incidentId)).emit(IncidentEvent.INCIDENT_UPDATED, payload);
    this.server.to(GLOBAL_ROOM).emit(IncidentEvent.INCIDENT_UPDATED, payload);
  }

  emitActivityAdded(incidentId: string, activity: any) {
    this.server.to(INCIDENTS_ROOM(incidentId)).emit(IncidentEvent.ACTIVITY_ADDED, activity);
  }

  emitIncidentClaimed(incidentId: string, groupId: number | undefined, payload: any) {
    // Tell all viewers of this incident
    this.server.to(INCIDENTS_ROOM(incidentId)).emit(IncidentEvent.INCIDENT_CLAIMED, payload);
    // Tell all agents watching the group queue — they need to remove this from their list
    if (groupId) {
      this.server.to(GROUP_QUEUE_ROOM(groupId)).emit(IncidentEvent.QUEUE_UPDATED, {
        action: "remove",
        incidentId,
      });
    }
  }

  emitIncidentCreated(groupId: number | undefined, incident: any) {
    // Tell agents watching that group's queue a new incident has arrived
    if (groupId) {
      this.server.to(GROUP_QUEUE_ROOM(groupId)).emit(IncidentEvent.QUEUE_UPDATED, {
        action: "add",
        incident,
      });
    }
    this.server.to(GLOBAL_ROOM).emit(IncidentEvent.INCIDENT_CREATED, incident);
  }

  emitIncidentReleased(incidentId: string, groupId: number | undefined, payload: any) {
    // Tell all viewers of this incident it's back in the queue
    this.server.to(INCIDENTS_ROOM(incidentId)).emit(IncidentEvent.INCIDENT_UPDATED, payload);
    // Tell agents watching the group queue — it needs to reappear in their list
    if (groupId) {
      this.server.to(GROUP_QUEUE_ROOM(groupId)).emit(IncidentEvent.QUEUE_UPDATED, {
        action: "add",
        incident: payload,
      });
    }
  }
}
