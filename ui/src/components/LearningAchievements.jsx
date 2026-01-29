import React, { useState, useEffect } from 'react';
import { FiAward, FiTrendingUp, FiCalendar, FiClock } from 'react-icons/fi';

const achievements = [
  {
    id: 'first_chat',
    title: 'First Conversation',
    description: 'Started your first chat with EduMentor AI',
    icon: <FiAward className="text-yellow-400" />,
    condition: (stats) => stats.totalChats > 0,
    points: 10
  },
  {
    id: 'document_master',
    title: 'Document Master',
    description: 'Uploaded 5 or more learning documents',
    icon: <FiAward className="text-blue-400" />,
    condition: (stats) => stats.documentsUploaded >= 5,
    points: 50
  },
  {
    id: 'quiz_champion',
    title: 'Quiz Champion',
    description: 'Created 10 quizzes to test your knowledge',
    icon: <FiAward className="text-purple-400" />,
    condition: (stats) => stats.quizzesCreated >= 10,
    points: 100
  },
  {
    id: 'study_streak',
    title: 'Study Streak',
    description: 'Used EduMentor for 7 consecutive days',
    icon: <FiCalendar className="text-green-400" />,
    condition: (stats) => stats.streak >= 7,
    points: 70
  },
  {
    id: 'deep_learner',
    title: 'Deep Learner',
    description: 'Spent over 10 hours learning with EduMentor',
    icon: <FiClock className="text-red-400" />,
    condition: (stats) => stats.hoursSpent >= 10,
    points: 150
  }
];

const LearningAchievements = ({ userStats }) => {
  const [earnedAchievements, setEarnedAchievements] = useState([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [newAchievement, setNewAchievement] = useState(null);

  // Sample user stats - in a real app, this would come from your backend
  const defaultStats = {
    totalChats: 5,
    documentsUploaded: 3,
    quizzesCreated: 8,
    streak: 4,
    hoursSpent: 7
  };

  const stats = userStats || defaultStats;

  useEffect(() => {
    // Calculate earned achievements
    const earned = achievements.filter(achievement => achievement.condition(stats));
    
    // Check for newly earned achievements
    const previouslyEarned = earnedAchievements.map(a => a.id);
    const newlyEarned = earned.find(a => !previouslyEarned.includes(a.id));
    
    if (newlyEarned && earnedAchievements.length > 0) {
      setNewAchievement(newlyEarned);
      // Clear notification after 5 seconds
      setTimeout(() => setNewAchievement(null), 5000);
    }
    
    setEarnedAchievements(earned);
    setTotalPoints(earned.reduce((sum, a) => sum + a.points, 0));
  }, [stats]);

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Learning Achievements</h2>
        <div className="bg-yellow-900 bg-opacity-30 px-3 py-1 rounded-full border border-yellow-500">
          <span className="text-yellow-400 font-bold">{totalPoints}</span> points
        </div>
      </div>
      
      {/* Achievement grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {achievements.map(achievement => {
          const isEarned = earnedAchievements.some(a => a.id === achievement.id);
          
          return (
            <div 
              key={achievement.id}
              className={`p-4 rounded-lg border ${
                isEarned 
                  ? 'bg-gray-700 border-green-500' 
                  : 'bg-gray-700 bg-opacity-50 border-gray-600'
              }`}
            >
              <div className="flex items-center">
                <div className={`p-3 rounded-full ${isEarned ? 'bg-green-900 bg-opacity-30' : 'bg-gray-800'}`}>
                  {achievement.icon}
                </div>
                <div className="ml-3">
                  <h3 className={`font-bold ${isEarned ? 'text-white' : 'text-gray-400'}`}>
                    {achievement.title}
                  </h3>
                  <p className="text-sm text-gray-400">{achievement.description}</p>
                </div>
                <div className="ml-auto">
                  <span className={`font-bold ${isEarned ? 'text-yellow-400' : 'text-gray-500'}`}>
                    {achievement.points}
                  </span>
                </div>
              </div>
              
              {!isEarned && (
                <div className="mt-2 w-full bg-gray-800 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full" 
                    style={{ 
                      width: `${Math.min(100, getProgressPercentage(achievement, stats))}%` 
                    }}
                  ></div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* New achievement notification */}
      {newAchievement && (
        <div className="fixed bottom-6 right-6 bg-green-900 bg-opacity-90 border border-green-500 rounded-lg p-4 shadow-lg animate-bounce">
          <div className="flex items-center">
            <div className="p-2 bg-green-800 rounded-full mr-3">
              {newAchievement.icon}
            </div>
            <div>
              <h4 className="font-bold">Achievement Unlocked!</h4>
              <p>{newAchievement.title}</p>
              <p className="text-xs text-green-300">+{newAchievement.points} points</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper function to calculate progress percentage for incomplete achievements
function getProgressPercentage(achievement, stats) {
  switch(achievement.id) {
    case 'document_master':
      return (stats.documentsUploaded / 5) * 100;
    case 'quiz_champion':
      return (stats.quizzesCreated / 10) * 100;
    case 'study_streak':
      return (stats.streak / 7) * 100;
    case 'deep_learner':
      return (stats.hoursSpent / 10) * 100;
    default:
      return 0;
  }
}

export default LearningAchievements;