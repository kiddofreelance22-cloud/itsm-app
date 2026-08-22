import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Logger } from "@nestjs/common";

@WebSocketGateway({
  cors: { origin: "*", credentials: false },
  namespace: "/",
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EventsGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /** Agent/user joins a room for a specific incident */
  @SubscribeMessage("join_incident")
  handleJoinIncident(
    @ConnectedSocket() client: Socket,
    @MessageBody() incidentId: string
  ) {
    client.join(`incident:${incidentId}`);
    this.logger.log(`${client.id} joined incident:${incidentId}`);
  }

  @SubscribeMessage("leave_incident")
  handleLeaveIncident(
    @ConnectedSocket() client: Socket,
    @MessageBody() incidentId: string
  ) {
    client.leave(`incident:${incidentId}`);
  }

  /** Join an assignment group room to receive queue updates */
  @SubscribeMessage("join_group_queue")
  handleJoinGroupQueue(
    @ConnectedSocket() client: Socket,
    @MessageBody() groupId: number
  ) {
    client.join(`group:${groupId}`);
    this.logger.log(`${client.id} joined group:${groupId}`);
  }

  @SubscribeMessage("leave_group_queue")
  handleLeaveGroupQueue(
    @ConnectedSocket() client: Socket,
    @MessageBody() groupId: number
  ) {
    client.leave(`group:${groupId}`);
  }

  // ─── Emit helpers (called from services) ───────────────────────────────────

  /** Broadcast a new activity to all viewers of an incident */
  emitActivity(incidentId: string, activity: unknown) {
    this.server.to(`incident:${incidentId}`).emit("activity:new", activity);
  }

  /** Broadcast incident field changes (status, priority, assignedTo, etc.) */
  emitIncidentUpdated(incidentId: string, patch: unknown) {
    this.server.to(`incident:${incidentId}`).emit("incident:updated", patch);
    // Also broadcast to global room so list pages can refresh
    this.server.emit("incident:updated_global", { incidentId, ...patch as object });
  }

  /** Broadcast when an incident is claimed – removes it from group queue */
  emitIncidentClaimed(groupId: number, incidentId: string, claimedBy: unknown) {
    this.server
      .to(`group:${groupId}`)
      .emit("incident:claimed", { incidentId, claimedBy });
    this.server.emit("incident:updated_global", { incidentId, claimed: true });
  }

  /** Broadcast when a new incident is added to a group queue */
  emitIncidentQueued(groupId: number, incident: unknown) {
    this.server.to(`group:${groupId}`).emit("incident:queued", incident);
    this.server.emit("incident:updated_global", { incident });
  }
}
