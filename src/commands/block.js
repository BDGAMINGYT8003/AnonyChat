const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const db = require('../services/database');
const safety = require('../services/safety');
const EmbedFactory = require('../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('block')
        .setDescription('Block and end chat with current partner'),

    async execute(interaction) {
        const session = db.getActiveSessionForUser(interaction.user.id);

        if (!session) {
            return interaction.reply({
                components: [EmbedFactory.createErrorEmbed("Error", "You are not in an active chat.")],
                flags: MessageFlags.IsComponentsV2,
                ephemeral: true
            });
        }

        const partnerId = session.user1_id === interaction.user.id ? session.user2_id : session.user1_id;

        // Block logic
        safety.emergencyBlockUser(interaction.user.id, partnerId, "User requested block");

        // End session
        db.endChatSession(session.session_id);

        // Notify user
        await interaction.reply({
            components: [EmbedFactory.createSuccessEmbed("Blocked", "User has been blocked and session ended.")],
            flags: MessageFlags.IsComponentsV2,
            ephemeral: true
        });

        // Notify partner (generic message)
        try {
            const partner = await interaction.client.users.fetch(partnerId);
            await partner.send({
                components: [EmbedFactory.createChatEndedEmbed("Partner disconnected.")],
                flags: MessageFlags.IsComponentsV2
            });
        } catch (e) {}
    },
};
