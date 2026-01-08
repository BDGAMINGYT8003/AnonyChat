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
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`# 🚫 Your Blocked Users\nYou have blocked ${blockedUsers.length} users:`)
        );
        container.addSeparatorComponents(new SeparatorBuilder());

        // Use TextDisplay instead of Section as we don't have accessories
        const listText = blockedUsers.slice(0, 10).map((anonId, i) => `**User ${i + 1}**: \`${anonId.substring(0, 8)}...\``).join("\n");
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(listText));

        if (blockedUsers.length > 10) {
            container.addSeparatorComponents(new SeparatorBuilder());
            container.addTextDisplayComponents(
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

        container.addActionRowComponents(row);

        await interaction.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
            ephemeral: true
        });
    },
};
