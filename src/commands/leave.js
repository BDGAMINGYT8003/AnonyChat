const { SlashCommandBuilder } = require('discord.js');
const db = require('../services/database');
const matchmaking = require('../services/matchmaking');
const chatService = require('../services/chat');
const EmbedFactory = require('../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leave')
        .setDescription('Leave the matchmaking queue'),

    async execute(interaction) {
        // Check if in queue
        const position = matchmaking.getQueuePosition(interaction.user.id);
        if (position) {
            await matchmaking.removeFromQueue(interaction.user.id);
            return interaction.reply({
                content: "✅ You have been removed from the matchmaking queue.",
                ephemeral: true
            });
        }

        // Check if in session - separate command /end is used for this now
        const session = db.getActiveSessionForUser(interaction.user.id);
        if (session) {
            return interaction.reply({
                content: "You are currently in a chat session. Use `/end` to leave the chat.",
                ephemeral: true
            });
        }

        return interaction.reply({
            content: "You are not in the matchmaking queue.",
            ephemeral: true
        });
    },
};
