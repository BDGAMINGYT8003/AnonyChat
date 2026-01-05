const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../services/database');
const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('blocklist')
        .setDescription('View your blocked users list'),

    async execute(interaction) {
        const blockedUsers = db.getBlockedUsers(interaction.user.id);

        if (blockedUsers.length === 0) {
            return interaction.reply({ content: "✅ You haven't blocked any users.", ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setTitle("🚫 Your Blocked Users")
            .setDescription(`You have blocked ${blockedUsers.length} users:`)
            .setColor(0xff6b6b);

        blockedUsers.slice(0, 10).forEach((anonId, i) => {
            embed.addFields({ name: `User ${i + 1}`, value: `\`${anonId.substring(0, 8)}...\``, inline: true });
        });

        if (blockedUsers.length > 10) {
            embed.setFooter({ text: `Showing first 10 of ${blockedUsers.length} blocked users` });
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

        await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    },
};
