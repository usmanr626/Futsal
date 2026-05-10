export function validateTeamSelection(
  teamAUserIds: string[],
  teamBUserIds: string[],
) {
  if (!teamAUserIds.length || !teamBUserIds.length) {
    return 'Select at least one player for each team.';
  }

  if (teamAUserIds.length + teamBUserIds.length < 3) {
    return 'Select at least 3 players total.';
  }

  return undefined;
}
