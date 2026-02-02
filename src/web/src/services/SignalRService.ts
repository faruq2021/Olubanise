import * as signalR from "@microsoft/signalr";

const HUB_URL = (import.meta.env.VITE_API_BASE || "http://localhost:5241") + "/hubs/olubanise";

export class SignalRService {
    private connection: signalR.HubConnection;

    constructor(userId: string) {
        this.connection = new signalR.HubConnectionBuilder()
            .withUrl(HUB_URL)
            .withAutomaticReconnect()
            .build();

        this.start(userId);
    }

    private async start(userId: string) {
        try {
            await this.connection.start();
            console.log("SignalR Connected.");
            await this.connection.invoke("JoinUserGroup", userId);
        } catch (err) {
            console.log("SignalR Connection Error: ", err);
            setTimeout(() => this.start(userId), 5000);
        }
    }

    public onStatusUpdate(callback: (data: { status: string; qr?: string }) => void) {
        this.connection.on("StatusUpdate", callback);
    }

    public onSessionUpdated(callback: (data: { status: string }) => void) {
        this.connection.on("SessionUpdated", callback);
    }

    public disconnect() {
        this.connection.stop();
    }
}
