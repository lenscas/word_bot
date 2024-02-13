import { create_command } from '../../command';

export const command = create_command('basic test comand', {
    func: async ({}) => {
        return { content: 'Amazing test!' };
    },
    config: (x) => x.toJSON(),
});
