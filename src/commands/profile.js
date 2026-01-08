const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags, TextDisplayBuilder } = require('discord.js');
const db = require('../services/database');
const EmbedFactory = require('../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('View or edit your BlindBond profile'),

    async execute(interaction) {
        const profile = db.getUserProfile(interaction.user.id);

        if (!profile || !profile.is_onboarded) {
            return interaction.reply({
                components: [EmbedFactory.createInfoEmbed("Profile Missing", "You haven't set up your profile yet. Use `/onboard` to get started!")],
                flags: MessageFlags.IsComponentsV2,
                ephemeral: true
            });
        }

        const container = EmbedFactory.createProfileEmbed(profile, true);

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('profile_edit_gender')
                    .setLabel('Edit Gender')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('profile_edit_age')
                    .setLabel('Edit Age')
                    .setStyle(ButtonStyle.Secondary),
                 new ButtonBuilder()
                    .setCustomId('profile_edit_interests')
                    .setLabel('Edit Interests')
                    .setStyle(ButtonStyle.Secondary),
            );

        // V2: Nest components
        container.addActionRowComponents(row);

        await interaction.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
            ephemeral: true
        });
    },

    async handleInteraction(interaction) {
        const { customId } = interaction;
        const profile = db.getUserProfile(interaction.user.id);

        if (!profile) return;

        if (customId === 'profile_edit_gender') {
             const row = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('profile_update_gender_select')
                        .setPlaceholder('Select your gender...')
                        .addOptions(
                            { label: 'Male', value: 'Male' },
                            { label: 'Female', value: 'Female' },
                            { label: 'Non-binary', value: 'Non-binary' },
                            { label: 'Other', value: 'Other' },
                        ),
                );

            const container = EmbedFactory.createContainer();
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent("Select new gender:"));
            container.addActionRowComponents(row);

            await interaction.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2,
                ephemeral: true
            });

        } else if (customId === 'profile_update_gender_select') {
            profile.gender = interaction.values[0];
            db.updateUserProfile(profile);

            const container = EmbedFactory.createSuccessEmbed("Updated", `✅ Gender updated to: ${profile.gender}`);
            await interaction.update({
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });

        } else if (customId === 'profile_edit_age') {
            const modal = new ModalBuilder()
                .setCustomId('profile_update_age_modal')
                .setTitle('Update Age');

            const ageInput = new TextInputBuilder()
                .setCustomId('profile_age_input')
                .setLabel("Age (13-99)")
                .setStyle(TextInputStyle.Short)
                .setValue(String(profile.age))
                .setMinLength(2)
                .setMaxLength(2)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(ageInput));
            await interaction.showModal(modal);

        } else if (customId === 'profile_update_age_modal') {
            const ageStr = interaction.fields.getTextInputValue('profile_age_input');
            const age = parseInt(ageStr);

            if (isNaN(age) || age < 13 || age > 99) {
                return interaction.reply({
                    components: [EmbedFactory.createErrorEmbed("Invalid Age", "❌ Invalid age.")],
                    flags: MessageFlags.IsComponentsV2,
                    ephemeral: true
                });
            }

            profile.age = age;
            db.updateUserProfile(profile);

            await interaction.reply({
                components: [EmbedFactory.createSuccessEmbed("Updated", `✅ Age updated to: ${age}`)],
                flags: MessageFlags.IsComponentsV2,
                ephemeral: true
            });

        } else if (customId === 'profile_edit_interests') {
             const modal = new ModalBuilder()
                .setCustomId('profile_update_interests_modal')
                .setTitle('Update Interests');

            const interestsInput = new TextInputBuilder()
                .setCustomId('profile_interests_input')
                .setLabel("Interests (comma separated)")
                .setStyle(TextInputStyle.Paragraph)
                .setValue(profile.interests.join(", "))
                .setRequired(false);

            modal.addComponents(new ActionRowBuilder().addComponents(interestsInput));
            await interaction.showModal(modal);
        } else if (customId === 'profile_update_interests_modal') {
            const interestsStr = interaction.fields.getTextInputValue('profile_interests_input');
            const interests = interestsStr.split(',').map(s => s.trim()).filter(s => s.length > 0);

            profile.interests = interests;
            db.updateUserProfile(profile);

            await interaction.reply({
                components: [EmbedFactory.createSuccessEmbed("Updated", "✅ Interests updated.")],
                flags: MessageFlags.IsComponentsV2,
                ephemeral: true
            });
        }
    }
};
