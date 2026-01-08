const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
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
                components: [EmbedFactory.createInfoEmbed("Already Onboarded", "You are already onboarded! Use `/profile` to view or edit your profile.")],
                flags: MessageFlags.IsComponentsV2,
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

        const container = EmbedFactory.createWelcomeEmbed();
        // createWelcomeEmbed returns a ContainerBuilder.
        // We can create a new container that includes the instruction.
        // Or modify the existing logic in EmbedFactory to include it or just rely on the selection menu context.
        // Let's create a wrapper container or just send the welcome embed.
        // Wait, "To get started..." description.
        // I'll add a TextDisplay to the container.
        const { TextDisplayBuilder } = require('discord.js');
        container.addComponents(new TextDisplayBuilder().setContent("To get started, please select your gender:"));

        if (interaction.replied || interaction.deferred) {
            await interaction.editReply({
                components: [container, row],
                flags: MessageFlags.IsComponentsV2
            });
        } else {
            await interaction.reply({
                components: [container, row],
                flags: MessageFlags.IsComponentsV2,
                ephemeral: true
            });
        }
    },

    async handleInteraction(interaction) {
        const { customId } = interaction;
        const userId = interaction.user.id;
        let profile = db.getUserProfile(userId);

        if (!profile) {
            return interaction.reply({
                components: [EmbedFactory.createErrorEmbed("Error", "Profile not found. Please run `/onboard` again.")],
                flags: MessageFlags.IsComponentsV2,
                ephemeral: true
            });
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
                return interaction.reply({
                    components: [EmbedFactory.createErrorEmbed("Invalid Age", "❌ You must be between 13 and 99.")],
                    flags: MessageFlags.IsComponentsV2,
                    ephemeral: true
                });
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

            const container = EmbedFactory.createSuccessEmbed("Age Saved", `✅ Age saved: ${age}. Now select your region:`);

            await interaction.reply({
                components: [container, row],
                flags: MessageFlags.IsComponentsV2,
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

            const container = EmbedFactory.createSuccessEmbed("Region Saved", `✅ Region saved: ${location}. Who are you interested in chatting with?`);

            await interaction.update({
                components: [container, row],
                flags: MessageFlags.IsComponentsV2
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

            const container = EmbedFactory.createSuccessEmbed("Onboarding Complete!", "Your profile has been set up. You can now use `/new` to find a chat partner!");

            await interaction.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2,
                ephemeral: true
            });
        }
    }
};
