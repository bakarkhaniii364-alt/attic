/**
 * User-specific data structure for personalized tracking
 * Each user has their own scores, streaks, achievements
 */

export const initializeUserScores = (userId) => ({
  [userId]: {
    tictactoe: 0,
    pictionary: 0,
    memory: 0,
    wordle: 0,
    sudoku: 0,
    chess: 0,
    typing: 0,
    couples_quiz: 0,
  }
});

export const initializeUserStreaks = (userId) => ({
  [userId]: {
    lastActiveDate: null,
    currentStreak: 0,
    longestStreak: 0,
  }
});

export const getScoreForUser = (scores, userId, game) => {
  return scores?.[userId]?.[game] || 0;
};

export const getTotalScoreForUser = (scores, userId) => {
  if (!scores?.[userId]) return 0;
  return Object.values(scores[userId]).reduce((sum, val) => sum + (val || 0), 0);
};

export const incrementUserScore = (scores, userId, game, amount = 1) => {
  const newScore = (scores?.[userId]?.[game] || 0) + amount;
  
  try {
      const profile = JSON.parse(localStorage.getItem('user_profile') || '{}');
      // Fire and forget
      submitHighscore(game, 'arcade', newScore, profile?.name || 'Player', userId);
  } catch(e) {}

  return {
    ...scores,
    [userId]: {
      ...scores?.[userId],
      [game]: newScore,
    }
  };
};

export const getStreakForUser = (streaks, userId) => {
  return streaks?.[userId] || { lastActiveDate: null, currentStreak: 0, longestStreak: 0 };
};

export const updateUserStreak = (streaks, userId, today) => {
  const userStreak = getStreakForUser(streaks, userId);
  const lastActive = userStreak.lastActiveDate ? new Date(userStreak.lastActiveDate) : null;
  const todayDate = new Date(today);
  
  // Reset streak if more than 1 day has passed
  const diffTime = lastActive ? todayDate - lastActive : 0;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  let newStreak = userStreak.currentStreak;
  if (diffDays === 1) {
    newStreak = userStreak.currentStreak + 1;
  } else if (diffDays > 1) {
    newStreak = 1;
  }
  
  return {
    ...streaks,
    [userId]: {
      ...userStreak,
      lastActiveDate: today,
      currentStreak: newStreak,
      longestStreak: Math.max(userStreak.longestStreak, newStreak),
    }
  };
};

/**
 * Check if both users were active today (for joint streak)
 */
export const getBothUsersActive = (streaks, userId, partnerId) => {
  const userStreak = getStreakForUser(streaks, userId);
  const partnerStreak = getStreakForUser(streaks, partnerId);
  
  const today = new Date().toDateString();
  const userActive = userStreak.lastActiveDate === today;
  const partnerActive = partnerStreak.lastActiveDate === today;
  
  return { userActive, partnerActive, bothActive: userActive && partnerActive };
};

export const submitHighscore = async (gameId, mode, score, playerName, userId) => {
  try {
     const { supabase } = await import('../lib/supabase.js');
     await supabase.from('highscores').insert([{
         user_id: userId,
         player_name: playerName,
         game_id: gameId,
         mode: mode,
         score: score
     }]);
  } catch(e) { console.error('Failed to submit highscore', e); }
};
