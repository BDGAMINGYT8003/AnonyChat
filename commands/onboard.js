const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../services/database');
const EmbedFactory = require('../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('onboard')
        .setDescription('Set up your profile for BlindBond'),

    async execute(interaction) {
        // Check if user already exists
        let profile = db.getUserProfile(interaction.user.id);

        if (!profile) {
            // Create new profile
            db.createUserProfile(interaction.user.id);
            profile = db.getUserProfile(interaction.user.id);
        }

        if (profile.is_onboarded) {
            return interaction.reply({
                content: "You are already onboarded! Use `/profile` to view or edit your profile.",
                ephemeral: true
            });
        }

        // Start onboarding wizard (Gender selection)
        await this.sendGenderSelection(interaction);
    },

    async sendGenderSelection(interaction) {
        const row = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('onboard_gender_select')
                    .setPlaceholder('Select your gender...')
                    .addOptions(
                        { label: 'Male', value: 'Male' },
                        { label: 'Female', value: 'Female' },
                        { label: 'Non-binary', value: 'Non-binary' },
                        { label: 'Other', value: 'Other' },
                    ),
            );

        const embed = EmbedFactory.createWelcomeEmbed()
            .setDescription("To get started, please select your gender:");

        if (interaction.replied || interaction.deferred) {
            await interaction.editReply({ embeds: [embed], components: [row] });
        } else {
            await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
        }
    },

    async handleInteraction(interaction) {
        const { customId } = interaction;
        const userId = interaction.user.id;
        let profile = db.getUserProfile(userId);

        if (!profile) {
            return interaction.reply({ content: "Profile not found. Please run `/onboard` again.", ephemeral: true });
        }

        if (customId === 'onboard_gender_select') {
            const gender = interaction.values[0];
            profile.gender = gender;
            db.updateUserProfile(profile);

            // Ask for age via Modal
            const modal = new ModalBuilder()
                .setCustomId('onboard_age_modal')
                .setTitle('Enter Your Age');

            const ageInput = new TextInputBuilder()
                .setCustomId('onboard_age_input')
                .setLabel("Age (13-99)")
                .setStyle(TextInputStyle.Short)
                .setMinLength(2)
                .setMaxLength(2)
                .setRequired(true);

            const firstActionRow = new ActionRowBuilder().addComponents(ageInput);
            modal.addComponents(firstActionRow);

            await interaction.showModal(modal);
        } else if (customId === 'onboard_age_modal') {
            const ageStr = interaction.fields.getTextInputValue('onboard_age_input');
            const age = parseInt(ageStr);

            if (isNaN(age) || age < 13 || age > 99) {
                return interaction.reply({ content: "❌ Invalid age. You must be between 13 and 99.", ephemeral: true });
            }

            profile.age = age;
            db.updateUserProfile(profile);

            // Ask for location via Select
            const row = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('onboard_location_select')
                        .setPlaceholder('Select your region...')
                        .addOptions(
                            { label: 'North America', value: 'North America' },
                            { label: 'South America', value: 'South America' },
                            { label: 'Europe', value: 'Europe' },
                            { label: 'Asia', value: 'Asia' },
                            { label: 'Africa', value: 'Africa' },
                            { label: 'Oceania', value: 'Oceania' },
                        ),
                );

            await interaction.reply({
                content: `✅ Age saved: ${age}. Now select your region:`,
                components: [row],
                ephemeral: true
            });
        } else if (customId === 'onboard_location_select') {
            const location = interaction.values[0];
            profile.location = location;
            db.updateUserProfile(profile);

            // Ask for interested_in
             const row = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('onboard_interested_in_select')
                        .setPlaceholder('Who do you want to chat with?')
                        .addOptions(
                            { label: 'Male', value: 'Male' },
                            { label: 'Female', value: 'Female' },
                            { label: 'Anyone', value: 'Anyone' },
                        ),
                );

            await interaction.update({
                content: `✅ Region saved: ${location}. Who are you interested in chatting with?`,
                components: [row]
            });
        } else if (customId === 'onboard_interested_in_select') {
            const interestedIn = interaction.values[0];
            profile.interested_in = interestedIn;
            db.updateUserProfile(profile);

            // Ask for interests via Modal (comma separated)
             const modal = new ModalBuilder()
                .setCustomId('onboard_interests_modal')
                .setTitle('Your Interests');

            const interestsInput = new TextInputBuilder()
                .setCustomId('onboard_interests_input')
                .setLabel("Interests (comma separated)")
                .setPlaceholder("Gaming, Music, Travel...")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false);

            const firstActionRow = new ActionRowBuilder().addComponents(interestsInput);
            modal.addComponents(firstActionRow);

            await interaction.showModal(modal);
        } else if (customId === 'onboard_interests_modal') {
            const interestsStr = interaction.fields.getTextInputValue('onboard_interests_input');
            const interests = interestsStr.split(',').map(s => s.trim()).filter(s => s.length > 0);

            profile.interests = interests;
            profile.is_onboarded = true; // Complete!
            db.updateUserProfile(profile);

            const embed = EmbedFactory.createSuccessEmbed("Onboarding Complete!", "Your profile has been set up. You can now use `/new` to find a chat partner!");

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
};
