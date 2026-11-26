import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WsException,
} from "@nestjs/websockets";
import { Namespace, Socket } from "socket.io";
import { Logger } from "@nestjs/common";
import { IncidentsService } from "./incidents.service";
import { SocketAuthService, SocketUser } from "../auth/socket-auth.service";

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
  @WebSocketServer() server: Namespace;
  private readonly logger = new Logger(IncidentsGateway.name);

  constructor(
    private readonly auth: SocketAuthService,
    private readonly incidents: IncidentsService,
  ) {}

  afterInit(server: Namespace) {
    server.use((client, next) => {
      const authToken = typeof client.handshake.auth?.token === "string" ? client.handshake.auth.token : "";
      const header = client.handshake.headers.authorization;
      const headerToken = typeof header === "string" && header.startsWith("Bearer ") ? header.slice(7) : "";
      void this.auth.authenticate(authToken || headerToken).then((user) => {
        if (!user) return next(new Error("Unauthorized"));
        client.data.user = user;
        next();
      }).catch((error: unknown) => {
        this.logger.error(`Socket authentication failed: ${error instanceof Error ? error.message : "unknown error"}`);
        next(new Error("Connection authentication failed"));
      });
    });
  }

  handleConnection(client: Socket) {
    const user = client.data.user as SocketUser;
    this.logger.log(`Authenticated client connected: ${client.id} (user ${user.userId})`);
    client.join(GLOBAL_ROOM);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage(IncidentEvent.JOIN_INCIDENT)
  async handleJoinIncident(
    @MessageBody() incidentId: string,
    @ConnectedSocket() client: Socket,
  ) {
    if (typeof incidentId !== "string" || !incidentId.trim()) throw new WsException("Invalid incident ID.");
    const user = client.data.user as SocketUser | undefined;
    if (!user) throw new WsException("Unauthorized.");
    await this.incidents.assertCanAccess(incidentId, user.userId, user.roles);
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
  async handleJoinQueue(
    @MessageBody() groupId: number,
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user as SocketUser | undefined;
    if (!user) throw new WsException("Unauthorized.");
    if (!Number.isSafeInteger(groupId) || groupId <= 0) throw new WsException("Invalid assignment group ID.");
    await this.incidents.assertCanJoinGroupQueue(groupId, user.userId, user.roles);
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
    this.server.to(GLOBAL_ROOM).emit("incident:updated_global", { incidentId });
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
    this.server.to(GLOBAL_ROOM).emit(IncidentEvent.INCIDENT_CREATED, { incidentId: incident.incidentId });
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
