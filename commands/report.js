const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const db = require('../services/database');
const safety = require('../services/safety');
const EmbedFactory = require('../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('report')
        .setDescription('Report your current or last chat partner'),

    async execute(interaction) {
        // We can allow reporting even if session ended recently, but for simplicity, let's start with active session.
        // Or if not active, maybe ask for anonymous ID?
        // The prompt says "current chat partner", so let's stick to active session.

        const session = db.getActiveSessionForUser(interaction.user.id);

        // If no active session, maybe check the last session?
        // For now, strict: Active session only.
        if (!session) {
             return interaction.reply({
                content: "You can only report a user during an active chat session.",
                ephemeral: true
            });
        }

        const modal = new ModalBuilder()
            .setCustomId('report_modal')
            .setTitle('Report User');

        const reasonInput = new TextInputBuilder()
            .setCustomId('report_reason')
            .setLabel("Reason")
            .setPlaceholder("Spam, Harassment, Inappropriate content...")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const descriptionInput = new TextInputBuilder()
            .setCustomId('report_description')
            .setLabel("Description")
            .setPlaceholder("Please provide more details...")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(reasonInput),
            new ActionRowBuilder().addComponents(descriptionInput)
        );

        await interaction.showModal(modal);
    },

    // We need to handle the modal submission.
    // Since interactionCreate calls this command, we need to export a handler or rely on the main event handling.
    // However, modals submit to the interaction, so we need to catch it in interactionCreate.
    // But interactionCreate logic I wrote earlier doesn't auto-route modals to commands unless we structure it.
    // I added `command.handleInteraction` support in interactionCreate.
    // BUT, for slash commands, the modal response is a separate interaction event.
    // The `customId` will be `report_modal`.
    // My `interactionCreate` handles `report_`? No, I need to add it.

    // Let's assume interactionCreate will route `report_modal` here if I add the logic.
    // I will modify interactionCreate.js to route `report_` to this file.

    async handleInteraction(interaction) {
        if (interaction.customId === 'report_modal') {
            const reason = interaction.fields.getTextInputValue('report_reason');
            const description = interaction.fields.getTextInputValue('report_description');

            const session = db.getActiveSessionForUser(interaction.user.id);
            if (!session) {
                return interaction.reply({ content: "Session ended, report cannot be filed automatically.", ephemeral: true });
            }

            const partnerId = session.user1_id === interaction.user.id ? session.user2_id : session.user1_id;

            try {
                const reportId = safety.createReport(
                    interaction.user.id,
                    partnerId,
                    reason,
                    description,
                    [] // Chat history could be fetched if we logged it, but for now empty or we need to implement logging.
                );

                await interaction.reply({
                    embeds: [EmbedFactory.createSuccessEmbed("Report Filed", `Thank you for your report. ID: ${reportId}`)],
                    ephemeral: true
                });

                // Optionally end chat?
                // The requirements say "Emergency Block" ends session, report just files it?
                // Usually report implies safety concern, so maybe offer to end.

            } catch (error) {
                console.error("Report error:", error);
                await interaction.reply({ content: "Failed to file report.", ephemeral: true });
            }
        }
    }
};
