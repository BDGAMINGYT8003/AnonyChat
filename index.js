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
setInterval(async () => {
    try {
        await matchmaking.cleanupStaleEntries();
    } catch (error) {
        console.error('Error in cleanup task:', error);
    }
}, 5 * 60 * 1000); // Every 5 minutes

// Activity monitor (30 min inactivity check)
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
                // Timeout session
                db.endChatSession(session.session_id);

                // Notify users
                try {
                    const user1 = await client.users.fetch(session.user1_id);
                    const user2 = await client.users.fetch(session.user2_id);
                    const embed = EmbedFactory.createChatEndedEmbed("Session timed out due to inactivity.");

                    await user1.send({ embeds: [embed] }).catch(() => {});
                    await user2.send({ embeds: [embed] }).catch(() => {});
                } catch (e) {
                    console.error('Error notifying users of timeout:', e);
                }
            } else if (timeDiff > WARNING_MS && !session.warning_sent) {
                // Send Warning
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
}, 60 * 1000); // Check every minute

// Login
if (!process.env.DISCORD_TOKEN) {
    console.warn("DISCORD_TOKEN is not set in environment variables. Bot will not login.");
} else {
    client.login(process.env.DISCORD_TOKEN);
}
