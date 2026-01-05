const { SlashCommandBuilder } = require('discord.js');
const db = require('../services/database');
const matchmaking = require('../services/matchmaking');
const chatService = require('../services/chat');
const EmbedFactory = require('../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leave')
        .setDescription('End your current chat session'),

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

        // Check if in session
        const session = db.getActiveSessionForUser(interaction.user.id);
        if (!session) {
            return interaction.reply({
                content: "You are not in an active chat or queue.",
                ephemeral: true
            });
        }

        // End session
        await chatService.endChat(interaction.client, session.session_id, "User ended chat via command");

        await interaction.reply({
             embeds: [EmbedFactory.createSuccessEmbed("Chat Ended", "✅ Your chat has been ended successfully. Use `/new` when you're ready to find another chat partner!")],
             ephemeral: true
        });
    },
};
