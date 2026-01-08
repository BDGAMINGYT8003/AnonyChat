const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, TextDisplayBuilder, SectionBuilder, SeparatorBuilder } = require('discord.js');
const db = require('../services/database');
const EmbedFactory = require('../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('share')
        .setDescription('Share your username with your chat partner'),

    async execute(interaction) {
        const session = db.getActiveSessionForUser(interaction.user.id);

        if (!session) {
            return interaction.reply({
                components: [EmbedFactory.createErrorEmbed("No Active Chat", "You are not in an active chat.")],
                flags: MessageFlags.IsComponentsV2,
                ephemeral: true
            });
        }

        const shareData = db.getShareData(session.session_id, interaction.user.id);

        if (shareData.count >= 2) {
            return interaction.reply({
                components: [EmbedFactory.createErrorEmbed("Limit Reached", "❌ You have reached the limit of 2 shares per session.")],
                flags: MessageFlags.IsComponentsV2,
                ephemeral: true
            });
        }

        if (shareData.last_share) {
            const now = new Date();
            const timeDiff = (now - shareData.last_share) / 1000; // seconds
            if (timeDiff < 60) {
                return interaction.reply({
                    components: [EmbedFactory.createErrorEmbed("Cooldown", `Please wait ${Math.ceil(60 - timeDiff)} seconds before sharing again.`)],
                    flags: MessageFlags.IsComponentsV2,
                    ephemeral: true
                });
            }
        }

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('share_confirm')
                    .setLabel('Yes, Share')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✅'),
                new ButtonBuilder()
                    .setCustomId('share_cancel')
                    .setLabel('No, Cancel')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('❌')
            );

        const container = EmbedFactory.createContainer(EmbedFactory.WARNING_COLOR);
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent("Are you sure you want to reveal your Discord username to your partner?"));
        container.addActionRowComponents(row);

        await interaction.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
            ephemeral: true
        });
    },

    async handleInteraction(interaction) {
        const { customId } = interaction;

        if (customId === 'share_cancel') {
            const container = EmbedFactory.createInfoEmbed("Cancelled", "Username sharing cancelled. Your privacy remains protected.");
            return interaction.update({ components: [container], flags: MessageFlags.IsComponentsV2 });
        }

        if (customId === 'share_confirm') {
            await interaction.deferUpdate();

            const session = db.getActiveSessionForUser(interaction.user.id);
            if (!session) {
                return interaction.followup({
                    components: [EmbedFactory.createErrorEmbed("Error", "Chat session not found.")],
                    flags: MessageFlags.IsComponentsV2,
                    ephemeral: true
                });
            }

             const shareData = db.getShareData(session.session_id, interaction.user.id);
             if (shareData.count >= 2) {
                 return interaction.followup({
                     components: [EmbedFactory.createErrorEmbed("Limit Reached", "❌ Limit reached.")],
                     flags: MessageFlags.IsComponentsV2,
                     ephemeral: true
                 });
             }

            db.recordUsernameShare(session.session_id, interaction.user.id);

            const partnerId = session.user1_id === interaction.user.id ? session.user2_id : session.user1_id;
            try {
                const partner = await interaction.client.users.fetch(partnerId);

                const shareContainer = EmbedFactory.createContainer(0x9b59b6);
                shareContainer.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent("# ℹ️🤝 Username Shared\nYour chat partner has shared their Discord username with you:")
                );
                shareContainer.addSeparatorComponents(new SeparatorBuilder());
                // Section without accessory is invalid? But user requested specific quote format.
                // "Use a blockquote (>) before the user mention, use double-newline spacing..."
                // I can just use TextDisplay with markdown quote.
                shareContainer.addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`> <@${interaction.user.id}> (\`${interaction.user.username}\`)\n\nFeel free to send them a friend request!`)
                );
                shareContainer.addSeparatorComponents(new SeparatorBuilder());
                shareContainer.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`*Today at ${new Date().toLocaleTimeString()}*`)
                );

                await partner.send({
                    components: [shareContainer],
                    flags: MessageFlags.IsComponentsV2
                });

                const successContainer = EmbedFactory.createSuccessEmbed("Username Shared", "✅ Your username has been shared with your chat partner!");
                await interaction.editReply({ components: [successContainer], flags: MessageFlags.IsComponentsV2 });

            } catch (error) {
                console.error("Share error:", error);
                await interaction.followup({
                    components: [EmbedFactory.createErrorEmbed("Delivery Failed", "Failed to deliver username (Partner may have DMs disabled).")],
                    flags: MessageFlags.IsComponentsV2,
                    ephemeral: true
                });
            }
        }
    }
};
