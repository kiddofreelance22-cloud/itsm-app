import { Namespace, Socket } from "socket.io";
import { IncidentsService } from "./incidents.service";
import { SocketAuthService, SocketUser } from "../auth/socket-auth.service";
import { GLOBAL_ROOM, GROUP_QUEUE_ROOM, INCIDENTS_ROOM, IncidentsGateway, IncidentEvent } from "./incidents.gateway";

describe("IncidentsGateway", () => {
  const setup = () => {
    const auth = { authenticate: jest.fn() } as unknown as jest.Mocked<SocketAuthService>;
    const incidents = {
      assertCanAccess: jest.fn(),
      assertCanJoinGroupQueue: jest.fn(),
    } as unknown as jest.Mocked<IncidentsService>;
    const gateway = new IncidentsGateway(auth, incidents);
    const client = {
      id: "socket-1",
      data: { user: { userId: 12, username: "staff", roles: ["IT Agent"] } as SocketUser },
      join: jest.fn(),
      leave: jest.fn(),
      handshake: { auth: {}, headers: {} },
    } as unknown as Socket;
    return { gateway, auth, incidents, client };
  };

  it("rejects unauthenticated socket handshakes", async () => {
    const { gateway, auth } = setup();
    auth.authenticate.mockResolvedValue(null);
    let middleware!: (client: Socket, next: (error?: Error) => void) => void;
    const namespace = { use: jest.fn((fn) => { middleware = fn; }) } as unknown as Namespace;
    gateway.afterInit(namespace);
    const client = { handshake: { auth: {}, headers: {} }, data: {} } as unknown as Socket;
    const error = await new Promise<Error | undefined>((resolve) => middleware(client, resolve));
    expect(error?.message).toBe("Unauthorized");
  });

  it("checks incident access before joining an incident room", async () => {
    const { gateway, incidents, client } = setup();
    await gateway.handleJoinIncident("INC-12", client);
    expect(incidents.assertCanAccess).toHaveBeenCalledWith("INC-12", 12, ["IT Agent"]);
    expect(client.join).toHaveBeenCalledWith(INCIDENTS_ROOM("INC-12"));

    incidents.assertCanAccess.mockRejectedValueOnce(new Error("forbidden"));
    await expect(gateway.handleJoinIncident("INC-13", client)).rejects.toThrow("forbidden");
    expect(client.join).toHaveBeenCalledTimes(1);
  });

  it("validates and authorizes group queue joins", async () => {
    const { gateway, incidents, client } = setup();
    await gateway.handleJoinQueue(5, client);
    expect(incidents.assertCanJoinGroupQueue).toHaveBeenCalledWith(5, 12, ["IT Agent"]);
    expect(client.join).toHaveBeenCalledWith(GROUP_QUEUE_ROOM(5));

    await expect(gateway.handleJoinQueue(0, client)).rejects.toThrow("Invalid assignment group ID");
    incidents.assertCanJoinGroupQueue.mockRejectedValueOnce(new Error("forbidden"));
    await expect(gateway.handleJoinQueue(6, client)).rejects.toThrow("forbidden");
    expect(client.join).toHaveBeenCalledTimes(1);
  });

  it("sends only an incident ID to the authenticated global refresh room", () => {
    const { gateway } = setup();
    const emit = jest.fn();
    gateway.server = { to: jest.fn(() => ({ emit })) } as unknown as Namespace;
    const incident = { incidentId: "INC-12", title: "sensitive title", description: "private details" };
    gateway.emitIncidentCreated(5, incident);
    expect(gateway.server.to).toHaveBeenCalledWith(GROUP_QUEUE_ROOM(5));
    expect(gateway.server.to).toHaveBeenCalledWith(GLOBAL_ROOM);
    expect(emit).toHaveBeenCalledWith(IncidentEvent.INCIDENT_CREATED, { incidentId: "INC-12" });
    expect(emit).not.toHaveBeenCalledWith(IncidentEvent.INCIDENT_CREATED, incident);
  });
});
