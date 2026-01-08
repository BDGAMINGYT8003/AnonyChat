const { SlashCommandBuilder, MessageFlags, SectionBuilder, TextDisplayBuilder, SeparatorBuilder } = require('discord.js');
const EmbedFactory = require('../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('privacy')
        .setDescription('View privacy policy and data usage'),

    async execute(interaction) {
        const container = EmbedFactory.createInfoEmbed("Privacy & Data Policy", "");

        container.addComponents(
             new SectionBuilder().addTextDisplayComponents(
                 new TextDisplayBuilder().setContent("## What we store:\n• Anonymous profile preferences (age, gender, location, interests)\n• Warning counts for safety\n• Block lists (anonymous IDs only)\n• Chat session metadata (no message content)")
             ),
             new SectionBuilder().addTextDisplayComponents(
                 new TextDisplayBuilder().setContent("## What we DON'T store:\n• Your Discord username or ID linked to your profile\n• Chat message content (except temporarily for reports)\n• Real names or personal information\n• Message history or logs")
             ),
             new SectionBuilder().addTextDisplayComponents(
                 new TextDisplayBuilder().setContent("## Safety & Reports:\nChat content is only temporarily saved when a report is filed, and only for moderation review. It's deleted after resolution.")
             ),
             new SeparatorBuilder(),
             new TextDisplayBuilder().setContent("*Your privacy and safety are our top priorities.*")
        );

        await interaction.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
            ephemeral: true
        });
    },
};
