import React, { useState, useEffect } from 'react';
import { FiCheckCircle, FiCircle, FiArrowRight } from 'react-icons/fi';
import { useTool } from '../services/api';

const LearningPath = ({ subject }) => {
  const [path, setPath] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLearningPath() {
      try {
        setLoading(true);
        const result = await useTool('study_plan', subject);
        // Transform the study plan into a sequential path
        const pathSteps = Object.entries(result.response.plan || {}).map(([key, value]) => ({
          title: key,
          description: value,
          completed: false
        }));
        setPath(pathSteps);
      } catch (error) {
        console.error("Error fetching learning path:", error);
      } finally {
        setLoading(false);
      }
    }

    if (subject) {
      fetchLearningPath();
    }
  }, [subject]);

  const markStepComplete = (index) => {
    setPath(prev => prev.map((step, i) => 
      i === index ? {...step, completed: true} : step
    ));
    setCurrentStep(index + 1);
  };

  // Process subject to ensure it's displayed properly as a string
  let subjectTitle = '';
  if (typeof subject === 'string') {
    subjectTitle = subject;
  } else if (subject && typeof subject === 'object') {
    subjectTitle = subject.toString();
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <h2 className="text-xl font-bold mb-4">Kế hoạch học tập: {subjectTitle}</h2>
      
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {path.map((step, index) => (
            <div 
              key={index} 
              className={`flex items-start p-4 rounded-lg transition-all duration-300 ${
                currentStep === index ? 'bg-blue-900 bg-opacity-30 border border-blue-500' : 
                step.completed ? 'bg-green-900 bg-opacity-20' : 'bg-gray-700'
              }`}
            >
              <div className="mr-3 mt-1">
                {step.completed ? 
                  <FiCheckCircle className="text-green-400 text-xl" /> : 
                  index === currentStep ? 
                    <FiCircle className="text-blue-400 text-xl animate-pulse" /> :
                    <FiCircle className="text-gray-400 text-xl" />
                }
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg">{step.title}</h3>
                <p className="text-gray-300 mt-1">{step.description}</p>
                
                {index === currentStep && !step.completed && (
                  <div className="mt-3 flex justify-end">
                    <button 
                      onClick={() => markStepComplete(index)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center"
                    >
                      Complete <FiArrowRight className="ml-2" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LearningPath;