const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const db = require('../services/database');
const EmbedFactory = require('../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unblock')
        .setDescription('Unblock a user by their anonymous ID')
        .addStringOption(option =>
            option.setName('anonymous_id')
                .setDescription('The anonymous ID to unblock')
                .setRequired(true)),

    async execute(interaction) {
        const anonymousId = interaction.options.getString('anonymous_id');
        db.removeBlock(interaction.user.id, anonymousId);

        await interaction.reply({
            components: [EmbedFactory.createSuccessEmbed("Unblocked", `✅ User \`${anonymousId.substring(0, 8)}...\` has been unblocked.`)],
            flags: MessageFlags.IsComponentsV2,
            ephemeral: true
        });
    },
};
