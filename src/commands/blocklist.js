const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags, TextDisplayBuilder, SectionBuilder, SeparatorBuilder } = require('discord.js');
const db = require('../services/database');
const EmbedFactory = require('../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('blocklist')
        .setDescription('View your blocked users list'),

    async execute(interaction) {
        const blockedUsers = db.getBlockedUsers(interaction.user.id);

        if (blockedUsers.length === 0) {
            return interaction.reply({
                components: [EmbedFactory.createSuccessEmbed("Blocklist", "✅ You haven't blocked any users.")],
                flags: MessageFlags.IsComponentsV2,
                ephemeral: true
            });
        }

        const container = EmbedFactory.createContainer(0xff6b6b);
        container.addComponents(
            new TextDisplayBuilder().setContent(`# 🚫 Your Blocked Users\nYou have blocked ${blockedUsers.length} users:`),
            new SeparatorBuilder()
        );

        const section = new SectionBuilder();
        blockedUsers.slice(0, 10).forEach((anonId, i) => {
            section.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**User ${i + 1}**: \`${anonId.substring(0, 8)}...\``));
        });
        container.addComponents(section);

        if (blockedUsers.length > 10) {
            container.addComponents(
                new SeparatorBuilder(),
                new TextDisplayBuilder().setContent(`*Showing first 10 of ${blockedUsers.length} blocked users*`)
            );
        }

        const options = blockedUsers.slice(0, 25).map((anonId, i) => ({
            label: `User ${i + 1}`,
            value: anonId,
            description: `${anonId.substring(0, 8)}...`
        }));

        const row = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('unblock_select')
                    .setPlaceholder('Select a user to unblock...')
                    .addOptions(options)
            );

        await interaction.reply({
            components: [container, row],
            flags: MessageFlags.IsComponentsV2,
            ephemeral: true
        });
    },
};
