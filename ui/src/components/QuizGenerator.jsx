import { useState, useEffect } from 'react';
import { FiFileText, FiLoader, FiAlertTriangle, FiCheckCircle, FiBarChart, FiSend } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import { submitQuiz } from '../services/api';

const QuizGenerator = ({ onSubmit, result, loading, error }) => {
  const [topic, setTopic] = useState('');
  const [numQuestions, setNumQuestions] = useState('5');
  const [quizData, setQuizData] = useState(null);
  const [userAnswers, setUserAnswers] = useState({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [score, setScore] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const { token } = useAuth();

  // Update internal quiz data state when the result prop changes
  useEffect(() => {
    if (result) {
      console.log('QuizGenerator received result:', result);
      // Chuyển đổi kết quả thành đối tượng nếu nó đang ở dạng chuỗi
      try {
        const parsedQuiz = typeof result === 'string' ? JSON.parse(result) : result;
        setQuizData(parsedQuiz);
        
        // Reset state khi nhận quiz mới
        setUserAnswers({});
        setQuizSubmitted(false);
        setScore(null);
        setSubmitError(null);
      } catch (err) {
        console.error('Error parsing quiz result:', err);
      }
    }
  }, [result]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!topic.trim() || !token) {
      return;
    }
    
    // Gửi yêu cầu tạo quiz với số lượng câu hỏi được chỉ định
    onSubmit({
      topic,
      options: { num_questions: numQuestions }
    });
  };

  const handleAnswerSelect = (questionId, answerIndex) => {
    setUserAnswers(prev => ({
      ...prev,
      [questionId]: answerIndex
    }));
  };

  const calculateScore = () => {
    if (!quizData || !quizData.questions || quizData.questions.length === 0) {
      return 0;
    }

    const totalQuestions = quizData.questions.length;
    let correctAnswers = 0;

    quizData.questions.forEach(question => {
      const userAnswer = userAnswers[question.id];
      if (userAnswer !== undefined && userAnswer === question.correct_answer_index) {
        correctAnswers++;
      }
    });

    return {
      correctAnswers,
      totalQuestions,
      percentage: Math.round((correctAnswers / totalQuestions) * 100)
    };
  };

  const handleQuizSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);

    const scoreData = calculateScore();
    setScore(scoreData);
    setQuizSubmitted(true);

    try {
      // Prepare submission data
      const submissionData = {
        quiz_id: quizData.quiz_id,
        topic: topic,
        total_questions: scoreData.totalQuestions,
        correct_answers: scoreData.correctAnswers,
        score_percentage: scoreData.percentage,
        user_answers: userAnswers
      };

      // Submit to backend if needed
      const response = await submitQuiz(submissionData, token);
      console.log('Quiz submission response:', response);
    } catch (err) {
      console.error('Error submitting quiz:', err);
      setSubmitError('Lỗi khi lưu kết quả bài kiểm tra.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setUserAnswers({});
    setQuizSubmitted(false);
    setScore(null);
    setSubmitError(null);
  };

  const answerOptions = ['A', 'B', 'C', 'D'];

  return (
    <div className="h-full flex flex-col p-4 md:p-6">
      {/* Header Section */}
      <div className="bg-gray-800 rounded-lg p-4 md:p-6 mb-6 shadow-lg">
        <h2 className="text-xl font-bold mb-4 flex items-center text-gray-100">
          <FiFileText className="mr-2 text-blue-400" />
          Tạo bài kiểm tra trắc nghiệm
        </h2>
        <p className="text-gray-300 mb-4 text-sm">
          Nhập chủ đề bạn muốn tạo bài kiểm tra. Hệ thống sẽ tạo các câu hỏi trắc nghiệm dựa trên tài liệu đã được tải lên.
        </p>

        <form onSubmit={handleSubmit} className="mt-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Nhập chủ đề (ví dụ: Neural Networks)"
              className="flex-grow bg-gray-700 text-white rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-500"
              disabled={loading || !token}
            />
            <select
              value={numQuestions}
              onChange={(e) => setNumQuestions(e.target.value)}
              className="bg-gray-700 text-white rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading || !token}
            >
              <option value="3">3 câu hỏi</option>
              <option value="5">5 câu hỏi</option>
              <option value="10">10 câu hỏi</option>
              <option value="15">15 câu hỏi</option>
            </select>
            <button
              type="submit"
              disabled={loading || !topic.trim() || !token}
              className={`bg-blue-600 text-white rounded-md px-5 py-2 flex items-center justify-center transition duration-150 ease-in-out ${loading || !topic.trim() || !token ? 'opacity-60 cursor-not-allowed' : 'hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:ring-offset-gray-800'}`}
            >
              {loading ? (
                <>
                  <FiLoader className="animate-spin mr-2" />
                  Đang tạo...
                </>
              ) : (
                'Tạo bài kiểm tra'
              )}
            </button>
          </div>
          {!token && <p className="text-xs text-yellow-400 mt-2">Bạn cần đăng nhập để sử dụng tính năng này.</p>}
        </form>

        {/* Display generation error */}
        {error && !loading && (
          <div className="mt-4 text-red-400 bg-red-900/30 p-3 rounded-md flex items-center text-sm border border-red-700">
            <FiAlertTriangle className="mr-2 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Quiz Display Area */}
      <div className="flex-1 mt-6 min-h-0 overflow-y-auto bg-gray-700/30 rounded-lg p-4 md:p-6 border border-gray-700">
        {loading ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <FiLoader className="animate-spin mr-2 h-8 w-8" />
            Đang tạo bài kiểm tra...
          </div>
        ) : quizData && quizData.questions ? (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-blue-300 mb-4">
              Bài kiểm tra: {topic}
            </h3>

            {/* Score display after submission */}
            {quizSubmitted && score && (
              <div className={`mb-6 p-4 rounded-lg border ${score.percentage >= 80 ? 'bg-green-900/30 border-green-700' : score.percentage >= 50 ? 'bg-yellow-900/30 border-yellow-700' : 'bg-red-900/30 border-red-700'}`}>
                <h4 className="text-lg font-medium mb-2 flex items-center">
                  <FiBarChart className="mr-2" />
                  Kết quả bài kiểm tra
                </h4>
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <div>
                    <span className="text-gray-300">Số câu đúng:</span>{' '}
                    <span className="font-medium text-white">{score.correctAnswers}/{score.totalQuestions}</span>
                  </div>
                  <div>
                    <span className="text-gray-300">Tỷ lệ đúng:</span>{' '}
                    <span className={`font-medium ${score.percentage >= 80 ? 'text-green-400' : score.percentage >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>{score.percentage}%</span>
                  </div>
                </div>
              </div>
            )}

            {/* Questions List */}
            <div className="space-y-6">
              {quizData.questions.map((question, qIndex) => (
                <div 
                  key={question.id} 
                  className={`bg-gray-800 rounded-lg p-4 border ${
                    quizSubmitted 
                      ? userAnswers[question.id] === question.correct_answer_index
                        ? 'border-green-500'
                        : 'border-red-500'
                      : 'border-gray-700'
                  }`}
                >
                  <h4 className="text-lg font-medium mb-3">
                    <span className="text-blue-400">Câu {qIndex + 1}: </span>
                    {question.question_text}
                  </h4>
                  <div className="space-y-2 mt-2">
                    {question.options.map((option, oIndex) => (
                      <label 
                        key={oIndex} 
                        className={`flex items-center p-3 rounded-md cursor-pointer transition-colors ${
                          quizSubmitted 
                            ? oIndex === question.correct_answer_index
                              ? 'bg-green-700/40 text-green-300'
                              : userAnswers[question.id] === oIndex
                                ? 'bg-red-700/40 text-red-300'
                                : 'bg-gray-700/40'
                            : userAnswers[question.id] === oIndex
                              ? 'bg-blue-700/40 text-blue-300'
                              : 'bg-gray-700/40 hover:bg-gray-600/70'
                        }`}
                      >
                        <input 
                          type="radio" 
                          name={`question-${question.id}`}
                          value={oIndex}
                          checked={userAnswers[question.id] === oIndex}
                          onChange={() => handleAnswerSelect(question.id, oIndex)}
                          disabled={quizSubmitted}
                          className="mr-2"
                        />
                        <span className="mr-2 font-medium">{answerOptions[oIndex]}:</span>
                        <span>{option}</span>
                        {quizSubmitted && oIndex === question.correct_answer_index && (
                          <FiCheckCircle className="ml-auto text-green-400" />
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Submit or Reset Button */}
            <div className="mt-8 flex justify-center">
              {!quizSubmitted ? (
                <button
                  onClick={handleQuizSubmit}
                  disabled={
                    submitting ||
                    Object.keys(userAnswers).length !== quizData.questions.length
                  }
                  className={`bg-blue-600 text-white rounded-md px-6 py-2 flex items-center ${
                    submitting ||
                    Object.keys(userAnswers).length !== quizData.questions.length
                      ? 'opacity-60 cursor-not-allowed'
                      : 'hover:bg-blue-700'
                  }`}
                >
                  {submitting ? (
                    <>
                      <FiLoader className="animate-spin mr-2" />
                      Đang xử lý...
                    </>
                  ) : (
                    <>
                      <FiSend className="mr-2" />
                      Nộp bài
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleReset}
                  className="bg-gray-600 text-white rounded-md px-6 py-2 flex items-center hover:bg-gray-700"
                >
                  Làm lại
                </button>
              )}
            </div>

            {/* Submit Error */}
            {submitError && (
              <div className="mt-4 text-red-400 bg-red-900/30 p-3 rounded-md flex items-center text-sm border border-red-700">
                <FiAlertTriangle className="mr-2 flex-shrink-0" />
                <span>{submitError}</span>
              </div>
            )}
          </div>
        ) : !error ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <FiFileText className="text-5xl opacity-30" />
            <span className="ml-2">Nhập chủ đề và nhấn "Tạo bài kiểm tra" để bắt đầu.</span>
          </div>
        ) : null /* Don't show initial message if there's an error */}
      </div>
    </div>
  );
};

export default QuizGenerator;
