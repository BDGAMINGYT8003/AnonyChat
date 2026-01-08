const { SlashCommandBuilder, MessageFlags } = require('discord.js');
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
                components: [EmbedFactory.createErrorEmbed("No Active Session", "You are not in an active chat session.")],
                flags: MessageFlags.IsComponentsV2,
                ephemeral: true
            });
        }

        // End session
        const success = await chatService.endChat(interaction.client, session.session_id, "User ended chat via command");

        if (success) {
            await interaction.reply({
                components: [EmbedFactory.createSuccessEmbed("Chat Ended", "✅ Your chat has been ended successfully. Use `/new` when you're ready to find another chat partner!")],
                flags: MessageFlags.IsComponentsV2,
                ephemeral: true
            });
        } else {
            await interaction.reply({
                components: [EmbedFactory.createErrorEmbed("Error", "Could not end chat - session may already be ended.")],
                flags: MessageFlags.IsComponentsV2,
                ephemeral: true
            });
        }
    },
};
