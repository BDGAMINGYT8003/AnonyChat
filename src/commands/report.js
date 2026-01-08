const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags } = require('discord.js');
const db = require('../services/database');
const safety = require('../services/safety');
const EmbedFactory = require('../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('report')
        .setDescription('Report your current or last chat partner'),

    async execute(interaction) {
        const session = db.getActiveSessionForUser(interaction.user.id);

        if (!session) {
             return interaction.reply({
                components: [EmbedFactory.createErrorEmbed("Error", "You can only report a user during an active chat session.")],
                flags: MessageFlags.IsComponentsV2,
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

    async handleInteraction(interaction) {
        if (interaction.customId === 'report_modal') {
            const reason = interaction.fields.getTextInputValue('report_reason');
            const description = interaction.fields.getTextInputValue('report_description');

            const session = db.getActiveSessionForUser(interaction.user.id);
            if (!session) {
                return interaction.reply({
                    components: [EmbedFactory.createErrorEmbed("Error", "Session ended, report cannot be filed automatically.")],
                    flags: MessageFlags.IsComponentsV2,
                    ephemeral: true
                });
            }

            const partnerId = session.user1_id === interaction.user.id ? session.user2_id : session.user1_id;

            try {
                const reportId = safety.createReport(
                    interaction.user.id,
                    partnerId,
                    reason,
                    description,
                    []
                );

                await interaction.reply({
                    components: [EmbedFactory.createSuccessEmbed("Report Filed", `Thank you for your report. ID: ${reportId}`)],
                    flags: MessageFlags.IsComponentsV2,
                    ephemeral: true
                });

            } catch (error) {
                console.error("Report error:", error);
                await interaction.reply({
                    components: [EmbedFactory.createErrorEmbed("Error", "Failed to file report.")],
                    flags: MessageFlags.IsComponentsV2,
                    ephemeral: true
                });
            }
        }
    }
};
