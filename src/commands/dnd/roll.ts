import { create_command } from '../../command';
import { DiceRoller } from 'dice-roller-parser';

export const command = create_command('Rolls some dice using the Roll20 dice specification as input.', {
    config: (x) =>
        x
            .addStringOption((x) => x.setName('dice').setDescription('dice string').setName('dice').setRequired(true))
            .toJSON(),
    func: async ({ interaction }) => {
        const roll = interaction.options.getString('dice', true);
        const roller = new DiceRoller();
        const res = roller.roll(roll);
        return {
            content: 'You cast your `' + roll + '` dice and rolled `' + res.value + '`',
        };
    },
});
