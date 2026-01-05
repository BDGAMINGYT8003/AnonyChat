const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
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
                content: "You are not in an active chat.",
                ephemeral: true
            });
        }

        // Check cooldown/limits
        const shareData = db.getShareData(session.session_id, interaction.user.id);

        if (shareData.count >= 2) {
            return interaction.reply({ content: "❌ You have reached the limit of 2 shares per session.", ephemeral: true });
        }

        if (shareData.last_share) {
            const now = new Date();
            const timeDiff = (now - shareData.last_share) / 1000; // seconds
            if (timeDiff < 60) {
                return interaction.reply({ content: `Please wait ${Math.ceil(60 - timeDiff)} seconds before sharing again.`, ephemeral: true });
            }
        }

        // Confirmation
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

        await interaction.reply({
            content: "Are you sure you want to reveal your Discord username to your partner?",
            components: [row],
            ephemeral: true
        });
    },

    async handleInteraction(interaction) {
        const { customId } = interaction;

        if (customId === 'share_cancel') {
            const embed = EmbedFactory.createInfoEmbed("Cancelled", "Username sharing cancelled. Your privacy remains protected.");
            return interaction.update({ content: null, embeds: [embed], components: [] });
        }

        if (customId === 'share_confirm') {
            await interaction.deferUpdate();

            const session = db.getActiveSessionForUser(interaction.user.id);
            if (!session) {
                return interaction.followup({ content: "Chat session not found.", ephemeral: true });
            }

            // Double check limits
             const shareData = db.getShareData(session.session_id, interaction.user.id);
             if (shareData.count >= 2) {
                 return interaction.followup({ content: "❌ Limit reached.", ephemeral: true });
             }

            // Record share
            db.recordUsernameShare(session.session_id, interaction.user.id);

            // Send to partner
            const partnerId = session.user1_id === interaction.user.id ? session.user2_id : session.user1_id;
            try {
                const partner = await interaction.client.users.fetch(partnerId);

                // Formatted exactly as requested
                // Title: ℹ️🤝 Username Shared
                // Content: Your chat partner has shared their Discord username with you:
                // <@User_ID> (`username`)
                //
                // Feel free to send them a friend request!
                // Footer: Today at [timestamp]

                const { EmbedBuilder } = require('discord.js');
                const shareEmbed = new EmbedBuilder()
                    .setTitle("ℹ️🤝 Username Shared")
                    .setDescription(`Your chat partner has shared their Discord username with you:\n<@${interaction.user.id}> (\`${interaction.user.username}\`)\n\nFeel free to send them a friend request!`)
                    .setColor(0x9b59b6) // Info color
                    .setTimestamp();

                await partner.send({ embeds: [shareEmbed] });

                const successEmbed = EmbedFactory.createSuccessEmbed("Username Shared", "✅ Your username has been shared with your chat partner!");
                await interaction.editReply({ content: null, embeds: [successEmbed], components: [] });

            } catch (error) {
                console.error("Share error:", error);
                await interaction.followup({ content: "Failed to deliver username (Partner may have DMs disabled).", ephemeral: true });
            }
        }
    }
};
