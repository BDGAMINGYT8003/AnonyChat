const { SlashCommandBuilder } = require('discord.js');
const db = require('../services/database');
const chatService = require('../services/chat');
const EmbedFactory = require('../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('end')
        .setDescription('End your current chat session'),

    async execute(interaction) {
        // Check if in session
        const session = db.getActiveSessionForUser(interaction.user.id);
        if (!session) {
            return interaction.reply({
                content: "You are not in an active chat session.",
                ephemeral: true
            });
        }

        // End session
        const success = await chatService.endChat(interaction.client, session.session_id, "User ended chat via command");

        if (success) {
            await interaction.reply({
                embeds: [EmbedFactory.createSuccessEmbed("Chat Ended", "✅ Your chat has been ended successfully. Use `/new` when you're ready to find another chat partner!")],
                ephemeral: true
            });
        } else {
            await interaction.reply({
                content: "❌ Could not end chat - session may already be ended.",
                ephemeral: true
            });
        }
    },
};
