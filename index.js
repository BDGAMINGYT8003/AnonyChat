const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');
const fs = require('fs');
const path = require('path');
const db = require('./services/database');
const safety = require('./services/safety');
const matchmaking = require('./services/matchmaking');

// Initialize Client with necessary intents and partials
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.DirectMessageTyping,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel, Partials.Message, Partials.Reaction]
});

// Collections for commands
client.commands = new Collection();

// Load commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    } else {
        console.warn(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

// Load events
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}

// Error handling
client.on('error', error => {
    console.error('Discord Client Error:', error);
});

process.on('unhandledRejection', error => {
    console.error('Unhandled Promise Rejection:', error);
});

// Periodic tasks
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const chatService = require('./services/chat');

// 1. Queue Monitor (Matchmaking + Broaden Search) - Runs every minute
setInterval(async () => {
    try {
        // Broaden Search Prompt
        const readyUsers = await matchmaking.getUsersReadyForBroadening();
        for (const userId of readyUsers) {
            try {
                const user = await client.users.fetch(userId);
                const embed = EmbedFactory.createInfoEmbed(
                    "🔍 Still Searching...",
                    "We haven't found a perfect match yet. Would you like to broaden your search criteria?"
                ).addFields({ name: "Options", value: "• Wait for a better match\n• Broaden search to include other regions/ages\n• Leave queue with `/leave`" });

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('broaden_search').setLabel('Broaden Search').setStyle(ButtonStyle.Primary).setEmoji('🌍'),
                    new ButtonBuilder().setCustomId('broaden_wait').setLabel('Keep Waiting').setStyle(ButtonStyle.Secondary).setEmoji('⏳'),
                    new ButtonBuilder().setCustomId('leave_queue').setLabel('Leave Queue').setStyle(ButtonStyle.Danger).setEmoji('❌')
                );
                await user.send({ embeds: [embed], components: [row] });
            } catch (e) {
                console.error(`Error sending queue update to user ${userId}:`, e);
            }
        }

        // Process Matchmaking Queue
        const matches = await matchmaking.processMatchmakingQueue();
        if (matches && matches.length > 0) {
            for (const match of matches) {
                await chatService.startChatSession(
                    client,
                    match.user1.user_id,
                    match.user2.user_id,
                    match.user1.anonymous_id,
                    match.user2.anonymous_id
                );
            }
        }

    } catch (error) {
        console.error('Error in queue monitor:', error);
    }
}, 60 * 1000);

// 2. Cleanup Stale Entries (Every 5 mins)
setInterval(async () => {
    try {
        await matchmaking.cleanupStaleEntries();
    } catch (error) {
        console.error('Error in cleanup task:', error);
    }
}, 5 * 60 * 1000);

// 3. Activity Monitor (Every minute)
const EmbedFactory = require('./utils/embeds');

setInterval(async () => {
    try {
        const sessions = db.getActiveSessions();
        const now = new Date();
        const TIMEOUT_MS = 30 * 60 * 1000; // 30 mins
        const WARNING_MS = 15 * 60 * 1000; // 15 mins

        for (const session of sessions) {
            const lastActivity = new Date(session.last_activity);
            const timeDiff = now - lastActivity;

            if (timeDiff > TIMEOUT_MS) {
                await chatService.endChat(client, session.session_id, "Session timed out due to inactivity.");
            } else if (timeDiff > WARNING_MS && !session.warning_sent) {
                db.markSessionWarningSent(session.session_id);
                try {
                    const user1 = await client.users.fetch(session.user1_id);
                    const user2 = await client.users.fetch(session.user2_id);
                    const embed = EmbedFactory.createIdleWarningEmbed();
                    await user1.send({ embeds: [embed] }).catch(() => {});
                    await user2.send({ embeds: [embed] }).catch(() => {});
                } catch (e) {
                    console.error('Error sending idle warning:', e);
                }
            }
        }
    } catch (error) {
        console.error('Error in activity monitor:', error);
    }
}, 60 * 1000);

// 4. Status Rotator (Every 5 mins)
const statusMessages = [
    "Connecting hearts anonymously 💕",
    "Use /new to find someone to chat with!",
    "Making new friendships one chat at a time",
    "Your privacy is our priority 🔒",
    "Building bridges through conversation"
];
let statusIndex = 0;

setInterval(async () => {
    if (client.user) {
        client.user.setActivity(statusMessages[statusIndex], { type: 3 }); // Watching
        statusIndex = (statusIndex + 1) % statusMessages.length;
    }
}, 5 * 60 * 1000);

// Login
if (!process.env.DISCORD_TOKEN) {
    console.warn("DISCORD_TOKEN is not set in environment variables. Bot will not login.");
} else {
    client.login(process.env.DISCORD_TOKEN);
}
