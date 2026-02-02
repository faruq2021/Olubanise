using Microsoft.AspNetCore.SignalR;

namespace Olubanise.Orchestrator.Hubs;

public class OlubaniseHub : Hub
{
    public async Task JoinUserGroup(Guid userId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, userId.ToString());
    }

    public async Task LeaveUserGroup(Guid userId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, userId.ToString());
    }
}
