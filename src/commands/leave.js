const { SlashCommandBuilder, MessageFlags } = require('discord.js');
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
                components: [EmbedFactory.createSuccessEmbed("Queue Left", "You have been removed from the matchmaking queue.")],
                flags: MessageFlags.IsComponentsV2,
                ephemeral: true
            });
        }

        // Check if in session - separate command /end is used for this now
        const session = db.getActiveSessionForUser(interaction.user.id);
        if (session) {
            return interaction.reply({
                components: [EmbedFactory.createInfoEmbed("Active Chat", "You are currently in a chat session. Use `/end` to leave the chat.")],
                flags: MessageFlags.IsComponentsV2,
                ephemeral: true
            });
        }

        return interaction.reply({
            components: [EmbedFactory.createInfoEmbed("Not In Queue", "You are not in the matchmaking queue.")],
            flags: MessageFlags.IsComponentsV2,
            ephemeral: true
        });
    },
};
