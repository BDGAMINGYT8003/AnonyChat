const { SlashCommandBuilder } = require('discord.js');
const db = require('../services/database');
const matchmaking = require('../services/matchmaking');
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
        db.endChatSession(session.session_id);

        // Notify partner
        const partnerId = session.user1_id === interaction.user.id ? session.user2_id : session.user1_id;

        try {
            const partner = await interaction.client.users.fetch(partnerId);
            await partner.send({ embeds: [EmbedFactory.createChatEndedEmbed("Partner disconnected.")] });
        } catch (e) {
            // Partner might have blocked bot or left
        }

        await interaction.reply({ embeds: [EmbedFactory.createChatEndedEmbed("You ended the chat.")], ephemeral: true });

        // Ask for feedback? (Optional)
        // await interaction.user.send({ embeds: [EmbedFactory.createFeedbackEmbed()] });
    },
};
