const { SlashCommandBuilder } = require('discord.js');
const EmbedFactory = require('../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('privacy')
        .setDescription('View privacy policy and data usage'),

    async execute(interaction) {
        const embed = EmbedFactory.createInfoEmbed("Privacy & Data Policy", "")
            .addFields(
                { name: "What we store:", value: "• Anonymous profile preferences (age, gender, location, interests)\n• Warning counts for safety\n• Block lists (anonymous IDs only)\n• Chat session metadata (no message content)" },
                { name: "What we DON'T store:", value: "• Your Discord username or ID linked to your profile\n• Chat message content (except temporarily for reports)\n• Real names or personal information\n• Message history or logs" },
                { name: "Safety & Reports:", value: "Chat content is only temporarily saved when a report is filed, and only for moderation review. It's deleted after resolution." }
            )
            .setFooter({ text: "Your privacy and safety are our top priorities." });

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};
