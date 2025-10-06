// Widget Library
const WidgetLibrary = {
    schedule: {
        name: "Schedule Widget",
        description: "Displays daily schedule and events",
        render: function() {
            const events = [
                { time: "9:00 AM", title: "Team Standup", duration: "30 min" },
                { time: "10:00 AM", title: "Product Review", duration: "1 hour" },
                { time: "12:00 PM", title: "Lunch Break", duration: "1 hour" },
                { time: "2:00 PM", title: "Client Meeting", duration: "45 min" },
                { time: "4:00 PM", title: "Design Workshop", duration: "1.5 hours" }
            ];

            return `
                <div style="font-family: Inter, sans-serif;">
                    <h3 style="margin-bottom: 16px;">Today's Schedule</h3>
                    <div style="display: grid; gap: 12px;">
                        ${events.map(event => `
                            <div style="padding: 12px; background: #fafafa; border: 1px solid #e5e5e5; border-radius: 8px;">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <div style="font-weight: 600; margin-bottom: 4px;">${event.title}</div>
                                        <div style="font-size: 12px; color: #666;">${event.time} • ${event.duration}</div>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        },
        getData: function() {
            return [
                { time: "9:00 AM", title: "Team Standup", duration: "30 min" },
                { time: "10:00 AM", title: "Product Review", duration: "1 hour" },
                { time: "12:00 PM", title: "Lunch Break", duration: "1 hour" },
                { time: "2:00 PM", title: "Client Meeting", duration: "45 min" },
                { time: "4:00 PM", title: "Design Workshop", duration: "1.5 hours" }
            ];
        }
    },
    
    onboarding: {
        name: "Onboarding Widget",
        description: "User onboarding checklist",
        render: function() {
            const tasks = [
                { task: "Complete profile", completed: true },
                { task: "Set up 2FA", completed: true },
                { task: "Join team channel", completed: false },
                { task: "Schedule 1:1 with manager", completed: false },
                { task: "Review documentation", completed: false }
            ];

            return `
                <div style="font-family: Inter, sans-serif;">
                    <h3 style="margin-bottom: 16px;">Onboarding Checklist</h3>
                    <div style="display: grid; gap: 8px;">
                        ${tasks.map(item => `
                            <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: #fafafa; border: 1px solid #e5e5e5; border-radius: 8px;">
                                <input type="checkbox" ${item.completed ? 'checked' : ''} style="width: 18px; height: 18px;">
                                <span style="flex: 1; ${item.completed ? 'text-decoration: line-through; color: #999;' : ''}">${item.task}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        },
        getData: function() {
            return [
                { task: "Complete profile", completed: true },
                { task: "Set up 2FA", completed: true },
                { task: "Join team channel", completed: false },
                { task: "Schedule 1:1 with manager", completed: false },
                { task: "Review documentation", completed: false }
            ];
        }
    }
};

