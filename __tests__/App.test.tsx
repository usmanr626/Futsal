import {playerName} from '../src/utils/player';

test('formats player display names', () => {
  expect(
    playerName({
      first_name: 'Usman',
      last_name: 'Rashid',
      username: 'usman_10',
    }),
  ).toBe('Usman Rashid');

  expect(
    playerName({
      first_name: null,
      last_name: null,
      username: 'keeper_one',
    }),
  ).toBe('keeper_one');
});
